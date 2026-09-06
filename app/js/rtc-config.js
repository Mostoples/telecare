/* ============================================================
   TeleCare App — rtc-config.js
   Konfigurasi server ICE untuk panggilan WebRTC.

   STUN saja cukup bila kedua sisi berada di jaringan yang ramah.
   Di balik NAT ketat — jaringan kampus/kantor dengan firewall keluar,
   atau CGNAT pada operator seluler — kedua sisi tidak dapat saling
   melihat dan panggilan gagal tersambung. Untuk kasus itu diperlukan
   server TURN yang merelai media.

   TURN TIDAK dapat dititipkan ke repositori publik seperti ini:
   kredensialnya memberi hak memakai bandwidth server, jadi siapa pun
   yang membaca berkas ini bisa memakainya. Dua cara yang benar:

   1. Kredensial sementara (disarankan). Server menerbitkan
      username/password berumur pendek — lihat "TURN REST API"
      (mekanisme ephemeral credential pada coturn). Isi `fetchFrom`
      dengan alamat endpoint yang mengembalikan
      { urls, username, credential }.

   2. Kredensial statis, hanya untuk uji coba tertutup. Isi `servers`
      di bawah, dan jangan commit berkas ini ke repositori publik.

   Pengguna juga dapat mengisi TURN sendiri lewat
   Profil → Pengaturan → Panggilan, yang tersimpan di perangkatnya saja
   dan menimpa nilai di berkas ini.
   ============================================================ */
window.TELECARE_RTC = {

  // Server STUN publik. Cukup untuk menemukan alamat publik sendiri,
  // tidak dapat merelai media.
  stun: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun.services.mozilla.com'
  ],

  // Kredensial TURN statis. Contoh bentuknya:
  //   { urls: ['turn:turn.contoh.id:3478?transport=udp',
  //            'turns:turn.contoh.id:5349?transport=tcp'],
  //     username: 'telecare', credential: 'ganti-ini' }
  servers: [],

  // Endpoint yang menerbitkan kredensial TURN sementara. Harus membalas JSON
  // { urls, username, credential } atau { iceServers: [...] }.
  fetchFrom: null,

  // Memaksa seluruh media lewat TURN. Berguna untuk menguji apakah TURN
  // benar-benar bekerja; jangan dinyalakan pada pemakaian biasa karena
  // menambah latensi dan beban server.
  paksaRelay: false
};
