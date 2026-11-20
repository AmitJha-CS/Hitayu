import React from 'react';
import { DICT, LANGUAGES } from '../i18n.js';

export default function Navbar({ shop, view, setView, lang, setLang, user, onAuthClick, cartCount, onOpenBag }) {
  const t = DICT[lang] || DICT.en;
  return (
    <header className="sticky top-0 z-40 bg-oat/90 backdrop-blur-md border-b border-oat-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setView('shop')} className="flex items-center gap-2.5 text-left shrink-0">
          <svg className="w-9 h-9" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" fill="#1E3A2F" />
            <path d="M32 13C23 23 19 31 19 39a13 13 0 0 0 26 0c0-8-4-16-13-26Z" fill="#D4962A" />
            <path d="M32 22v26M32 34l-7-6M32 39l7-6" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div className="leading-none">
            <span className="font-display text-2xl font-bold text-forest block">{shop?.name?.split(' ')[0] || 'Hitayu'}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-sage-muted">Organic Living</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-forest/80">
          {[['shop', t.shop], ['blog', t.blog], ['profile', t.profile], ['studio', t.studio]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={view === id ? 'text-terracotta font-semibold' : 'hover:text-terracotta'}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language" className="px-2.5 py-1.5 rounded-full bg-oat-warm border border-oat-border text-xs font-semibold text-forest">
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          <button type="button" onClick={onAuthClick} className="px-3.5 py-1.5 rounded-full bg-oat-warm border border-oat-border text-xs font-semibold text-forest hover:border-forest/40">
            {user ? `${user.name.split(' ')[0]} (${user.role})` : t.signIn}
          </button>

          <button type="button" onClick={onOpenBag} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-forest text-oat text-xs font-semibold hover:bg-forest-light">
            <span>{t.bag}</span>
            <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-turmeric text-forest-dark text-[11px] font-bold">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
