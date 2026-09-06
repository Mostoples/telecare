/* ============================================================
   TeleCare App — push-config.js
   Konfigurasi notifikasi.

   Ada dua hal berbeda yang mudah tertukar:

   1. NOTIFIKASI LOKAL. Dihitung di perangkat dari nilai vital yang
      masuk, lalu ditampilkan lewat service worker. Tidak memerlukan
      server maupun kunci apa pun, dan sudah aktif begitu pengguna
      memberi izin. Inilah yang menangani eskalasi kritis pada
      pemakaian sehari-hari.

   2. PUSH DARI SERVER (FCM). Diperlukan bila pesan harus sampai
      ketika aplikasi tidak terbuka sama sekali — misalnya dokter
      memanggil pasien. Ini menuntut dua hal yang tidak dapat
      disediakan dari sisi kode:

        a. VAPID key (Web Push certificate). Dibuat di Firebase
           Console → Project settings → Cloud Messaging →
           Web Push certificates → Generate key pair, lalu tempel
           kunci publiknya ke `vapidKey` di bawah. Tidak ada API
           publik untuk membuatnya.

        b. Pengirim di sisi server. Klien hanya dapat MENERIMA push.
           Mengirimnya memerlukan kredensial akun layanan lewat
           FCM HTTP v1 API — mis. Cloud Functions. Lihat README.

   Selama `vapidKey` masih null, aplikasi tetap berjalan dan hanya
   memakai notifikasi lokal.
   ============================================================ */
window.TELECARE_PUSH = {

  // Kunci publik VAPID dari Firebase Console. Contoh bentuknya:
  //   vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJ...'
  vapidKey: null,

  // Alamat yang dibuka ketika notifikasi diketuk.
  urlBuka: '/app/',

  // Jeda minimum sebelum peringatan untuk ukuran yang sama diulang,
  // dalam menit. Tanpa jeda ini satu vital yang menggantung di ambang
  // akan memicu notifikasi setiap kali nilai masuk.
  jedaMenit: 10
};
