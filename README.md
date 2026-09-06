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
python -m http.server 8899
# buka http://127.0.0.1:8899
```

Harus lewat HTTP server, bukan `file://` — modul ES dan pemuatan GLB memerlukan origin yang sah.

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
| `dokter` | `/klinik` | Status menerima konsultasi, antrean masuk, pasien binaan + detail vital, jadwal |
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
| Pemantauan | Vital langsung, EKG bergulir, tren 7 hari, indeks stres, langkah, tidur |
| Sesi makan | Kamera → pengenalan makanan → koreksi → 4 titik pengukuran → ringkasan kurva respons |
| Telemedisin | Cari dokter, profil, chat, panggilan suara/video, janji temu, riwayat |
| Profil | Informasi pribadi, tujuan & target gizi, kalibrasi tekanan darah, pengaturan, ekspor data |

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

Panggilan memerlukan HTTPS (terpenuhi di Hosting) atau `localhost`. Di balik NAT ketat,
STUN saja mungkin tidak cukup — pemakaian nyata memerlukan server TURN.

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
