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

      // Identitas anonim dipakai bila diaktifkan pada proyek; bila tidak,
      // aplikasi tetap berjalan dengan identitas lokal.
      FB.uid = localUid();
      if (firebase.auth) {
        firebase.auth().onAuthStateChanged((u) => {
          FB.uid = u ? u.uid : localUid();
          FB.authUser = u || null;
          emit();
        });
      }
    } catch (e) {
      FB.error = e.message;
      FB.ready = false;
      FB.settled = true;
      console.warn('[TeleCare] Firebase tidak aktif:', e.message);
      emit();
    }
  };

  function localUid() {
    let id = localStorage.getItem('telecare.uid');
    if (!id) {
      id = 'local-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('telecare.uid', id);
    }
    return id;
  }

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

  FB.signOut = function () {
    if (FB.googleAvailable()) firebase.auth().signOut().catch(() => {});
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
    r.set(true).catch(() => {});
    try { r.onDisconnect().set(false); } catch (e) { /* abaikan */ }
    return () => { r.set(false).catch(() => {}); };
  };

  FB.watchPresence = function (consultId, fn) {
    const r = FB.ref('consults/' + consultId + '/meta/doctorOnline');
    if (!r) return () => {};
    const h = r.on('value', (s) => fn(!!s.val()));
    return () => r.off('value', h);
  };

  FB.ref = (path) => (FB.db ? FB.db.ref(ROOT + '/' + path) : null);
  FB.stamp = () => (window.firebase && firebase.database
    ? firebase.database.ServerValue.TIMESTAMP : Date.now());

  /* ============================================================
     2. CHAT — pesan konsultasi di Realtime Database
     ============================================================ */
  const Chat = {
    /** Menuliskan metadata percakapan bila belum ada. */
    ensure(consultId, meta) {
      const r = FB.ref('consults/' + consultId + '/meta');
      if (!r) return Promise.resolve(false);
      return r.transaction((cur) => (cur ? cur : {
        doctorId: meta.doctorId, mode: meta.mode,
        startedAt: meta.startedAt || Date.now(), status: 'active'
      })).then(() => true).catch(() => false);
    },

    /** Mendengarkan pesan baru. Mengembalikan fungsi pemutus langganan. */
    subscribe(consultId, onMessage) {
      const r = FB.ref('consults/' + consultId + '/messages');
      if (!r) return () => {};
      const q = r.limitToLast(200);
      const handler = q.on('child_added', (snap) => {
        const v = snap.val();
        if (v) onMessage(Object.assign({ key: snap.key }, v));
      }, (err) => {
        console.warn('[TeleCare] gagal membaca percakapan:', err.message);
      });
      return () => q.off('child_added', handler);
    },

    /** Mengirim satu pesan. Menolak (reject) bila server tak terjangkau. */
    send(consultId, msg) {
      const r = FB.ref('consults/' + consultId + '/messages');
      if (!r) return Promise.reject(new Error('Firebase belum siap'));
      // Tulisan saat luring diantre oleh SDK dan dikirim setelah tersambung.
      return r.push(Object.assign({ at: Date.now(), uid: FB.uid || 'anon' }, msg));
    },

    /** Mengambil metadata percakapan (dipakai saat membuka tautan undangan). */
    meta(consultId) {
      const r = FB.ref('consults/' + consultId + '/meta');
      if (!r) return Promise.resolve(null);
      return r.get().then((s) => (s.exists() ? s.val() : null)).catch(() => null);
    },

    setStatus(consultId, status) {
      const r = FB.ref('consults/' + consultId + '/meta/status');
      if (r) r.set(status).catch(() => {});
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
      const linked = roomRef ? await FB.waitOnline(7000) : false;
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
