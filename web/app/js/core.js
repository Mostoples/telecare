/* ============================================================
   TeleCare App — core.js
   Utilitas, penyimpanan lokal, perute (router), komponen UI,
   dan penggambar grafik di atas canvas/SVG. Tanpa pustaka luar.
   ============================================================ */
window.TC = window.TC || {};

(function (TC) {
  'use strict';

  /* ---------------- 1. UTIL ---------------- */
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.round(rnd(a, b));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const uid = (p) => (p || 'id') + '-' + Math.random().toString(36).slice(2, 9);

  /**
   * Pengenal acak kriptografis (± 128 bit) untuk hal yang ikut menentukan
   * hak akses — mis. ID konsultasi, yang sekaligus menjadi ID ruang panggilan
   * dan dibagikan lewat tautan undangan. `uid()` memakai Math.random dan
   * terlalu mudah diterka untuk keperluan itu.
   */
  function secureId(p) {
    const pre = (p || 'id') + '-';
    const c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      let out = '';
      for (let i = 0; i < b.length; i++) out += b[i].toString(36).padStart(2, '0');
      return pre + out.slice(0, 26);
    }
    // Cadangan bila Web Crypto tidak tersedia; dicatat agar tidak lolos diam-diam.
    console.warn('[TeleCare] Web Crypto tidak tersedia, ID memakai Math.random.');
    let out = '';
    while (out.length < 26) out += Math.random().toString(36).slice(2);
    return pre + out.slice(0, 26);
  }

  // escape agar teks pengguna tidak pernah ditafsirkan sebagai HTML
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const icon = (name, cls) =>
    `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#ic-${name}"/></svg>`;

  /* Ikon 3D (render Blender, lihat blender/build_ikon3d.py). Dipakai untuk
     titik fokus visual; ikon garis SVG tetap dipakai di teks dan tombol. */
  // Tema: 'biru' (bawaan) | 'hijau'. Aset 3D biru ada di assets/3d/biru/.
  const tema = {
    kini() { return document.documentElement.getAttribute('data-tema') === 'hijau' ? 'hijau' : 'biru'; },
    pasang(t) {
      t = t === 'hijau' ? 'hijau' : 'biru';
      try { localStorage.setItem('tc.tema', t); } catch (e) {}
      document.documentElement.setAttribute('data-tema', t);
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'hijau' ? '#0B9A62' : '#2F7BFF');
      // ganti sumber semua ikon/ilustrasi 3D yang sedang tampil
      document.querySelectorAll('img.i3d, img.ilus3d').forEach((im) => {
        im.src = im.src.replace(/assets\/3d\/(biru\/)?/, 'assets/3d/' + (t === 'biru' ? 'biru/' : ''));
      });
      window.dispatchEvent(new CustomEvent('tc:tema', { detail: t }));
    },
    warna(nama) {   // nilai token CSS, mis. warna('--g2') untuk canvas
      return getComputedStyle(document.documentElement).getPropertyValue(nama).trim() || '#2F7BFF';
    }
  };
  const aset3d = () => '../assets/3d/' + (tema.kini() === 'biru' ? 'biru/' : '');
  const ASET3D = '../assets/3d/';
  // Versi animasi (WebP loop, ikon-anim/) dipakai lebih dulu; bila belum ada,
  // jatuh ke render diam (ikon/).
  const i3d = (name, cls) =>
    `<img class="i3d is-anim${cls ? ' ' + cls : ''}" src="${aset3d()}ikon-anim/${name}.webp" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.onerror=null;this.classList.remove('is-anim');this.src='${aset3d()}ikon/${name}.webp'">`;
  // Ikon 3D diam (untuk dock tab & daftar panjang yang tak perlu animasi).
  const i3dDiam = (name, cls) =>
    `<img class="i3d${cls ? ' ' + cls : ''}" src="${aset3d()}ikon/${name}.webp" alt="" decoding="async" draggable="false">`;
  // Pemetaan ikon garis sprite → ikon 3D Blender padanannya.
  const IKON3D = { home: 'rumah', chart: 'grafik', chat: 'chat', user: 'pengguna', users: 'pengguna',
    inbox: 'lonceng', cal: 'kalender', watch: 'jam', stetho: 'stetoskop', building: 'gedung',
    doc: 'grafik', bell: 'lonceng', target: 'tujuan', sync: 'gerigi', cam: 'makan' };
  const ilus3d = (name, cls) =>
    `<img class="ilus3d${cls ? ' ' + cls : ''}" src="${aset3d()}ilustrasi/${name}.webp" alt="" decoding="async" draggable="false">`;

  const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');

  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
                  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const pad2 = (n) => String(n).padStart(2, '0');
  const hhmm = (d) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const fullDate = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 604800) return Math.floor(s / 86400) + ' hari lalu';
    return shortDate(new Date(ts));
  }

  function countdown(ms) {
    if (ms <= 0) return '00:00';
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' : '') + pad2(m) + ':' + pad2(s);
  }

  function greeting(d) {
    const h = d.getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 19) return 'Selamat sore';
    return 'Selamat malam';
  }

  const initials = (name) => String(name || '?').trim().split(/\s+/)
    .map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  /* ---------------- 2. STORE ---------------- */
  // Seluruh data aplikasi tersimpan di localStorage perangkat ini.
  const KEY = 'telecare.app.v1';

  const defaults = () => ({
    session: null,                 // { userId }
    users: {},                     // id -> { id, name, email, phone, pass, ... }
    onboarded: false,
    devices: [],                   // perangkat terpasang
    activeDeviceId: null,
    lastSync: null,
    pendingSamples: 0,
    meals: [],                     // riwayat sesi makan
    activeMeal: null,              // sesi yang sedang berjalan
    consults: [],                  // riwayat & percakapan konsultasi
    // Catatan klinis dokter, dikelompokkan per pasien:
    //   { [patientId]: [{ id, at, author, role, text }] }
    clinicalNotes: {},
    // Dokter yang sudah diverifikasi admin platform (daftar id).
    verifiedDoctors: [],
    /* Kalibrasi tingkat sensor, milik pengembang — dikelompokkan per jenis
       perangkat lalu per parameter:
         { band: { hr: { gain: 1, offset: 0, on: true }, ... }, ... }
       Berbeda dari `profile.bpCal` yang merupakan satu titik acuan tensimeter
       milik pengguna. Yang ini mengubah nilai mentah dari sensor sebelum
       masuk ke mesin vital: nilai = mentah * gain + offset. */
    sensorCal: {},
    // Sakelar induk kalibrasi sensor; dimatikan berarti nilai mentah dipakai apa adanya.
    sensorCalOn: true,
    // Pasien yang ditandai perlu tindak lanjut:
    //   [{ id, patientId, at, by }]
    escalations: [],
    appointments: [],
    notifications: [],
    vitalsHistory: [],
    // Agregat vital per hari, dipakai tren 7 hari pada layar Analisis:
    //   { 'YYYY-MM-DD': { n, hrSum, hrMin, stressSum, spo2Min, steps, sumber } }
    dailyVitals: {},
    profile: {
      nickname: '', gender: '', age: null, height: null, weight: null,
      goal: 'jaga-berat',
      targets: { kcal: 2000, carb: 250, protein: 60, fat: 65 },
      bpCal: null                  // { sys, dia, at }
    },
    // turn: { urls, username, credential } — server TURN pilihan pengguna,
    // menimpa bawaan di app/js/rtc-config.js. Lihat Pengaturan → Panggilan.
    settings: { fastDemo: true, notif: true, turn: null }
  });

  let state = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(defaults(), JSON.parse(raw));
    } catch (e) {
      console.warn('[TeleCare] penyimpanan lokal tidak terbaca, memakai data awal.', e);
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('[TeleCare] gagal menyimpan.', e); }
  }

  const Store = {
    get state() { return state; },
    load, save,
    reset() { state = defaults(); save(); },
    update(fn) { fn(state); save(); },
    user() { return state.session ? state.users[state.session.userId] || null : null; },
    /** Peran pengguna aktif; 'pasien' bila belum ditetapkan. */
    role() { const u = this.user(); return (u && u.role) || 'pasien'; },
    is(role) { return this.role() === role; },
    profile() { return state.profile; },
    activeDevice() {
      return state.devices.find((d) => d.id === state.activeDeviceId) || null;
    },
    connectedDevices() { return state.devices.filter((d) => d.connected); },

    /* ---------------- verifikasi dokter (admin platform) ---------------- */
    isVerified(doctorId) {
      return (state.verifiedDoctors || []).indexOf(doctorId) !== -1;
    },
    verifyDoctor(doctorId) {
      if (!doctorId || this.isVerified(doctorId)) return false;
      state.verifiedDoctors = (state.verifiedDoctors || []).concat([doctorId]);
      save();
      return true;
    },

    /* ---------------- kalibrasi sensor (pengembang) ---------------- */
    /** Kalibrasi satu parameter pada satu jenis perangkat, dengan nilai bawaan netral. */
    cal(deviceType, param) {
      const all = state.sensorCal || {};
      const perJenis = all[deviceType] || {};
      const c = perJenis[param];
      return {
        gain: c && typeof c.gain === 'number' ? c.gain : 1,
        offset: c && typeof c.offset === 'number' ? c.offset : 0,
        on: !c || c.on !== false
      };
    },
    setCal(deviceType, param, patch) {
      if (!deviceType || !param) return null;
      if (!state.sensorCal) state.sensorCal = {};
      if (!state.sensorCal[deviceType]) state.sensorCal[deviceType] = {};
      const kini = this.cal(deviceType, param);
      state.sensorCal[deviceType][param] = Object.assign(kini, patch || {});
      save();
      return state.sensorCal[deviceType][param];
    },
    /** Mengosongkan kalibrasi satu jenis perangkat, atau seluruhnya bila kosong. */
    resetCal(deviceType) {
      if (deviceType) delete (state.sensorCal || {})[deviceType];
      else state.sensorCal = {};
      save();
    },
    /** Benar bila ada satu saja parameter yang menyimpang dari netral. */
    calAktif(deviceType) {
      const per = (state.sensorCal || {})[deviceType] || {};
      return Object.keys(per).some((k) => {
        const c = per[k];
        return c && c.on !== false && (c.gain !== 1 || c.offset !== 0);
      });
    },

    /* ---------------- penandaan eskalasi ---------------- */
    escalationsFor(patientId) {
      return (state.escalations || [])
        .filter((e) => e.patientId === patientId)
        .sort((a, b) => (b.at || 0) - (a.at || 0));
    },
    addEscalation(patientId, by) {
      if (!patientId) return null;
      const e = { id: uid('esc'), patientId, at: Date.now(), by: by || null };
      state.escalations = (state.escalations || []).concat([e]).slice(-200);
      save();
      return e;
    },
    removeEscalation(id) {
      const n = (state.escalations || []).length;
      state.escalations = (state.escalations || []).filter((e) => e.id !== id);
      save();
      return state.escalations.length !== n;
    },
    notify(title, body, kind) {
      state.notifications.unshift({
        id: uid('n'), title, body, kind: kind || 'info', at: Date.now(), read: false
      });
      state.notifications = state.notifications.slice(0, 40);
      save();
    },
    unread() { return state.notifications.filter((n) => !n.read).length; }
  };

  /* ---------------- 3. ROUTER ---------------- */
  const routes = [];
  let current = { path: '/', params: {} };
  let cleanups = [];

  function route(pattern, handler, opts) {
    // "/consult/:id" -> regex
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
      keys.push(k); return '([^/]+)';
    }) + '$');
    routes.push(Object.assign({ rx, keys, handler }, opts || {}));
  }

  function onLeave(fn) { cleanups.push(fn); }

  function runCleanups() {
    cleanups.forEach((fn) => { try { fn(); } catch (e) { /* abaikan */ } });
    cleanups = [];
  }

  function navigate(path, replace) {
    if (replace) location.replace('#' + path);
    else location.hash = path;
  }

  function back(fallback) {
    if (history.length > 1) history.back();
    else navigate(fallback || '/home', true);
  }

  function resolve() {
    const path = (location.hash || '#/').slice(1) || '/';
    const clean = path.split('?')[0];
    for (const r of routes) {
      const m = clean.match(r.rx);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, path: clean, params };
      }
    }
    return null;
  }

  let rendering = false;
  function render() {
    if (rendering) return;
    rendering = true;
    runCleanups();

    const found = resolve();
    if (!found) { rendering = false; navigate('/home', true); return; }

    // penjaga akses: sebagian besar layar butuh sesi masuk
    const signedIn = !!Store.user();
    if (found.route.guard === 'auth' && !signedIn) {
      rendering = false;
      navigate(state.onboarded ? '/masuk' : '/mulai', true);
      return;
    }
    if (found.route.guard === 'guest' && signedIn) {
      rendering = false; navigate('/home', true); return;
    }

    current = { path: found.path, params: found.params, route: found.route };
    try {
      found.route.handler(found.params);
    } catch (e) {
      console.error('[TeleCare] gagal menggambar layar:', e);
      $('#view').innerHTML = `<div class="empty">${icon('alert')}
        <b>Terjadi kesalahan</b><p>Layar ini gagal dimuat. Coba kembali ke beranda.</p>
        <a class="btn btn--primary mt" href="#/home">Ke Beranda</a></div>`;
    }
    window.scrollTo(0, 0);
    rendering = false;
  }

  const Router = {
    route, navigate, back, render, onLeave,
    get current() { return current; }
  };

  /* ---------------- 4. SHELL / UI ---------------- */
  function setView(html, opts) {
    const v = $('#view');
    v.className = 'view' + (opts && opts.cls ? ' ' + opts.cls : '');
    v.innerHTML = html;
    return v;
  }

  function setTopbar(html) {
    $('#topbar').innerHTML = html || '';
  }

  function topbar(title, opts) {
    opts = opts || {};
    const sub = opts.sub ? `<small>${esc(opts.sub)}</small>` : '';
    const backBtn = opts.back === false ? '' :
      `<button class="topbar__back" data-back aria-label="Kembali">${icon('back')}</button>`;
    setTopbar(`<header class="topbar">
      ${backBtn}
      <div class="topbar__title">${esc(title)}${sub}</div>
      <div class="topbar__act">${opts.actions || ''}</div>
    </header>`);
  }

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' toast--err' : '');
    el.innerHTML = icon(kind === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  /** Lembar bawah (mobile) / dialog (desktop). */
  function sheet(html, opts) {
    opts = opts || {};
    close();
    // Ganti simpul overlay agar pendengar dari lembar sebelumnya ikut terbuang.
    const old = $('#overlay');
    const ov = document.createElement('div');
    ov.id = 'overlay';
    old.replaceWith(ov);
    ov.innerHTML = `<div class="scrim" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet__grip"></div>${html}
      </div>`;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov._onKey = onKey;
    ov.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
    const focusable = ov.querySelector('input,button,select,textarea');
    if (focusable && opts.focus !== false) setTimeout(() => focusable.focus(), 60);
    return ov;
  }

  function close() {
    const ov = $('#overlay');
    if (ov._onKey) { document.removeEventListener('keydown', ov._onKey); ov._onKey = null; }
    ov.innerHTML = '';
  }

  function confirmSheet(opts) {
    return new Promise((resolve) => {
      sheet(`
        <h3>${esc(opts.title)}</h3>
        <p class="sub">${esc(opts.body || '')}</p>
        <div class="stack--sm stack">
          <button class="btn ${opts.danger ? 'btn--danger' : 'btn--primary'} btn--block" data-yes>${esc(opts.ok || 'Lanjutkan')}</button>
          <button class="btn btn--ghost btn--block" data-close>${esc(opts.cancel || 'Batal')}</button>
        </div>`);
      $('#overlay').addEventListener('click', (e) => {
        if (e.target.closest('[data-yes]')) { close(); resolve(true); }
        else if (e.target.closest('[data-close]')) { close(); resolve(false); }
      });
    });
  }

  /* ---------------- 5. GRAFIK ---------------- */
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return null;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  /** Garis mungil tanpa sumbu, untuk kartu vital. */
  function sparkline(cv, data, color) {
    const f = fitCanvas(cv);
    if (!f || data.length < 2) return;
    const { ctx, w, h } = f;
    ctx.clearRect(0, 0, w, h);
    let mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
    if (mx - mn < 1e-6) { mx += 1; mn -= 1; }
    const pad = 3;
    const X = (i) => (i / (data.length - 1)) * w;
    const Y = (v) => h - pad - ((v - mn) / (mx - mn)) * (h - pad * 2);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color + '3a'); g.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
    ctx.strokeStyle = color; ctx.lineWidth = 1.7;
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.stroke();

    ctx.beginPath();
    ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 2.3, 0, 7);
    ctx.fillStyle = color; ctx.fill();
  }

  /**
   * Grafik garis dengan sumbu.
   * series: [{ data:[], color:'#..', fill:bool, label:'' }]
   */
  function lineChart(cv, series, opts) {
    opts = opts || {};
    const f = fitCanvas(cv);
    if (!f) return;
    const { ctx, w, h } = f;
    ctx.clearRect(0, 0, w, h);
    const padL = opts.padL != null ? opts.padL : 30;
    const padB = 22, padT = 10, padR = 8;
    const iw = w - padL - padR, ih = h - padT - padB;

    let mn = opts.min, mx = opts.max;
    if (mn == null || mx == null) {
      const all = series.reduce((a, s) => a.concat(s.data.filter((v) => v != null)), []);
      if (!all.length) return;
      mn = mn != null ? mn : Math.min.apply(null, all);
      mx = mx != null ? mx : Math.max.apply(null, all);
      const pad = (mx - mn) * 0.15 || 1;
      mn -= pad; mx += pad;
    }
    const X = (i, n) => padL + (n < 2 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = (v) => padT + (1 - (v - mn) / (mx - mn)) * ih;

    // kisi + label sumbu Y
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8AA79C'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 3; k++) {
      const v = mn + (k / 3) * (mx - mn), y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y);
      ctx.strokeStyle = '#EDF3F0'; ctx.lineWidth = 1; ctx.stroke();
      if (opts.yLabels !== false) ctx.fillText(Math.round(v), padL - 6, y);
    }

    // label sumbu X
    if (opts.xLabels) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      opts.xLabels.forEach((lab, i) => {
        const x = clamp(X(i, opts.xLabels.length), padL + 10, w - padR - 10);
        ctx.fillText(lab, x, h - 6);
      });
    }

    series.forEach((s) => {
      const d = s.data, n = d.length;
      if (n < 1) return;
      const pts = [];
      for (let i = 0; i < n; i++) if (d[i] != null) pts.push([X(i, n), Y(d[i])]);
      if (!pts.length) return;

      if (s.fill) {
        const g = ctx.createLinearGradient(0, padT, 0, h - padB);
        g.addColorStop(0, s.color + '33'); g.addColorStop(1, s.color + '00');
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); });
        ctx.lineTo(pts[pts.length - 1][0], h - padB); ctx.lineTo(pts[0][0], h - padB);
        ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      }

      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      if (s.smooth !== false && pts.length > 2) {
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1], p1 = pts[i];
          const cx = (p0[0] + p1[0]) / 2;
          ctx.bezierCurveTo(cx, p0[1], cx, p1[1], p1[0], p1[1]);
        }
      } else {
        pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); });
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2;
      ctx.lineJoin = ctx.lineCap = 'round';
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (s.dots) {
        pts.forEach((p) => {
          ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 2.4; ctx.strokeStyle = s.color; ctx.stroke();
        });
      }
    });
  }

  /** Batang vertikal sederhana. */
  function barChart(cv, data, labels, color) {
    const f = fitCanvas(cv);
    if (!f) return;
    const { ctx, w, h } = f;
    ctx.clearRect(0, 0, w, h);
    const padB = 20, padT = 8;
    const mx = Math.max.apply(null, data.concat([1]));
    const n = data.length, gap = 6;
    const bw = (w - gap * (n - 1)) / n;
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    data.forEach((v, i) => {
      const bh = Math.max(3, ((v / mx) * (h - padT - padB)));
      const x = i * (bw + gap), y = h - padB - bh;
      const g = ctx.createLinearGradient(0, y, 0, h - padB);
      g.addColorStop(0, color); g.addColorStop(1, color + '55');
      ctx.fillStyle = g;
      const r = Math.min(6, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x, h - padB); ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, h - padB); ctx.closePath(); ctx.fill();
      if (labels && labels[i]) {
        ctx.fillStyle = '#8AA79C';
        ctx.fillText(labels[i], x + bw / 2, h - 6);
      }
    });
  }

  /** Busur setengah lingkaran 0–100 sebagai SVG. */
  function gaugeSvg(value, opts) {
    opts = opts || {};
    const v = clamp(value, 0, 100);
    const LEN = 258;
    const off = Math.round(LEN - (v / 100) * LEN);
    const ang = (-90 + (v / 100) * 180).toFixed(1);
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 200 118" style="width:100%">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
        <stop style="stop-color:var(--g2)"/><stop offset=".55" stop-color="#E09B12"/><stop offset="1" stop-color="#E2543F"/>
      </linearGradient></defs>
      <path d="M18 106a82 82 0 0 1 164 0" fill="none" stroke="#EDF3F0" stroke-width="16" stroke-linecap="round"/>
      <path d="M18 106a82 82 0 0 1 164 0" fill="none" stroke="url(#${gid})" stroke-width="16"
            stroke-linecap="round" stroke-dasharray="${LEN}" stroke-dashoffset="${off}"/>
      <g transform="rotate(${ang} 100 106)">
        <path d="M100 106V44" stroke="#08201A" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="100" cy="106" r="6.5" fill="#08201A"/><circle cx="100" cy="106" r="2.8" fill="#fff"/>
      </g></svg>`;
  }

  /** Cincin kemajuan SVG (0–1). */
  function ringSvg(p, color, size, label) {
    const R = 42, C = 2 * Math.PI * R;
    const off = C * (1 - clamp(p, 0, 1));
    return `<svg viewBox="0 0 100 100" style="width:${size || 90}px;height:${size || 90}px">
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="#EDF3F0" stroke-width="9"/>
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 50 50)"/>
      ${label ? `<text x="50" y="55" text-anchor="middle" font-size="20" font-weight="800"
        font-family="Plus Jakarta Sans, sans-serif" fill="#08201A">${esc(label)}</text>` : ''}
    </svg>`;
  }

  /* ---------------- 6. EKSPOR ---------------- */
  Object.assign(TC, {
    $, $$, clamp, lerp, rnd, rint, pick, uid, secureId, esc, icon, i3d, i3dDiam, IKON3D, ilus3d, tema, rupiah,
    pad2, hhmm, fullDate, shortDate, relTime, countdown, greeting, initials,
    DAYS, MONTHS,
    Store, Router,
    setView, setTopbar, topbar, toast, sheet, closeSheet: close, confirmSheet,
    fitCanvas, sparkline, lineChart, barChart, gaugeSvg, ringSvg
  });
})(window.TC);
