/* ============================================================
   TeleCare App — push.js
   Peringatan eskalasi: penilaian ambang di perangkat, notifikasi
   sistem operasi lewat service worker, dan pendaftaran FCM bila
   VAPID key sudah diisi.

   Pembagiannya:
     Escalation — aturan ambang murni, tanpa efek samping. Dapat
                  diuji langsung dengan angka.
     Push       — izin, penampilan notifikasi, token FCM.

   CATATAN KLINIS: ambang di bawah adalah heuristik penyaring untuk
   purwarupa, bukan kriteria diagnostik dan bukan alat kesehatan.
   Nilainya mengikuti rentang rujukan umum agar peragaan terasa
   masuk akal; penetapan ambang sungguhan harus dilakukan oleh
   klinisi dan disesuaikan per pasien (usia, kondisi dasar, obat).
   ============================================================ */
(function (TC) {
  'use strict';

  const cfg = () => window.TELECARE_PUSH || {};

  /* ============================================================
     1. ATURAN AMBANG
     ============================================================
     Setiap ukuran diperiksa dari yang paling berat lebih dulu,
     sehingga satu nilai hanya menghasilkan satu temuan.
     ============================================================ */
  const ATURAN = [
    {
      metric: 'hr', label: 'Detak jantung', unit: 'bpm',
      uji: (v) => {
        if (v.hr == null) return null;
        if (v.hr > 130) return { severity: 'crit', sebab: 'takikardia berat' };
        if (v.hr < 45) return { severity: 'crit', sebab: 'bradikardia berat' };
        if (v.hr > 110) return { severity: 'warn', sebab: 'detak jantung tinggi' };
        if (v.hr < 50) return { severity: 'warn', sebab: 'detak jantung rendah' };
        return null;
      }
    },
    {
      metric: 'spo2', label: 'Saturasi oksigen', unit: '%',
      uji: (v) => {
        if (v.spo2 == null) return null;
        if (v.spo2 < 90) return { severity: 'crit', sebab: 'hipoksemia' };
        if (v.spo2 < 94) return { severity: 'warn', sebab: 'saturasi menurun' };
        return null;
      }
    },
    {
      metric: 'temp', label: 'Suhu tubuh', unit: '°C',
      uji: (v) => {
        if (v.temp == null) return null;
        if (v.temp >= 39) return { severity: 'crit', sebab: 'demam tinggi' };
        if (v.temp <= 35) return { severity: 'crit', sebab: 'hipotermia' };
        if (v.temp >= 37.8) return { severity: 'warn', sebab: 'demam' };
        return null;
      }
    },
    {
      metric: 'bp', label: 'Tekanan darah', unit: 'mmHg',
      uji: (v) => {
        if (v.sys == null || v.dia == null) return null;
        // Krisis hipertensi diperiksa lebih dulu karena paling mendesak.
        if (v.sys >= 180 || v.dia >= 120) return { severity: 'crit', sebab: 'tekanan darah sangat tinggi' };
        if (v.sys < 90) return { severity: 'crit', sebab: 'tekanan darah sangat rendah' };
        if (v.sys >= 140 || v.dia >= 90) return { severity: 'warn', sebab: 'tekanan darah tinggi' };
        return null;
      }
    }
  ];

  const Escalation = {
    ATURAN,

    /** Nilai tampilan untuk sebuah ukuran. */
    nilai(metric, v) {
      if (metric === 'bp') return v.sys + '/' + v.dia;
      const x = v[metric];
      return typeof x === 'number' ? (metric === 'temp' ? x.toFixed(1) : Math.round(x)) : '—';
    },

    /**
     * Menilai satu set vital. Murni: tidak menyentuh penyimpanan,
     * tidak menampilkan apa pun.
     * @returns {Array<{metric,severity,label,sebab,nilai,unit,text}>}
     */
    evaluate(v) {
      if (!v) return [];
      const out = [];
      ATURAN.forEach((r) => {
        const hasil = r.uji(v);
        if (!hasil) return;
        const nilai = Escalation.nilai(r.metric, v);
        out.push({
          metric: r.metric,
          severity: hasil.severity,
          label: r.label,
          sebab: hasil.sebab,
          nilai,
          unit: r.unit,
          text: r.label + ' ' + nilai + ' ' + r.unit + ' — ' + hasil.sebab
        });
      });
      // Yang kritis lebih dulu agar notifikasi pertama yang terlihat
      // adalah yang paling mendesak.
      return out.sort((a, b) => (a.severity === 'crit' ? -1 : 1) - (b.severity === 'crit' ? -1 : 1));
    },

    /* ---------------- jeda pengulangan ---------------- */
    _terakhir: Object.create(null),

    /** Melupakan seluruh riwayat jeda; dipakai pada pengujian. */
    resetJeda() { Escalation._terakhir = Object.create(null); },

    /**
     * Menyaring temuan yang layak diberitahukan sekarang.
     *
     * Aturannya: satu ukuran tidak diulang sebelum jeda berakhir,
     * KECUALI tingkatannya naik dari waspada menjadi kritis — kondisi
     * yang memburuk tidak boleh tertahan hanya karena baru saja
     * diberitahukan.
     *
     * @param {object} v     snapshot vital
     * @param {number} [now] cap waktu, agar dapat diuji
     */
    check(v, now) {
      const t = now == null ? Date.now() : now;
      const jeda = (cfg().jedaMenit == null ? 10 : cfg().jedaMenit) * 60000;
      const keluar = [];

      Escalation.evaluate(v).forEach((f) => {
        const sebelum = Escalation._terakhir[f.metric];
        const naikTingkat = sebelum && sebelum.severity === 'warn' && f.severity === 'crit';
        const lewatJeda = !sebelum || (t - sebelum.at) >= jeda;
        if (!lewatJeda && !naikTingkat) return;
        Escalation._terakhir[f.metric] = { severity: f.severity, at: t };
        keluar.push(f);
      });

      return keluar;
    }
  };

  /* ============================================================
     2. NOTIFIKASI
     ============================================================ */
  const Push = {

    supported() {
      return !!(window.Notification && 'serviceWorker' in navigator);
    },

    /** 'default' | 'granted' | 'denied' | 'unsupported' */
    permission() {
      if (!Push.supported()) return 'unsupported';
      return Notification.permission;
    },

    /** Harus dipanggil dari gestur pengguna; peramban mensyaratkannya. */
    async request() {
      if (!Push.supported()) throw new Error('Peramban ini tidak mendukung notifikasi.');
      const p = await Notification.requestPermission();
      if (p === 'granted') Push.daftarFcm().catch(() => {});
      return p;
    },

    async registrasi() {
      if (!('serviceWorker' in navigator)) return null;
      try { return await navigator.serviceWorker.ready; }
      catch (e) { return null; }
    },

    /**
     * Menampilkan notifikasi. Selalu lewat service worker, bukan
     * `new Notification()`: hanya jalur service worker yang dapat
     * menampilkan aksi dan tetap bekerja ketika tab tidak aktif.
     */
    async show(title, opts) {
      if (Push.permission() !== 'granted') return false;
      const reg = await Push.registrasi();
      if (!reg) return false;
      try {
        await reg.showNotification(title, Object.assign({
          body: '',
          icon: 'assets/icons/icon-192.png',
          badge: 'assets/icons/icon-192.png',
          lang: 'id',
          data: { url: cfg().urlBuka || '/app/' }
        }, opts || {}));
        return true;
      } catch (e) {
        console.warn('[TeleCare] notifikasi gagal ditampilkan:', e.message);
        return false;
      }
    },

    /**
     * Memberitahukan satu temuan eskalasi: tercatat di dalam aplikasi,
     * dan bila diizinkan juga muncul sebagai notifikasi sistem.
     */
    async peringatkan(f) {
      const berat = f.severity === 'crit';
      // Nilai simulasi dapat menembus ambang juga. Notifikasi memotong
      // perhatian pengguna, jadi asal angka harus disebutkan — peringatan
      // "kritis" dari angka yang dibangkitkan sendiri akan menyesatkan.
      const simulasi = !(TC.Vitals && TC.Vitals.source && TC.Vitals.source() === 'device');
      const judul = (berat ? 'Peringatan kritis · ' : 'Perlu diperhatikan · ') + f.label +
                    (simulasi ? ' (simulasi)' : '');

      TC.Store.notify(judul, f.text, berat ? 'warn' : 'info');

      return Push.show(judul, {
        body: f.text +
              (simulasi ? '\nAngka ini dari simulasi purwarupa, bukan sensor.' : '') +
              (berat && !simulasi ? '\nSegera hubungi tenaga kesehatan bila keluhan terasa.' : ''),
        tag: 'telecare-' + f.metric,        // satu ukuran menimpa notifikasinya sendiri
        renotify: berat,
        requireInteraction: berat,
        data: { url: (cfg().urlBuka || '/app/') + '#/vital/' + (f.metric === 'bp' ? 'bp' : f.metric) }
      });
    },

    /* ---------------- pemantauan otomatis ---------------- */
    _lepas: null,

    /**
     * Mulai memantau vital dan memberitahukan bila menembus ambang.
     * Aman dipanggil berulang; langganan lama dilepas lebih dulu.
     */
    mulaiPantau() {
      Push.hentikanPantau();
      if (!TC.Vitals) return;
      Push._lepas = TC.Vitals.subscribe(() => {
        const s = TC.Store.state.settings;
        if (s && s.notif === false) return;
        const temuan = Escalation.check(TC.Vitals.snapshot());
        temuan.forEach((f) => { Push.peringatkan(f).catch(() => {}); });
      });
    },

    hentikanPantau() {
      if (Push._lepas) { Push._lepas(); Push._lepas = null; }
    },

    /* ---------------- FCM ---------------- */
    fcmSiap() {
      return !!(cfg().vapidKey && window.firebase && firebase.messaging);
    },

    /** Memuat SDK messaging hanya bila memang dipakai. */
    muatSdk() {
      if (!cfg().vapidKey) return Promise.resolve(false);
      if (window.firebase && firebase.messaging) return Promise.resolve(true);
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js';
        s.onload = () => resolve(true);
        s.onerror = () => { console.warn('[TeleCare] SDK messaging gagal dimuat.'); resolve(false); };
        document.head.appendChild(s);
      });
    },

    /**
     * Mendaftarkan perangkat ke FCM dan mengembalikan tokennya.
     * Mengembalikan null bila VAPID key belum diisi — keadaan bawaan
     * proyek ini, dan bukan galat.
     */
    async daftarFcm() {
      if (!cfg().vapidKey) return null;
      if (Push.permission() !== 'granted') return null;
      if (!(await Push.muatSdk())) return null;
      if (!(window.firebase && firebase.messaging)) return null;
      try {
        const reg = await Push.registrasi();
        const messaging = firebase.messaging();
        const token = await messaging.getToken({
          vapidKey: cfg().vapidKey,
          serviceWorkerRegistration: reg || undefined
        });
        if (!token) return null;
        Push.token = token;

        // Pesan yang datang saat aplikasi sedang dibuka tidak ditampilkan
        // otomatis oleh peramban, jadi ditangani sendiri di sini.
        messaging.onMessage((payload) => {
          const n = (payload && payload.notification) || {};
          const d = (payload && payload.data) || {};
          Push.show(n.title || d.title || 'TeleCare', {
            body: n.body || d.body || '',
            tag: d.tag || 'telecare-fcm'
          }).catch(() => {});
          TC.Store.notify(n.title || 'Pesan masuk', n.body || d.body || '', 'info');
        });

        return token;
      } catch (e) {
        console.warn('[TeleCare] pendaftaran FCM gagal:', e.message);
        return null;
      }
    },

    /** Ringkasan keadaan untuk ditampilkan di Pengaturan. */
    status() {
      const p = Push.permission();
      return {
        didukung: Push.supported(),
        izin: p,
        vapidDiisi: !!cfg().vapidKey,
        token: Push.token || null,
        ringkasan: !Push.supported()
          ? 'Peramban ini tidak mendukung notifikasi.'
          : p === 'denied'
            ? 'Notifikasi diblokir untuk situs ini — ubah dari pengaturan peramban.'
            : p !== 'granted'
              ? 'Izin notifikasi belum diberikan.'
              : (cfg().vapidKey
                  ? 'Notifikasi aktif, termasuk push dari server.'
                  : 'Notifikasi lokal aktif. Push dari server belum dikonfigurasi (VAPID key kosong).')
      };
    }
  };

  TC.Escalation = Escalation;
  TC.Push = Push;
})(window.TC);
