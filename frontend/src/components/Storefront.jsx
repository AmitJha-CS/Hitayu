import React, { useState } from 'react';
import { apiRequest } from '../api.js';
import { DICT } from '../i18n.js';

export default function Storefront({ shop, products, lang, user, token, onAddToCart, onToggleWishlist, onRefreshProducts, onToast, onGoBlog }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const t = DICT[lang] || DICT.en;

  const categories = ['All', 'Immunity', 'Digestion', 'Daily Vitality', 'Calm & Sleep'];
  const filtered = products.filter(p => {
    const okCat = category === 'All' || p.category === category;
    const q = query.trim().toLowerCase();
    const okQ = !q || p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return okCat && okQ;
  });

  async function openDetail(productId) {
    const res = await apiRequest(`/api/products/${productId}`);
    setSelected(res.product);
    setReviews(res.reviews || []);
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!user) return onToast('Please sign in to post a review.', true);
    try {
      await apiRequest(`/api/products/${selected.id}/reviews`, {
        method: 'POST',
        token,
        body: { rating: Number(revRating), comment: revComment },
      });
      setRevComment('');
      onToast('Review published!');
      await openDetail(selected.id);
      onRefreshProducts();
    } catch (err) {
      onToast(err.message, true);
    }
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-5">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sage text-forest text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-terracotta" /> {t.heroTag}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-forest leading-[1.08]">
            {shop?.name || 'Hitayu Organic Wellness'}
          </h1>
          <p className="text-forest/75 text-base leading-relaxed max-w-xl">
            {shop?.tagline || 'Rooted in Nature. Crafted for Daily Vitality.'} · Free shipping above ₹{shop?.freeShippingThreshold || 999} · {shop?.returnPolicy}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#catalog" className="px-6 py-3 rounded-full bg-forest text-oat text-sm font-semibold hover:bg-forest-light">Shop Apothecary</a>
            <button type="button" onClick={onGoBlog} className="px-6 py-3 rounded-full bg-oat-warm text-forest border border-oat-border text-sm font-semibold">Read Wellness Journal</button>
          </div>
        </div>
        <div className="lg:col-span-6">
          <img src="/images/hero.jpg" alt="Hitayu Morning Ritual" className="w-full rounded-3xl shadow-xl border border-oat-border aspect-[16/10] object-cover" />
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-semibold">Small-Batch Apothecary</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-forest mt-1">Unique Formulations, Live Stock</h2>
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Search herbs, SKU, or benefits..." className="w-full md:w-72 px-4 py-2 rounded-full bg-oat-warm border border-oat-border text-sm" />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-semibold ${category === c ? 'bg-forest text-oat' : 'bg-oat-warm text-forest border border-oat-border'}`}>{c}</button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => {
            const disc = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
            const wished = user?.wishlist?.includes(p.id);
            return (
              <article key={p.id} className="bg-oat rounded-3xl border border-oat-border overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="relative aspect-[4/3] bg-oat-warm overflow-hidden">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-oat/90 text-[11px] font-semibold text-forest">{p.category}</span>
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {disc > 0 && <span className="px-2.5 py-1 rounded-full bg-terracotta text-oat text-[11px] font-bold">{disc}% OFF</span>}
                    <button type="button" onClick={() => onToggleWishlist(p.id)} aria-label="Wishlist" className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${wished ? 'bg-terracotta text-oat' : 'bg-oat/90 text-forest'}`}>
                      {wished ? '♥' : '♡'}
                    </button>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-2xl font-semibold text-forest leading-snug">{p.name}</h3>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-forest">₹{p.price}</span>
                        {p.mrp > p.price && <span className="block text-[11px] text-sage-muted line-through">₹{p.mrp}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-sage-muted mt-0.5">{p.size} · Stock: {p.stock} · ★ {p.avgRating || 'New'} ({p.reviewCount})</p>
                    <p className="text-sm text-forest/75 mt-2">{p.tagline}</p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-oat-border/70">
                    <button type="button" onClick={() => openDetail(p.id)} className="flex-1 py-2 rounded-full bg-oat-warm text-forest text-xs font-semibold">Details &amp; Reviews</button>
                    <button type="button" disabled={p.stock <= 0} onClick={() => onAddToCart(p)} className="flex-1 py-2 rounded-full bg-forest text-oat text-xs font-semibold disabled:opacity-40">
                      {p.stock > 0 ? 'Add to Bag' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Product Detail & Reviews Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-forest-dark/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-oat rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-oat-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-[16/9]">
              <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
              <button type="button" onClick={() => setSelected(null)} className="absolute top-3 right-3 px-3 py-1 rounded-full bg-oat/90 text-forest font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase tracking-widest text-terracotta font-semibold">{selected.category} · SKU {selected.sku}</p>
                  <h3 className="font-display text-3xl font-semibold text-forest">{selected.name}</h3>
                </div>
                <span className="font-display text-2xl font-bold text-forest">₹{selected.price}</span>
              </div>
              <p className="text-sm text-forest/80">{selected.tagline}</p>
              <div className="p-4 rounded-2xl bg-oat-warm/80 text-xs space-y-1.5">
                <p><strong>Botanicals:</strong> {selected.ingredients}</p>
                <p><strong>Daily Ritual:</strong> {selected.ritual}</p>
              </div>
              <div className="border-t border-oat-border pt-4 space-y-3">
                <h4 className="font-semibold text-sm text-forest">Verified Reviews ({reviews.length})</h4>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {reviews.length ? reviews.map(r => (
                    <div key={r.id} className="p-3 rounded-xl bg-oat-warm/50 text-xs">
                      <strong>{r.authorName}</strong> · {'★'.repeat(r.rating)}
                      <p className="mt-1">{r.comment}</p>
                    </div>
                  )) : <p className="text-xs text-sage-muted">No reviews yet.</p>}
                </div>
                <form onSubmit={submitReview} className="flex gap-2">
                  <select value={revRating} onChange={e => setRevRating(e.target.value)} className="px-2 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs">
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}★</option>)}
                  </select>
                  <input value={revComment} onChange={e => setRevComment(e.target.value)} required placeholder="Write a review..." className="flex-1 px-3 py-2 rounded-xl bg-oat-warm border border-oat-border text-xs" />
                  <button type="submit" className="px-4 py-2 rounded-full bg-forest text-oat text-xs font-semibold">Post</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
