/* ============================================================
   TeleCare App — sw.js (service worker)

   Tujuannya dua: aplikasi dapat dipasang, dan tetap terbuka saat
   luring dengan memakai data yang sudah tersimpan di localStorage.

   Yang TIDAK pernah disentuh service worker ini:
   - Realtime Database, Authentication, dan layanan Firebase lain.
     Permintaan ke sana harus selalu menembus jaringan; menyimpannya
     akan membuat aplikasi menampilkan percakapan atau sesi basi,
     dan pada Realtime Database justru merusak long-polling.
   - Semua permintaan selain GET.

   Menaikkan VERSION akan membuang seluruh cache lama saat aktivasi.
   ============================================================ */
'use strict';

const VERSION = 'v10';
const CACHE = `telecare-app-${VERSION}`;

// Kerangka aplikasi. Urutan skrip mengikuti app/index.html.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/core.js',
  'js/data.js',
  'js/rtc-config.js',
  'js/firebase.js',
  'js/ble.js',
  'js/engine.js',
  'js/push-config.js',
  'js/push.js',
  'js/ring.js',
  'js/ring-ui.js',
  'js/views-auth.js',
  'js/views-home.js',
  'js/views-session.js',
  'js/views-care.js',
  'js/views-profile.js',
  'js/views-roles.js',
  'js/app.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-192.png',
  'assets/icons/icon-maskable-512.png'
];

// Host yang selalu dilewatkan ke jaringan, tanpa cache sama sekali.
const LEWATI_HOST = [
  'firebaseio.com',            // Realtime Database (long-poll & websocket)
  'firebasedatabase.app',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebaseremoteconfig.googleapis.com',
  'fcmregistrations.googleapis.com',
  'firebaselogging-pa.googleapis.com',
  'google-analytics.com',
  'googletagmanager.com',
  'accounts.google.com',
  'apis.google.com'
];

// Sumber pihak ketiga yang aman disimpan agar aplikasi tetap rapi saat luring.
const CACHE_LINTAS_ASAL = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'            // SDK Firebase (build compat)
];

const cocok = (host, daftar) =>
  daftar.some((h) => host === h || host.endsWith('.' + h));

// Berkas yang isinya berubah tanpa namanya berubah. Semua ini harus diambil
// dari jaringan lebih dulu, kalau tidak pembaruan tidak pernah sampai.
const KODE_SENDIRI = /\.(?:js|css|webmanifest|html)$/i;

/* ---------------- pemasangan ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Ditambahkan satu per satu: satu berkas gagal tidak boleh menggagalkan
    // seluruh pemasangan, sebab itu membuat service worker tidak pernah aktif.
    await Promise.all(SHELL.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[sw] gagal menyimpan', url, e && e.message);
      }
    }));
    await self.skipWaiting();
  })());
});

/* ---------------- aktivasi ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nama = await caches.keys();
    await Promise.all(
      nama.filter((n) => n.startsWith('telecare-app-') && n !== CACHE)
          .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---------------- pengambilan ---------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (cocok(url.hostname, LEWATI_HOST)) return;

  const asalSendiri = url.origin === self.location.origin;

  // Navigasi: utamakan jaringan agar pembaruan cepat terlihat, tetapi jatuh ke
  // kerangka tersimpan saat luring supaya aplikasi tetap dapat dibuka.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) simpan(req, res.clone());
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) ||
               (await cache.match('index.html')) ||
               (await cache.match('./')) ||
               new Response('Luring dan kerangka aplikasi belum tersimpan.',
                            { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  if (!asalSendiri && !cocok(url.hostname, CACHE_LINTAS_ASAL)) return;

  // Kode aplikasi sendiri: JARINGAN LEBIH DULU, cache hanya cadangan luring.
  //
  // Sebelumnya bagian ini memakai stale-while-revalidate seperti aset lain,
  // dan itu bug yang menggigit setiap deploy: index.html selalu diambil dari
  // jaringan, jadi HTML baru meminta berkas skrip baru — tetapi berkas yang
  // NAMANYA tidak berubah, seperti js/app.js, tetap disajikan dari cache versi
  // sebelumnya. Akibatnya modul baru ikut termuat namun tidak pernah dikaitkan,
  // dan pengguna harus memuat ulang dua kali. Cache-first hanya aman bila nama
  // berkas memuat sidik isinya, dan proyek ini sengaja tanpa langkah build.
  if (asalSendiri && KODE_SENDIRI.test(url.pathname)) {
    event.respondWith(jaringanDulu(req));
    return;
  }

  // Aset statis lain (gambar, ikon, font): sajikan dari cache lalu perbarui di
  // belakang. Aman karena isinya berubah bersamaan dengan namanya.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const tersimpan = await cache.match(req);

    const jaringan = fetch(req).then((res) => {
      // Respons lintas asal tanpa CORS berstatus 0 (opaque) — tetap berguna
      // untuk font dan SDK, jadi ikut disimpan.
      if (res && (res.ok || res.type === 'opaque')) simpan(req, res.clone());
      return res;
    }).catch(() => null);

    if (tersimpan) return tersimpan;

    const res = await jaringan;
    return res || new Response('', { status: 504, statusText: 'Luring' });
  })());
});

/**
 * Jaringan lebih dulu, cache sebagai cadangan. Dipakai untuk kode aplikasi
 * supaya versi yang dijalankan selalu versi yang ter-deploy.
 */
