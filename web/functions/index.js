/* ============================================================
   TeleCare — Cloud Functions
   Pengirim notifikasi push untuk panggilan masuk.

   KENAPA INI PERLU
   Klien hanya dapat MENERIMA push; mengirimnya menuntut kredensial
   akun layanan lewat FCM HTTP v1. Selama aplikasi dokter terbuka,
   dering sudah berjalan lewat Realtime Database tanpa fungsi ini
   (lihat app/js/ring.js). Fungsi ini menambal satu celah yang
   tersisa: memberi tahu ketika aplikasi benar-benar tertutup.

   BELUM AKTIF — dua prasyarat harus dipenuhi lebih dulu:

     1. VAPID key. Firebase Console → Project settings →
        Cloud Messaging → Web Push certificates → Generate key pair.
        Tempel kunci publiknya ke `vapidKey` di
        app/js/push-config.js.

     2. Paket Blaze. Cloud Functions menuntutnya.

   Setelah keduanya siap:

     a. Tambahkan blok berikut ke firebase.json:

          "functions": { "source": "functions" }

        Sengaja belum ditambahkan supaya `firebase deploy` yang ada
        sekarang tidak ikut gagal.

     b. cd functions && npm install
     c. npx firebase-tools deploy --only functions --project telecare-id
   ============================================================ */
'use strict';

const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');
const logger = require('firebase-functions/logger');

initializeApp();

const ROOT = 'telecare/demo';

/**
 * Berbunyi ketika pasien menulis panggilan ke kotak masuk seseorang.
 * `{uid}` adalah Firebase uid penerima — sama dengan kunci pada
 * `push/{uid}` tempat tokennya disimpan.
 */
exports.deringPanggilan = onValueCreated(
  { ref: `/${ROOT}/inbox/{uid}/{ringId}`, region: 'asia-southeast1' },
  async (event) => {
    const ring = event.data.val();
    const { uid, ringId } = event.params;

    if (!ring || ring.status !== 'ringing') return;

    const db = getDatabase();
    const snap = await db.ref(`${ROOT}/push/${uid}/token`).get();
    const token = snap.val();
    if (!token) {
      logger.info('tidak ada token push untuk uid ini, dering hanya lewat database', { uid });
      return;
    }

    const video = ring.mode !== 'audio';
    const jenis = video ? 'Panggilan video' : 'Panggilan suara';

    try {
      await getMessaging().send({
        token,
        // Blok webpush dipakai agar service worker aplikasi menerima bentuk
        // yang sudah dikenali bacaMuatanPush() di app/sw.js.
        webpush: {
          notification: {
            title: `${jenis} masuk`,
            body: `${ring.fromName || 'Pasien'} sedang memanggil Anda.`,
            icon: '/app/assets/icons/icon-192.png',
            badge: '/app/assets/icons/icon-192.png',
            tag: 'telecare-ring',
            renotify: true,
            requireInteraction: true
          },
          fcmOptions: { link: '/app/#/klinik' }
        },
        data: {
          severity: 'crit',
          tag: 'telecare-ring',
          url: '/app/#/klinik',
          ringId: String(ringId),
          mode: String(ring.mode || 'video')
        },
        // Panggilan tidak berguna lagi setelah deringnya berhenti, jadi
        // pesannya dibuat kedaluwarsa alih-alih menyusul beberapa menit
        // kemudian dan membingungkan.
        android: { ttl: 45000, priority: 'high' },
        apns: {
          headers: {
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 45),
            'apns-priority': '10'
          }
        }
      });
      logger.info('push panggilan terkirim', { uid, ringId });
    } catch (e) {
      // Token yang sudah tidak sah dibuang supaya tidak dicoba terus.
      const kode = e && e.errorInfo && e.errorInfo.code;
      if (kode === 'messaging/registration-token-not-registered' ||
          kode === 'messaging/invalid-registration-token') {
        await db.ref(`${ROOT}/push/${uid}`).remove().catch(() => {});
        logger.warn('token push tidak sah, dihapus', { uid, kode });
        return;
      }
      logger.error('gagal mengirim push panggilan', { uid, ringId, pesan: e.message });
    }
  }
);
