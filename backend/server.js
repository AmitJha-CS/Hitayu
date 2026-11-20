'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const config = require('./config');
const { getDb, persist, nextId } = require('./db');
const sec = require('./security');

// Initialize DB & upload folder on startup
getDb();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  });
  res.end(body);
}

function sendError(res, status, detail) {
  return sendJson(res, status, { detail });
}

function readRawBody(req, maxBytes = config.MAX_UPLOAD_BYTES + 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject({ status: 413, detail: 'Payload exceeds maximum allowed size.' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => reject({ status: 400, detail: 'Failed to read request body.' }));
  });
}

async function readJson(req) {
  const raw = await readRawBody(req, 1024 * 1024);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw { status: 400, detail: 'Invalid JSON payload.' };
  }
}

function parseMultipartFile(rawBuf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw { status: 400, detail: 'Missing multipart boundary.' };
  const boundary = Buffer.from(`--${m[1] || m[2].trim()}`);
  const start = rawBuf.indexOf(boundary);
  if (start === -1) throw { status: 400, detail: 'Malformed multipart payload.' };
  const headerStart = start + boundary.length + 2;
  const headerEnd = rawBuf.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) throw { status: 400, detail: 'Missing part headers.' };
  const headersText = rawBuf.subarray(headerStart, headerEnd).toString('utf8');
  const fnMatch = /filename="([^"]+)"/i.exec(headersText);
  if (!fnMatch) throw { status: 400, detail: 'No file field found in multipart upload.' };
  const fileStart = headerEnd + 4;
  const nextBoundary = rawBuf.indexOf(boundary, fileStart);
  if (nextBoundary === -1) throw { status: 400, detail: 'Unterminated multipart body.' };
  const content = rawBuf.subarray(fileStart, nextBoundary - 2); // trim trailing \r\n
  return { originalName: path.basename(fnMatch[1]), content };
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `item-${crypto.randomBytes(3).toString('hex')}`;
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone || '',
    bio: u.bio || '',
    isActive: u.isActive,
    wishlist: u.wishlist || [],
    addresses: u.addresses || [],
    createdAt: u.createdAt,
  };
}

function getAuthUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, detail: 'Authentication required.' };
  const payload = sec.verifyToken(auth.slice(7).trim());
  if (!payload) throw { status: 401, detail: 'Invalid or expired token.' };
  const db = getDb();
  const user = db.users.find(u => u.id === Number(payload.sub));
  if (!user || !user.isActive) throw { status: 401, detail: 'Account inactive or not found.' };
  return user;
}

function requireAdmin(req) {
  const u = getAuthUser(req);
  if (u.role !== 'admin') throw { status: 403, detail: 'Admin privileges required.' };
  return u;
}

function requireAuthorOrAdmin(req) {
  const u = getAuthUser(req);
  if (!['admin', 'author'].includes(u.role)) throw { status: 403, detail: 'Author or Admin privileges required.' };
  return u;
}

function getAgentContext(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, detail: 'Agent Bearer API key required.' };
  const raw = auth.slice(7).trim();
  if (!raw.startsWith('ht_agent_')) throw { status: 401, detail: 'Invalid agent API key format.' };
  const hash = sec.hashAgentKey(raw);
  const db = getDb();
  const key = db.agentKeys.find(k => k.keyHash === hash);
  if (!key || !key.isActive) throw { status: 401, detail: 'Revoked or invalid agent API key.' };
  const owner = db.users.find(u => u.id === key.authorUserId && u.isActive);
  if (!owner) throw { status: 401, detail: 'Key owner account is inactive.' };
  key.lastUsedAt = new Date().toISOString();
  persist();
  return { key, scopes: new Set(key.scopes.split(',').map(s => s.trim()).filter(Boolean)) };
}

function saveValidatedMedia(originalName, content, userId) {
  if (!content.length) throw { status: 400, detail: 'Empty file upload.' };
  if (content.length > config.MAX_UPLOAD_BYTES) throw { status: 413, detail: 'File exceeds 10 MB limit.' };
  const ext = path.extname(originalName).toLowerCase();
  const kind = sec.detectMediaKind(ext, content);
  if (!kind) throw { status: 400, detail: 'Invalid file type or magic-byte signature mismatch. Allowed: jpg, png, webp, mp4, webm.' };
  const safeName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dest = path.resolve(config.UPLOAD_DIR, safeName);
  if (!dest.startsWith(path.resolve(config.UPLOAD_DIR) + path.sep)) throw { status: 400, detail: 'Invalid upload path.' };
  fs.writeFileSync(dest, content);
  const db = getDb();
  const asset = {
    id: nextId('media'),
    filename: safeName,
    originalName: sec.sanitizeText(originalName),
    mediaType: kind,
    sizeBytes: content.length,
    url: `/uploads/${safeName}`,
    uploadedByUserId: userId,
    createdAt: new Date().toISOString(),
  };
  db.mediaAssets.push(asset);
  persist();
  return asset;
}

