# TeleCare

**Platform Telemedisin AIoT Terpadu untuk Pencegahan Penyakit Kronis dan Manajemen Gaya Hidup Berbasis Health 5.0**

Situs web profil penelitian — HTML, CSS, dan JavaScript native (tanpa framework, tanpa langkah build).

- **Situs penelitian:** https://telecare-id.web.app
- **Aplikasi:** https://telecare-id.web.app/app/
- **Tautan demo per peran:** `?demo=pasien` · `?demo=dokter` · `?demo=admin-faskes` · `?demo=admin`
- **Komisaris pembimbing:** Dr. Fuad Anwar, S.Si., M.Si.
- **Tim:** Fajar Jelang Riyadi (M0222027) · Faizal Tri Widiandika (M0222026) · Sholeh Putra Utama (M0222083) — Fisika, FMIPA

> **Melacak progres?** Lihat [MEMORY.md](MEMORY.md) — status per bagian, keputusan teknis
> beserta alasannya, bug yang pernah ditemukan, utang teknis, dan rencana berikutnya.

---

## Struktur

```
index.html                  situs penelitian (landing page)
app/                        aplikasi TeleCare (SPA, hash routing)
404.html                    halaman galat, gaya sama
robots.txt / sitemap.xml    metadata pengindeksan
css/style.css               sistem desain (palet Kemenkes RI), tata letak, komponen
css/fx.css                  transisi antar-bagian, HUD, ikon SVG teranimasi
js/app.js                   dashboard: EKG sintetis, sparkline, tren 24 jam, gauge stres
js/three-scenes.js          tiga scene Three.js (hero, viewer produk, holo Health 5.0)
js/transitions.js           overlay transisi, pengungkap bertahap, penghitung angka
js/firebase-init.js         binding Realtime Database (opsional)
blender/build_assets.py     generator aset 3D — sumber tunggal semua model & render
assets/models/*.glb         model untuk viewer Three.js
assets/video/*.mp4          render turntable
assets/img/render-*.png     still transparan (+ varian .webp)
assets/img/og-cover.png     kartu pratinjau media sosial 1200x630
```

## Menjalankan secara lokal

```bash
python tools/serve.py 8899
# buka http://127.0.0.1:8899
```

Harus lewat HTTP server, bukan `file://` — modul ES dan pemuatan GLB memerlukan origin yang sah.

`python -m http.server` juga bisa dipakai untuk situs penelitian, tetapi **tidak untuk menguji
service worker di Windows**: pemetaan MIME diambil dari registry, dan `.js` di sana sering
terdaftar sebagai `text/plain` sehingga peramban menolak mendaftarkan service worker.
`tools/serve.py` memaksa MIME type yang benar dan meniru header `sw.js` milik Firebase Hosting.

## Membangun ulang aset 3D

Seluruh geometri, material, pencahayaan, dan animasi kamera dihasilkan skrip Python — tidak ada
model yang dibuat manual, sehingga hasilnya dapat direproduksi.

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -noaudio \
  -P blender/build_assets.py -- --root "C:/Users/mosto/Desktop/telecare"