async function jaringanDulu(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) simpan(req, res.clone());
    return res;
  } catch (e) {
    const cache = await caches.open(CACHE);
    const tersimpan = await cache.match(req);
    if (tersimpan) return tersimpan;
    return new Response('Luring dan berkas ini belum tersimpan.',
      { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function simpan(req, res) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(req, res);
  } catch (e) { /* kuota penuh atau permintaan tak dapat disimpan */ }
}

/* ---------------- push dari server (FCM) ----------------
   Ditangani sendiri, tanpa pustaka service worker FCM, supaya aplikasi
   cukup memakai satu service worker. Bentuk muatan FCM berbeda-beda
   menurut cara pengiriman, jadi ketiga bentuk yang lazim diperiksa.
   ------------------------------------------------------- */
/**
 * Menyusun judul dan opsi notifikasi dari muatan push.
 * Dipisahkan sebagai fungsi murni agar percabangannya dapat diuji tanpa
 * mengirim push sungguhan.
 */
function bacaMuatanPush(p) {
  const obj = p && typeof p === 'object' ? p : {};
  const n = obj.notification || (obj.webpush && obj.webpush.notification) || {};
  const d = obj.data || {};
  const berat = (d.severity || n.severity) === 'crit';

  return {
    judul: n.title || d.title || 'TeleCare',
    opsi: {
      body: n.body || d.body || '',
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-192.png',
      lang: 'id',
      tag: d.tag || n.tag || 'telecare-push',
      renotify: berat,
      requireInteraction: berat,
      data: { url: d.url || d.click_action || n.click_action || '/app/' }
    }
  };
}
self.bacaMuatanPush = bacaMuatanPush;

self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    // Muatan bukan JSON; pakai apa adanya sebagai isi pesan.
    p = { notification: { body: event.data ? event.data.text() : '' } };
  }
  const { judul, opsi } = bacaMuatanPush(p);
  event.waitUntil(self.registration.showNotification(judul, opsi));
});

/* Mengetuk notifikasi memfokuskan tab yang sudah ada, bukan membuka
   tab baru — kalau tidak, aplikasi bisa terbuka berkali-kali. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tujuan = (event.notification.data && event.notification.data.url) || '/app/';

  event.waitUntil((async () => {
    const daftar = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of daftar) {
      if (c.url.indexOf('/app/') !== -1) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(tujuan); } catch (e) { /* abaikan */ } }
        return;
      }
    }
    await self.clients.openWindow(tujuan);
  })());
});

/* ---------------- pesan dari halaman ---------------- */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: VERSION, cache: CACHE });
  }
});
