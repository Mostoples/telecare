/* ============================================================
   TeleCare App — ring.js
   Panggilan masuk: dokter berdering ketika pasien memanggil.

   KENAPA LEWAT REALTIME DATABASE, BUKAN FCM
   FCM baru diperlukan bila pesan harus sampai ketika aplikasi
   benar-benar tertutup, dan itu menuntut VAPID key serta pengirim
   di sisi server. Selama aplikasi terbuka — termasuk di tab latar
   belakang atau PWA yang terpasang — Realtime Database sudah
   mengantarkan panggilan seketika lewat `child_added`, tanpa
   prasyarat apa pun. Jalur FCM ditambahkan sebagai pelengkap,
   bukan pengganti; lihat app/js/push.js dan functions/.

   KENAPA KOTAK MASUK DIKUNCI PER FIREBASE UID
   Entri panggilan memuat `consultId`, dan siapa pun yang memegang
   consultId dapat bergabung ke percakapan itu. Kalau kotak masuk
   dikunci per `doctorId`, aturan database tidak punya cara
   memverifikasi bahwa pembacanya benar-benar dokter tersebut —
   peran hanya tersimpan di localStorage. Dengan mengunci per
   `auth.uid`, aturan dapat memaksa `auth.uid == $uid`, sehingga
   consultId tetap rahasia. Papan jaga `duty/{doctorId}` hanya
   memuat uid yang bersifat buram dan tidak memberi hak apa pun.
   ============================================================ */
