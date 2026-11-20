import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

export default function AdminStudio({ user, token, shop, onShopUpdated, onProductsUpdated, onToast }) {
  const [tab, setTab] = useState('items');
  const [shopForm, setShopForm] = useState(shop || {});
  const [itemForm, setItemForm] = useState({ sku: '', name: '', category: 'Immunity', price: '', mrp: '', size: '100 g', stock: '25', imageUrl: '/images/hero.jpg', tagline: '', ingredients: '', ritual: '' });
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '', role: 'author', bio: '' });
  const [blogs, setBlogs] = useState([]);
  const [blogForm, setBlogForm] = useState({ title: '', category: 'Herbal Habits', excerpt: '', body: '' });
  const [draftMedia, setDraftMedia] = useState([]);
  const [agentKeys, setAgentKeys] = useState([]);
  const [agentName, setAgentName] = useState('');
  const [createdKey, setCreatedKey] = useState('');

  const isAdmin = user?.role === 'admin';
  const isAuthor = user?.role === 'author';

  useEffect(() => {
    setShopForm(shop || {});
  }, [shop]);

  useEffect(() => {
    if (!user || !token) return;
    if (!isAdmin && tab !== 'blogs') setTab('blogs');
    refreshData();
  }, [user, token, tab]);

  async function refreshData() {
    try {
      if (tab === 'blogs') {
        const r = await apiRequest('/api/author/blogs', { token });
        setBlogs(r.blogs || []);
      } else if (tab === 'orders' && isAdmin) {
        const r = await apiRequest('/api/admin/orders', { token });
        setOrders(r.orders || []);
      } else if (tab === 'members' && isAdmin) {
        const r = await apiRequest('/api/admin/members', { token });
        setMembers(r.members || []);
      } else if (tab === 'agent' && isAdmin) {
        const r = await apiRequest('/api/admin/agent-keys', { token });
        setAgentKeys(r.keys || []);
      }
    } catch {}
  }

  if (!isAdmin && !isAuthor) {
    return (
      <div className="p-8 rounded-3xl bg-oat-warm/60 border border-oat-border text-sm text-forest">
        Sign in with an <strong>Admin</strong> (`admin@hitayu.in`) or <strong>Author</strong> (`writer@hitayu.in`) account to access Shop Profile, Item Adding, Order Fulfillment, Blog CMS, and AI Agent Keys.
      </div>
    );
  }

  async function uploadMediaFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    return apiRequest('/api/media/upload', { method: 'POST', token, body: fd });
  }

  async function handleSaveShop(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/admin/shop/profile', { method: 'PUT', token, body: shopForm });
      onShopUpdated(res.shop);
      onToast('Shop profile updated!');
    } catch (err) { onToast(err.message, true); }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/products', {
        method: 'POST',
        token,
        body: { ...itemForm, price: Number(itemForm.price), mrp: Number(itemForm.mrp || itemForm.price), stock: Number(itemForm.stock) },
      });
      setItemForm({ sku: '', name: '', category: 'Immunity', price: '', mrp: '', size: '100 g', stock: '25', imageUrl: '/images/hero.jpg', tagline: '', ingredients: '', ritual: '' });
      onProductsUpdated();
      onToast('New product added to store!');
    } catch (err) { onToast(err.message, true); }
  }

  async function handlePublishBlog(e) {
    e.preventDefault();
    try {
      const cover = draftMedia.find(m => m.type === 'image')?.url || '/images/hero.jpg';
      await apiRequest('/api/author/blogs', {
        method: 'POST',
        token,
        body: { ...blogForm, coverImageUrl: cover, media: draftMedia, status: 'published' },
      });
      setBlogForm({ title: '', category: 'Herbal Habits', excerpt: '', body: '' });
      setDraftMedia([]);
      refreshData();
      onToast('Blog article published!');
    } catch (err) { onToast(err.message, true); }
  }

  const tabs = isAdmin
    ? [['items', 'Add Items'], ['shop', 'Shop Profile'], ['orders', 'Orders & Tracking'], ['members', 'Blog Writers'], ['blogs', 'Write Blogs'], ['agent', 'AI Agent API']]
    : [['blogs', 'Write Blogs']];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-oat-border pb-4">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`px-4 py-2 rounded-full text-xs font-semibold ${tab === id ? 'bg-forest text-oat' : 'bg-oat-warm text-forest border border-oat-border'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: ADD ITEMS */}
      {tab === 'items' && isAdmin && (
        <form onSubmit={handleAddItem} className="max-w-2xl p-6 rounded-3xl bg-oat border border-oat-border space-y-3">
          <h3 className="font-display text-2xl font-semibold text-forest">Add New Store Item</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={itemForm.sku} onChange={e => setItemForm({ ...itemForm, sku: e.target.value })} required placeholder="SKU (e.g. HT-NEW-007)" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} required placeholder="Product Name" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs">
              {['Immunity', 'Digestion', 'Daily Vitality', 'Calm & Sleep'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={itemForm.size} onChange={e => setItemForm({ ...itemForm, size: e.target.value })} required placeholder="Pack Size (e.g. 100 g)" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} required type="number" min="1" placeholder="Selling Price (₹)" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={itemForm.mrp} onChange={e => setItemForm({ ...itemForm, mrp: e.target.value })} required type="number" min="1" placeholder="MRP (₹)" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={itemForm.stock} onChange={e => setItemForm({ ...itemForm, stock: e.target.value })} required type="number" min="0" placeholder="Opening Stock" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={async e => {
              if (!e.target.files[0]) return;
              try { const r = await uploadMediaFile(e.target.files[0]); setItemForm(f => ({ ...f, imageUrl: r.asset.url })); onToast('Product photo uploaded!'); }
              catch (err) { onToast(err.message, true); }
            }} className="text-xs self-center" />
          </div>
          <input value={itemForm.tagline} onChange={e => setItemForm({ ...itemForm, tagline: e.target.value })} required placeholder="Short Tagline" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <input value={itemForm.ingredients} onChange={e => setItemForm({ ...itemForm, ingredients: e.target.value })} required placeholder="Botanical Ingredients" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <input value={itemForm.ritual} onChange={e => setItemForm({ ...itemForm, ritual: e.target.value })} required placeholder="Usage Ritual" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <button type="submit" className="px-6 py-2.5 rounded-full bg-forest text-oat text-xs font-semibold">Add Item to Catalog</button>
        </form>
      )}

      {/* TAB: SHOP PROFILE */}
      {tab === 'shop' && isAdmin && (
        <form onSubmit={handleSaveShop} className="max-w-2xl p-6 rounded-3xl bg-oat border border-oat-border space-y-3">
          <h3 className="font-display text-2xl font-semibold text-forest">Shop Profile &amp; Store Settings</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={shopForm.name || ''} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} placeholder="Shop Name" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={shopForm.gstin || ''} onChange={e => setShopForm({ ...shopForm, gstin: e.target.value })} placeholder="GSTIN" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={shopForm.supportEmail || ''} onChange={e => setShopForm({ ...shopForm, supportEmail: e.target.value })} placeholder="Support Email" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={shopForm.supportPhone || ''} onChange={e => setShopForm({ ...shopForm, supportPhone: e.target.value })} placeholder="Support Phone" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input type="number" value={shopForm.gstRatePercent ?? 12} onChange={e => setShopForm({ ...shopForm, gstRatePercent: Number(e.target.value) })} placeholder="GST %" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input type="number" value={shopForm.freeShippingThreshold ?? 999} onChange={e => setShopForm({ ...shopForm, freeShippingThreshold: Number(e.target.value) })} placeholder="Free Shipping Above ₹" className="px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          </div>
          <input value={shopForm.tagline || ''} onChange={e => setShopForm({ ...shopForm, tagline: e.target.value })} placeholder="Shop Tagline" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <input value={shopForm.warehouseAddress || ''} onChange={e => setShopForm({ ...shopForm, warehouseAddress: e.target.value })} placeholder="Warehouse / Business Address" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <input value={shopForm.returnPolicy || ''} onChange={e => setShopForm({ ...shopForm, returnPolicy: e.target.value })} placeholder="Return Policy" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
          <button type="submit" className="px-6 py-2.5 rounded-full bg-forest text-oat text-xs font-semibold">Save Shop Profile</button>
        </form>
      )}

      {/* TAB: ORDERS & SHIPMENT TRACKING */}
      {tab === 'orders' && isAdmin && (
        <div className="space-y-3">
          <h3 className="font-display text-2xl font-semibold text-forest">Manage Orders &amp; Tracking ({orders.length})</h3>
          {orders.map(o => (
            <div key={o.id} className="p-4 rounded-2xl bg-oat border border-oat-border flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-forest">{o.orderNumber} · {o.customerName} · ₹{o.totalAmount} ({o.paymentMethod})</p>
                <p className="text-xs text-sage-muted">{o.shippingAddress} · Tracking: {o.trackingNumber}</p>
              </div>
              <select value={o.status} onChange={async e => {
                await apiRequest(`/api/admin/orders/${o.id}/status`, { method: 'PATCH', token, body: { status: e.target.value } });
                onToast(`Order ${o.orderNumber} updated to ${e.target.value}`);
                refreshData();
              }} className="px-3 py-1.5 rounded-full bg-oat-warm border border-oat-border text-xs font-semibold">
                {['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* TAB: MEMBERS */}
      {tab === 'members' && isAdmin && (
        <div className="grid lg:grid-cols-12 gap-6">
          <form onSubmit={async e => {
            e.preventDefault();
            try {
              await apiRequest('/api/admin/members', { method: 'POST', token, body: memberForm });
              setMemberForm({ name: '', email: '', password: '', role: 'author', bio: '' });
              refreshData();
              onToast('Writer member added!');
            } catch (err) { onToast(err.message, true); }
          }} className="lg:col-span-5 p-5 rounded-3xl bg-oat border border-oat-border space-y-2.5">
            <h3 className="font-display text-2xl font-semibold text-forest">Add Blog Writer</h3>
            <input value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} required placeholder="Full Name" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} required type="email" placeholder="Email" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={memberForm.password} onChange={e => setMemberForm({ ...memberForm, password: e.target.value })} required type="password" placeholder="Password (8+ chars)" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={memberForm.bio} onChange={e => setMemberForm({ ...memberForm, bio: e.target.value })} placeholder="Author Bio" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <button type="submit" className="w-full py-2.5 rounded-full bg-forest text-oat text-xs font-semibold">Create Member</button>
          </form>
          <div className="lg:col-span-7 space-y-2.5">
            {members.map(m => (
              <div key={m.id} className="p-4 rounded-2xl bg-oat border border-oat-border flex items-center justify-between text-xs">
                <div><strong className="text-forest">{m.name}</strong> ({m.role}) · {m.email}</div>
                {m.id !== user.id && <button type="button" onClick={async () => { await apiRequest(`/api/admin/members/${m.id}/toggle`, { method: 'PATCH', token }); refreshData(); }} className="px-3 py-1 rounded-full bg-oat-warm font-semibold">{m.isActive ? 'Suspend' : 'Activate'}</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: WRITE BLOGS */}
      {tab === 'blogs' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <form onSubmit={handlePublishBlog} className="lg:col-span-6 p-5 rounded-3xl bg-oat border border-oat-border space-y-3">
            <h3 className="font-display text-2xl font-semibold text-forest">Write Blog with Photo / Video</h3>
            <input value={blogForm.title} onChange={e => setBlogForm({ ...blogForm, title: e.target.value })} required placeholder="Article Title" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={blogForm.excerpt} onChange={e => setBlogForm({ ...blogForm, excerpt: e.target.value })} required placeholder="Short Excerpt" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <textarea value={blogForm.body} onChange={e => setBlogForm({ ...blogForm, body: e.target.value })} required rows="4" placeholder="Write your article..." className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm" onChange={async e => {
              if (!e.target.files[0]) return;
              try {
                const r = await uploadMediaFile(e.target.files[0]);
                setDraftMedia(d => [...d, { type: r.asset.mediaType, url: r.asset.url, caption: e.target.files[0].name }]);
                onToast(`Attached ${r.asset.mediaType}`);
              } catch (err) { onToast(err.message, true); }
            }} className="text-xs" />
            {draftMedia.length > 0 && <div className="text-xs text-forest">{draftMedia.map((m, i) => <div key={i}>Attached {m.type}: {m.url}</div>)}</div>}
            <button type="submit" className="w-full py-2.5 rounded-full bg-forest text-oat text-xs font-semibold">Publish Article</button>
          </form>
          <div className="lg:col-span-6 space-y-2.5">
            {blogs.map(b => (
              <div key={b.id} className="p-4 rounded-2xl bg-oat border border-oat-border flex items-center justify-between text-xs">
                <div><strong className="text-forest">{b.title}</strong> · By {b.authorName}</div>
                <button type="button" onClick={async () => { await apiRequest(`/api/author/blogs/${b.id}`, { method: 'DELETE', token }); refreshData(); }} className="text-red-700 font-semibold">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: AI AGENT CONNECTOR */}
      {tab === 'agent' && isAdmin && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 p-5 rounded-3xl bg-oat border border-oat-border space-y-3">
            <h3 className="font-display text-2xl font-semibold text-forest">AI Agent Publishing Keys</h3>
            <form onSubmit={async e => {
              e.preventDefault();
              const r = await apiRequest('/api/admin/agent-keys', { method: 'POST', token, body: { name: agentName } });
              setCreatedKey(r.key.apiKey);
              setAgentName('');
              refreshData();
              onToast('Agent API key generated!');
            }} className="flex gap-2">
              <input value={agentName} onChange={e => setAgentName(e.target.value)} required placeholder="Agent Name (e.g. Gemini Writer)" className="flex-1 px-3 py-2 rounded-full bg-oat-warm border border-oat-border text-xs" />
              <button type="submit" className="px-4 py-2 rounded-full bg-forest text-oat text-xs font-semibold">Generate</button>
            </form>
            {createdKey && <div className="p-3 rounded-xl bg-turmeric/20 text-xs break-all"><strong>Copy once:</strong> <code>{createdKey}</code></div>}
            <div className="space-y-2">
              {agentKeys.map(k => (
                <div key={k.id} className="p-3 rounded-xl bg-oat-warm/60 border border-oat-border flex justify-between text-xs">
                  <span><strong>{k.name}</strong> ({k.keyPrefix}...) · {k.isActive ? 'Active' : 'Revoked'}</span>
                  {k.isActive && <button type="button" onClick={async () => { await apiRequest(`/api/admin/agent-keys/${k.id}/revoke`, { method: 'POST', token }); refreshData(); }} className="text-red-700 font-semibold">Revoke</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 p-5 rounded-3xl bg-forest text-oat text-xs space-y-2">
            <p className="uppercase tracking-widest text-turmeric font-semibold">Connect Gemini / AI Agent</p>
            <pre className="bg-forest-dark/80 p-3 rounded-xl overflow-x-auto">{`# Upload photo/video
curl -X POST http://127.0.0.1:5000/api/agent/media \\
  -H "Authorization: Bearer ht_agent_KEY" -F "file=@guide.jpg"

# Publish blog directly
curl -X POST http://127.0.0.1:5000/api/agent/blogs \\
  -H "Authorization: Bearer ht_agent_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Herbal Guide","excerpt":"Daily immunity.","body":"Warm tulsi tea...","status":"published"}'`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
