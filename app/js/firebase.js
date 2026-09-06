/* ============================================================
   TeleCare App — firebase.js
   Dua hal yang membutuhkan server: percakapan konsultasi
   (Realtime Database) dan sinyal panggilan WebRTC.

   Bila Firebase tidak dapat dijangkau, seluruh modul di sini
   melapor "luring" dan aplikasi kembali memakai penyimpanan lokal
   sehingga tetap dapat dipakai.
   ============================================================ */
(function (TC) {
  'use strict';

  const CONFIG = {
    apiKey: "AIzaSyBhMi3nXhZFDKFXaZi6Ptm2yPTh1FDIf-Y",
    authDomain: "telecare-id.firebaseapp.com",
    databaseURL: "https://telecare-id-default-rtdb.firebaseio.com",
    projectId: "telecare-id",
    storageBucket: "telecare-id.firebasestorage.app",
    messagingSenderId: "110142041439",
    appId: "1:110142041439:web:9fe1c6449b51c5d2431aea"
  };

  // Seluruh data purwarupa dikurung di bawah satu cabang agar mudah
  // dibersihkan dan dibatasi lewat aturan keamanan.
  const ROOT = 'telecare/demo';

  /* ============================================================
     1. KONEKSI
     ============================================================ */
  const FB = {
    ready: false,
    online: false,
    settled: false,   // sudah menerima kabar pertama dari .info/connected
    uid: null,
    db: null,
    error: null,
    _subs: new Set()
  };

  function emit() {
    FB._subs.forEach((fn) => { try { fn(FB); } catch (e) { /* abaikan */ } });
    window.dispatchEvent(new CustomEvent('telecare:fb', { detail: { online: FB.online } }));
  }

  FB.onStatus = function (fn) {
    FB._subs.add(fn);
    fn(FB);
    return () => FB._subs.delete(fn);
  };

  FB.init = function () {
    if (FB.ready) return;
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
      FB.error = 'SDK Firebase tidak termuat';
      FB.settled = true;
      emit();
      return;
    }
    try {
      firebase.initializeApp(CONFIG);
      FB.db = firebase.database();
      FB.ready = true;

      FB.db.ref('.info/connected').on('value', (snap) => {
        FB.online = !!snap.val();
        FB.settled = true;
        emit();
      });
      // Bila dalam 8 detik tidak ada kabar, anggap luring agar UI tidak
      // menggantung pada keadaan "menghubungkan" selamanya.
      setTimeout(() => { if (!FB.settled) { FB.settled = true; emit(); } }, 8000);

      // Sejak aturan database mensyaratkan `auth != null`, identitas lokal
      // tidak lagi cukup: setiap tulisan menunggu sesi Firebase yang sah.
      FB.uid = null;
      if (firebase.auth) {
        // Janji ini selesai pada kabar pertama dari onAuthStateChanged, yaitu
        // setelah SDK selesai memulihkan sesi tersimpan (bila ada). Menunggu
        // kabar itu mencegah pembuatan sesi anonim baru yang tidak perlu.
        FB._firstAuth = new Promise((resolve) => {
          let settled = false;
          firebase.auth().onAuthStateChanged((u) => {
            FB.uid = u ? u.uid : null;
            FB.authUser = u || null;
            FB.anonymous = !!(u && u.isAnonymous);
            if (!settled) { settled = true; resolve(u || null); }
            emit();
          });
        });
        // Sesi disiapkan sejak awal agar layar pertama yang menulis tidak
        // perlu menunggu proses masuk.
        FB.ensureAuth().catch(() => {});
      }
    } catch (e) {
      FB.error = e.message;
      FB.ready = false;
      FB.settled = true;
      console.warn('[TeleCare] Firebase tidak aktif:', e.message);
      emit();
    }
  };

  /* ---------------- Sesi wajib untuk menulis ke database ----------------
     Aturan database menolak tulisan tanpa autentikasi. Pengguna yang belum
     masuk (termasuk mode Tamu dan tautan ?demo=) diberi sesi anonim Firebase
     supaya alur peragaan tetap utuh tanpa membuka database ke publik.
     -------------------------------------------------------------------- */
  FB._authOnce = null;

  FB.ensureAuth = function () {
    if (!(window.firebase && firebase.auth)) {
      return Promise.reject(new Error('Firebase Authentication tidak termuat.'));
    }
    if (FB._authOnce) return FB._authOnce;

    FB._authOnce = (FB._firstAuth || Promise.resolve(null))
      .then((u) => {
        const cur = firebase.auth().currentUser || u;
        if (cur) return cur;
        return firebase.auth().signInAnonymously().then((res) => res.user);
      })
      .then((user) => { FB.authFatal = null; emit(); return user; })
      .catch((err) => {
        FB._authOnce = null;               // biar percobaan berikutnya bisa jalan
        const code = (err && err.code) || '';
        if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
          FB.authFatal = 'Metode masuk Anonim belum diaktifkan pada proyek Firebase. ' +
            'Aktifkan di Firebase Console → Authentication → Sign-in method → Anonymous.';
        } else {
          FB.authFatal = FB.authError(err);
        }
        console.warn('[TeleCare] sesi Firebase gagal:', FB.authFatal);
        emit();
        throw err;
      });

    return FB._authOnce;
  };

  /**
   * Benar hanya bila data sungguh dapat disinkronkan: tersambung **dan**
   * bersesi sah. Tanpa pemeriksaan sesi, aplikasi bisa mengaku "tersambung"
   * padahal setiap tulisan ditolak aturan database.
   */
  FB.canSync = function () {
    return !!(FB.ready && FB.online && FB.uid && !FB.authFatal);
  };

  /**
   * Menunggu sambungan siap. Dipakai sebelum menulis sinyal WebRTC, karena
   * pada saat layar panggilan dibuka koneksi sering belum selesai terbentuk.
   */
  FB.waitOnline = function (ms) {
    if (FB.online) return Promise.resolve(true);
    if (!FB.ready) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false;
      const off = FB.onStatus((s) => {
        if (s.online && !done) { done = true; off(); resolve(true); }
      });
      setTimeout(() => { if (!done) { done = true; off(); resolve(false); } }, ms || 7000);
    });
  };

  /* ---------------- Masuk dengan Google ---------------- */
  FB.googleAvailable = () => !!(window.firebase && firebase.auth);

  /**
   * Membuka jendela masuk Google. Pada peramban yang memblokir popup
   * (umumnya di ponsel), otomatis beralih ke alur pengalihan halaman.
   */
  FB.signInGoogle = function () {
    if (!FB.googleAvailable()) {
      return Promise.reject(new Error('Firebase Authentication belum termuat.'));
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return firebase.auth().signInWithPopup(provider)
      .then((res) => res.user)
      .catch((err) => {
        const code = err && err.code ? err.code : '';
        if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request' ||
            code === 'auth/operation-not-supported-in-this-environment') {
          return firebase.auth().signInWithRedirect(provider).then(() => null);
        }
        throw err;
      });
  };

  /** Hasil alur pengalihan, dipanggil sekali saat aplikasi dimuat. */
  FB.redirectResult = function () {
    if (!FB.googleAvailable()) return Promise.resolve(null);
    return firebase.auth().getRedirectResult()
      .then((res) => (res && res.user ? res.user : null))
      .catch(() => null);
  };

  /**
   * Keluar dari akun, lalu kembali ke sesi anonim. Tanpa langkah kedua,
   * aplikasi kehilangan hak tulis ke database setelah pengguna keluar.
   */
  FB.signOut = function () {
    FB._authOnce = null;
    if (!FB.googleAvailable()) return Promise.resolve();
    return firebase.auth().signOut()
      .then(() => FB.ensureAuth().catch(() => null))
      .catch(() => null);
  };

  /** Menerjemahkan kode galat Firebase Auth ke bahasa yang bisa dibaca. */
  FB.authError = function (err) {
    const c = (err && err.code) || '';
    if (c === 'auth/operation-not-allowed') {
      return 'Metode masuk Google belum diaktifkan pada proyek Firebase. ' +
             'Aktifkan di Firebase Console → Authentication → Sign-in method → Google.';
    }
    if (c === 'auth/unauthorized-domain') {
      return 'Domain ini belum diizinkan pada Firebase Authentication.';
    }
    if (c === 'auth/popup-closed-by-user') return 'Jendela masuk ditutup sebelum selesai.';
    if (c === 'auth/network-request-failed') return 'Jaringan bermasalah. Coba lagi.';
    return (err && err.message) || 'Masuk dengan Google gagal.';
  };

  /* ---------------- Kehadiran dokter pada percakapan ---------------- */
  // Dipakai agar balasan otomatis berhenti ketika dokter sungguhan hadir.
  FB.presence = function (consultId, role) {
    const r = FB.ref('consults/' + consultId + '/meta/doctorOnline');
    if (!r || role !== 'dokter') return () => {};
    // Menulis kehadiran memerlukan sesi sah dan keanggotaan percakapan.
    Chat.join(consultId).then(() => {
      r.set(true).catch(() => {});
      try { r.onDisconnect().set(false); } catch (e) { /* abaikan */ }
    }).catch(() => {});
    return () => { r.set(false).catch(() => {}); };
  };

  FB.watchPresence = function (consultId, fn) {
    const r = FB.ref('consults/' + consultId + '/meta/doctorOnline');
    if (!r) return () => {};
    let handler = null;
    // Membaca pun menuntut keanggotaan, jadi bergabung dulu.
    Chat.join(consultId).then(() => {
      handler = r.on('value', (s) => fn(!!s.val()));
    }).catch(() => {});
    return () => { if (handler) r.off('value', handler); };
  };

  FB.ref = (path) => (FB.db ? FB.db.ref(ROOT + '/' + path) : null);
  FB.stamp = () => (window.firebase && firebase.database
    ? firebase.database.ServerValue.TIMESTAMP : Date.now());

  /* ============================================================
     2. CHAT — pesan konsultasi di Realtime Database
     ============================================================ */
  const Chat = {
    /**
     * Mendaftarkan diri sebagai peserta percakapan. Aturan database hanya
     * mengizinkan setiap orang menulis kunci miliknya sendiri
     * (`meta/members/$uid` dengan `$uid == auth.uid`), dan seluruh akses
     * baca-tulis percakapan bertumpu pada daftar itu. Konsekuensinya: yang
     * memegang ID percakapan boleh bergabung — ID itulah kapabilitasnya,
     * karena itu dibangkitkan secara kriptografis.
     */
    _joined: Object.create(null),

    join(consultId) {
      return FB.ensureAuth().then((user) => {
        const key = user.uid + '@' + consultId;
        // Ditulis sekali per sesi; janji yang sama dipakai ulang agar pemanggil
        // lain (kirim pesan, langganan, sinyal panggilan) cukup menunggunya.
        if (Chat._joined[key]) return Chat._joined[key];
        const r = FB.ref('consults/' + consultId + '/meta/members/' + user.uid);
        if (!r) return false;
        Chat._joined[key] = r.set(true).then(() => true).catch((e) => {
          delete Chat._joined[key];
          throw e;
        });
        return Chat._joined[key];
      });
    },

    /** Melupakan keanggotaan yang tersimpan (dipakai saat ID ternyata tak dikenal). */
    _forget(consultId) {
      if (!FB.uid) return;
      delete Chat._joined[FB.uid + '@' + consultId];
    },

    /**
     * Menuliskan metadata percakapan bila belum ada.
     *
     * Memakai `update()` dan bukan `set()`/`transaction()` pada simpul `meta`
     * secara sengaja: aturan database tidak memberi izin tulis pada `meta`
     * itu sendiri, hanya pada masing-masing field. Sebabnya izin tulis di
     * Firebase menurun ke seluruh anak — izin di `meta` akan membuat siapa pun
     * peserta bisa mengubah daftar `members`, termasuk menambah atau membuang
     * orang lain. `update()` dinilai per-anak, jadi tetap sah, dan `members`
     * sama sekali tidak tersentuh.
     */
    ensure(consultId, meta) {
      return Chat.join(consultId).then(() => {
        const r = FB.ref('consults/' + consultId + '/meta');
        if (!r) return false;
        // doctorId menjadi penanda "percakapan sudah disiapkan", sebab `join`
        // sudah lebih dulu membuat simpul meta berisi members.
        return r.child('doctorId').get().then((s) => {
          if (s.exists()) return true;
          return r.update({
            doctorId: meta.doctorId,
            mode: meta.mode || 'chat',
            startedAt: meta.startedAt || Date.now(),
            status: 'active'
          }).then(() => true);
        });
      }).catch((e) => {
        console.warn('[TeleCare] gagal menyiapkan percakapan:', e.message);
        return false;
      });
    },

    /** Mendengarkan pesan baru. Mengembalikan fungsi pemutus langganan. */
    subscribe(consultId, onMessage) {
      const r = FB.ref('consults/' + consultId + '/messages');
      if (!r) return () => {};
      const q = r.limitToLast(200);
      let handler = null;
      let stopped = false;
      // Membaca pesan menuntut keanggotaan, jadi langganan dipasang setelah
      // sesi siap dan diri terdaftar sebagai peserta.
      Chat.join(consultId).then(() => {
        if (stopped) return;
        handler = q.on('child_added', (snap) => {
          const v = snap.val();
          if (v) onMessage(Object.assign({ key: snap.key }, v));
        }, (err) => {
          console.warn('[TeleCare] gagal membaca percakapan:', err.message);
        });
      }).catch((e) => {
        console.warn('[TeleCare] tidak dapat mengikuti percakapan:', e.message);
      });
      return () => {
        stopped = true;
        if (handler) q.off('child_added', handler);
      };
    },

    /** Mengirim satu pesan. Menolak (reject) bila sesi atau server gagal. */
    send(consultId, msg) {
      if (!FB.db) return Promise.reject(new Error('Firebase belum siap'));
      // Keanggotaan wajib lebih dulu, kalau tidak aturan menolak tulisan ini.
      return Chat.join(consultId).then(() => {
        const r = FB.ref('consults/' + consultId + '/messages');
        if (!r) throw new Error('Firebase belum siap');
        // `uid` wajib sama dengan auth.uid — divalidasi oleh aturan database.
        // Tulisan saat luring diantre oleh SDK dan dikirim setelah tersambung.
        return r.push(Object.assign({ at: Date.now() }, msg, { uid: FB.uid }));
      });
    },

    /**
     * Mengambil metadata percakapan (dipakai saat membuka tautan undangan).
     * Mengembalikan null bila percakapan tidak ada — ditandai oleh tidak
     * adanya `doctorId`, sebab `join` di atas sudah membuat simpul `members`
     * lebih dulu sehingga meta selalu "ada" secara teknis. Keanggotaan yang
     * telanjur tertulis untuk ID tak dikenal dibersihkan kembali.
     */
    meta(consultId) {
      if (!FB.db) return Promise.resolve(null);
      return Chat.join(consultId)
        .then(() => {
          const r = FB.ref('consults/' + consultId + '/meta');
          if (!r) return null;
          return r.get().then((s) => {
            const v = s.exists() ? s.val() : null;
            if (v && v.doctorId) return v;
            if (FB.uid) {
              const mine = FB.ref('consults/' + consultId + '/meta/members/' + FB.uid);
              if (mine) mine.remove().catch(() => {});
              Chat._forget(consultId);
            }
            return null;
          });
        })
        .catch(() => null);
    },

    setStatus(consultId, status) {
      const r = FB.ref('consults/' + consultId + '/meta/status');
      if (r) FB.ensureAuth().then(() => r.set(status)).catch(() => {});
    }
  };

  /* ============================================================
     3. WEBRTC — panggilan suara/video dengan sinyal lewat RTDB
     ============================================================
     Pola yang dipakai: peserta pertama pada sebuah ruang menjadi
     pemanggil (menulis offer), peserta berikutnya menjadi penerima
     (menulis answer). Kandidat ICE dipertukarkan lewat dua daftar
     terpisah agar tidak saling menimpa.
     ============================================================ */
  const ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['stun:stun.services.mozilla.com'] }
    ],
    iceCandidatePoolSize: 8
  };

  const RTC = {
    supported() {
      return !!(window.RTCPeerConnection && navigator.mediaDevices &&
                navigator.mediaDevices.getUserMedia);
    },

    /**
     * Bergabung ke sebuah ruang panggilan.
     * @param {string} roomId  pengenal ruang (dipakai bersama kedua sisi)
     * @param {object} opts    { video:boolean, audio:boolean }
     * @param {object} on      { onLocal, onRemote, onState, onRole }
     */
    async join(roomId, opts, on) {
      on = on || {};
      const wantVideo = opts.video !== false;

      if (!RTC.supported()) throw new Error('Peramban ini tidak mendukung WebRTC.');

      const local = await navigator.mediaDevices.getUserMedia({
        video: wantVideo ? { facingMode: 'user' } : false,
        audio: true
      });
      if (on.onLocal) on.onLocal(local);

      const pc = new RTCPeerConnection(ICE);
      local.getTracks().forEach((t) => pc.addTrack(t, local));

      const remote = new MediaStream();
      pc.ontrack = (ev) => {
        ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
        if (on.onRemote) on.onRemote(remote);
      };
      pc.onconnectionstatechange = () => {
        if (on.onState) on.onState(pc.connectionState);
      };

      const roomRef = FB.ref('rooms/' + roomId);
      let linked = roomRef ? await FB.waitOnline(7000) : false;
      // Sinyal panggilan hanya boleh ditulis peserta percakapan yang sama;
      // tanpa sesi dan keanggotaan, aturan database menolak seluruh tulisan.
      if (linked) {
        try { await Chat.join(roomId); }
        catch (e) {
          console.warn('[TeleCare] sesi panggilan tidak sah:', e.message);
          linked = false;
        }
      }
      if (!roomRef || !linked) {
        // Tanpa server sinyal, panggilan tetap menampilkan pratinjau lokal.
        if (on.onRole) on.onRole('solo');
        return session(pc, local, remote, null, [], 'solo');
      }

      const snap = await roomRef.child('offer').get();
      const isCaller = !snap.exists();
      const myList = isCaller ? 'callerCandidates' : 'calleeCandidates';
      const theirList = isCaller ? 'calleeCandidates' : 'callerCandidates';
      if (on.onRole) on.onRole(isCaller ? 'caller' : 'callee');

      pc.onicecandidate = (ev) => {
        if (ev.candidate) roomRef.child(myList).push(ev.candidate.toJSON()).catch(() => {});
      };

      const offs = [];

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await roomRef.child('offer').set({ type: offer.type, sdp: offer.sdp });
        await roomRef.child('createdAt').set(Date.now());

        const aRef = roomRef.child('answer');
        const aH = aRef.on('value', async (s) => {
          const v = s.val();
          if (v && !pc.currentRemoteDescription) {
            try { await pc.setRemoteDescription(new RTCSessionDescription(v)); }
            catch (e) { console.warn('[TeleCare] answer ditolak:', e.message); }
          }
        });
        offs.push(() => aRef.off('value', aH));
      } else {
        const offer = snap.val();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });
      }

      const cRef = roomRef.child(theirList);
      const cH = cRef.on('child_added', async (s) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(s.val())); }
        catch (e) { /* kandidat usang, abaikan */ }
      });
      offs.push(() => cRef.off('child_added', cH));

      return session(pc, local, remote, roomRef, offs, isCaller ? 'caller' : 'callee');
    },

    /** Membersihkan ruang yang sudah selesai dipakai. */
    clearRoom(roomId) {
      const r = FB.ref('rooms/' + roomId);
      if (r) r.remove().catch(() => {});
    }
  };

  function session(pc, local, remote, roomRef, offs, role) {
    return {
      pc, local, remote, role,
      toggleAudio(on) { local.getAudioTracks().forEach((t) => { t.enabled = on; }); },
      toggleVideo(on) { local.getVideoTracks().forEach((t) => { t.enabled = on; }); },
      async switchCamera() {
        const vt = local.getVideoTracks()[0];
        if (!vt) return false;
        const cur = vt.getSettings().facingMode === 'environment' ? 'user' : 'environment';
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cur }, audio: false });
          const nt = s.getVideoTracks()[0];
          const sender = pc.getSenders().find((x) => x.track && x.track.kind === 'video');
          if (sender) await sender.replaceTrack(nt);
          vt.stop();
          local.removeTrack(vt);
          local.addTrack(nt);
          return true;
        } catch (e) { return false; }
      },
      hangup(removeRoom) {
        offs.forEach((f) => { try { f(); } catch (e) {} });
        try { pc.getSenders().forEach((s) => s.track && s.track.stop()); } catch (e) {}
        try { local.getTracks().forEach((t) => t.stop()); } catch (e) {}
        try { pc.close(); } catch (e) {}
        if (roomRef && removeRoom) roomRef.remove().catch(() => {});
      }
    };
  }

  TC.FB = FB;
  TC.Chat = Chat;
  TC.RTC = RTC;
})(window.TC);