(function (TC) {
  'use strict';

  const FB = TC.FB;

  // Berapa lama panggilan berdering sebelum dianggap tidak dijawab.
  const TIMEOUT_MS = 45000;
  // Entri yang lebih tua dari ini diabaikan: sisa sesi lama yang belum
  // terbersihkan tidak boleh membuat perangkat berdering saat dibuka.
  const KEDALUWARSA_MS = 60000;
  // Selang pembaruan penanda waktu papan jaga.
  const DENYUT_MS = 60000;
  // Papan jaga yang tidak diperbarui selama ini dianggap ditinggalkan.
  const JAGA_BASI_MS = 3 * DENYUT_MS;

  /* ============================================================
     1. NADA DERING
     ============================================================
     Dibangkitkan Web Audio, tanpa berkas aset — mengikuti pola
     proyek ini yang membangun aset lewat kode.

     Peramban melarang audio berbunyi sebelum pengguna berinteraksi
     dengan halaman. Kalau itu terjadi, `diblokir` menjadi true dan
     pemanggilan tetap terlihat lewat notifikasi sistem dan overlay —
     bukan gagal diam-diam.
     ============================================================ */
  const nada = {
    ctx: null,
    timer: null,
    aktif: false,
    diblokir: false,

    _ctxBaru() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!nada.ctx) nada.ctx = new AC();
      return nada.ctx;
    },

    /** Satu ketukan dering: dua nada berpadu, dengan selubung agar tidak "klik". */
    _ketuk(mulaiDetik) {
      const ctx = nada.ctx;
      if (!ctx) return;
      const t = ctx.currentTime + mulaiDetik;
      const durasi = 0.32;
      const g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + durasi - 0.06);
      g.gain.linearRampToValueAtTime(0, t + durasi);

      [440, 554.37].forEach((hz) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz, t);
        o.connect(g);
        o.start(t);
        o.stop(t + durasi);
      });
    },

    _pola() {
      nada._ketuk(0);
      nada._ketuk(0.42);
      if (navigator.vibrate) {
        try { navigator.vibrate([420, 180, 420]); } catch (e) { /* abaikan */ }
      }
    },

    async mulai() {
      if (nada.aktif) return !nada.diblokir;
      const ctx = nada._ctxBaru();
      if (!ctx) { nada.diblokir = true; return false; }
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) { /* ditolak peramban */ }
      }
      if (ctx.state !== 'running') {
        nada.diblokir = true;
        console.info('[TeleCare] nada dering diblokir peramban sampai ada interaksi.');
        // Getaran masih mungkin walau audio diblokir.
        if (navigator.vibrate) { try { navigator.vibrate([420, 180, 420]); } catch (e) {} }
        return false;
      }
      nada.diblokir = false;
      nada.aktif = true;
      nada._pola();
      nada.timer = setInterval(nada._pola, 2600);
      return true;
    },

    berhenti() {
      nada.aktif = false;
      if (nada.timer) { clearInterval(nada.timer); nada.timer = null; }
      if (navigator.vibrate) { try { navigator.vibrate(0); } catch (e) { /* abaikan */ } }
    },

    /**
     * Membuka kunci audio pada interaksi pertama pengguna, supaya dering
     * berikutnya sudah boleh berbunyi. Dipasang sekali saat aplikasi dimuat.
     */
    siapkanIzin() {
      const buka = () => {
        const ctx = nada._ctxBaru();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      };
      ['pointerdown', 'keydown'].forEach((ev) => {
        window.addEventListener(ev, buka, { once: true, passive: true });
      });
    }
  };

  /* ============================================================
     2. KANAL PANGGILAN
     ============================================================ */
  const Ring = {
    nada,
    TIMEOUT_MS,

    tersedia() { return !!(FB && FB.db); },

    /* ---------------- sisi dokter ---------------- */

    _dutyRef: null,
    _denyut: null,

    /**
     * Mendaftarkan diri sebagai dokter yang sedang menerima panggilan.
     *
     * Dua lapis perlindungan terhadap entri usang, sebab entri usang membuat
     * pasien mendering perangkat yang sudah tidak ada lalu menunggu sampai
     * kedaluwarsa tanpa penjelasan:
     *   1. `onDisconnect` menghapus entri ketika sambungan putus dengan tertib.
     *   2. `at` diperbarui berkala, sehingga entri yang ditinggalkan proses
     *      yang mati mendadak masih dapat dikenali basi oleh `cekJaga`.
     */
    async mulaiJaga(doctorId, nama) {
      if (!Ring.tersedia() || !doctorId) return false;
      const user = await FB.ensureAuth();
      const r = FB.ref('duty/' + doctorId);
      if (!r) return false;
      await r.set({ uid: user.uid, name: String(nama || 'Dokter').slice(0, 80), at: Date.now() });
      try { r.onDisconnect().remove(); } catch (e) { /* abaikan */ }
      Ring._dutyRef = r;

      if (Ring._denyut) clearInterval(Ring._denyut);
      Ring._denyut = setInterval(() => {
        r.child('at').set(Date.now()).catch(() => {});
      }, DENYUT_MS);
      return true;
    },

    async berhentiJaga() {
      const r = Ring._dutyRef;
      Ring._dutyRef = null;
      if (Ring._denyut) { clearInterval(Ring._denyut); Ring._denyut = null; }
      if (!r) return;
      try { await r.onDisconnect().cancel(); } catch (e) { /* abaikan */ }
      await r.remove().catch(() => {});
    },

    /**
     * Mendengarkan panggilan masuk untuk pengguna ini.
     * @param {object} on { onMasuk(ring), onBatal(ringId) }
     * @returns {Function} pemutus langganan
     */
    dengarkan(on) {
      on = on || {};
      if (!Ring.tersedia()) return () => {};
      let lepas = null;
      let berhenti = false;

      FB.ensureAuth().then((user) => {
        if (berhenti) return;
        const r = FB.ref('inbox/' + user.uid);
        if (!r) return;
        const q = r.limitToLast(5);

        const masuk = (snap) => {
          const v = snap.val();
          if (!v) return;
          // Hanya panggilan yang masih berdering dan masih segar.
          if (v.status && v.status !== 'ringing') return;
          if (!v.at || Date.now() - v.at > KEDALUWARSA_MS) {
            snap.ref.remove().catch(() => {});
            return;
          }
          if (on.onMasuk) on.onMasuk(Object.assign({ ringId: snap.key, ref: snap.ref }, v));
        };

        const berubah = (snap) => {
          const v = snap.val() || {};
          // Pasien membatalkan, atau entri sudah dijawab di perangkat lain.
          if (v.status && v.status !== 'ringing' && on.onBatal) on.onBatal(snap.key, v.status);
        };

        const hilang = (snap) => { if (on.onBatal) on.onBatal(snap.key, 'removed'); };

        const h1 = q.on('child_added', masuk, (e) =>
          console.warn('[TeleCare] kotak masuk panggilan tidak terbaca:', e.message));
        const h2 = q.on('child_changed', berubah);
        const h3 = q.on('child_removed', hilang);

        lepas = () => {
          q.off('child_added', h1);
          q.off('child_changed', h2);
          q.off('child_removed', h3);
        };
      }).catch((e) => console.warn('[TeleCare] gagal mendengarkan panggilan:', e.message));

      return () => { berhenti = true; if (lepas) lepas(); };
    },

    /** Menerima panggilan: tandai diterima lalu gabung ke percakapannya. */
    async terima(ring) {
      nada.berhenti();
      if (!ring || !ring.ref) return null;
      await ring.ref.update({ status: 'accepted', answeredAt: Date.now() }).catch(() => {});
      if (ring.consultId && TC.Chat) {
        await TC.Chat.join(ring.consultId).catch(() => {});
      }
      // Entri dihapus setelah beberapa saat agar pemanggil sempat membaca
      // statusnya lebih dulu.
      setTimeout(() => { ring.ref.remove().catch(() => {}); }, 4000);
      return ring.consultId || null;
    },

    async tolak(ring) {
      nada.berhenti();
      if (!ring || !ring.ref) return;
      await ring.ref.update({ status: 'declined', answeredAt: Date.now() }).catch(() => {});
      setTimeout(() => { ring.ref.remove().catch(() => {}); }, 4000);
    },

    /**
     * Menyimpan token FCM perangkat ini. Ditaruh di `push/{uid}` yang hanya
     * dapat dibaca pemiliknya — token push tidak layak diumbar, sedangkan
     * Cloud Function tetap dapat membacanya lewat Admin SDK.
     */
    async simpanToken(token, peran) {
      if (!Ring.tersedia() || !token) return false;
      const user = await FB.ensureAuth();
      const r = FB.ref('push/' + user.uid);
      if (!r) return false;
      await r.set({
        token: String(token).slice(0, 4096),
        role: String(peran || 'pasien').slice(0, 20),
        at: Date.now()
      }).catch(() => {});
      return true;
    },

    /* ---------------- sisi pasien ---------------- */

    /** Apakah dokter itu sedang siap dipanggil? Mengembalikan { uid, name } atau null. */
    async cekJaga(doctorId) {
      if (!Ring.tersedia() || !doctorId) return null;
      try {
        await FB.ensureAuth();
        const r = FB.ref('duty/' + doctorId);
        if (!r) return null;
        const s = await r.get();
        const v = s.exists() ? s.val() : null;
        if (!v || !v.uid) return null;
        // Entri yang denyutnya berhenti berarti perangkatnya mati mendadak;
        // memanggilnya hanya membuat pasien menunggu sia-sia.
        if (!v.at || Date.now() - v.at > JAGA_BASI_MS) {
          r.remove().catch(() => {});
          return null;
        }
        return v;
      } catch (e) {
        return null;
      }
    },

    /**
     * Memanggil dokter. Mengembalikan null bila dokter itu tidak sedang jaga —
     * pemanggil lalu dapat jatuh ke cara tautan undangan.
     *
     * @param {object} o { doctorId, consultId, mode, fromName }
     * @returns {Promise<object|null>} { ringId, doctorUid, pantau, batalkan }
     */
    async panggil(o) {
      const jaga = await Ring.cekJaga(o.doctorId);
      if (!jaga) return null;

      const user = await FB.ensureAuth();
      const ringId = TC.secureId('r');
      const ref = FB.ref('inbox/' + jaga.uid + '/' + ringId);
      if (!ref) return null;

      await ref.set({
        from: user.uid,
        fromName: String(o.fromName || 'Pasien').slice(0, 80),
        consultId: o.consultId,
        mode: o.mode || 'video',
        at: Date.now(),
        status: 'ringing'
      });

      let habis = null;
      let lepas = null;

      const handle = {
        ringId,
        doctorUid: jaga.uid,
        doctorName: jaga.name,

        /** @param {Function} cb dipanggil dengan 'accepted' | 'declined' | 'missed' */
        pantau(cb) {
          const h = ref.on('value', (s) => {
            const v = s.val();
            // Entri hilang sebelum dijawab: anggap tidak dijawab.
            if (!v) { cb('missed'); return; }
            if (v.status && v.status !== 'ringing') cb(v.status);
          });
          lepas = () => ref.off('value', h);

          habis = setTimeout(() => {
            ref.update({ status: 'missed' }).catch(() => {});
            cb('missed');
            setTimeout(() => ref.remove().catch(() => {}), 2000);
          }, TIMEOUT_MS);

          return handle;
        },

        selesai() {
          if (habis) { clearTimeout(habis); habis = null; }
          if (lepas) { lepas(); lepas = null; }
        },

        async batalkan() {
          handle.selesai();
          await ref.update({ status: 'canceled' }).catch(() => {});
          setTimeout(() => ref.remove().catch(() => {}), 2000);
        }
      };

      return handle;
    }
  };

  TC.Ring = Ring;
})(window.TC);