function serveStaticFile(res, baseDir, relPath) {
  const cleanRel = relPath.replace(/^\/+/, '');
  if (cleanRel.includes('..') || cleanRel.includes('\\')) return sendError(res, 400, 'Invalid path.');
  const full = path.resolve(baseDir, cleanRel);
  const resolvedBase = path.resolve(baseDir);
  if (!full.startsWith(resolvedBase + path.sep) && full !== resolvedBase) return sendError(res, 403, 'Forbidden.');
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return sendError(res, 404, 'Not found.');
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  fs.createReadStream(full).pipe(res);
}

async function handleApi(req, res, pathname, urlObj) {
  const db = getDb();
  const method = req.method;

  // --- Health ---
  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', service: 'hitayu-react-node', version: '3.0.0' });
  }

  // --- Shop Profile ---
  if (method === 'GET' && pathname === '/api/shop/profile') {
    return sendJson(res, 200, { shop: db.shopProfile });
  }
  if (method === 'PUT' && pathname === '/api/admin/shop/profile') {
    requireAdmin(req);
    const body = await readJson(req);
    const s = db.shopProfile;
    if (body.name !== undefined) s.name = sec.sanitizeText(body.name) || s.name;
    if (body.tagline !== undefined) s.tagline = sec.sanitizeText(body.tagline);
    if (body.gstin !== undefined) s.gstin = sec.sanitizeText(body.gstin);
    if (body.supportEmail !== undefined) s.supportEmail = sec.sanitizeText(body.supportEmail);
    if (body.supportPhone !== undefined) s.supportPhone = sec.sanitizeText(body.supportPhone);
    if (body.warehouseAddress !== undefined) s.warehouseAddress = sec.sanitizeText(body.warehouseAddress);
    if (body.returnPolicy !== undefined) s.returnPolicy = sec.sanitizeText(body.returnPolicy);
    if (body.gstRatePercent !== undefined) {
      const g = Number(body.gstRatePercent);
      if (Number.isNaN(g) || g < 0 || g > 28) throw { status: 400, detail: 'GST rate must be between 0 and 28%.' };
      s.gstRatePercent = g;
    }
    if (body.freeShippingThreshold !== undefined) s.freeShippingThreshold = Math.max(0, Number(body.freeShippingThreshold) || 0);
    if (body.standardShippingFee !== undefined) s.standardShippingFee = Math.max(0, Number(body.standardShippingFee) || 0);
    if (body.codFee !== undefined) s.codFee = Math.max(0, Number(body.codFee) || 0);
    s.updatedAt = new Date().toISOString();
    persist();
    return sendJson(res, 200, { shop: s });
  }

  // --- Auth ---
  if (method === 'POST' && pathname === '/api/auth/register') {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!sec.authRateLimiter.allow(`reg:${ip}`)) throw { status: 429, detail: 'Too many requests.' };
    const body = await readJson(req);
    const name = sec.sanitizeText(body.name || '');
    const email = String(body.email || '').trim().toLowerCase();
    const pwErr = sec.validatePasswordStrength(body.password);
    if (name.length < 2) throw { status: 400, detail: 'Name must be at least 2 characters.' };
    if (!email.includes('@') || !email.split('@')[1].includes('.')) throw { status: 400, detail: 'Invalid email address.' };
    if (pwErr) throw { status: 400, detail: pwErr };
    if (db.users.some(u => u.email === email)) throw { status: 409, detail: 'Email already registered.' };
    const user = {
      id: nextId('users'),
      name,
      email,
      passwordHash: sec.hashPassword(body.password),
      role: 'customer',
      phone: sec.sanitizeText(body.phone || ''),
      bio: '',
      isActive: true,
      wishlist: [],
      addresses: [],
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    persist();
    return sendJson(res, 201, { token: sec.createToken(user), user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    if (!sec.authRateLimiter.allow(`login:${ip}`)) throw { status: 429, detail: 'Too many login attempts. Please wait.' };
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === email);
    if (!user || !user.isActive || !sec.verifyPassword(String(body.password || ''), user.passwordHash)) {
      throw { status: 401, detail: 'Invalid email or password.' };
    }
    return sendJson(res, 200, { token: sec.createToken(user), user: publicUser(user) });
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    const u = getAuthUser(req);
    return sendJson(res, 200, { user: publicUser(u) });
  }

  // --- User Profile, Password, Wishlist & Address Book ---
  if (method === 'PUT' && pathname === '/api/profile') {
    const u = getAuthUser(req);
    const body = await readJson(req);
    if (body.name !== undefined) {
      const n = sec.sanitizeText(body.name);
      if (n.length < 2) throw { status: 400, detail: 'Name too short.' };
      u.name = n;
    }
    if (body.phone !== undefined) u.phone = sec.sanitizeText(body.phone);
    if (body.bio !== undefined) u.bio = sec.sanitizeText(body.bio);
    if (body.newPassword) {
      if (!sec.verifyPassword(String(body.currentPassword || ''), u.passwordHash)) {
        throw { status: 400, detail: 'Current password is incorrect.' };
      }
      const pwErr = sec.validatePasswordStrength(body.newPassword);
      if (pwErr) throw { status: 400, detail: pwErr };
      u.passwordHash = sec.hashPassword(body.newPassword);
    }
    persist();
    return sendJson(res, 200, { user: publicUser(u) });
  }

  if (method === 'POST' && pathname === '/api/profile/addresses') {
    const u = getAuthUser(req);
    const body = await readJson(req);
    const recipient = sec.sanitizeText(body.recipient || u.name);
    const phone = sec.sanitizeText(body.phone || u.phone);
    const line1 = sec.sanitizeText(body.line1 || '');
    const city = sec.sanitizeText(body.city || '');
    const state = sec.sanitizeText(body.state || '');
    const pincode = sec.sanitizeText(body.pincode || '');
    if (line1.length < 5 || !city || !pincode) throw { status: 400, detail: 'Address line, city, and pincode are required.' };
    u.addresses = u.addresses || [];
    if (body.isDefault) u.addresses.forEach(a => (a.isDefault = false));
    const addr = {
      id: nextId('addresses'),
      label: sec.sanitizeText(body.label || 'Home'),
      recipient,
      phone,
      line1,
      city,
      state,
      pincode,
      isDefault: Boolean(body.isDefault || u.addresses.length === 0),
    };
    u.addresses.push(addr);
    persist();
    return sendJson(res, 201, { address: addr, addresses: u.addresses });
  }

  const addrDelMatch = /^\/api\/profile\/addresses\/(\d+)$/.exec(pathname);
  if (method === 'DELETE' && addrDelMatch) {
    const u = getAuthUser(req);
    const aid = Number(addrDelMatch[1]);
    u.addresses = (u.addresses || []).filter(a => a.id !== aid);
    persist();
    return sendJson(res, 200, { addresses: u.addresses });
  }

  const wishMatch = /^\/api\/profile\/wishlist\/(\d+)$/.exec(pathname);
  if (method === 'POST' && wishMatch) {
    const u = getAuthUser(req);
    const pid = Number(wishMatch[1]);
    u.wishlist = u.wishlist || [];
    if (u.wishlist.includes(pid)) u.wishlist = u.wishlist.filter(id => id !== pid);
    else u.wishlist.push(pid);
    persist();
    return sendJson(res, 200, { wishlist: u.wishlist });
  }

  // --- Products (Public & Admin Item Adding/Editing) ---
  if (method === 'GET' && pathname === '/api/products') {
    const cat = urlObj.searchParams.get('category');
    const q = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
    const list = db.products
      .filter(p => p.isActive)
      .filter(p => !cat || cat === 'All' || p.category === cat)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .map(p => {
        const revs = db.reviews.filter(r => r.productId === p.id);
        const avg = revs.length ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / revs.length) * 10) / 10 : 0;
        return { ...p, reviewCount: revs.length, avgRating: avg };
      });
    return sendJson(res, 200, { products: list });
  }

  const prodMatch = /^\/api\/products\/(\d+)$/.exec(pathname);
  if (method === 'GET' && prodMatch) {
    const pid = Number(prodMatch[1]);
    const p = db.products.find(x => x.id === pid && x.isActive);
    if (!p) throw { status: 404, detail: 'Product not found.' };
    const reviews = db.reviews.filter(r => r.productId === pid).reverse();
    return sendJson(res, 200, { product: p, reviews });
  }

  const revMatch = /^\/api\/products\/(\d+)\/reviews$/.exec(pathname);
  if (method === 'POST' && revMatch) {
    const u = getAuthUser(req);
    const pid = Number(revMatch[1]);
    const p = db.products.find(x => x.id === pid && x.isActive);
    if (!p) throw { status: 404, detail: 'Product not found.' };
    const body = await readJson(req);
    const rating = Number(body.rating);
    const comment = sec.sanitizeText(body.comment || '');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw { status: 400, detail: 'Rating must be 1 to 5.' };
    if (comment.length < 3) throw { status: 400, detail: 'Comment must be at least 3 characters.' };
    const review = { id: nextId('reviews'), productId: pid, userId: u.id, authorName: u.name, rating, comment, createdAt: new Date().toISOString() };
    db.reviews.push(review);
    persist();
    return sendJson(res, 201, { review });
  }

  if (method === 'POST' && pathname === '/api/admin/products') {
    requireAdmin(req);
    const body = await readJson(req);
    const price = Number(body.price);
    const mrp = Number(body.mrp || price);
    const stock = Number(body.stock);
    if (!body.name || !body.sku || !body.category) throw { status: 400, detail: 'Name, SKU, and category are required.' };
    if (!(price > 0) || mrp < price) throw { status: 400, detail: 'Price must be > 0 and MRP >= price.' };
    if (!Number.isInteger(stock) || stock < 0) throw { status: 400, detail: 'Stock must be a non-negative integer.' };
    if (!sec.isSafeMediaUrl(body.imageUrl || '/images/hero.jpg')) throw { status: 400, detail: 'Unsafe image URL.' };
    const sku = sec.sanitizeText(body.sku).toUpperCase();
    if (db.products.some(p => p.sku === sku)) throw { status: 409, detail: 'SKU already exists.' };
    const prod = {
      id: nextId('products'),
      sku,
      name: sec.sanitizeText(body.name),
      slug: `${slugify(body.name)}-${crypto.randomBytes(2).toString('hex')}`,
      category: sec.sanitizeText(body.category),
      price,
      mrp,
      size: sec.sanitizeText(body.size || '100 g'),
      stock,
      imageUrl: String(body.imageUrl || '/images/hero.jpg').trim(),
      tagline: sec.sanitizeText(body.tagline || 'Organic Hitayu formulation.'),
      ingredients: sec.sanitizeText(body.ingredients || '100% Organic Botanicals.'),
      ritual: sec.sanitizeText(body.ritual || 'Use daily as directed.'),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.products.push(prod);
    persist();
    return sendJson(res, 201, { product: prod });
  }

  const adminProdMatch = /^\/api\/admin\/products\/(\d+)$/.exec(pathname);
  if (method === 'PATCH' && adminProdMatch) {
    requireAdmin(req);
    const pid = Number(adminProdMatch[1]);
    const p = db.products.find(x => x.id === pid);
    if (!p) throw { status: 404, detail: 'Product not found.' };
    const body = await readJson(req);
    if (body.price !== undefined) {
      const pr = Number(body.price);
      if (!(pr > 0)) throw { status: 400, detail: 'Price must be > 0.' };
      p.price = pr;
      if (p.mrp < pr) p.mrp = pr;
    }
    if (body.mrp !== undefined) {
      const m = Number(body.mrp);
      if (m < p.price) throw { status: 400, detail: 'MRP must be >= price.' };
      p.mrp = m;
    }
    if (body.stock !== undefined) {
      const st = Number(body.stock);
      if (!Number.isInteger(st) || st < 0) throw { status: 400, detail: 'Invalid stock.' };
      p.stock = st;
    }
    if (body.isActive !== undefined) p.isActive = Boolean(body.isActive);
    persist();
    return sendJson(res, 200, { product: p });
  }

  // --- Coupons ---
  const couponMatch = /^\/api\/coupons\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (method === 'GET' && couponMatch) {
    const code = couponMatch[1].toUpperCase();
    const c = db.coupons.find(x => x.code === code && x.isActive);
    if (!c) throw { status: 404, detail: 'Invalid or expired coupon code.' };
    return sendJson(res, 200, { coupon: c });
  }

  // --- Payment, Order Placement & Tracking ---
  if (method === 'POST' && pathname === '/api/orders/checkout') {
    const u = getAuthUser(req);
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length || items.length > 30) throw { status: 422, detail: 'Order must include 1 to 30 items.' };
    const customerName = sec.sanitizeText(body.customerName || u.name);
    const shippingAddress = sec.sanitizeText(body.shippingAddress || '');
    const phone = sec.sanitizeText(body.phone || u.phone);
    const paymentMethod = String(body.paymentMethod || 'UPI').toUpperCase();
    if (!['UPI', 'CARD', 'COD'].includes(paymentMethod)) throw { status: 400, detail: 'Invalid payment method.' };
    if (shippingAddress.length < 10) throw { status: 400, detail: 'Please provide a complete shipping address.' };

    // Payment validation (UPI / Card / COD)
    const paymentDetails = body.paymentDetails || {};
    let paymentStatus = 'paid';
    let paymentRef = `PAY_HT_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    if (paymentMethod === 'UPI') {
      const upiId = String(paymentDetails.upiId || '').trim();
      if (!upiId.includes('@') || upiId.length < 5) throw { status: 400, detail: 'Please enter a valid UPI ID (e.g. name@upi).' };
    } else if (paymentMethod === 'CARD') {
      const digits = String(paymentDetails.cardNumber || '').replace(/\D/g, '');
      if (digits.length < 12 || digits.length > 19) throw { status: 400, detail: 'Please enter a valid card number.' };
    } else if (paymentMethod === 'COD') {
      paymentStatus = 'pending_cod';
    }

    // Aggregate quantities to prevent duplicate line bypass
    const qtyMap = new Map();
    for (const it of items) {
      const pid = Number(it.productId);
      const qty = Number(it.quantity);
      if (!Number.isInteger(pid) || pid < 1 || !Number.isInteger(qty) || qty < 1 || qty > 25) {
        throw { status: 422, detail: 'Each item must have a valid productId and quantity (1-25).' };
      }
      qtyMap.set(pid, (qtyMap.get(pid) || 0) + qty);
    }

    // Verify stock BEFORE mutating any product
    const lineItems = [];
    let subtotal = 0;
    for (const [pid, qty] of qtyMap.entries()) {
      const p = db.products.find(x => x.id === pid && x.isActive);
      if (!p) throw { status: 404, detail: `Product #${pid} not found.` };
      if (p.stock < qty) throw { status: 409, detail: `Insufficient stock for ${p.name} (available: ${p.stock}).` };
      subtotal += p.price * qty;
      lineItems.push({ productId: p.id, sku: p.sku, name: p.name, unitPrice: p.price, quantity: qty, imageUrl: p.imageUrl });
    }

    // Coupon calculation
    let discountAmount = 0;
    let appliedCoupon = '';
    const rawCoupon = String(body.couponCode || '').trim().toUpperCase();
    if (rawCoupon) {
      const c = db.coupons.find(x => x.code === rawCoupon && x.isActive);
      if (!c) throw { status: 400, detail: 'Invalid coupon code.' };
      if (subtotal < c.minOrderAmount) throw { status: 400, detail: `Coupon ${c.code} requires minimum ₹${c.minOrderAmount}.` };
      discountAmount = Math.round(subtotal * (c.discountPercent / 100) * 100) / 100;
      appliedCoupon = c.code;
    }

    // Deduct stock atomically
    for (const [pid, qty] of qtyMap.entries()) {
      const p = db.products.find(x => x.id === pid);
      p.stock -= qty;
    }

    const shop = db.shopProfile;
    const taxable = Math.max(0, subtotal - discountAmount);
    const gstAmount = Math.round(taxable * (shop.gstRatePercent / 100) * 100) / 100;
    const shippingFee = taxable >= shop.freeShippingThreshold ? 0 : shop.standardShippingFee;
    const codFee = paymentMethod === 'COD' ? shop.codFee : 0;
    const totalAmount = Math.round((taxable + gstAmount + shippingFee + codFee) * 100) / 100;
    const now = new Date().toISOString();

    const order = {
      id: nextId('orders'),
      orderNumber: `HT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId: u.id,
      customerName,
      shippingAddress,
      phone,
      paymentMethod,
      paymentStatus,
      paymentRef,
      couponCode: appliedCoupon,
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount,
      gstAmount,
      shippingFee,
      codFee,
      totalAmount,
      status: 'confirmed',
      courierName: 'Hitayu Express / Delhivery',
      trackingNumber: `TRK${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      timeline: [
        { status: 'placed', label: 'Order Placed', timestamp: now, note: `Payment via ${paymentMethod} (${paymentRef})` },
        { status: 'confirmed', label: 'Order Confirmed', timestamp: now, note: 'Verified by Hitayu fulfillment desk' },
      ],
      items: lineItems,
      createdAt: now,
    };
    db.orders.push(order);
    persist();
    return sendJson(res, 201, { order });
  }

  if (method === 'GET' && pathname === '/api/orders/my') {
    const u = getAuthUser(req);
    const orders = db.orders.filter(o => o.userId === u.id).slice().reverse();
    return sendJson(res, 200, { orders });
  }

  const orderTrackMatch = /^\/api\/orders\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (method === 'GET' && orderTrackMatch) {
    const u = getAuthUser(req);
    const o = db.orders.find(x => x.orderNumber === orderTrackMatch[1]);
    if (!o) throw { status: 404, detail: 'Order not found.' };
    if (o.userId !== u.id && u.role !== 'admin') throw { status: 403, detail: 'Access denied to this order.' };
    return sendJson(res, 200, { order: o });
  }

  const orderCancelMatch = /^\/api\/orders\/([A-Za-z0-9_-]+)\/cancel$/.exec(pathname);
  if (method === 'POST' && orderCancelMatch) {
    const u = getAuthUser(req);
    const o = db.orders.find(x => x.orderNumber === orderCancelMatch[1]);
    if (!o) throw { status: 404, detail: 'Order not found.' };
    if (o.userId !== u.id && u.role !== 'admin') throw { status: 403, detail: 'Access denied.' };
    if (!['placed', 'confirmed', 'packed'].includes(o.status)) throw { status: 400, detail: 'Shipped or delivered orders cannot be cancelled.' };
    o.status = 'cancelled';
    o.timeline.push({ status: 'cancelled', label: 'Order Cancelled', timestamp: new Date().toISOString(), note: 'Stock restored automatically' });
    for (const it of o.items) {
      const p = db.products.find(x => x.id === it.productId);
      if (p) p.stock += it.quantity;
    }
    persist();
    return sendJson(res, 200, { order: o });
  }

  // --- Admin Orders & Members ---
  if (method === 'GET' && pathname === '/api/admin/orders') {
    requireAdmin(req);
    return sendJson(res, 200, { orders: db.orders.slice().reverse() });
  }

  const adminOrdMatch = /^\/api\/admin\/orders\/(\d+)\/status$/.exec(pathname);
  if (method === 'PATCH' && adminOrdMatch) {
    requireAdmin(req);
    const oid = Number(adminOrdMatch[1]);
    const o = db.orders.find(x => x.id === oid);
    if (!o) throw { status: 404, detail: 'Order not found.' };
    const body = await readJson(req);
    const allowed = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(body.status)) throw { status: 400, detail: 'Invalid order status.' };
    o.status = body.status;
    if (body.courierName) o.courierName = sec.sanitizeText(body.courierName);
    if (body.trackingNumber) o.trackingNumber = sec.sanitizeText(body.trackingNumber);
    o.timeline.push({
      status: body.status,
      label: body.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      timestamp: new Date().toISOString(),
      note: sec.sanitizeText(body.note || `Updated to ${body.status}`),
    });
    persist();
    return sendJson(res, 200, { order: o });
  }

  if (method === 'GET' && pathname === '/api/admin/members') {
    requireAdmin(req);
    return sendJson(res, 200, { members: db.users.map(publicUser) });
  }

  if (method === 'POST' && pathname === '/api/admin/members') {
    requireAdmin(req);
    const body = await readJson(req);
    const name = sec.sanitizeText(body.name || '');
    const email = String(body.email || '').trim().toLowerCase();
    const role = ['author', 'admin'].includes(body.role) ? body.role : 'author';
    const pwErr = sec.validatePasswordStrength(body.password);
    if (name.length < 2 || !email.includes('@') || pwErr) throw { status: 400, detail: pwErr || 'Invalid member details.' };
    if (db.users.some(u => u.email === email)) throw { status: 409, detail: 'Email already exists.' };
    const member = {
      id: nextId('users'),
      name,
      email,
      passwordHash: sec.hashPassword(body.password),
      role,
      phone: sec.sanitizeText(body.phone || ''),
      bio: sec.sanitizeText(body.bio || ''),
      isActive: true,
      wishlist: [],
      addresses: [],
      createdAt: new Date().toISOString(),
    };
    db.users.push(member);
    persist();
    return sendJson(res, 201, { member: publicUser(member) });
  }

  const togMemMatch = /^\/api\/admin\/members\/(\d+)\/toggle$/.exec(pathname);
  if (method === 'PATCH' && togMemMatch) {
    const admin = requireAdmin(req);
    const mid = Number(togMemMatch[1]);
    if (mid === admin.id) throw { status: 400, detail: 'Cannot deactivate yourself.' };
    const m = db.users.find(u => u.id === mid);
    if (!m) throw { status: 404, detail: 'Member not found.' };
    m.isActive = !m.isActive;
    persist();
    return sendJson(res, 200, { member: publicUser(m) });
  }

  // --- Multi-Author Blog CMS ---
  function enrichBlog(b) {
    const author = db.users.find(u => u.id === b.authorId);
    return { ...b, authorName: author ? author.name : 'Hitayu Team', authorBio: author ? author.bio : '' };
  }

  if (method === 'GET' && pathname === '/api/blogs') {
    const q = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
    const blogs = db.blogs
      .filter(b => b.status === 'published')
      .filter(b => !q || b.title.toLowerCase().includes(q) || b.excerpt.toLowerCase().includes(q) || b.body.toLowerCase().includes(q))
      .slice().reverse()
      .map(enrichBlog);
    return sendJson(res, 200, { blogs });
  }

  const blogSlugMatch = /^\/api\/blogs\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (method === 'GET' && blogSlugMatch) {
    const b = db.blogs.find(x => x.slug === blogSlugMatch[1] && x.status === 'published');
    if (!b) throw { status: 404, detail: 'Article not found.' };
    return sendJson(res, 200, { blog: enrichBlog(b) });
  }

  if (method === 'GET' && pathname === '/api/author/blogs') {
    const u = requireAuthorOrAdmin(req);
    const list = (u.role === 'admin' ? db.blogs : db.blogs.filter(b => b.authorId === u.id)).slice().reverse().map(enrichBlog);
    return sendJson(res, 200, { blogs: list });
  }

  function createBlogObj(body, authorId, authoredByAgent = false, agentName = '') {
    const title = sec.sanitizeText(body.title || '');
    const excerpt = sec.sanitizeText(body.excerpt || '');
    const richBody = sec.sanitizeRichText(body.body || '');
    const coverImageUrl = String(body.coverImageUrl || body.cover_image_url || '').trim();
    if (title.length < 4 || excerpt.length < 8 || richBody.length < 15) {
      throw { status: 400, detail: 'Title (4+), excerpt (8+), and body (15+) are required.' };
    }
    if (!sec.isSafeMediaUrl(coverImageUrl)) throw { status: 400, detail: 'Unsafe cover image URL.' };
    const media = (Array.isArray(body.media) ? body.media : []).slice(0, 12).map(m => {
      if (!sec.isSafeMediaUrl(m.url)) throw { status: 400, detail: 'Unsafe media attachment URL.' };
      return { type: m.type === 'video' ? 'video' : 'image', url: String(m.url).trim(), caption: sec.sanitizeText(m.caption || '') };
    });
    const now = new Date().toISOString();
    const blog = {
      id: nextId('blogs'),
      slug: `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`,
      title,
      excerpt,
      body: richBody,
      category: sec.sanitizeText(body.category || 'Ayurveda'),
      tags: (Array.isArray(body.tags) ? body.tags : []).slice(0, 10).map(sec.sanitizeText).filter(Boolean),
      coverImageUrl,
      media,
      status: body.status === 'draft' ? 'draft' : 'published',
      authorId,
      authoredByAgent,
      agentName: sec.sanitizeText(agentName),
      createdAt: now,
      updatedAt: now,
    };
    db.blogs.push(blog);
    persist();
    return enrichBlog(blog);
  }

  if (method === 'POST' && pathname === '/api/author/blogs') {
    const u = requireAuthorOrAdmin(req);
    const body = await readJson(req);
    return sendJson(res, 201, { blog: createBlogObj(body, u.id) });
  }

  const authorBlogDel = /^\/api\/author\/blogs\/(\d+)$/.exec(pathname);
  if (method === 'DELETE' && authorBlogDel) {
    const u = requireAuthorOrAdmin(req);
    const bid = Number(authorBlogDel[1]);
    const idx = db.blogs.findIndex(b => b.id === bid);
    if (idx === -1) throw { status: 404, detail: 'Blog not found.' };
    if (db.blogs[idx].authorId !== u.id && u.role !== 'admin') throw { status: 403, detail: 'You can only delete your own blog posts.' };
    db.blogs.splice(idx, 1);
    persist();
    return sendJson(res, 200, { deleted: true, id: bid });
  }

  // --- Media Upload (Authors/Admins) ---
  if (method === 'POST' && pathname === '/api/media/upload') {
    const u = requireAuthorOrAdmin(req);
    const raw = await readRawBody(req);
    const { originalName, content } = parseMultipartFile(raw, req.headers['content-type']);
    const asset = saveValidatedMedia(originalName, content, u.id);
    return sendJson(res, 201, { asset });
  }

  // --- AI Agent API Keys & Publishing Endpoints ---
  if (method === 'GET' && pathname === '/api/admin/agent-keys') {
    requireAdmin(req);
    const keys = db.agentKeys.slice().reverse().map(({ keyHash, ...rest }) => rest);
    return sendJson(res, 200, { keys });
  }

  if (method === 'POST' && pathname === '/api/admin/agent-keys') {
    const admin = requireAdmin(req);
    const body = await readJson(req);
    const name = sec.sanitizeText(body.name || 'AI Wellness Agent');
    const { raw, prefix, hash } = sec.generateAgentKey();
    const record = {
      id: nextId('agentKeys'),
      name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: sec.sanitizeText(body.scopes || 'blogs:write,media:upload,blogs:publish'),
      authorUserId: admin.id,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
    };
    db.agentKeys.push(record);
    persist();
    return sendJson(res, 201, { key: { id: record.id, name: record.name, apiKey: raw, keyPrefix: prefix, scopes: record.scopes } });
  }

  const revKeyMatch = /^\/api\/admin\/agent-keys\/(\d+)\/revoke$/.exec(pathname);
  if (method === 'POST' && revKeyMatch) {
    requireAdmin(req);
    const kid = Number(revKeyMatch[1]);
    const k = db.agentKeys.find(x => x.id === kid);
    if (!k) throw { status: 404, detail: 'Agent key not found.' };
    k.isActive = false;
    persist();
    return sendJson(res, 200, { revoked: true, id: kid });
  }

  if (method === 'POST' && pathname === '/api/agent/media') {
    const { key, scopes } = getAgentContext(req);
    if (!scopes.has('media:upload')) throw { status: 403, detail: 'Agent key lacks media:upload scope.' };
    const raw = await readRawBody(req);
    const { originalName, content } = parseMultipartFile(raw, req.headers['content-type']);
    const asset = saveValidatedMedia(originalName, content, key.authorUserId);
    return sendJson(res, 201, { asset, uploadedByAgent: key.name });
  }

  if (method === 'POST' && pathname === '/api/agent/blogs') {
    const { key, scopes } = getAgentContext(req);
    if (!scopes.has('blogs:write')) throw { status: 403, detail: 'Agent key lacks blogs:write scope.' };
    const body = await readJson(req);
    if (body.status !== 'draft' && !scopes.has('blogs:publish')) {
      throw { status: 403, detail: 'Agent key lacks blogs:publish scope.' };
    }
    const blog = createBlogObj(body, key.authorUserId, true, key.name);
    return sendJson(res, 201, { blog });
  }

  if (method === 'GET' && pathname === '/api/agent/blogs') {
    getAgentContext(req);
    return sendJson(res, 200, { blogs: db.blogs.filter(b => b.authoredByAgent).slice().reverse().map(enrichBlog) });
  }

  return sendError(res, 404, 'API route not found.');
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, urlObj);
    }
    if (pathname.startsWith('/uploads/')) {
      return serveStaticFile(res, config.UPLOAD_DIR, pathname.slice('/uploads/'.length));
    }
    if (pathname.startsWith('/images/')) {
      return serveStaticFile(res, path.join(config.FRONTEND_PUBLIC_DIR, 'images'), pathname.slice('/images/'.length));
    }
    // Serve built React dist if present
    if (fs.existsSync(config.FRONTEND_DIST_DIR)) {
      const target = pathname === '/' ? 'index.html' : pathname.slice(1);
      const candidate = path.resolve(config.FRONTEND_DIST_DIR, target);
      if (candidate.startsWith(config.FRONTEND_DIST_DIR) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveStaticFile(res, config.FRONTEND_DIST_DIR, target);
      }
      return serveStaticFile(res, config.FRONTEND_DIST_DIR, 'index.html');
    }
    return sendJson(res, 200, {
      service: 'Hitayu Node.js API Server',
      status: 'running',
      frontendDevUrl: 'http://localhost:5173',
      hint: 'Run `cd frontend && npm install && npm run dev` to launch the React storefront, or `npm run build` to serve from Node directly.',
    });
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    const detail = err && err.detail ? err.detail : 'Internal server error.';
    return sendError(res, status, detail);
  }
});

if (require.main === module) {
  server.listen(config.PORT, config.HOST, () => {
    console.log(`Hitayu Node.js API listening at http://${config.HOST}:${config.PORT}`);
  });
}

module.exports = { server };
