import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

const STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export default function ProfileAndOrders({ user, token, onUserUpdated, onNeedLogin, onToast }) {
  const [orders, setOrders] = useState([]);
  const [trackInput, setTrackInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [addrForm, setAddrForm] = useState({ label: 'Home', recipient: '', phone: '', line1: '', city: '', state: '', pincode: '' });

  useEffect(() => {
    if (!user || !token) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
    apiRequest('/api/orders/my', { token }).then(r => setOrders(r.orders || [])).catch(() => {});
  }, [user, token]);

  if (!user) {
    return (
      <div className="p-10 rounded-3xl bg-oat-warm/60 border border-oat-border text-center space-y-3">
        <h2 className="font-display text-3xl text-forest">Sign In to Manage Profile &amp; Track Orders</h2>
        <p className="text-sm text-sage-muted">View saved addresses, update your account, and track live shipments.</p>
        <button type="button" onClick={onNeedLogin} className="px-6 py-2.5 rounded-full bg-forest text-oat text-sm font-semibold">Sign In / Register</button>
      </div>
    );
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/profile', { method: 'PUT', token, body: { name, phone, bio } });
      onUserUpdated(res.user);
      onToast('Profile updated!');
    } catch (err) { onToast(err.message, true); }
  }

  async function addAddress(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/profile/addresses', { method: 'POST', token, body: { ...addrForm, isDefault: true } });
      onUserUpdated({ ...user, addresses: res.addresses });
      setAddrForm({ label: 'Work', recipient: '', phone: '', line1: '', city: '', state: '', pincode: '' });
      onToast('Shipping address saved!');
    } catch (err) { onToast(err.message, true); }
  }

  async function removeAddress(id) {
    const res = await apiRequest(`/api/profile/addresses/${id}`, { method: 'DELETE', token });
    onUserUpdated({ ...user, addresses: res.addresses });
    onToast('Address removed');
  }

  async function trackByNumber(e) {
    e.preventDefault();
    if (!trackInput.trim()) return;
    try {
      const res = await apiRequest(`/api/orders/${encodeURIComponent(trackInput.trim())}`, { token });
      setTrackedOrder(res.order);
    } catch (err) { onToast(err.message, true); }
  }

  async function cancelOrder(orderNumber) {
    try {
      await apiRequest(`/api/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST', token });
      onToast(`Order ${orderNumber} cancelled and stock restored.`);
      const r = await apiRequest('/api/orders/my', { token });
      setOrders(r.orders || []);
    } catch (err) { onToast(err.message, true); }
  }

  function renderTimeline(o) {
    const idx = STEPS.indexOf(o.status);
    return (
      <div className="mt-4 pt-4 border-t border-oat-border space-y-3">
        <div className="flex flex-wrap items-center justify-between text-xs text-sage-muted">
          <span>Courier: <strong className="text-forest">{o.courierName}</strong></span>
          <span>Tracking ID: <strong className="text-forest">{o.trackingNumber}</strong></span>
          <span>Payment: <strong className="text-forest">{o.paymentMethod} ({o.paymentRef})</strong></span>
        </div>
        {o.status !== 'cancelled' ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STEPS.map((st, i) => (
              <div key={st} className={`p-2 rounded-xl text-center text-[11px] font-semibold ${i <= idx ? 'bg-forest text-oat' : 'bg-oat-warm text-sage-muted'}`}>
                {st.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">Order Cancelled</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Profile Form */}
        <form onSubmit={saveProfile} className="lg:col-span-5 p-6 rounded-3xl bg-oat border border-oat-border space-y-3">
          <h3 className="font-display text-2xl font-semibold text-forest">My Profile ({user.role})</h3>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Full Name" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-sm" />
          <input value={user.email} disabled className="w-full px-3.5 py-2 rounded-xl bg-oat-warm/50 border border-oat-border text-sm text-sage-muted" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-sm" />
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows="2" placeholder="Bio" className="w-full px-3.5 py-2 rounded-xl bg-oat-warm border border-oat-border text-sm" />
          <button type="submit" className="px-5 py-2.5 rounded-full bg-forest text-oat text-xs font-semibold">Save Profile</button>
        </form>

        {/* Address Book */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-oat border border-oat-border space-y-4">
          <h3 className="font-display text-2xl font-semibold text-forest">Saved Shipping Addresses</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {(user.addresses || []).map(a => (
              <div key={a.id} className="p-3.5 rounded-2xl bg-oat-warm/60 border border-oat-border text-xs flex justify-between gap-2">
                <div>
                  <p className="font-semibold text-forest">{a.label} {a.isDefault && <span className="text-terracotta">(Default)</span>}</p>
                  <p>{a.recipient} · {a.phone}</p>
                  <p className="text-sage-muted">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
                </div>
                <button type="button" onClick={() => removeAddress(a.id)} className="text-red-700 font-semibold self-start">Remove</button>
              </div>
            ))}
          </div>
          <form onSubmit={addAddress} className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-oat-border">
            <input value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Label (Home/Office)" className="px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={addrForm.recipient} onChange={e => setAddrForm({ ...addrForm, recipient: e.target.value })} placeholder="Recipient Name" className="px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={addrForm.line1} onChange={e => setAddrForm({ ...addrForm, line1: e.target.value })} required placeholder="Street / House No." className="sm:col-span-2 px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={addrForm.city} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} required placeholder="City" className="px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={addrForm.state} onChange={e => setAddrForm({ ...addrForm, state: e.target.value })} placeholder="State" className="px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <input value={addrForm.pincode} onChange={e => setAddrForm({ ...addrForm, pincode: e.target.value })} required placeholder="PIN Code" className="px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
            <button type="submit" className="px-4 py-2 rounded-full bg-forest text-oat text-xs font-semibold">Add Address</button>
          </form>
        </div>
      </div>

      {/* Order Tracker & History */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-display text-3xl font-semibold text-forest">Orders &amp; Live Shipment Tracking</h3>
          <form onSubmit={trackByNumber} className="flex gap-2">
            <input value={trackInput} onChange={e => setTrackInput(e.target.value)} placeholder="Track Order # (e.g. HT-...)" className="px-4 py-2 rounded-full bg-oat-warm border border-oat-border text-xs" />
            <button type="submit" className="px-4 py-2 rounded-full bg-forest text-oat text-xs font-semibold">Track</button>
          </form>
        </div>

        {trackedOrder && (
          <div className="p-5 rounded-3xl bg-sage/50 border border-forest/20">
            <p className="text-xs font-bold uppercase text-terracotta">Tracked Order: {trackedOrder.orderNumber}</p>
            {renderTimeline(trackedOrder)}
          </div>
        )}

        {orders.length ? orders.map(o => (
          <div key={o.id} className="p-5 rounded-3xl bg-oat border border-oat-border">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-terracotta font-semibold">{o.orderNumber} · {o.status.toUpperCase()}</p>
                <p className="font-semibold text-sm text-forest mt-1">{o.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</p>
                <p className="text-xs text-sage-muted">{o.shippingAddress}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="font-display text-2xl font-bold text-forest">₹{o.totalAmount}</p>
                <p className="text-[11px] text-sage-muted">GST ₹{o.gstAmount} · {o.paymentStatus}</p>
                {['placed', 'confirmed', 'packed'].includes(o.status) && (
                  <button type="button" onClick={() => cancelOrder(o.orderNumber)} className="text-xs text-red-700 font-semibold hover:underline">Cancel Order</button>
                )}
              </div>
            </div>
            {renderTimeline(o)}
          </div>
        )) : <p className="text-sm text-sage-muted">No orders placed yet.</p>}
      </div>
    </div>
  );
}
