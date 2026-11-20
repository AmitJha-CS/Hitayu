'use strict';

const crypto = require('crypto');
const config = require('./config');

// --- scrypt Password Hashing ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${dk.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, dkB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(dkB64, 'base64');
    const actual = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validatePasswordStrength(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain at least one letter and one number.';
  return null;
}

// --- HMAC-SHA256 JWT ---
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: user.id,
    role: user.role,
    email: user.email,
    iat: now,
    exp: now + config.TOKEN_TTL_SEC,
  }));
  const sig = b64url(crypto.createHmac('sha256', config.SECRET_KEY).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = JSON.parse(fromB64url(h).toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const expected = crypto.createHmac('sha256', config.SECRET_KEY).update(`${h}.${p}`).digest();
    const actual = fromB64url(s);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(fromB64url(p).toString('utf8'));
    if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Scoped Agent API Keys ---
function generateAgentKey() {
  const raw = `ht_agent_${crypto.randomBytes(24).toString('base64url')}`;
  const prefix = raw.slice(0, 16);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

function hashAgentKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// --- XSS & Safe URL Sanitization ---
function sanitizeText(val) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<\s*(script|iframe|object|embed|style|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|svg|math|form|input|meta|link|base)[^>]*>/gi, '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .trim();
}

function sanitizeRichText(val) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<\s*(script|iframe|object|embed|style|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|svg|math|form|input|meta|link|base)[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, 'blocked:')
    .trim();
}

function isSafeMediaUrl(url) {
  if (!url) return true;
  const u = String(url).trim();
  if (u.startsWith('/uploads/') || u.startsWith('/images/')) {
    return !u.includes('..') && !u.includes('\\');
  }
  if (u.startsWith('https://') && !/(javascript|vbscript)\s*:/i.test(u)) return true;
  return false;
}

// --- Magic-Byte Media Validation ---
function detectMediaKind(ext, buf) {
  const lower = String(ext).toLowerCase();
  if (config.ALLOWED_IMAGE_EXTS.has(lower)) {
    if ((lower === '.jpg' || lower === '.jpeg') && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image';
    if (lower === '.png' && buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image';
    if (lower === '.webp' && buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image';
    return null;
  }
  if (config.ALLOWED_VIDEO_EXTS.has(lower)) {
    if (lower === '.mp4' && buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'video';
    if (lower === '.webm' && buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video';
    return null;
  }
  return null;
}

// --- Sliding-Window Rate Limiter ---
class RateLimiter {
  constructor(max = config.AUTH_RATE_LIMIT_MAX, windowMs = config.AUTH_RATE_LIMIT_WINDOW_MS) {
    this.max = max;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }
  allow(key) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const arr = (this.buckets.get(key) || []).filter(ts => ts > cutoff);
    if (arr.length >= this.max) {
      this.buckets.set(key, arr);
      return false;
    }
    arr.push(now);
    this.buckets.set(key, arr);
    return true;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createToken,
  verifyToken,
  generateAgentKey,
  hashAgentKey,
  sanitizeText,
  sanitizeRichText,
  isSafeMediaUrl,
  detectMediaKind,
  authRateLimiter: new RateLimiter(),
};