```

Menghasilkan `teleband.glb`, `telering.glb`, `telecare-product.mp4` (120 frame, 30 fps, EEVEE),
tiga PNG transparan, dan kartu sosial `og-cover.png`. Waktu render sekitar 2–5 menit.

Tambahkan `--stills-only` untuk melewati render video ketika hanya gambar yang perlu diperbarui:

```bash
... -P blender/build_assets.py -- --root "<path>" --stills-only
```

Varian WebP dibuat terpisah (menekan berat gambar ~95%):

```bash
python -c "from PIL import Image; import glob; [Image.open(f).save(f[:-4]+'.webp','WEBP',quality=88,method=6) for f in glob.glob('assets/img/*.png')]"
```

Catatan Blender 5.x yang ditangani skrip: output video berada di balik
`image_settings.media_type = 'VIDEO'`, dan F-curve diakses lewat *slotted Action*
(`action.layers[].strips[].channelbag`), bukan `action.fcurves`.

## Data langsung (opsional)

Dashboard membaca `telecare/live` pada Realtime Database proyek `telecare-id`:

```json
{ "hr": 78, "spo2": 98, "temp": 36.7, "sys": 118, "dia": 76, "stress": 28 }
```

Bila node kosong atau tidak dapat diakses, halaman otomatis beralih ke simulasi fisiologis lokal
dan menandainya pada indikator status — situs tetap berfungsi penuh tanpa data.

## Aplikasi TeleCare

SPA native (tanpa framework, tanpa build) di `app/`, responsif untuk ponsel maupun desktop:
tab bar di bawah pada layar sempit, sidebar pada layar lebar.

```
app/index.html          shell + sprite ikon SVG
app/css/app.css         sistem desain aplikasi
app/js/core.js          util, penyimpanan lokal, router, komponen UI, grafik canvas/SVG
app/js/data.js          katalog perangkat, spesialisasi, dokter, basis makanan
app/js/engine.js        simulasi fisiologis, hub perangkat, sesi makan, EKG
app/js/firebase.js      chat Realtime Database + sinyal & sesi WebRTC
app/js/views-*.js       layar: auth, beranda/analisis, sesi makan, telemedisin, profil
app/js/views-roles.js   layar dokter, admin faskes, dan admin platform
app/js/app.js           daftar rute, navigasi, boot
```

### Masuk

Tiga jalur, semuanya tersedia di layar masuk:

| Jalur | Keterangan |
| --- | --- |
| Email &amp; kata sandi | Akun lokal di peramban ini (purwarupa, bukan server) |
| Google | Firebase Authentication, `signInWithPopup` dengan cadangan `signInWithRedirect` |
| Tamu | Akun demo berisi riwayat contoh; peran dapat dipilih saat masuk |

Terlepas dari jalur yang dipilih, aplikasi selalu memastikan ada sesi Firebase — anonim bila
pengguna belum masuk — karena aturan database menolak setiap tulisan tanpa autentikasi. Bila
sesi gagal terbentuk, aplikasi berkata jujur (*"sesi server belum aktif · pesan disimpan lokal"*)
dan turun ke penyimpanan lokal, bukan diam-diam mengaku tersinkron.

### Peran

Empat peran dengan navigasi dan layar masing-masing. Peran dapat diganti kapan saja lewat
**Profil → Ganti peran** (mode purwarupa), atau lewat tautan `?demo=<peran>`.

| Peran | Beranda | Isi |
| --- | --- | --- |
| `pasien` | `/home` | Vital langsung, EKG, sesi makan, analisis, konsultasi, perangkat |
| `dokter` | `/klinik` | Status menerima konsultasi, antrean masuk, pasien binaan + detail vital, riwayat konsultasi & catatan klinis, jadwal |
| `admin-faskes` | `/faskes` | Dashboard unit, triase anggota, inventaris perangkat, daftar nakes |
| `admin` | `/sistem` | Statistik platform, verifikasi dokter, kelola pengguna & faskes |

Di dalam percakapan, peran ikut menentukan perilaku: dokter mengirim pesan sebagai dokter,
dan **balasan otomatis berhenti** begitu dokter sungguhan hadir — kehadiran itu ditandai lewat
`meta/doctorOnline` dengan `onDisconnect` di Realtime Database.

### Alur yang tersedia

| Bagian | Isi |
| --- | --- |
| Onboarding & akun | Layar pembuka, daftar, masuk, pemulihan kata sandi, pelengkapan profil |
| Hub perangkat AIoT | Pindai, pasangkan, sinkronkan buffer, putuskan, lupakan — TeleBand, TeleRing, TeleStrap, TeleCuff, TeleScale, TelePatch |
| Perangkat BLE nyata | Pembacaan karakteristik GATT standar lewat Web Bluetooth — lihat di bawah |
| Pemantauan | Vital langsung, EKG bergulir, tren 7 hari, indeks stres, langkah, tidur |
| Sesi makan | Kamera → pengenalan makanan → koreksi → 4 titik pengukuran → ringkasan kurva respons |
| Telemedisin | Cari dokter, profil, chat, panggilan suara/video, janji temu, riwayat |
| Profil | Informasi pribadi, tujuan & target gizi, kalibrasi tekanan darah, pengaturan, ekspor data |

### Perangkat BLE nyata — pembacaan GATT

[app/js/ble.js](app/js/ble.js) membaca karakteristik standar Bluetooth SIG, jadi perangkat
kesehatan mana pun yang mematuhi profil berikut dapat dipakai tanpa penyesuaian khusus:

| Service | Karakteristik | Yang dibaca |
| --- | --- | --- |
| `0x180D` Heart Rate | `0x2A37` Heart Rate Measurement | detak jantung, interval RR, status kontak kulit |
| `0x180F` Battery | `0x2A19` Battery Level | baterai (dibaca + diikuti bila didukung) |
| `0x1809` Health Thermometer | `0x2A1C` Temperature Measurement | suhu (Celsius atau Fahrenheit) |
| `0x1810` Blood Pressure | `0x2A35` Blood Pressure Measurement | sistol, diastol, MAP, denyut nadi |
| `0x1822` Pulse Oximeter | `0x2A5F` PLX Continuous | SpO₂ dan denyut nadi |

Service yang tidak dimiliki perangkat dilewati tanpa menggagalkan sambungan — wearable umumnya
hanya menyediakan sebagian. HRV dihitung sebagai **RMSSD** dari interval RR.

Suhu dan tekanan darah memakai format titik-mengambang desimal **IEEE-11073** (`FLOAT` 32-bit dan
`SFLOAT` 16-bit): mantissa dengan eksponen basis sepuluh, sehingga nilai seperti 36,7 tidak
kehilangan ketepatan seperti pada biner basis dua. Pola bit khusus (`NaN`, `NRes`, ±`INFINITY`)
dikembalikan sebagai `null`, bukan dihitung sebagai angka.

Ketika perangkat sungguhan tersambung, `Vitals.ingest()` mengambil alih dan simulasi berhenti
menimpa angka. Saat perangkat lepas (`gattserverdisconnected`), `Vitals.releaseDevice()`
mengembalikannya ke simulasi — tanpa itu layar akan membeku pada angka terakhir dan tampak
seolah masih hidup. Beranda menandai asalnya: **dari perangkat** atau **simulasi**.

Web Bluetooth hanya tersedia di peramban berbasis Chromium pada origin aman. Di Safari dan
Firefox aplikasi tetap memakai daftar perangkat simulasi.

### Detail pasien untuk dokter

`/klinik/pasien/:id` menampilkan vital, indeks stres, tren 7 hari, perangkat, **riwayat
konsultasi**, dan **catatan klinis**.

Riwayat konsultasi dikumpulkan lewat `patientId` pada catatan konsultasi. Field itu sengaja
hanya disimpan secara lokal dan **tidak** dikirim ke Realtime Database — aturan di sana menolak
kunci di luar skema `meta`, jadi mengirimnya akan menggagalkan penulisan.

Catatan klinis (`TC.Notes`) bersifat **tambah-saja pada tiap butirnya**: teks yang sudah
tersimpan tidak dapat diubah, hanya dihapus seluruhnya, supaya isi catatan tidak berubah
diam-diam setelah dijadikan rujukan. Setiap catatan menyimpan penulis, peran, dan cap waktu.
Urutannya terbaru lebih dulu, dengan indeks penyisipan sebagai pemecah seri — dua catatan bisa
memiliki cap waktu yang sama persis.

Layar yang sama dipakai admin faskes lewat `/faskes/anggota/:id`, tetapi peran itu bukan klinisi
sehingga catatan klinis dibuka **baca saja**.

Catatan tersimpan di `localStorage` perangkat itu saja; belum ada penyimpanan bersama
antar-dokter.

### PWA — dapat dipasang dan jalan luring

Aplikasi di `/app/` adalah Progressive Web App: `app/manifest.webmanifest` membuatnya dapat
dipasang ke layar utama, dan `app/sw.js` menyimpan kerangka aplikasi sehingga tetap terbuka
tanpa jaringan (riwayat dibaca dari `localStorage`).

| Berkas | Isi |
| --- | --- |
| `app/manifest.webmanifest` | nama, `scope: /app/`, `display: standalone`, ikon biasa + maskable, tiga shortcut |
| `app/sw.js` | precache kerangka, *stale-while-revalidate* untuk aset, jaringan lebih dulu untuk navigasi |
| `tools/build_icons.py` | generator ikon (192/512, maskable, apple-touch) — dibangun lewat skrip agar reproducible |

Yang **tidak** pernah disimpan service worker: Realtime Database, Authentication, dan layanan
Firebase lain. Menyimpannya akan menampilkan percakapan basi dan merusak long-polling RTDB.
Permintaan selain GET juga dilewatkan begitu saja.

Membangun ulang ikon:

```bash
python tools/build_icons.py
```

Menaikkan `VERSION` di `app/sw.js` membuang seluruh cache lama saat aktivasi — lakukan itu bila
kerangka aplikasi berubah dan pembaruan harus dipaksa.

### Chat — Firebase Realtime Database

Pesan disimpan di `telecare/demo/consults/{id}/messages` dan didengarkan lewat `child_added`,
sehingga percakapan tersinkron antarperangkat secara langsung. Salinan lokal tetap ditulis
lebih dulu (dedup lewat `mid`), jadi aplikasi tetap dapat dipakai saat luring dan pesan
menyusul begitu sambungan pulih.

### Panggilan — WebRTC

`RTCPeerConnection` dengan STUN publik; offer, answer, dan kandidat ICE dipertukarkan lewat
`telecare/demo/rooms/{consultId}`. Peserta pertama menjadi pemanggil, peserta berikutnya
menjadi penerima.

**Mencoba dua sisi sekaligus (pasien ↔ dokter):**

1. Perangkat A: buka `?demo=pasien`, mulai konsultasi dengan salah satu dokter.
2. Salin tautan percakapan lewat menu di kanan atas layar chat.
3. Perangkat B: buka `?demo=dokter`, lalu tempel tautan tadi — percakapan yang sama terbuka
   dari sisi dokter, dan balasan otomatis berhenti.

**Mencoba panggilan dua perangkat:**

1. Buka aplikasi, mulai konsultasi dengan salah satu dokter, tekan **Video Call**.
2. Tekan **Salin tautan undangan**, buka tautan itu di perangkat atau peramban lain.
3. Izinkan kamera dan mikrofon di kedua sisi — sambungan terbentuk langsung antarperangkat.

Panggilan memerlukan HTTPS (terpenuhi di Hosting) atau `localhost`.

#### TURN — menembus NAT ketat

STUN hanya memberi tahu setiap sisi alamat publiknya sendiri. Di balik NAT ketat — jaringan
kampus/kantor dengan firewall keluar, atau CGNAT operator seluler — kedua sisi tetap tidak dapat
saling menjangkau dan panggilan gagal. Server TURN merelai media untuk kasus itu.

Konfigurasi ada di [app/js/rtc-config.js](app/js/rtc-config.js):

| Kunci | Isi |
| --- | --- |
| `stun` | daftar server STUN (sudah terisi, publik) |
| `servers` | kredensial TURN statis — **hanya untuk uji tertutup** |
| `fetchFrom` | endpoint penerbit kredensial sementara (cara yang disarankan) |
| `paksaRelay` | memaksa media lewat TURN, untuk membuktikan TURN benar-benar bekerja |

Urutan prioritas: pengaturan pengguna → `fetchFrom` → `servers`.

**Kredensial TURN tidak boleh dititipkan di repositori publik.** Kredensial itu memberi hak
memakai bandwidth server, jadi siapa pun yang membaca berkasnya dapat memakainya. Pakailah
kredensial sementara: coturn dapat menerbitkan username/password berumur pendek lewat mekanisme
*TURN REST API*, dan `fetchFrom` diisi alamat endpoint yang menerbitkannya.

Contoh coturn minimal (`/etc/turnserver.conf`):

```conf
listening-port=3478
tls-listening-port=5349
fingerprint
realm=telecare.example
# Kredensial sementara — server dan penerbit berbagi rahasia ini
use-auth-secret
static-auth-secret=GANTI_DENGAN_RAHASIA_PANJANG
# Alamat publik server; wajib bila berada di belakang NAT
external-ip=203.0.113.10
# Sertifikat untuk turns:// (mis. dari Let's Encrypt)
cert=/etc/letsencrypt/live/turn.example/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example/privkey.pem
# Jangan relai ke jaringan internal
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
```

Port yang perlu dibuka: 3478 (UDP dan TCP), 5349 (TLS), dan rentang relai
(`min-port`–`max-port`, bawaan 49152–65535 UDP).

Untuk uji cepat tanpa memasang server, pengguna dapat mengisi TURN miliknya sendiri di
**Profil → Pengaturan → Panggilan**. Nilainya tersimpan di perangkat itu saja dan menimpa
konfigurasi proyek. Kata sandi TURN sengaja tidak diikutkan dalam ekspor data JSON.

#### Memeriksa apakah TURN bekerja

Tombol **Uji konektivitas** pada layar yang sama menjalankan pengumpulan kandidat ICE tanpa
membuka kamera, lalu melaporkan jumlah kandidat per jenis:

| Jenis | Arti |
| --- | --- |
| `host` | alamat di jaringan lokal |
| `srflx` | alamat publik hasil STUN |
| `relay` | jalur lewat TURN — **hanya ini** yang menembus NAT ketat |

`relay = 0` padahal TURN sudah diisi berarti alamat, port, atau kredensialnya salah. Setelah
panggilan tersambung, status di layar panggilan juga membedakan *media lewat TURN* dari *jalur
langsung*, dibaca dari `getStats()` — karena "TURN dikonfigurasi" tidak sama dengan
"TURN terpakai".

### Catatan keamanan

Seluruh akses ke `telecare/demo/**` menuntut sesi Firebase yang sah. Pengguna yang belum masuk
— termasuk mode Tamu dan tautan `?demo=` — otomatis mendapat **sesi anonim**, jadi alur peragaan
tetap utuh tanpa membuka database ke publik.

Akses percakapan dibatasi per peserta lewat `meta/members`:

| Aturan | Akibatnya |
| --- | --- |
| Baca/tulis percakapan hanya bila `auth.uid` terdaftar di `meta/members` | Percakapan orang lain tidak terbaca |
| `meta/members/$uid` hanya dapat ditulis bila `$uid == auth.uid` | Tidak bisa menambah atau mengeluarkan peserta lain |
| Tidak ada izin tulis pada simpul `meta` itu sendiri, hanya pada tiap field | Daftar peserta tidak bisa ditimpa sekaligus |
| `uid` pesan wajib sama dengan `auth.uid` | Pengirim tidak dapat dipalsukan |
| Pesan tidak dapat ditimpa setelah tertulis | Riwayat percakapan tidak bisa diubah diam-diam |
| Kunci di luar skema ditolak, teks dibatasi 2.000 karakter | Bentuk data terkendali |
| Ruang WebRTC mewarisi keanggotaan konsultasi ber-ID sama | Sinyal panggilan tertutup bagi non-peserta |

**Model kepercayaannya:** siapa pun yang memegang ID konsultasi boleh bergabung sebagai peserta.
Ini konsekuensi dari fitur tautan undangan — dokter di perangkat lain harus dapat masuk tanpa
didaftarkan lebih dulu. Karena ID itu berfungsi sebagai kunci akses, ID dibangkitkan dengan
`crypto.getRandomValues` (± 128 bit), bukan `Math.random`.

Pengecualian yang disengaja: `telecare/live` tetap dapat dibaca tanpa autentikasi karena
dashboard pada landing page memakainya dan isinya telemetri peragaan tanpa data pribadi.
Menulis ke sana tertutup untuk semua klien.

**Yang masih kurang untuk data kesehatan sungguhan:** peran (`pasien`/`dokter`/`admin`) masih
disimpan di `localStorage`, jadi aturan database tidak dapat membedakan dokter sungguhan dari
pengguna biasa. Membatasi "hanya dokter terverifikasi yang boleh bergabung" memerlukan peran
yang tersimpan di server, mis. lewat custom claims pada token.

## Deploy

```bash
npx firebase-tools deploy --only database,hosting --project telecare-id
```

`firebase.json` mengecualikan `blender/`, berkas `.blend`, dan log dari unggahan.
