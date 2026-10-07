/* LapakKu – aplikasi jual beli statis (tanpa backend).
 * Data disimpan di localStorage. Cocok untuk demo/portofolio di GitHub Pages. */
(() => {
  'use strict';

  /* ================= Konfigurasi ================= */
  const KEYS = { users: 'lapak_users', products: 'lapak_products', session: 'lapak_session', favs: 'lapak_favs' };
  const CATEGORIES = {
    'Elektronik': '📱',
    'Fashion': '👕',
    'Rumah Tangga': '🏠',
    'Hobi & Olahraga': '🎸',
    'Kendaraan': '🚲',
    'Lainnya': '📦'
  };
  const MAX_IMG = 640; // sisi terpanjang foto (px) agar muat di localStorage

  /* ================= Helper ================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const store = {
    get(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    }
  };

  const rupiah = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Escape HTML untuk mencegah XSS saat data pengguna dirender via innerHTML.
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function hashPassword(password, salt) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + password));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(salt + ':' + password))); // cadangan lemah jika non-HTTPS
  }

  function normalizePhone(p) {
    let d = String(p).replace(/\D/g, '');
    if (d.startsWith('0')) d = '62' + d.slice(1);
    return d;
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, MAX_IMG / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ================= State ================= */
  const state = {
    user: null,
    view: 'all',      // all | mine | fav
    query: '',
    category: 'Semua',
    sort: 'new',
    pendingImage: null // dataURL foto saat form produk dibuka
  };

  const getUsers = () => store.get(KEYS.users, []);
  const getProducts = () => store.get(KEYS.products, []);
  const getFavs = () => store.get(KEYS.favs + '_' + state.user.id, []);

  /* ================= Data awal (demo) ================= */
  function seed() {
    if (store.get(KEYS.products, null)) return;
    const now = Date.now();
    const demo = [
      ['Sepeda Lipat 20 inci', 1850000, 'Kendaraan', 'Bekas - Seperti baru', 'Sepeda lipat 7 speed, rem cakram, jarang dipakai. Lengkap dengan tas.'],
      ['Headphone Bluetooth ANC', 450000, 'Elektronik', 'Bekas - Layak pakai', 'Baterai tahan ±20 jam, suara bersih. Box dan kabel charger lengkap.'],
      ['Jaket Denim Pria L', 120000, 'Fashion', 'Bekas - Seperti baru', 'Ukuran L, warna biru tua, tanpa cacat.'],
      ['Rice Cooker 1,8 L', 175000, 'Rumah Tangga', 'Baru', 'Garansi toko 1 tahun, segel belum dibuka.'],
      ['Gitar Akustik Pemula', 650000, 'Hobi & Olahraga', 'Bekas - Layak pakai', 'Senar baru diganti, suara masih bagus. Bonus softcase.'],
      ['Meja Belajar Kayu', 300000, 'Rumah Tangga', 'Bekas - Layak pakai', 'Ukuran 100x50 cm, kokoh. Ambil di tempat.']
    ].map(([title, price, category, condition, description], i) => ({
      id: 'demo' + i, title, price, category, condition, description,
      image: null, status: 'tersedia', createdAt: now - i * 3600_000,
      sellerId: 'demo', sellerName: 'Lapak Demo', sellerPhone: '6281234567890'
    }));
    store.set(KEYS.products, demo);
  }

  /* ================= Auth ================= */
  function showAuth() {
    $('#authView').hidden = false;
    $('#appView').hidden = true;
  }

  function showApp() {
    $('#authView').hidden = true;
    $('#appView').hidden = false;
    $('#userName').textContent = state.user.name;
    render();
  }

  function setAuthTab(tab) {
    $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
    $('#loginForm').hidden = tab !== 'login';
    $('#registerForm').hidden = tab !== 'register';
    $('#loginError').textContent = '';
    $('#registerError').textContent = '';
  }

  async function handleRegister(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = f.get('name').trim();
    const email = f.get('email').trim().toLowerCase();
    const phone = f.get('phone').trim();
    const password = f.get('password');
    const err = $('#registerError');

    if (normalizePhone(phone).length < 9) { err.textContent = 'Nomor WhatsApp tidak valid.'; return; }
    const users = getUsers();
    if (users.some(u => u.email === email)) { err.textContent = 'Email sudah terdaftar.'; return; }

    const salt = uid();
    const user = { id: uid(), name, email, phone, salt, passHash: await hashPassword(password, salt) };
    users.push(user);
    if (!store.set(KEYS.users, users)) { err.textContent = 'Gagal menyimpan akun (penyimpanan penuh).'; return; }

    startSession(user);
    toast('Akun dibuat. Selamat datang, ' + name + '!');
    e.target.reset();
  }

  async function handleLogin(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = f.get('email').trim().toLowerCase();
    const password = f.get('password');
    const err = $('#loginError');

    const user = getUsers().find(u => u.email === email);
    if (!user || (await hashPassword(password, user.salt)) !== user.passHash) {
      err.textContent = 'Email atau kata sandi salah.';
      return;
    }
    startSession(user);
    e.target.reset();
    err.textContent = '';
  }

  function startSession(user) {
    state.user = user;
    store.set(KEYS.session, user.id);
    state.view = 'all';
    showApp();
  }

  function logout() {
    localStorage.removeItem(KEYS.session);
    state.user = null;
    $('#detailDialog').close?.();
    showAuth();
  }

  /* ================= Render ================= */
  function filteredProducts() {
    let list = getProducts();
    const favs = getFavs();

    if (state.view === 'mine') list = list.filter(p => p.sellerId === state.user.id);
    if (state.view === 'fav') list = list.filter(p => favs.includes(p.id));
    if (state.category !== 'Semua') list = list.filter(p => p.category === state.category);
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(p => (p.title + ' ' + p.description).toLowerCase().includes(q));
    }
    const sorters = {
      new: (a, b) => b.createdAt - a.createdAt,
      cheap: (a, b) => a.price - b.price,
      expensive: (a, b) => b.price - a.price
    };
    return list.sort(sorters[state.sort]);
  }

  function thumbHtml(p) {
    return p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`
      : esc(CATEGORIES[p.category] || '📦');
  }

  function render() {
    const list = filteredProducts();
    const favs = getFavs();
    const grid = $('#grid');

    grid.innerHTML = list.map(p => `
      <article class="card ${p.status === 'terjual' ? 'sold-overlay' : ''}" data-id="${esc(p.id)}">
        <button class="fav-btn" data-fav="${esc(p.id)}" aria-label="Favorit" title="Favorit">${favs.includes(p.id) ? '❤️' : '🤍'}</button>
        <div class="thumb">${thumbHtml(p)}</div>
        <div class="card-body">
          <h3 class="card-title">${esc(p.title)}</h3>
          <div class="price">${rupiah(p.price)}</div>
          <span class="badge ${p.status === 'terjual' ? 'badge-sold' : ''}">${p.status === 'terjual' ? 'Terjual' : esc(p.condition)}</span>
          <div class="meta">${esc(p.category)} • ${esc(p.sellerName)}</div>
        </div>
      </article>`).join('');

    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = list.length + ' barang';
    $$('.vtab').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  }

  /* ================= Detail ================= */
  function openDetail(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    const mine = p.sellerId === state.user.id;
    const msg = encodeURIComponent(`Halo ${p.sellerName}, saya tertarik dengan "${p.title}" (${rupiah(p.price)}) di LapakKu. Apakah masih tersedia?`);

    $('#detailBody').innerHTML = `
      <div class="detail-img">${thumbHtml(p)}</div>
      <span class="badge ${p.status === 'terjual' ? 'badge-sold' : ''}">${p.status === 'terjual' ? 'Terjual' : esc(p.condition)}</span>
      <h2>${esc(p.title)}</h2>
      <div class="price" style="font-size:1.4rem">${rupiah(p.price)}</div>
      <p class="meta">${esc(p.category)} • Diposting ${new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p class="detail-desc">${esc(p.description)}</p>
      <div class="detail-seller">Penjual: <strong>${esc(p.sellerName)}</strong></div>
      <div class="dialog-actions">
        <button class="btn btn-ghost" data-close>Tutup</button>
        ${mine
          ? `<button class="btn btn-ghost" data-toggle-sold="${esc(p.id)}">${p.status === 'terjual' ? 'Tandai tersedia' : 'Tandai terjual'}</button>
             <button class="btn btn-ghost" data-edit="${esc(p.id)}">Edit</button>
             <button class="btn btn-danger" data-delete="${esc(p.id)}">Hapus</button>`
          : `<a class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(normalizePhone(p.sellerPhone))}?text=${msg}">Hubungi via WhatsApp</a>`}
      </div>`;
    $('#detailDialog').showModal();
  }

  /* ================= Produk: tambah / edit / hapus ================= */
  function openProductForm(id) {
    const form = $('#productForm');
    form.reset();
    state.pendingImage = null;
    $('#imagePreview').hidden = true;
    $('#productError').textContent = '';

    if (id) {
      const p = getProducts().find(x => x.id === id);
      if (!p) return;
      $('#productDialogTitle').textContent = 'Edit Barang';
      form.id.value = p.id;
      form.title.value = p.title;
      form.price.value = p.price;
      form.category.value = p.category;
      form.condition.value = p.condition;
      form.description.value = p.description;
      state.pendingImage = p.image;
      if (p.image) { $('#imagePreview').src = p.image; $('#imagePreview').hidden = false; }
    } else {
      $('#productDialogTitle').textContent = 'Jual Barang';
      form.id.value = '';
    }
    $('#productDialog').showModal();
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state.pendingImage = await resizeImage(file);
      $('#imagePreview').src = state.pendingImage;
      $('#imagePreview').hidden = false;
    } catch {
      $('#productError').textContent = 'Foto tidak dapat dibaca.';
    }
  }

  function handleProductSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const price = Number(f.price.value);
    if (!(price >= 0)) { $('#productError').textContent = 'Harga tidak valid.'; return; }

    const products = getProducts();
    const data = {
      title: f.title.value.trim(),
      price,
      category: f.category.value,
      condition: f.condition.value,
      description: f.description.value.trim(),
      image: state.pendingImage
    };

    if (f.id.value) {
      const idx = products.findIndex(p => p.id === f.id.value && p.sellerId === state.user.id);
      if (idx < 0) return;
      products[idx] = { ...products[idx], ...data };
    } else {
      products.push({
        id: uid(), status: 'tersedia', createdAt: Date.now(),
        sellerId: state.user.id, sellerName: state.user.name, sellerPhone: state.user.phone,
        ...data
      });
    }

    if (!store.set(KEYS.products, products)) {
      $('#productError').textContent = 'Penyimpanan browser penuh. Gunakan foto lebih kecil atau hapus barang lama.';
      return;
    }
    $('#productDialog').close();
    toast('Barang disimpan.');
    render();
  }

  function mutateOwned(id, fn) {
    const products = getProducts();
    const idx = products.findIndex(p => p.id === id && p.sellerId === state.user.id);
    if (idx < 0) return;
    fn(products, idx);
    store.set(KEYS.products, products);
    render();
  }

  function toggleFav(id) {
    const favs = getFavs();
    const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    store.set(KEYS.favs + '_' + state.user.id, next);
    render();
  }

  /* ================= Event ================= */
  function bind() {
    // Auth
    $$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => setAuthTab(b.dataset.authTab)));
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#registerForm').addEventListener('submit', handleRegister);
    $('#logoutBtn').addEventListener('click', logout);

    // Filter
    const catFilter = $('#categoryFilter');
    catFilter.innerHTML = ['Semua', ...Object.keys(CATEGORIES)].map(c => `<option>${esc(c)}</option>`).join('');
    $('#formCategory').innerHTML = Object.keys(CATEGORIES).map(c => `<option>${esc(c)}</option>`).join('');
    catFilter.addEventListener('change', e => { state.category = e.target.value; render(); });
    $('#sortFilter').addEventListener('change', e => { state.sort = e.target.value; render(); });
    $('#searchInput').addEventListener('input', e => { state.query = e.target.value.trim(); render(); });
    $$('.vtab').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));

    // Grid (delegasi)
    $('#grid').addEventListener('click', e => {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) { e.stopPropagation(); toggleFav(favBtn.dataset.fav); return; }
      const card = e.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });

    // Detail dialog (delegasi)
    $('#detailDialog').addEventListener('click', e => {
      const t = e.target;
      if (t.matches('[data-close]')) return $('#detailDialog').close();
      if (t.dataset.edit) { $('#detailDialog').close(); return openProductForm(t.dataset.edit); }
      if (t.dataset.toggleSold) {
        mutateOwned(t.dataset.toggleSold, (arr, i) => { arr[i].status = arr[i].status === 'terjual' ? 'tersedia' : 'terjual'; });
        $('#detailDialog').close();
        return toast('Status diperbarui.');
      }
      if (t.dataset.delete && confirm('Hapus barang ini secara permanen?')) {
        mutateOwned(t.dataset.delete, (arr, i) => arr.splice(i, 1));
        $('#detailDialog').close();
        toast('Barang dihapus.');
      }
    });

    // Form produk
    $('#sellBtn').addEventListener('click', () => openProductForm());
    $('#cancelProduct').addEventListener('click', () => $('#productDialog').close());
    $('#productForm').addEventListener('submit', handleProductSubmit);
    $('#productForm').image.addEventListener('change', handleImageChange);

    // Tutup dialog saat klik area backdrop
    $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  }

  /* ================= Init ================= */
  function init() {
    seed();
    bind();
    const sessionId = store.get(KEYS.session, null);
    const user = sessionId && getUsers().find(u => u.id === sessionId);
    if (user) { state.user = user; showApp(); } else { showAuth(); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
