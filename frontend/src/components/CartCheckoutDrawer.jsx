import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

export default function CartCheckoutDrawer({ open, onClose, cart, products, shop, user, token, onUpdateQty, onOrderComplete, onNeedLogin, onToast }) {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      const def = user.addresses?.find(a => a.isDefault) || user.addresses?.[0];
      setRecipient(def?.recipient || user.name || '');
      setPhone(def?.phone || user.phone || '');
      setAddress(def ? `${def.line1}, ${def.city}, ${def.state} ${def.pincode}` : '');
    }
  }, [user, open]);

  if (!open) return null;

  const detailed = cart.map(c => ({ ...c, product: products.find(p => p.id === c.productId) })).filter(x => x.product);
  const subtotal = detailed.reduce((s, x) => s + x.product.price * x.quantity, 0);
  const discount = appliedCoupon && subtotal >= appliedCoupon.minOrderAmount ? Math.round(subtotal * (appliedCoupon.discountPercent / 100) * 100) / 100 : 0;
  const taxable = Math.max(0, subtotal - discount);
  const gstRate = shop?.gstRatePercent ?? 12;
  const gst = Math.round(taxable * (gstRate / 100) * 100) / 100;
  const shipping = taxable >= (shop?.freeShippingThreshold ?? 999) ? 0 : (shop?.standardShippingFee ?? 79);
  const codFee = paymentMethod === 'COD' ? (shop?.codFee ?? 29) : 0;
  const total = Math.round((taxable + gst + shipping + codFee) * 100) / 100;

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    try {
      const res = await apiRequest(`/api/coupons/${encodeURIComponent(couponCode.trim())}`);
      setAppliedCoupon(res.coupon);
      onToast(`Applied ${res.coupon.code} (${res.coupon.discountPercent}% off)`);
    } catch (err) {
      onToast(err.message, true);
    }
  }

  async function handleCheckout(e) {
    e.preventDefault();
    if (!user) {
      onNeedLogin();
      return onToast('Please sign in to complete payment and place your order.', true);
    }
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/orders/checkout', {
        method: 'POST',
        token,
        body: {
          customerName: recipient,
          phone,
          shippingAddress: address,
          paymentMethod,
          paymentDetails: paymentMethod === 'UPI' ? { upiId } : paymentMethod === 'CARD' ? { cardNumber } : {},
          couponCode: appliedCoupon ? appliedCoupon.code : '',
          items: cart,
        },
      });
      setAppliedCoupon(null);
      setCouponCode('');
      onOrderComplete(res.order);
    } catch (err) {
      onToast(err.message, true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-forest-dark/50 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="bg-oat w-full max-w-md h-full flex flex-col shadow-2xl border-l border-oat-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-oat-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold text-forest">Bag &amp; Payment</h3>
            <p className="text-xs text-sage-muted">Free shipping above ₹{shop?.freeShippingThreshold ?? 999} · {gstRate}% GST</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-oat-warm text-forest text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!detailed.length ? (
            <p className="text-center text-sm text-sage-muted py-12">Your bag is empty.</p>
          ) : (
            <>
              <div className="space-y-2.5">
                {detailed.map(({ product: p, quantity }) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-oat-warm/60 border border-oat-border">
                    <img src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-forest truncate">{p.name}</p>
                      <p className="text-[11px] text-sage-muted">₹{p.price} × {quantity}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => onUpdateQty(p.id, -1)} className="w-6 h-6 rounded-full bg-oat border text-xs">-</button>
                      <button type="button" onClick={() => onUpdateQty(p.id, 1)} className="w-6 h-6 rounded-full bg-oat border text-xs">+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon */}
              <div className="flex gap-2">
                <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Coupon (HITAYU10 / WELLNESS15)" className="flex-1 px-3 py-2 rounded-full bg-oat-warm border border-oat-border text-xs uppercase" />
                <button type="button" onClick={applyCoupon} className="px-4 py-2 rounded-full bg-forest text-oat text-xs font-semibold">Apply</button>
              </div>

              {/* Saved Addresses Quick Picker */}
              {user?.addresses?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-sage-muted uppercase">Saved Addresses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.addresses.map(a => (
                      <button key={a.id} type="button" onClick={() => { setRecipient(a.recipient); setPhone(a.phone); setAddress(`${a.line1}, ${a.city}, ${a.state} ${a.pincode}`); }} className="px-2.5 py-1 rounded-full bg-sage text-forest text-[11px] font-semibold">
                        {a.label} ({a.city})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkout & Payment Form */}
              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-2.5 pt-2 border-t border-oat-border">
                <input value={recipient} onChange={e => setRecipient(e.target.value)} required placeholder="Recipient Full Name" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
                <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="Phone (+91...)" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
                <input value={address} onChange={e => setAddress(e.target.value)} required placeholder="Complete Shipping Address & PIN" className="w-full px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['UPI', 'CARD', 'COD'].map(m => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)} className={`py-2 rounded-xl text-xs font-semibold border ${paymentMethod === m ? 'bg-forest text-oat border-forest' : 'bg-oat-warm text-forest border-oat-border'}`}>
                      {m}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'UPI' && (
                  <input value={upiId} onChange={e => setUpiId(e.target.value)} required placeholder="Enter UPI ID (e.g. amit@upi)" className="w-full px-3 py-2 rounded-xl bg-sage/50 border border-forest/20 text-xs" />
                )}
                {paymentMethod === 'CARD' && (
                  <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} required placeholder="Card Number (16 digits)" className="w-full px-3 py-2 rounded-xl bg-sage/50 border border-forest/20 text-xs" />
                )}
                {paymentMethod === 'COD' && (
                  <p className="text-[11px] text-sage-muted">Cash on Delivery includes a ₹{shop?.codFee ?? 29} COD handling fee.</p>
                )}

                <div className="p-3 rounded-2xl bg-oat-warm/80 text-xs space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-terracotta"><span>Discount ({appliedCoupon.code})</span><span>-₹{discount.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span>GST ({gstRate}%)</span><span>₹{gst.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : `₹${shipping}`}</span></div>
                  {codFee > 0 && <div className="flex justify-between"><span>COD Fee</span><span>₹{codFee}</span></div>}
                  <div className="flex justify-between font-bold text-sm text-forest pt-1 border-t border-oat-border"><span>Total Payable</span><span>₹{total.toFixed(2)}</span></div>
                </div>

                <button type="submit" disabled={submitting} className="w-full py-3 rounded-full bg-forest text-oat text-sm font-semibold hover:bg-forest-light disabled:opacity-40">
                  {submitting ? 'Processing Payment...' : `Pay & Place Order (₹${total.toFixed(2)})`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
