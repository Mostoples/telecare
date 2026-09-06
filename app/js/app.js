/* ============================================================
   TeleCare App — app.js
   Pendaftaran rute, navigasi bawah/samping, dan proses awal.
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, Store, Router, toast } = TC;
  const V = TC.views;

  /* ---------------- RUTE ----------------
     Urutan penting: pola yang lebih spesifik didaftarkan lebih dulu
     agar "/sesi/kamera" tidak tertangkap oleh "/sesi/:id".        */
  const R = [
    ['/mulai',        V.onboard,   { guard: 'guest', chrome: false }],
    ['/masuk',        V.login,     { guard: 'guest', chrome: false }],
    ['/daftar',       V.register,  { guard: 'guest', chrome: false }],
    ['/lupa',         V.forgot,    { guard: 'guest', chrome: false }],
    ['/lengkapi',     V.complete,  { guard: 'auth',  chrome: false }],

    ['/home',         V.home,      { guard: 'auth', roles: ['pasien'], tab: 'home' }],
    ['/vital/:kind',  V.vital,     { guard: 'auth', tab: 'home' }],
    ['/analisis',     V.analysis,  { guard: 'auth', roles: ['pasien'], tab: 'analisis' }],
    ['/riwayat',      V.history,   { guard: 'auth', tab: 'riwayat' }],
    ['/notifikasi',   V.notifications, { guard: 'auth', tab: 'home' }],
    ['/artikel/:id',  V.article,   { guard: 'auth', tab: 'home' }],

    ['/sesi/kamera',   V.camera,   { guard: 'auth', roles: ['pasien'], chrome: false }],
    ['/sesi/hasil',    V.result,   { guard: 'auth', tab: 'catat' }],
    ['/sesi/berjalan', V.running,  { guard: 'auth', tab: 'catat' }],
    ['/sesi/:id',      V.summary,  { guard: 'auth', tab: 'riwayat' }],

    ['/konsultasi',                 V.consult,   { guard: 'auth', tab: 'konsultasi' }],
    ['/konsultasi/spesialis/:id',   V.specialty, { guard: 'auth', tab: 'konsultasi' }],
    ['/dokter/:id',                 V.doctor,    { guard: 'auth', tab: 'konsultasi' }],
    ['/chat/:id',                   V.chat,      { guard: 'auth', chrome: false }],
    ['/call/:id',                   V.call,      { guard: 'auth', chrome: false }],
    ['/jadwal',                     V.schedule,  { guard: 'auth', tab: 'konsultasi' }],

    ['/perangkat',        V.devices,      { guard: 'auth', tab: 'profil' }],
    ['/perangkat/pindai', V.scan,         { guard: 'auth', tab: 'profil' }],
    ['/perangkat/:id',    V.deviceDetail, { guard: 'auth', tab: 'profil' }],

    // ---- peran: dokter ----
    ['/klinik',              V.clinic,        { guard: 'auth', roles: ['dokter'], tab: 'k-home' }],
    ['/klinik/antrean',      V.queue,         { guard: 'auth', roles: ['dokter'], tab: 'k-antrean' }],
    ['/klinik/pasien',       V.patients,      { guard: 'auth', roles: ['dokter'], tab: 'k-pasien' }],
    ['/klinik/pasien/:id',   V.patientDetail, { guard: 'auth', roles: ['dokter'], tab: 'k-pasien' }],

    // ---- peran: admin faskes ----
    ['/faskes',            V.facility,        { guard: 'auth', roles: ['admin-faskes'], tab: 'f-home' }],
    ['/faskes/anggota',    V.facilityMembers, { guard: 'auth', roles: ['admin-faskes'], tab: 'f-anggota' }],
    ['/faskes/anggota/:id', V.patientDetail,  { guard: 'auth', roles: ['admin-faskes'], tab: 'f-anggota' }],
    ['/faskes/perangkat',  V.facilityDevices, { guard: 'auth', roles: ['admin-faskes'], tab: 'f-perangkat' }],
    ['/faskes/nakes',      V.facilityStaff,   { guard: 'auth', roles: ['admin-faskes'], tab: 'f-nakes' }],

    // ---- peran: admin platform ----
    ['/sistem',           V.system,            { guard: 'auth', roles: ['admin'], tab: 's-home' }],
    ['/sistem/pengguna',  V.systemUsers,       { guard: 'auth', roles: ['admin'], tab: 's-pengguna' }],
    ['/sistem/dokter',    V.systemDoctors,     { guard: 'auth', roles: ['admin'], tab: 's-dokter' }],
    ['/sistem/faskes',    V.systemFacilities,  { guard: 'auth', roles: ['admin'], tab: 's-faskes' }],

    ['/profil',             V.profile,     { guard: 'auth', tab: 'profil' }],
    ['/profil/pribadi',     V.personal,    { guard: 'auth', tab: 'profil' }],
    ['/profil/tujuan',      V.goals,       { guard: 'auth', tab: 'profil' }],
    ['/profil/kalibrasi',   V.calibration, { guard: 'auth', tab: 'profil' }],
    ['/profil/pengaturan',  V.settings,    { guard: 'auth', tab: 'profil' }],
    ['/tentang',            V.about,       { guard: 'auth', tab: 'profil' }]
  ];

  R.forEach(([p, h, o]) => Router.route(p, wrap(h, o), o));

  /* Membungkus penangan agar kerangka (tabbar/sidebar) ikut disesuaikan. */
  function wrap(handler, opts) {
    return function (params) {
      opts = opts || {};
      // Rute yang dibatasi peran mengalihkan ke beranda peran pengguna.
      if (opts.roles && opts.roles.indexOf(Store.role()) === -1) {
        Router.navigate(TC.DATA.role(Store.role()).home, true);
        return;
      }
      applyChrome(opts);
      drawTabbar();
      handler(params);
      paintNav((opts || {}).tab);
      toggleDemoBadge((opts || {}).chrome !== false &&
        ['/home', '/tentang'].indexOf(Router.current.path) !== -1);
    };
  }

  /* ---------------- KERANGKA ---------------- */
  function applyChrome(opts) {
    const show = opts.chrome !== false;
    document.body.classList.toggle('is-bare', !show);
    $('#tabbar').style.display = show ? '' : 'none';
    $('#sidebar').style.display = show ? '' : 'none';
    if (!show) $('#sidebar').innerHTML = '';
    else drawSidebar();
  }

  // Setiap peran memiliki susunan navigasinya sendiri.
  const TABS_BY_ROLE = {
    'pasien': [
      { id: 'home',       label: 'Beranda',    icon: 'home',  href: '#/home' },
      { id: 'analisis',   label: 'Analisis',   icon: 'chart', href: '#/analisis' },
      { id: 'catat',      label: 'Catat',      icon: 'cam',   href: '#/sesi/kamera', fab: true },
      { id: 'konsultasi', label: 'Konsultasi', icon: 'chat',  href: '#/konsultasi' },
      { id: 'profil',     label: 'Profil',     icon: 'user',  href: '#/profil' }
    ],
    'dokter': [
      { id: 'k-home',    label: 'Klinik',   icon: 'home',   href: '#/klinik' },
      { id: 'k-antrean', label: 'Antrean',  icon: 'inbox',  href: '#/klinik/antrean' },
      { id: 'k-pasien',  label: 'Pasien',   icon: 'users',  href: '#/klinik/pasien' },
      { id: 'jadwal',    label: 'Jadwal',   icon: 'cal',    href: '#/jadwal' },
      { id: 'profil',    label: 'Profil',   icon: 'user',   href: '#/profil' }
    ],
    'admin-faskes': [
      { id: 'f-home',      label: 'Unit',      icon: 'home',  href: '#/faskes' },
      { id: 'f-anggota',   label: 'Anggota',   icon: 'users', href: '#/faskes/anggota' },
      { id: 'f-perangkat', label: 'Perangkat', icon: 'watch', href: '#/faskes/perangkat' },
      { id: 'f-nakes',     label: 'Nakes',     icon: 'stetho', href: '#/faskes/nakes' },
      { id: 'profil',      label: 'Profil',    icon: 'user',  href: '#/profil' }
    ],
    'admin': [
      { id: 's-home',     label: 'Ringkasan', icon: 'home',     href: '#/sistem' },
      { id: 's-pengguna', label: 'Pengguna',  icon: 'users',    href: '#/sistem/pengguna' },
      { id: 's-dokter',   label: 'Dokter',    icon: 'stetho',   href: '#/sistem/dokter' },
      { id: 's-faskes',   label: 'Faskes',    icon: 'building', href: '#/sistem/faskes' },
      { id: 'profil',     label: 'Profil',    icon: 'user',     href: '#/profil' }
    ]
  };

  const tabsFor = (role) => TABS_BY_ROLE[role] || TABS_BY_ROLE.pasien;

  function drawTabbar() {
    const tabs = tabsFor(Store.role());
    const bar = $('#tabbar');
    bar.style.gridTemplateColumns = 'repeat(' + tabs.length + ',1fr)';
    bar.innerHTML = tabs.map((t) => t.fab
      ? `<a class="tab tab--fab" href="${t.href}" data-tab="${t.id}">
           <i>${icon(t.icon)}</i><span>${esc(t.label)}</span></a>`
      : `<a class="tab" href="${t.href}" data-tab="${t.id}">
           ${icon(t.icon)}<span>${esc(t.label)}</span></a>`).join('');
  }

  function drawSidebar() {
    const u = Store.user();
    if (!u) return;
    const p = Store.profile();
    const unread = Store.unread();
    const role = Store.role();
    const EXTRA = {
      'pasien': [
        { id: 'jadwal', label: 'Janji Temu', icon: 'cal', href: '#/jadwal' },
        { id: 'perangkat', label: 'Perangkat', icon: 'watch', href: '#/perangkat' },
        { id: 'riwayat', label: 'Riwayat', icon: 'doc', href: '#/riwayat' }
      ],
      'dokter': [{ id: 'riwayat', label: 'Riwayat', icon: 'doc', href: '#/riwayat' }],
      'admin-faskes': [],
      'admin': [{ id: 'pengaturan', label: 'Pengaturan', icon: 'sync', href: '#/profil/pengaturan' }]
    };
    const SIDE = tabsFor(role)
      .filter((t) => t.id !== 'profil')
      .map((t) => ({ id: t.id, label: t.label, icon: t.icon, href: t.href }))
      .concat(EXTRA[role] || [])
      .concat([{ id: 'notif', label: 'Notifikasi', icon: 'bell', href: '#/notifikasi', badge: unread }]);
    $('#sidebar').innerHTML = `
      <a class="side-brand" href="${TC.DATA.role(role).home.replace('/', '#/')}">
        ${TC.views.logoSvg(36)}
        <span>TeleCare<small>${esc(TC.DATA.role(role).short)}</small></span>
      </a>
      <nav class="side-nav">
        ${SIDE.map((s) => `<a class="side-link" href="${s.href}" data-side="${s.id}">
          ${icon(s.icon)}<span>${esc(s.label)}</span>
          ${s.badge ? '<i class="dot"></i>' : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <a class="side-user" href="#/profil">
          <span class="avatar" style="background:${TC.DATA.role(role).color}">${esc(TC.initials(u.name))}</span>
          <span style="min-width:0"><b>${esc(p.nickname || u.name)}</b>
            <small>${esc(TC.DATA.role(role).name)}</small></span>
        </a>
      </div>`;
  }

  function paintNav(tab) {
    $$('#tabbar .tab').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === tab));
    const path = Router.current.path || '';
    $$('#sidebar .side-link').forEach((a) => {
      const href = a.getAttribute('href').slice(1);
      a.classList.toggle('is-active', path === href ||
        (href !== '/home' && path.indexOf(href) === 0));
    });
  }

  function toggleDemoBadge(show) {
    let b = $('#demoBadge');
    if (!show) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('a');
      b.id = 'demoBadge';
      b.className = 'demo-badge';
      b.href = '#/tentang';
      b.innerHTML = icon('info') + ' MODE PURWARUPA';
      document.body.appendChild(b);
    }
  }

  /* ---------------- INTERAKSI GLOBAL ---------------- */
  document.addEventListener('click', (e) => {
    const back = e.target.closest('[data-back]');
    if (back) { e.preventDefault(); Router.back('/home'); }
  });

  /* ---------------- BOOT ---------------- */
  function boot() {
    Store.load();
    if (TC.FB) TC.FB.init();
    drawTabbar();

    // "?demo=1" membuka aplikasi langsung dengan akun contoh berisi riwayat —
    // memudahkan berbagi tautan peragaan tanpa perlu mendaftar dulu.
    // "?demo=1" (pasien) atau "?demo=<peran>" — misalnya ?demo=dokter
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo && !Store.user()) {
      const valid = TC.DATA.ROLES.map((r) => r.id);
      const role = valid.indexOf(demo) !== -1 ? demo : 'pasien';
      // Rute pada URL dipertahankan agar tautan undangan tetap berfungsi.
      TC.views.seedDemoUser(false, role);
      if (!location.hash || location.hash === '#') location.replace('#' + TC.DATA.role(role).home);
    }

    // Sesi makan yang tertinggal tetap dilanjutkan setelah aplikasi dibuka kembali.
    TC.Meals.tick();
    TC.Vitals.start();
    if (Store.user()) TC.Devices.startBuffer();

    window.addEventListener('hashchange', Router.render);

    if (!location.hash || location.hash === '#') {
      const s = Store.state;
      const home = s.session ? TC.DATA.role(Store.role()).home
                             : (s.onboarded ? '/masuk' : '/mulai');
      location.replace('#' + home);
    }

    // Menyelesaikan alur masuk Google yang memakai pengalihan halaman.
    if (TC.FB && TC.FB.googleAvailable() && !Store.user()) {
      TC.FB.redirectResult().then((u) => {
        if (u) TC.views.adoptGoogleUser(u);
      });
    }
    Router.render();

    // Menahan sesi tetap hidup saat tab kembali aktif.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (TC.Meals.tick() && !Store.state.activeMeal) Router.render();
      }
    });

    registerServiceWorker();

    // Pemantauan eskalasi hanya berguna bagi pasien; peran lain memantau
    // orang lain, bukan dirinya sendiri.
    if (TC.Push && Store.user() && Store.is('pasien')) {
      TC.Push.mulaiPantau();
      // Token FCM diperbarui bila izin sudah pernah diberikan sebelumnya.
      if (TC.Push.permission() === 'granted') TC.Push.daftarFcm().catch(() => {});
    }

    if (TC.Ring) {
      // Membuka kunci audio pada interaksi pertama, supaya dering berikutnya
      // sudah boleh berbunyi tanpa diblokir peramban.
      TC.Ring.nada.siapkanIzin();
      if (Store.user() && Store.is('dokter')) siapkanPenerimaanPanggilan();
    }
  }

  /**
   * Menyalakan atau memadamkan status jaga sesuai sakelar "Menerima konsultasi"
   * di layar klinik. Dipanggil juga dari sakelar itu supaya perubahannya
   * langsung berlaku tanpa memuat ulang aplikasi.
   */
  function segarkanJaga() {
    if (!TC.Ring || !Store.user() || !Store.is('dokter')) return;
    const doc = TC.DATA.doctor((Store.user() || {}).doctorId);
    if (!doc) return;
    if (Store.state.settings.doctorOnline !== false) {
      TC.Ring.mulaiJaga(doc.id, doc.name).catch(() => {});
    } else {
      TC.Ring.berhentiJaga();
    }
  }
  TC.segarkanJaga = segarkanJaga;

  /**
   * Menyiapkan perangkat dokter untuk menerima panggilan: mendaftar di papan
   * jaga, lalu mendengarkan kotak masuk. Berjalan di semua layar, bukan hanya
   * layar klinik — panggilan bisa datang kapan saja.
   */
  function siapkanPenerimaanPanggilan() {
    const u = Store.user();
    const doc = TC.DATA.doctor(u && u.doctorId);
    if (!doc) return;

    // Hanya mendaftar bila dokter memang sedang menerima konsultasi.
    if (Store.state.settings.doctorOnline !== false) {
      TC.Ring.mulaiJaga(doc.id, doc.name).catch((e) =>
        console.warn('[TeleCare] gagal mendaftar jaga:', e.message));
    }

    if (TC.Push && TC.Push.permission() === 'granted') {
      TC.Push.daftarFcm().then((t) => {
        if (t && TC.Ring.simpanToken) TC.Ring.simpanToken(t, 'dokter');
      }).catch(() => {});
    }

    TC.Ring.dengarkan({
      onMasuk(ring) {
        TC.RingUI.tampilkan(ring, {
          onTerima() {
            TC.Ring.terima(ring).then((consultId) => {
              if (!consultId) { toast('Percakapan tidak ditemukan.', 'err'); return; }
              // Percakapan diambil dari server lebih dulu bila belum ada
              // salinan lokalnya di perangkat ini.
              TC.Consult.adopt(consultId).then(() => {
                Router.navigate((ring.mode === 'chat' ? '/chat/' : '/call/') + consultId);
              });
            });
          },
          onTolak() { TC.Ring.tolak(ring); },
          onLewat() { TC.Ring.tolak(ring); }
        });
      },
      onBatal(ringId) { TC.RingUI.tutupBila(ringId); }
    });

    // Berhenti jaga saat tab ditutup, agar pasien tidak memanggil perangkat
    // yang sudah tidak mendengarkan. onDisconnect di server menangani kasus
    // sambungan putus; ini menangani penutupan tab yang tertib.
    window.addEventListener('pagehide', () => { TC.Ring.berhentiJaga(); });
  }

  /**
   * Mendaftarkan service worker agar aplikasi dapat dipasang dan tetap terbuka
   * saat luring. Didaftarkan setelah `load` supaya pengunduhan kerangka tidak
   * bersaing dengan pemuatan layar pertama.
   *
   * Hanya berjalan pada origin aman (HTTPS atau localhost); pada `file://`
   * atau HTTP biasa, peramban menolaknya dan aplikasi tetap jalan tanpa PWA.
   */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Apakah halaman ini sudah dikendalikan service worker sebelumnya?
    // Membedakan "pemasangan pertama" dari "pembaruan" — hanya pembaruan yang
    // perlu memuat ulang, dan itu harus dibedakan supaya kunjungan pertama
    // tidak memuat ulang tanpa alasan.
    const adaPengendaliAwal = !!navigator.serviceWorker.controller;
    let sudahMuatUlang = false;

    // Ketika service worker baru mengambil alih, kode di halaman ini sudah
    // versi lama. Memuat ulang sekali membuat pembaruan langsung berlaku,
    // tanpa pengguna perlu menekan muat-ulang dua kali.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!adaPengendaliAwal || sudahMuatUlang) return;
      sudahMuatUlang = true;
      location.reload();
    });

    const daftar = () => {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then((reg) => {
          // Paksa pemeriksaan versi baru pada setiap pemuatan; tanpa ini
          // peramban dapat menunda pemeriksaan hingga beberapa jam.
          reg.update().catch(() => {});
        })
        .catch((e) => console.warn('[TeleCare] service worker gagal didaftarkan:', e.message));
    };
    if (document.readyState === 'complete') daftar();
    else window.addEventListener('load', daftar, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TC);
