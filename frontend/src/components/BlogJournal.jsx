import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.js';

export default function BlogJournal() {
  const [blogs, setBlogs] = useState([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);

  useEffect(() => {
    const q = query.trim();
    apiRequest(`/api/blogs${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => setBlogs(r.blogs || [])).catch(() => {});
  }, [query]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-terracotta font-semibold">Hitayu Wellness Journal</p>
          <h2 className="font-display text-4xl font-semibold text-forest mt-1">Stories, Guides &amp; Herbal Rituals</h2>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Search articles..." className="w-full md:w-64 px-4 py-2 rounded-full bg-oat-warm border border-oat-border text-sm" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogs.map(b => (
          <article key={b.id} className="bg-oat rounded-3xl border border-oat-border overflow-hidden flex flex-col shadow-sm">
            {b.coverImageUrl && <img src={b.coverImageUrl} alt={b.title} className="w-full aspect-[16/10] object-cover" />}
            <div className="p-5 flex-1 flex flex-col justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-sage text-forest font-semibold">{b.category}</span>
                  {b.authoredByAgent && <span className="px-2.5 py-0.5 rounded-full bg-turmeric/25 text-forest font-semibold">AI Agent · {b.agentName}</span>}
                </div>
                <h3 className="font-display text-2xl font-semibold text-forest mt-2 leading-snug">{b.title}</h3>
                <p className="text-xs text-sage-muted mt-1">By {b.authorName} · {b.createdAt.slice(0, 10)}</p>
                <p className="text-sm text-forest/75 mt-2">{b.excerpt}</p>
              </div>
              <button type="button" onClick={() => setActive(b)} className="py-2 rounded-full bg-forest text-oat text-xs font-semibold">Read Full Article</button>
            </div>
          </article>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 bg-forest-dark/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="bg-oat rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-oat-border shadow-2xl" onClick={e => e.stopPropagation()}>
            {active.coverImageUrl && <img src={active.coverImageUrl} alt={active.title} className="w-full aspect-[16/8] object-cover" />}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-terracotta font-semibold">{active.category} · By {active.authorName}</p>
                  <h3 className="font-display text-3xl sm:text-4xl font-semibold text-forest mt-1">{active.title}</h3>
                </div>
                <button type="button" onClick={() => setActive(null)} className="px-3 py-1 rounded-full bg-oat-warm text-forest font-bold">&times;</button>
              </div>
              <div className="space-y-3 text-sm sm:text-base text-forest/85">
                {active.body.split(/\n\n+/).map((para, i) => <p key={i} className="leading-relaxed">{para}</p>)}
              </div>
              {active.media?.length > 0 && (
                <div className="pt-4 border-t border-oat-border space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-sage-muted font-semibold">Attached Photos &amp; Videos</h4>
                  {active.media.map((m, i) => m.type === 'video' ? (
                    <figure key={i} className="space-y-1">
                      <video controls className="w-full rounded-2xl border border-oat-border bg-black"><source src={m.url} /></video>
                      <figcaption className="text-xs text-sage-muted">{m.caption}</figcaption>
                    </figure>
                  ) : (
                    <figure key={i} className="space-y-1">
                      <img src={m.url} alt={m.caption} className="w-full rounded-2xl border border-oat-border object-cover" />
                      <figcaption className="text-xs text-sage-muted">{m.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
