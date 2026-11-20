import React, { useState, useEffect } from 'react';
import { apiRequest } from './api.js';
import Navbar from './components/Navbar.jsx';
import Storefront from './components/Storefront.jsx';
import CartCheckoutDrawer from './components/CartCheckoutDrawer.jsx';
import ProfileAndOrders from './components/ProfileAndOrders.jsx';
import BlogJournal from './components/BlogJournal.jsx';
import AdminStudio from './components/AdminStudio.jsx';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ht_token') || '');
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('ht_cart') || '[]'));
  const [view, setView] = useState('shop');
  const [lang, setLang] = useState(() => localStorage.getItem('ht_lang') || 'en');
  const [bagOpen, setBagOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [toasts, setToasts] = useState([]);

  function toast(msg, isError = false) {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, isError }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }

  async function loadShopAndProducts() {
    const [s, p] = await Promise.all([apiRequest('/api/shop/profile'), apiRequest('/api/products')]);
    setShop(s.shop);
    setProducts(p.products || []);
  }

  useEffect(() => {
    loadShopAndProducts().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('ht_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    apiRequest('/api/auth/me', { token })
      .then(r => setUser(r.user))
      .catch(() => { setToken(''); localStorage.removeItem('ht_token'); setUser(null); });
  }, [token]);

  function saveCart(next) {
    setCart(next);
    localStorage.setItem('ht_cart', JSON.stringify(next));
  }

  function addToCart(product) {
    const ex = cart.find(i => i.productId === product.id);
    const next = ex ? cart.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...cart, { productId: product.id, quantity: 1 }];
    saveCart(next);
    toast(`Added ${product.name} to bag`);
  }

  function updateQty(productId, delta) {
    saveCart(cart.map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0));
  }

  async function toggleWishlist(productId) {
    if (!user) { setAuthOpen(true); return toast('Sign in to save items to wishlist.', true); }
    const res = await apiRequest(`/api/profile/wishlist/${productId}`, { method: 'POST', token });
    setUser({ ...user, wishlist: res.wishlist });
  }

  async function submitAuth(e) {
    e.preventDefault();
    try {
      const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await apiRequest(url, { method: 'POST', body: authForm });
      setToken(res.token);
      localStorage.setItem('ht_token', res.token);
      setUser(res.user);
      setAuthOpen(false);
      toast(`Welcome, ${res.user.name}!`);
    } catch (err) { toast(err.message, true); }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-2xl shadow-lg text-sm ${t.isError ? 'bg-red-800 text-white' : 'bg-forest text-oat border border-turmeric/40'}`}>{t.msg}</div>
        ))}
      </div>

      <Navbar
        shop={shop}
        view={view}
        setView={setView}
        lang={lang}
        setLang={setLang}
        user={user}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        onOpenBag={() => setBagOpen(true)}
        onAuthClick={() => {
          if (user) { setToken(''); localStorage.removeItem('ht_token'); setUser(null); toast('Signed out'); }
          else setAuthOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'shop' && (
          <Storefront
            shop={shop}
            products={products}
            lang={lang}
            user={user}
            token={token}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            onRefreshProducts={loadShopAndProducts}
            onToast={toast}
            onGoBlog={() => setView('blog')}
          />
        )}
        {view === 'blog' && <BlogJournal />}
        {view === 'profile' && (
          <ProfileAndOrders
            user={user}
            token={token}
            onUserUpdated={setUser}
            onNeedLogin={() => setAuthOpen(true)}
            onToast={toast}
          />
        )}
        {view === 'studio' && (
          <AdminStudio
            user={user}
            token={token}
            shop={shop}
            onShopUpdated={setShop}
            onProductsUpdated={loadShopAndProducts}
            onToast={toast}
          />
        )}
      </main>

      <footer className="bg-forest text-oat py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-3 text-xs text-oat/80">
          <div>
            <strong className="font-display text-lg text-oat">{shop?.name || 'Hitayu Organic Wellness'}</strong>
            <p>{shop?.warehouseAddress} · GSTIN: {shop?.gstin}</p>
          </div>
          <div className="sm:text-right">
            <p>{shop?.supportEmail} · {shop?.supportPhone}</p>
            <p>{shop?.returnPolicy}</p>
          </div>
        </div>
      </footer>

      <CartCheckoutDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        cart={cart}
        products={products}
        shop={shop}
        user={user}
        token={token}
        onUpdateQty={updateQty}
        onNeedLogin={() => setAuthOpen(true)}
        onToast={toast}
        onOrderComplete={order => {
          saveCart([]);
          setBagOpen(false);
          loadShopAndProducts();
          toast(`Order ${order.orderNumber} paid & confirmed (₹${order.totalAmount})!`);
          setView('profile');
        }}
      />

      {authOpen && (
        <div className="fixed inset-0 z-50 bg-forest-dark/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAuthOpen(false)}>
          <div className="bg-oat rounded-3xl max-w-md w-full p-6 border border-oat-border shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-display text-3xl font-semibold text-forest">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h3>
              <button type="button" onClick={() => setAuthOpen(false)} className="text-xl text-forest">&times;</button>
            </div>
            <div className="flex gap-2 bg-oat-warm p-1 rounded-full text-xs font-semibold">
              <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-full ${authMode === 'login' ? 'bg-forest text-oat' : 'text-forest'}`}>Sign In</button>
              <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 py-2 rounded-full ${authMode === 'register' ? 'bg-forest text-oat' : 'text-forest'}`}>Register</button>
            </div>
            <form onSubmit={submitAuth} className="space-y-3">
              {authMode === 'register' && <input value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required placeholder="Full Name" className="w-full px-4 py-2.5 rounded-xl bg-oat-warm border border-oat-border text-sm" />}
              <input value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required type="email" placeholder="Email" className="w-full px-4 py-2.5 rounded-xl bg-oat-warm border border-oat-border text-sm" />
              <input value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required type="password" placeholder="Password (8+ chars, letters + numbers)" className="w-full px-4 py-2.5 rounded-xl bg-oat-warm border border-oat-border text-sm" />
              <button type="submit" className="w-full py-3 rounded-full bg-forest text-oat text-sm font-semibold">Continue</button>
            </form>
            <div className="p-3 rounded-2xl bg-sage/60 text-xs text-forest space-y-1">
              <p><strong>Admin:</strong> admin@hitayu.in / Admin@Hitayu2026</p>
              <p><strong>Author:</strong> writer@hitayu.in / Writer@Hitayu2026</p>
              <p><strong>Customer:</strong> customer@hitayu.in / Customer@2026</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
