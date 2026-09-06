/* ============================================================
   TeleCare App — views-auth.js
   Layar pembuka, masuk, daftar, dan pemulihan kata sandi.

   Autentikasi berjalan lokal di perangkat ini (mode purwarupa):
   akun disimpan di localStorage, bukan di server.
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, uid, Store, Router, setView, setTopbar, toast,
          sheet, closeSheet } = TC;

  /* ---------------- ILUSTRASI (SVG orisinil) ---------------- */
  function artHub() {
    return `<svg viewBox="0 0 340 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="og1" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#0FB56C"/><stop offset="1" stop-color="#0E7FB8"/></linearGradient>
        <linearGradient id="og2" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#EDF9F2"/></linearGradient>
      </defs>
      <circle cx="170" cy="150" r="118" stroke="#D6F2E3" stroke-width="1.6"/>
      <circle cx="170" cy="150" r="88" stroke="#D6F2E3" stroke-width="1.6" stroke-dasharray="4 8"/>
      <circle cx="170" cy="150" r="58" fill="url(#og2)" stroke="#A9E5C8" stroke-width="1.6"/>
      <path d="M132 150h16l8-20 12 40 9-28 6 8h25" stroke="#049A5B" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <!-- simpul perangkat mengelilingi pusat -->
      <g>
        <circle cx="170" cy="32" r="26" fill="url(#og1)"/>
        <rect x="160" y="22" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2"/>
        <path d="M164 22v-4h12v4M164 42v4h12v-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g>
        <circle cx="288" cy="150" r="26" fill="#fff" stroke="#A9E5C8" stroke-width="1.8"/>
        <ellipse cx="288" cy="151" rx="11" ry="10" fill="none" stroke="#049A5B" stroke-width="2.6"/>
        <ellipse cx="288" cy="151" rx="5.5" ry="5" fill="none" stroke="#6FD3A6" stroke-width="1.8"/>
      </g>
      <g>
        <circle cx="52" cy="150" r="26" fill="#fff" stroke="#7CC3E8" stroke-width="1.8"/>
        <rect x="40" y="142" width="24" height="16" rx="4" fill="none" stroke="#0E7FB8" stroke-width="2"/>
        <path d="M44 150h4l2-4 3 8 2-5 1.5 2h5" stroke="#0E7FB8" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
      <g>
        <circle cx="170" cy="268" r="26" fill="#fff" stroke="#DDD7FB" stroke-width="1.8"/>
        <path d="M160 274c0-6 4-10 10-10s10 4 10 10" stroke="#6C5CE7" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="170" cy="259" r="5" stroke="#6C5CE7" stroke-width="2.2" fill="none"/>
      </g>
      <g stroke="#A9E5C8" stroke-width="1.6" stroke-dasharray="3 6">
        <path d="M170 58v34M262 150h-34M78 150h34M170 242v-34"/>
      </g>
    </svg>`;
  }

  function artConsult() {
    return `<svg viewBox="0 0 340 300" fill="none" aria-hidden="true">
      <defs><linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#0FB56C"/><stop offset="1" stop-color="#02643C"/></linearGradient></defs>
      <rect x="52" y="30" width="150" height="215" rx="26" fill="#fff" stroke="#A9E5C8" stroke-width="2"/>
      <rect x="64" y="52" width="126" height="150" rx="14" fill="#EDF9F2"/>
      <circle cx="127" cy="94" r="24" fill="url(#cg1)"/>
      <path d="M118 96c0-5 4-9 9-9s9 4 9 9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="127" cy="83" r="5" stroke="#fff" stroke-width="2.4" fill="none"/>
      <rect x="82" y="132" width="90" height="9" rx="4.5" fill="#A9E5C8"/>
      <rect x="96" y="150" width="62" height="8" rx="4" fill="#D6F2E3"/>
      <rect x="76" y="172" width="102" height="20" rx="10" fill="#049A5B"/>
      <path d="M104 182h8l3-6 5 12 3-8 2 2h12" stroke="#fff" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="64" y="212" width="126" height="20" rx="10" fill="#F3F8F6"/>
      <!-- gelembung percakapan -->
      <g>
        <rect x="196" y="96" width="118" height="46" rx="16" fill="#fff" stroke="#7CC3E8" stroke-width="1.8"/>
        <rect x="210" y="110" width="72" height="7" rx="3.5" fill="#DCEEF9"/>
        <rect x="210" y="124" width="52" height="7" rx="3.5" fill="#DCEEF9"/>
      </g>
      <g>
        <rect x="176" y="158" width="128" height="46" rx="16" fill="#049A5B"/>
        <rect x="192" y="172" width="80" height="7" rx="3.5" fill="rgba(255,255,255,.5)"/>
        <rect x="192" y="186" width="56" height="7" rx="3.5" fill="rgba(255,255,255,.32)"/>
      </g>
      <circle cx="272" cy="60" r="22" fill="#EEEBFD" stroke="#DDD7FB" stroke-width="1.6"/>
      <path d="M264 62c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#6C5CE7" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="272" cy="52" r="4.4" stroke="#6C5CE7" stroke-width="2.2" fill="none"/>
    </svg>`;
  }

  const logoSvg = (size) => `<svg viewBox="0 0 48 48" fill="none" style="width:${size}px;height:${size}px" aria-hidden="true">
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#lg1)"/>
    <path d="M13 24.5h4.6l2.6-6.6 3.8 13 2.9-8.6 1.9 2.2H35" fill="none" stroke="#fff"
          stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <defs><linearGradient id="lg1" x1="2" y1="2" x2="46" y2="46">
      <stop stop-color="#0FB56C"/><stop offset=".55" stop-color="#049A5B"/><stop offset="1" stop-color="#0E7FB8"/>
    </linearGradient></defs></svg>`;

  /* ---------------- ONBOARDING ---------------- */
  const SLIDES = [
    { art: artHub, title: 'Semua perangkat, satu platform',
      body: 'TeleBand, TeleRing, sabuk EKG, tensimeter, hingga timbangan — semuanya mengalir ke satu riwayat kesehatan yang sama.' },
    { art: artConsult, title: 'Dari data langsung ke dokter',
      body: 'Bila ada yang perlu ditanyakan, mulai konsultasi chat atau video call dengan konteks vital Anda sudah terlampir.' }
  ];

  function viewOnboard() {
    setTopbar('');
    let i = 0;

    function draw() {
      const s = SLIDES[i];
      setView(`<div class="onb">
        <div class="onb__art">${s.art()}</div>
        <h1>${esc(s.title)}</h1>
        <p>${esc(s.body)}</p>
        <div class="onb__dots">${SLIDES.map((_, k) =>
          `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="onb__act">
          <button class="btn btn--primary btn--lg btn--block" data-next>
            ${i < SLIDES.length - 1 ? 'Lanjut' : 'Mulai Sekarang'} ${icon('arrow')}</button>
          <button class="btn btn--ghost btn--block" data-login>Masuk ke Akun</button>
        </div>
      </div>`, { cls: 'view view--full' });

      $('[data-next]').onclick = () => {
        if (i < SLIDES.length - 1) { i++; draw(); }
        else { Store.update((st) => { st.onboarded = true; }); Router.navigate('/daftar'); }
      };
      $('[data-login]').onclick = () => {
        Store.update((st) => { st.onboarded = true; });
        Router.navigate('/masuk');
      };
    }
    draw();
  }

  /* ---------------- MASUK ---------------- */
  function findUser(ident) {
    const users = Store.state.users;
    const k = String(ident || '').trim().toLowerCase();
    return Object.values(users).find(
      (u) => u.email.toLowerCase() === k || u.phone === k
    ) || null;
  }

  function signIn(user) {
    Store.update((s) => { s.session = { userId: user.id, at: Date.now() }; });
    TC.Devices.startBuffer();
    Router.navigate(TC.DATA.role(user.role || 'pasien').home, true);
    toast('Selamat datang kembali, ' + (user.nickname || user.name) + '!');
  }

  function viewLogin() {
    setTopbar('');
    setView(`<div class="auth">
      <div class="auth__top">
        <button class="topbar__back" data-back-onb aria-label="Kembali">${icon('back')}</button>
      </div>
      <div class="auth__body">
        <div class="auth__logo">${logoSvg(62)}</div>
        <h1>Selamat Datang Kembali!</h1>
        <p class="sub">Masuk untuk melanjutkan perjalanan sehatmu</p>

        <form id="fLogin" novalidate>
          <label class="field">
            <span>Email atau Nomor HP</span>
            <span class="wrap">${icon('user')}
              <input type="text" name="ident" autocomplete="username"
                     placeholder="Masukkan email atau nomor HP" required>
            </span>
          </label>
          <label class="field">
            <span>Kata Sandi</span>
            <span class="wrap">${icon('lock')}
              <input type="password" name="pass" autocomplete="current-password"
                     placeholder="Masukkan kata sandi" required>
              <button type="button" class="eye" data-eye aria-label="Tampilkan kata sandi">${icon('eye-off')}</button>
            </span>
          </label>
          <div style="text-align:right;margin:-6px 0 16px">
            <a class="link" href="#/lupa">Lupa kata sandi?</a>
          </div>
          <button class="btn btn--primary btn--lg btn--block" type="submit">Masuk</button>
        </form>

        <div class="alt">atau masuk dengan</div>

        <button class="btn btn--ghost btn--lg btn--block" data-google>
          ${icon('google')} Masuk dengan Google</button>

        <div class="social mt">
          <button data-social="Apple" aria-label="Masuk dengan Apple">${icon('apple')}</button>
          <button data-social="Nomor telepon" aria-label="Masuk dengan nomor telepon">${icon('phone')}</button>
        </div>

        <div class="alt">atau tanpa akun</div>
        <button class="btn btn--soft btn--lg btn--block" data-guest>
          ${icon('user')} Masuk sebagai Tamu</button>
        <p class="tiny muted tc" style="margin-top:8px">
          Memakai akun demo berisi riwayat contoh. Anda dapat memilih perannya.</p>

        <div class="auth__foot">Belum punya akun? <b data-go-daftar>Daftar sekarang</b></div>
      </div>
    </div>`, { cls: 'view view--full' });

    bindEye();
    $('[data-back-onb]').onclick = () => Router.navigate('/mulai');
    $('[data-go-daftar]').onclick = () => Router.navigate('/daftar');
    $$('[data-social]').forEach((b) => {
      b.onclick = () => toast('Masuk lewat ' + b.dataset.social + ' belum tersedia di purwarupa ini.', 'err');
    });
    $('[data-google]').onclick = () => googleSignIn($('[data-google]'));
    $('[data-guest]').onclick = () => guestSheet();

    $('#fLogin').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const ident = f.ident.value.trim();
      const pass = f.pass.value;
      if (!ident || !pass) { toast('Lengkapi kedua kolom terlebih dahulu.', 'err'); return; }
      const u = findUser(ident);
      if (!u) { toast('Akun tidak ditemukan. Periksa email atau nomor Anda.', 'err'); return; }
      if (u.pass !== pass) { toast('Kata sandi salah. Coba periksa huruf besar/kecil.', 'err'); return; }
      signIn(u);
    };
  }

  function bindEye() {
    $$('[data-eye]').forEach((btn) => {
      btn.onclick = () => {
        const inp = btn.parentElement.querySelector('input');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.innerHTML = icon(show ? 'eye' : 'eye-off');
      };
    });
  }

  /* ---------------- MASUK DENGAN GOOGLE ---------------- */
  function googleSignIn(btn) {
    if (!TC.FB || !TC.FB.googleAvailable()) {
      toast('Firebase Authentication belum siap. Coba muat ulang halaman.', 'err');
      return;
    }
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.classList.add('is-disabled'); btn.innerHTML = icon('sync') + ' Menghubungkan…'; }

    TC.FB.signInGoogle().then((u) => {
      if (btn) { btn.classList.remove('is-disabled'); btn.innerHTML = label; }
      if (!u) return;               // alur pengalihan: halaman akan dimuat ulang
      adoptGoogleUser(u);
    }).catch((err) => {
      if (btn) { btn.classList.remove('is-disabled'); btn.innerHTML = label; }
      console.warn('[TeleCare] Google Sign-In:', err);
      sheet(`
        <h3>Masuk dengan Google belum bisa</h3>
        <p class="sub">${esc(TC.FB.authError(err))}</p>
        <div class="note note--i">${icon('info')}
          <div><b>Cara mengaktifkan</b>Buka Firebase Console → Authentication → Sign-in method →
          aktifkan penyedia <b>Google</b>, lalu simpan. Setelah itu tombol ini langsung berfungsi.</div></div>
        <button class="btn btn--primary btn--block mt" data-close>Mengerti</button>`);
    });
  }

  /** Membuat atau memakai kembali akun lokal untuk pengguna Google. */
  function adoptGoogleUser(u) {
    const email = u.email || (u.uid + '@google.local');
    let existing = findUser(email);
    if (existing) {
      Store.update((s) => {
        s.users[existing.id].googleUid = u.uid;
        if (u.photoURL) s.users[existing.id].photo = u.photoURL;
      });
      signIn(existing);
      return;
    }
    const id = uid('u');
    const name = u.displayName || (email.split('@')[0]);
    const user = {
      id, name, email, phone: u.phoneNumber || '',
      pass: null, provider: 'google', googleUid: u.uid,
      photo: u.photoURL || null, role: 'pasien',
      nickname: name.split(/\s+/)[0], createdAt: Date.now()
    };
    Store.update((s) => {
      s.users[id] = user;
      s.onboarded = true;
      s.profile.nickname = user.nickname;
      s.session = { userId: id, at: Date.now() };
    });
    TC.Devices.startBuffer();
    Router.navigate('/lengkapi', true);
    toast('Berhasil masuk sebagai ' + name + '.');
  }

  /* ---------------- MASUK SEBAGAI TAMU ---------------- */
  function guestSheet() {
    sheet(`
      <h3>Masuk sebagai tamu</h3>
      <p class="sub">Pilih peran yang ingin Anda coba. Data contoh disiapkan otomatis
        dan hanya tersimpan di peramban ini.</p>
      <div class="stack--sm stack">
        ${TC.DATA.ROLES.map((r) => `
          <button class="row" data-role="${r.id}" style="border-radius:16px">
            <span class="row__ico" style="background:${r.color}1a;color:${r.color}">${icon(r.icon)}</span>
            <div style="min-width:0"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div>
            ${icon('chev', 'chev')}
          </button>`).join('')}
      </div>`);

    $$('[data-role]').forEach((b) => {
      b.onclick = () => { closeSheet(); seedDemoUser(true, b.dataset.role); };
    });
  }

  /**
   * Membuat akun contoh berisi riwayat agar aplikasi langsung terasa hidup.
   * @param {boolean} redirect  false bila rute pada URL harus dipertahankan —
   *   dipakai saat tautan undangan (#/chat/... atau #/call/...) dibuka di
   *   perangkat yang belum punya akun.
   */
  function seedDemoUser(redirect, role) {
    role = role || 'pasien';
    const id = uid('u');
    const PROFILES = {
      'pasien':       { name: 'Ayu Prameswari',   nick: 'Ayu',   email: 'ayu@contoh.id' },
      'dokter':       { name: 'dr. Anindya Kusuma, Sp.JP', nick: 'dr. Anindya',
                        email: 'anindya@contoh.id', doctorId: 'd1' },
      'admin-faskes': { name: 'Rudi Hartono',      nick: 'Rudi',  email: 'rudi@contoh.id',
                        facilityId: 'f1' },
      'admin':        { name: 'Sari Widowati',     nick: 'Sari',  email: 'sari@contoh.id' }
    };
    const prof = PROFILES[role] || PROFILES.pasien;
    const user = {
      id, name: prof.name, nickname: prof.nick,
      email: prof.email, phone: '081234567890', pass: 'demo1234',
      role: role, doctorId: prof.doctorId || null, facilityId: prof.facilityId || null,
      createdAt: Date.now(), demo: true
    };
    Store.update((s) => {
      s.users[id] = user;
      s.onboarded = true;
      s.profile = Object.assign(s.profile, {
        nickname: prof.nick, gender: 'perempuan', age: 29, height: 162, weight: 57,
        goal: 'gula-stabil',
        targets: TC.DATA.goal('gula-stabil').targets
      });
      // satu TeleBand dan satu TeleRing sudah terpasang
      const band = {
        id: uid('dev'), type: 'band', name: 'TeleBand', code: TC.Devices.makeCode('TC-BAND'),
        battery: 68, connected: true, pairedAt: Date.now() - 86400000 * 12,
        lastSync: Date.now() - 3600000, rssi: 4
      };
      const ring = {
        id: uid('dev'), type: 'ring', name: 'TeleRing', code: TC.Devices.makeCode('TC-RING'),
        battery: 84, connected: true, pairedAt: Date.now() - 86400000 * 5,
        lastSync: Date.now() - 5400000, rssi: 3
      };
      s.devices = [band, ring];
      s.activeDeviceId = band.id;
      s.pendingSamples = 12;
      s.lastSync = Date.now() - 3600000;

      // beberapa sesi makan terdahulu
      const combos = TC.DATA.FOOD_COMBOS.slice(0, 6);
      s.meals = combos.map((combo, i) => {
        const items = combo.map((n) => ({ n, qty: 1, g: TC.DATA.food(n).g }));
        const nut = TC.Meals.nutrition(items);
        const baseline = TC.rint(84, 95);
        const delta = TC.Meals.predictDelta(nut, items);
        const at = Date.now() - (i * 0.85 + 0.4) * 86400000;
        return {
          id: uid('meal'), at, photo: null,
          kind: TC.Meals.mealKind(new Date(at)).name,
          items, nutrition: nut, confidence: TC.rint(68, 93),
          speed: 1, baseline, predictedDelta: delta,
          status: 'done', doneAt: at + 7200000,
          peak: baseline + delta, peakAt: '+1 jam', delta,
          recovery: delta > 45 ? 3 : delta > 28 ? 2 : 1.5,
          category: delta > 45 ? 'Tinggi' : delta > 28 ? 'Sedang' : 'Landai',
          points: [
            { key: 'baseline', label: 'Baseline', offset: -300000, value: baseline, done: true },
            { key: 't0', label: 'Selesai makan', offset: 0, value: baseline + 8, done: true },
            { key: 'h1', label: '+1 jam', offset: 3600000, value: baseline + delta, done: true },
            { key: 'h2', label: '+2 jam', offset: 7200000, value: baseline + Math.round(delta * 0.28), done: true }
          ]
        };
      });
      // satu percakapan contoh agar layar konsultasi tidak kosong
      const t0 = Date.now() - 86400000 * 2;
      s.consults = [{
        id: 'cs-demo', doctorId: 'd1', mode: 'chat',
        startedAt: t0, status: 'active',
        messages: [
          { from: 'sys', text: 'Konsultasi dimulai. Sampaikan keluhan Anda selengkap mungkin.', at: t0 },
          { from: 'me', kind: 'vitals', text: '', at: t0 + 1000,
            data: { hr: 88, spo2: 97, temp: 36.8, sys: 128, dia: 84, stress: 58, hrv: 34, glucose: 96, at: t0 + 1000 } },
          { from: 'doc', at: t0 + 60000,
            text: 'Selamat datang, saya dr. Anindya Kusuma, Sp.JP. Ada yang bisa saya bantu hari ini? Silakan ceritakan keluhan yang Anda rasakan.' },
          { from: 'me', text: 'Dok, beberapa hari ini saya sering berdebar dan mudah lelah padahal tidak sedang beraktivitas berat.', at: t0 + 180000 },
          { from: 'doc', at: t0 + 260000,
            text: 'Saya sudah melihat ringkasan vital yang Anda kirimkan. Detak jantung istirahat 88 bpm memang sedikit di atas rata-rata Anda sebelumnya, dan HRV-nya turun. Berdebarnya muncul saat istirahat atau setelah aktivitas, dan berapa lama biasanya berlangsung?' },
          { from: 'me', text: 'Biasanya sore hari saat kerja, sekitar 10–15 menit lalu reda sendiri.', at: t0 + 420000 },
          { from: 'doc', at: t0 + 500000,
            text: 'Baik. Polanya konsisten dengan kenaikan beban stres pada rentang tersebut. Untuk sementara, coba rekam EKG lead-I lewat TeleBand tepat saat keluhan muncul, lalu kirimkan ke saya. Bila disertai nyeri dada atau sesak, jangan menunggu — segera ke IGD.' }
        ]
      }];
      s.appointments = [{
        id: 'ap-demo', doctorId: 'd3', at: Date.now() + 86400000 * 2, slot: '15.30',
        note: 'Ingin membahas pola stres sore hari dan kualitas tidur.',
        createdAt: Date.now() - 3600000, status: 'terjadwal'
      }];
      s.notifications = [
        { id: uid('n'), title: 'Sinkronisasi selesai', body: '124 sampel dipindahkan dari TeleBand.', kind: 'ok', at: Date.now() - 3600000, read: false },
        { id: uid('n'), title: 'Pola stres terdeteksi', body: 'Indeks stres naik pada 14.00–16.00 selama 5 hari.', kind: 'warn', at: Date.now() - 18000000, read: false }
      ];
      s.session = { userId: id, at: Date.now() };
    });
    TC.Devices.startBuffer();
    if (redirect === false) return;
    Router.navigate(TC.DATA.role(role).home, true);
    toast('Masuk sebagai tamu · peran ' + TC.DATA.role(role).name + '.');
  }

  /* ---------------- DAFTAR ---------------- */
  function viewRegister() {
    setTopbar('');
    setView(`<div class="auth">
      <div class="auth__top">
        <button class="topbar__back" data-back-onb aria-label="Kembali">${icon('back')}</button>
      </div>
      <div class="auth__body">
        <div class="auth__logo">${logoSvg(62)}</div>
        <h1>Buat Akun TeleCare</h1>
        <p class="sub">Riwayat kesehatan Anda tersimpan pada akun ini</p>

        <form id="fReg" novalidate>
          <label class="field">
            <span>Nama lengkap</span>
            <span class="wrap">${icon('user')}
              <input name="name" type="text" placeholder="Nama sesuai identitas" autocomplete="name" required></span>
          </label>
          <label class="field">
            <span>Email</span>
            <span class="wrap">${icon('mail')}
              <input name="email" type="email" placeholder="nama@email.com" autocomplete="email" required></span>
          </label>
          <label class="field">
            <span>Nomor HP</span>
            <span class="wrap">${icon('phone')}
              <input name="phone" type="tel" placeholder="08xxxxxxxxxx" autocomplete="tel" required></span>
          </label>
          <label class="field">
            <span>Kata sandi</span>
            <span class="wrap">${icon('lock')}
              <input name="pass" type="password" placeholder="Minimal 8 karakter" autocomplete="new-password" required>
              <button type="button" class="eye" data-eye aria-label="Tampilkan kata sandi">${icon('eye-off')}</button>
            </span>
            <span class="hint">Gabungkan huruf besar, huruf kecil, dan angka. Hindari tanggal lahir.</span>
          </label>
          <button class="btn btn--primary btn--lg btn--block" type="submit">Daftar</button>
        </form>

        <div class="note note--w mt2">${icon('alert')}
          <div><b>Bukan alat diagnosis</b>TeleCare adalah alat bantu pemantauan gaya hidup.
          Angka yang ditampilkan tidak boleh dipakai untuk mendiagnosis penyakit atau mengubah dosis obat.</div>
        </div>

        <div class="auth__foot">Sudah punya akun? <b data-go-masuk>Masuk di sini</b></div>
      </div>
    </div>`, { cls: 'view view--full' });

    bindEye();
    $('[data-back-onb]').onclick = () => Router.navigate('/mulai');
    $('[data-go-masuk]').onclick = () => Router.navigate('/masuk');

    $('#fReg').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim();
      const email = f.email.value.trim();
      const phone = f.phone.value.trim();
      const pass = f.pass.value;

      if (name.length < 3) { toast('Nama terlalu pendek.', 'err'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Format email belum benar.', 'err'); return; }
      if (!/^0\d{8,13}$/.test(phone)) { toast('Nomor HP harus diawali 0 dan 9–14 digit.', 'err'); return; }
      if (pass.length < 8) { toast('Kata sandi minimal 8 karakter.', 'err'); return; }
      if (findUser(email) || findUser(phone)) {
        toast('Email atau nomor tersebut sudah terdaftar di perangkat ini.', 'err'); return;
      }

      const id = uid('u');
      const user = {
        id, name, email, phone, pass,
        nickname: name.split(/\s+/)[0], createdAt: Date.now()
      };
      Store.update((s) => {
        s.users[id] = user;
        s.onboarded = true;
        s.profile.nickname = user.nickname;
        s.session = { userId: id, at: Date.now() };
      });
      TC.Devices.startBuffer();
      Router.navigate('/lengkapi', true);
      toast('Akun dibuat. Lengkapi data agar target lebih sesuai.');
    };
  }

  /* ---------------- LENGKAPI PROFIL AWAL ---------------- */
  function viewComplete() {
    TC.topbar('Lengkapi Data', { sub: 'Agar target harian sesuai kebutuhan Anda', back: false });
    const p = Store.profile();
    setView(`
      <div class="note note--i">${icon('info')}
        <div><b>Kenapa ini penting</b>Usia, tinggi, dan berat badan dipakai untuk memperkirakan
        kebutuhan energi harian Anda. Selama belum diisi, aplikasi memakai nilai bawaan.</div></div>

      <form id="fComplete" class="mt2">
        <label class="field"><span>Nama panggilan</span>
          <span class="wrap"><input name="nickname" value="${esc(p.nickname || '')}" placeholder="Dipakai pada sapaan di Beranda"></span></label>
        <label class="field"><span>Jenis kelamin</span>
          <span class="wrap"><select name="gender">
            <option value="">Pilih…</option>
            <option value="perempuan"${p.gender === 'perempuan' ? ' selected' : ''}>Perempuan</option>
            <option value="laki-laki"${p.gender === 'laki-laki' ? ' selected' : ''}>Laki-laki</option>
          </select></span></label>
        <div class="grid2">
          <label class="field"><span>Usia (tahun)</span>
            <span class="wrap"><input name="age" type="number" min="5" max="110" value="${p.age || ''}" placeholder="mis. 29"></span></label>
          <label class="field"><span>Tinggi badan (cm)</span>
            <span class="wrap"><input name="height" type="number" min="80" max="230" value="${p.height || ''}" placeholder="mis. 165"></span></label>
        </div>
        <label class="field"><span>Berat badan (kg)</span>
          <span class="wrap"><input name="weight" type="number" min="20" max="250" step="0.1" value="${p.weight || ''}" placeholder="mis. 60"></span>
          <span class="hint">Perbarui kira-kira sebulan sekali agar target tetap masuk akal.</span></label>

        <div class="section-title">${icon('target')} Tujuan kesehatan</div>
        <div class="stack--sm stack" id="goals">
          ${TC.DATA.GOALS.map((g) => `
            <label class="row" style="border-radius:14px;border:1.5px solid ${g.id === p.goal ? 'var(--green-400)' : 'var(--line)'};background:${g.id === p.goal ? 'var(--green-50)' : 'var(--surface)'}">
              <input type="radio" name="goal" value="${g.id}" ${g.id === p.goal ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--green-500)">
              <div><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></div>
            </label>`).join('')}
        </div>

        <button class="btn btn--primary btn--lg btn--block mt2" type="submit">Simpan &amp; Lanjut</button>
        <button class="btn btn--ghost btn--block mt" type="button" data-skip>Lewati dulu</button>
      </form>`);

    $('[data-skip]').onclick = () => Router.navigate('/home', true);
    $('#fComplete').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const goalId = (f.querySelector('input[name=goal]:checked') || {}).value || 'jaga-berat';
      Store.update((s) => {
        Object.assign(s.profile, {
          nickname: f.nickname.value.trim() || s.profile.nickname,
          gender: f.gender.value,
          age: +f.age.value || null,
          height: +f.height.value || null,
          weight: +f.weight.value || null,
          goal: goalId,
          targets: Object.assign({}, TC.DATA.goal(goalId).targets)
        });
      });
      toast('Data tersimpan.');
      Router.navigate('/home', true);
    };
  }

  /* ---------------- LUPA KATA SANDI ---------------- */
  function viewForgot() {
    setTopbar('');
    setView(`<div class="auth">
      <div class="auth__top">
        <button class="topbar__back" data-back-login aria-label="Kembali">${icon('back')}</button>
      </div>
      <div class="auth__body">
        <div class="auth__logo">${logoSvg(62)}</div>
        <h1>Pemulihan Kata Sandi</h1>
        <p class="sub">Masukkan email atau nomor yang sama persis dengan saat mendaftar</p>

        <form id="fForgot" novalidate>
          <label class="field"><span>Email atau Nomor HP</span>
            <span class="wrap">${icon('mail')}
              <input name="ident" type="text" placeholder="Identitas terdaftar" required></span></label>
          <div id="step2" hidden>
            <label class="field"><span>Kata sandi baru</span>
              <span class="wrap">${icon('lock')}
                <input name="pass" type="password" placeholder="Minimal 8 karakter">
                <button type="button" class="eye" data-eye aria-label="Tampilkan">${icon('eye-off')}</button></span></label>
          </div>
          <button class="btn btn--primary btn--lg btn--block" type="submit" id="btnForgot">Cari akun saya</button>
        </form>

        <div class="note note--w mt2">${icon('alert')}
          <div><b>Bila email dan nomor sama-sama tidak dapat diakses</b>
          Pemulihan hanya lewat jalur terdaftar. Pastikan email pemulihan Anda selalu aktif.</div></div>
      </div>
    </div>`, { cls: 'view view--full' });

    bindEye();
    $('[data-back-login]').onclick = () => Router.navigate('/masuk');

    let found = null;
    $('#fForgot').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (!found) {
        found = findUser(f.ident.value);
        if (!found) { toast('Akun tidak ditemukan di perangkat ini.', 'err'); return; }
        $('#step2').hidden = false;
        $('#btnForgot').textContent = 'Simpan kata sandi baru';
        toast('Akun ditemukan. Silakan buat kata sandi baru.');
        return;
      }
      const pass = f.pass.value;
      if (pass.length < 8) { toast('Kata sandi minimal 8 karakter.', 'err'); return; }
      Store.update((s) => { s.users[found.id].pass = pass; });
      toast('Kata sandi diperbarui. Silakan masuk.');
      Router.navigate('/masuk');
    };
  }

  TC.views = TC.views || {};
  Object.assign(TC.views, {
    onboard: viewOnboard, login: viewLogin, register: viewRegister,
    complete: viewComplete, forgot: viewForgot, logoSvg, seedDemoUser,
    googleSignIn, adoptGoogleUser
  });
})(window.TC);
