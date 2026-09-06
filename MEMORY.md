# MEMORY — Catatan Progres TeleCare

Berkas ini melacak **keadaan proyek, keputusan yang sudah diambil, dan apa yang belum
selesai** — supaya siapa pun (termasuk sesi kerja berikutnya) bisa melanjutkan tanpa
menebak-nebak. Untuk cara memakai dan menjalankan proyek, lihat [README.md](README.md);
berkas ini khusus soal *progres* dan *alasan di balik keputusan*.

**Diperbarui:** 7 September 2026

---

## 1. Ringkasan

| | |
| --- | --- |
| **Judul penelitian** | TeleCare: Platform Telemedisin AIoT Terpadu untuk Pencegahan Penyakit Kronis dan Manajemen Gaya Hidup Berbasis Health 5.0 |
| **Komisaris pembimbing** | Dr. Fuad Anwar, S.Si., M.Si. |
| **Tim** | Fajar Jelang Riyadi (M0222027) · Faizal Tri Widiandika (M0222026) · Sholeh Putra Utama (M0222083) — Fisika, FMIPA |
| **Teknologi** | HTML, CSS, JavaScript **native** — tanpa framework, tanpa build step |
| **Hosting** | Firebase Hosting, proyek `telecare-id` |
| **Situs penelitian** | https://telecare-id.web.app |
| **Aplikasi** | https://telecare-id.web.app/app/ |
| **Ukuran** | ± 11.500 baris (HTML/CSS/JS/Python) |
| **Versi kontrol** | ✅ Git aktif, branch `main` |

### Tautan demo cepat

| Peran | Tautan |
| --- | --- |
| Pasien | `/app/?demo=pasien` |
| Dokter | `/app/?demo=dokter` |
| Admin Faskes | `/app/?demo=admin-faskes` |
| Admin Platform | `/app/?demo=admin` |

---

## 2. Status per bagian

Legenda: ✅ selesai & terverifikasi · 🟡 berjalan, ada batasan · ⬜ belum dikerjakan

### Situs penelitian (landing page)

| Bagian | Status | Catatan |
| --- | --- | --- |
| Hero + Three.js "data sphere" | ✅ | Shader kustom, 1.400 partikel, pita EKG 3D |
| Urgensi / latar belakang | ✅ | Angka bersumber Riskesdas 2018 + WHO, ada daftar sitasi |
| Perangkat + viewer GLB Three.js | ✅ | Auto-fit kamera, fallback geometris bila GLB gagal |
| Perbandingan TeleBand vs TeleRing | ✅ | Memakai render Blender + halo SVG |
| Video render Blender | ✅ | Turntable 120 frame / 30 fps |
| Diagram arsitektur SVG | ✅ | 4 lapis, SVG orisinil |
| Seksi Health 5.0 + holo Three.js | ✅ | Cincin pemindai membuat simpul berdenyut |
| Dashboard pratinjau | ✅ | EKG sintetis, sparkline, gauge stres |
| Segmen, alur, roadmap, tim | ✅ | |
| Transisi antar-seksi futuristik | ✅ | Tirai putih + garis pemindai + EKG tergambar |
| Etalase aplikasi | ✅ | Dua tangkapan layar dalam bingkai ponsel |
| 404, robots.txt, sitemap.xml, OG | ✅ | |

### Aplikasi (`/app/`)

| Bagian | Status | Catatan |
| --- | --- | --- |
| Onboarding 2 slide | ✅ | SVG orisinil |
| Daftar / masuk / lupa sandi | ✅ | Akun lokal di localStorage |
| **Masuk dengan Google** | ✅ | Provider sudah aktif di proyek; popup + cadangan redirect |
| **Sesi anonim otomatis** | ✅ | Provider Anonymous aktif; wajib sejak aturan menuntut `auth != null` |
| **Masuk sebagai Tamu** | ✅ | Pilih peran dulu, lalu data contoh disiapkan |
| **4 peran** | ✅ | pasien · dokter · admin-faskes · admin |
| Hub perangkat AIoT | ✅ | 6 jenis perangkat, pindai, sinkron buffer, lupakan |
| Web Bluetooth (perangkat nyata) | 🟡 | Pembacaan GATT lengkap (5 service); parser terverifikasi, **belum diuji perangkat fisik** |
| Vital + EKG langsung | 🟡 | Nilai dari perangkat bila tersambung, selain itu simulasi sirkadian — asalnya ditandai di beranda |
| Sesi makan 4 titik | ✅ | Kamera → koreksi → kurva respons |
| Analisis (vital/gizi/respons) | ✅ | |
| **Chat via Firebase RTDB** | ✅ | Tersinkron antarperangkat, ada mirror lokal luring; akses per peserta |
| **Panggilan WebRTC** | 🟡 | Offer/answer/ICE terverifikasi; TURN sudah didukung + ada diagnostik, **servernya belum diisi** |
| **PWA (installable + luring)** | ✅ | manifest + service worker; terbukti termuat dengan server dimatikan |
| Balasan dokter otomatis | 🟡 | Pola kata kunci; berhenti saat dokter nyata hadir |
| Layar dokter (klinik) | ✅ | Antrean, pasien binaan, detail vital, riwayat konsultasi, catatan klinis |
| Layar admin faskes | ✅ | Triase unit, inventaris, nakes |
| Layar admin platform | ✅ | Statistik, verifikasi dokter, kelola pengguna |
| Profil, kalibrasi TD, pengaturan | ✅ | Termasuk ekspor data JSON |
| Notifikasi eskalasi | 🟡 | Ambang lokal + notifikasi sistem berfungsi; **push dari server belum** (butuh VAPID + backend) |

---

## 3. Riwayat pengerjaan

Urut dari yang paling awal.

1. **Situs penelitian + aset 3D.** Landing page dengan palet Kemenkes RI. Seluruh aset produk
   dibangun prosedural lewat skrip Python Blender ([blender/build_assets.py](blender/build_assets.py)) —
   tidak ada model yang dibuat manual, sehingga hasilnya bisa direproduksi.
2. **Perbaikan render bertahap.** Empat iterasi sampai bentuknya benar: tali jam sempat jadi
   batang tipis, cincin sempat padat, layar tertelan bodi, framing kamera terpotong.
3. **Lapisan futuristik.** Transisi antar-seksi, HUD sudut kartu, sapuan pemindai, ikon SVG
   yang menggambar dirinya, scene holografik Three.js.
4. **Deploy pertama** ke Firebase Hosting.
5. **Poles + SEO.** Seksi perbandingan perangkat, kartu sosial 1200×630, konversi WebP
   (turun ± 95%), tautan lewati navigasi, halaman 404, robots + sitemap.
6. **Aplikasi TeleCare.** SPA native: rebranding AsaWatch (pairing, sinkronisasi, sesi makan,
   analisis) + lapisan telemedisin ala Halodoc, dengan hub AIoT sebagai pembeda.
7. **Chat nyata + panggilan nyata.** Chat pindah ke Firebase Realtime Database; panggilan
   memakai WebRTC dengan signaling lewat RTDB.
8. **Login Google, tamu, dan 4 peran.** Navigasi, rute, dan layar terpisah per peran;
   chat ikut sadar peran.
9. **Git + angka Urgensi bersumber.** Repositori dimulai (branch `main`, `.gitignore`), dan angka
   pada seksi Urgensi diganti data Riskesdas 2018 + WHO berikut daftar sitasi. Klaim "1×" yang
   tidak dapat disumberkan dibuang, digantikan celah 34,1% (terukur) vs 8,4% (terdiagnosis) yang
   justru menjadi bukti langsung premis TeleCare.
11. **PWA, TURN, GATT, detail pasien, notifikasi.** Aplikasi jadi installable dan jalan luring;
   dukungan TURN beserta diagnostik ICE; pembacaan karakteristik GATT sungguhan; riwayat
   konsultasi dan catatan klinis pada halaman pasien; peringatan eskalasi dengan ambang di
   perangkat. Tiga hal masih menunggu prasyarat di luar kode: server TURN, wearable BLE fisik,
   dan VAPID key + backend pengirim FCM.
10. **Pengetatan keamanan database.** Provider Anonymous diaktifkan, sesi wajib untuk setiap
   tulisan, akses percakapan dibatasi per peserta, ID konsultasi jadi kriptografis. Diverifikasi
   lewat 41 pemeriksaan aturan + 12 pemeriksaan jalur klien + sapuan 9 rute.

---

## 4. Keputusan teknis & alasannya

Bagian ini yang paling mudah terlupa, jadi ditulis lengkap.

**Native, tanpa framework.** Diminta secara eksplisit. Konsekuensinya: routing, state,
dan komponen ditulis sendiri di [app/js/core.js](app/js/core.js). Tidak ada langkah build,
jadi berkas yang di-deploy sama persis dengan yang ada di repo.

**Skrip global, bukan ES module (di aplikasi).** Urutan muat dijamin oleh urutan `<script>`
di [app/index.html](app/index.html), semua berbagi namespace `TC`. Alasannya: Firebase SDK
dipakai lewat build *compat* yang berupa skrip klasik, jadi mencampur module dan non-module
hanya menambah rumit. Landing page tetap memakai ES module karena butuh Three.js.

**Data aplikasi di localStorage.** Kunci `telecare.app.v1`. Akun, riwayat sesi, perangkat,
dan profil semuanya lokal. Hanya percakapan dan sinyal panggilan yang menyentuh server.

**Firebase RTDB untuk chat, bukan Firestore.** Pola `child_added` cocok untuk aliran pesan,
dan RTDB juga dipakai sebagai papan sinyal WebRTC — satu layanan untuk dua kebutuhan.

**Mirror lokal ditulis lebih dulu.** `Consult.push()` menyimpan ke localStorage dulu, baru
mengirim ke server. Dedup lewat `mid`. Efeknya: pesan langsung muncul walau jaringan lambat,
dan tidak hilang saat luring. SDK RTDB sendiri mengantre tulisan luring lalu mengirimnya
saat tersambung — makanya `Chat.send()` **tidak** lagi menolak saat `!online`.

**Ruang WebRTC = ID konsultasi.** Tidak perlu kode ruang terpisah. Peserta pertama menulis
`offer` (jadi pemanggil), peserta berikutnya menulis `answer` (jadi penerima).

**Kehadiran dokter mematikan balasan otomatis.** `meta/doctorOnline` + `onDisconnect`.
Tanpa ini, balasan bot akan bertabrakan dengan jawaban dokter sungguhan.

**Mode demo mempercepat waktu.** Sesi makan 2 jam dipadatkan jadi ± 2 menit (`settings.fastDemo`),
supaya alur empat titik pengukuran bisa dicoba utuh. Bisa dimatikan di Pengaturan.

**Peran disimpan di `user.role`.** Rute dijaga lewat `opts.roles`; yang tidak berhak
dialihkan ke beranda perannya sendiri. Tab bar dan sidebar dibangun dari `TABS_BY_ROLE`.

**Sesi anonim, bukan identitas localStorage.** Sejak aturan menuntut `auth != null`, `FB.uid`
diambil dari Firebase Auth saja. `FB.ensureAuth()` menunggu kabar pertama `onAuthStateChanged`
lebih dulu — kalau langsung `signInAnonymously()`, sesi tersimpan yang sedang dipulihkan akan
tertimpa sesi baru setiap kali halaman dimuat. Setelah keluar dari akun Google, `signOut()`
sengaja membuat sesi anonim baru; tanpa itu aplikasi kehilangan hak tulis.

**Keanggotaan percakapan di `meta/members`, dan izin tulis TIDAK dipasang di `meta`.**
Ini yang paling mudah salah: di Firebase, izin tulis **menurun ke seluruh anak** dan aturan yang
lebih dalam tidak dapat menariknya kembali. Waktu `.write` masih dipasang di `meta`, setiap
peserta bisa menulis `meta/members/<siapa pun>` — menambah maupun mengeluarkan orang lain —
walau `members/$uid` sudah dibatasi `$uid == auth.uid`. Karena itu izin tulis dipindah ke
masing-masing field (`doctorId`, `mode`, `status`, `startedAt`, `doctorOnline`), sehingga
`members/$uid` menjadi satu-satunya jalan menuju daftar peserta.

**`Chat.ensure` memakai `update()`, bukan `set()`/`transaction()`.** Konsekuensi keputusan di
atas: tidak ada izin tulis pada simpul `meta`, jadi menulis seluruh objek akan ditolak.
`update()` dinilai per-anak sehingga tetap sah, dan `members` tidak tersentuh. Sudah diverifikasi
langsung lewat REST `PATCH`.

**`Chat.join` ter-memo dan menjadi prasyarat setiap operasi.** `send`, `subscribe`, `meta`,
`presence`, `watchPresence`, dan `RTC.join` semuanya menunggu `join` selesai. Tanpa itu pesan
pertama pada percakapan baru bisa ditulis sebelum keanggotaan terdaftar, lalu ditolak aturan.

**ID konsultasi kriptografis.** ID itu sekaligus ID ruang panggilan dan dibagikan lewat tautan
undangan, jadi ia adalah kunci akses. `uid()` lama hanya 7 karakter `Math.random` (± 7,8×10¹⁰);
`secureId()` memakai `crypto.getRandomValues` (± 128 bit).

**`FB.canSync()` memisahkan "tersambung" dari "boleh menulis".** Sesi yang gagal tidak membuat
`FB.online` menjadi false, sehingga UI sempat mengaku tersinkron padahal setiap tulisan ditolak.

---

## 5. Bug yang pernah ditemukan (jangan terulang)

Ditulis karena beberapa di antaranya tidak terlihat sampai benar-benar diuji.

| Bug | Sebab | Perbaikan |
| --- | --- | --- |
| Tata letak melebar, kartu terpotong | `icon()` menghasilkan `<svg>` tanpa kelas → ukuran bawaan 300×150 | Aturan `svg:not([class])` di awal reset CSS |
| Video Blender gagal ditulis | Blender 5.x memindahkan output video ke `image_settings.media_type` | Set `media_type = 'VIDEO'` sebelum `file_format` |
| Animasi turntable gagal | Blender 5.x memakai *slotted Action*, `action.fcurves` tidak ada | Helper `iter_fcurves()` menelusuri `layers[].strips[].channelbag` |
| Layar jam tertelan bodi | Bezel diturunkan ke dalam kubus bodi yang padat | Bezel dinaikkan jadi rim menonjol di atas permukaan |
| Bintik pada kaca layar | Noise ray-tracing EEVEE pada bidang transmisif tipis | Kaca dihapus; layar jadi emisif ber-*clear coat* |
| Panggilan selalu "solo" | `RTC.join` menilai `FB.online` sebelum koneksi terbentuk | `FB.waitOnline()` menunggu maksimal 7 detik |
| **Tautan undangan tidak sampai** | `?demo=1` menyemai akun lalu **membajak rute** ke `/home` | `seedDemoUser(false)` — rute pada URL dipertahankan |
| Listener sheet menumpuk | `#overlay` dipakai ulang, listener tidak pernah dilepas | Simpul overlay diganti baru setiap kali dibuka |
| Padding bawah nyangkut di desktop | Inline `--tabbar-h` menimpa media query | Diganti kelas `body.is-bare` |
| **Peserta bisa menambah/mengeluarkan peserta lain** | `.write` di `meta` menurun ke `meta/members`; aturan `$uid == auth.uid` yang lebih dalam tidak dapat menarik izin itu | Izin tulis dipindah ke tiap field meta; `meta` sendiri tanpa `.write` |
| UI mengaku "tersambung" padahal tulisan ditolak | Sesi gagal tidak mengubah `FB.online` | `FB.canSync()` = tersambung **dan** bersesi |
| Pesan pertama ditolak pada percakapan baru | `send` hanya menunggu sesi, bukan keanggotaan | `Chat.join` ter-memo jadi prasyarat `send`/`subscribe` |
| Catatan klinis pada milidetik sama tampil terbalik | `at` identik → sort seri → urutan bergantung kestabilan sort, yang menampilkan terlama di atas | Indeks penyisipan dipakai sebagai pemecah seri di `Notes.list` dan `Consult.forPatient` |

---

## 6. Cara verifikasi yang dipakai

Supaya klaim "sudah jalan" bisa diperiksa ulang:

- **Sapuan rute.** Chrome headless `--dump-dom` ke tiap rute, dicari string `Terjadi kesalahan`
  (penanda layar gagal) dan DOM yang terlalu pendek. Dijalankan untuk keempat peran; 9 rute
  produksi bersih setelah pengetatan keamanan.
- **Ambang eskalasi (51 pemeriksaan) & muatan push (23 pemeriksaan).** Setiap ambang diuji pada
  nilainya sendiri **dan** pada nilai tepat di batas, karena salah tanda perbandingan hanya
  terlihat di sana. Jeda pengulangan diuji dengan cap waktu yang disuntikkan: ditahan sebelum
  jeda, lolos tepat setelahnya, tetap lolos bila waspada memburuk jadi kritis, dan terpisah per
  ukuran. Penguraian muatan push diuji untuk tiga bentuk kiriman FCM (`notification`,
  `webpush.notification`, data-only), prioritas antar bentuk, nilai bawaan, dan masukan tak wajar.
- **Catatan klinis & riwayat pasien (29 pemeriksaan).** Tambah, tolak isi kosong, pangkas spasi,
  batas 4.000 karakter, isolasi antar pasien, hapus, persistensi lewat `localStorage` dan terbaca
  kembali setelah `load()`, serta pengumpulan konsultasi per `patientId`. Uji urutan menemukan
  bahwa catatan pada milidetik yang sama tampil terbalik — lihat §5.
- **Parser GATT (42 pemeriksaan).** Diuji dengan vektor byte yang disusun menurut spesifikasi
  Bluetooth SIG, bukan perangkat: HR uint8 dan uint16 little-endian, tiga keadaan kontak kulit,
  bidang energi yang harus dilewati sebelum interval RR, RR bersatuan 1/1024 detik, RMSSD,
  baterai di luar rentang, SFLOAT/FLOAT IEEE-11073 termasuk pola NaN, suhu Fahrenheit→Celsius,
  tekanan kPa→mmHg, denyut nadi yang bergeser 7 bita bila cap waktu ada, dan ketahanan terhadap
  buffer kosong maupun null. Kesalahan offset pada bidang opsional adalah bug klasik di sini,
  jadi kasus itu diuji khusus.
- **Aturan RTDB (41 pemeriksaan, semua sesuai harapan).** Dua sesi anonim sungguhan dibuat lewat
  REST Identity Toolkit, lalu izin diuji pada REST Realtime Database: tanpa auth semua ditolak
  (401); tulis di luar `telecare/demo` ditolak; bukan-peserta tidak dapat membaca percakapan,
  daftar pesan, maupun ruang panggilan; peserta tidak dapat menambah, menonaktifkan, atau
  membuang keanggotaan orang lain, dan tidak dapat menimpa `meta` atau `meta/members` sekaligus;
  `uid` palsu, teks 2.100 karakter, `from` tidak sah, kunci asing, dan penimpaan pesan ditolak;
  `update()` multi-field pada `meta` (jalur `Chat.ensure`) diizinkan, tetapi ditolak bila
  diselipkan anggota lain; peserta boleh keluar sendiri. Data uji dibersihkan setelahnya.
- **Jalur klien sungguhan (12 pemeriksaan).** Halaman uji memuat `core.js` + `firebase.js` yang
  ter-deploy lalu menjalankan `ensureAuth` → `join` → `ensure` → `send` → `subscribe` memakai SDK
  Firebase asli: sesi anonim terbentuk, `canSync` benar, pesan terkirim dan diterima kembali oleh
  listener, pesan 2.100 karakter ditolak server, ID tak dikenal mengembalikan `null`.
  Diperlukan karena REST tidak menguji semantik `update()`/antrean luring milik SDK.
- **Handshake WebRTC.** Dua Chrome headless dengan `--use-fake-device-for-media-stream`
  bergabung ke ruang yang sama; DB diperiksa: `offer` + `answer` tertulis, 14 dan 7 kandidat ICE
  dipertukarkan.
- **Provider Google.** `POST identitytoolkit.googleapis.com/v1/accounts:signInWithIdp` dengan
  token dummy → balasan `INVALID_IDP_RESPONSE` (bukan `OPERATION_NOT_ALLOWED`), artinya
  provider aktif. Domain terizinkan: `localhost`, `telecare-id.firebaseapp.com`,
  `telecare-id.web.app`.
- **Provider Anonymous.** `POST .../v1/accounts:signUp` dengan `returnSecureToken` → mengembalikan
  `idToken`. Sebelum diaktifkan, balasannya `ADMIN_ONLY_OPERATION`; itu penanda cepat kalau
  provider mati dan seluruh sinkronisasi ikut berhenti.
- **Tangkapan layar.** Render 390 px lewat iframe (lebar jendela headless punya batas minimum,
  jadi tangkapan langsung pada 390 px memotong isi — itu artefak, bukan bug tata letak).

---

## 7. Utang teknis & batasan yang diketahui

Urut dari yang paling perlu diselesaikan.

1. ~~**Aturan database masih terbuka.**~~ **Selesai.** `telecare/demo/**` kini menuntut
   `auth != null`; percakapan dibatasi per peserta lewat `meta/members`; `uid` pesan wajib
   sama dengan `auth.uid`; pesan tidak dapat ditimpa. Sesi anonim otomatis menjaga alur Tamu
   dan `?demo=` tetap jalan. Sisa yang belum: peran masih di `localStorage`, jadi aturan tidak
   dapat membedakan dokter sungguhan — lihat butir 9.
   → [database.rules.json](database.rules.json), [app/js/firebase.js](app/js/firebase.js)
2. ~~**Angka pada seksi Urgensi belum bersumber.**~~ **Selesai.** Kini memakai Riskesdas 2018
   (34,1% prevalensi hasil pengukuran; 8,4% berdasarkan diagnosis nakes) dan WHO (PTM ± tiga
   perempat kematian), dengan daftar sumber `#sumber-urgensi` di bawah kartu statistik.
   Kartu "Stres" sengaja dilabeli *fokus penelitian, bukan angka survei*.
3. ~~**Belum ada Git.**~~ **Selesai.** Repositori aktif pada branch `main`, `.gitignore`
   mengecualikan `*.blend1`, log, dan `.firebase/`.
4. **⚠️ TURN belum ada servernya — dukungannya sudah, kredensialnya belum.** Seluruh jalur sudah
   siap: [app/js/rtc-config.js](app/js/rtc-config.js) menerima TURN statis maupun penerbit
   kredensial sementara, pengguna dapat mengisi TURN sendiri di Pengaturan, ada diagnostik
   kandidat ICE, dan layar panggilan membedakan *media lewat TURN* dari *jalur langsung*.
   **Yang belum ada: server TURN sungguhan beserta kredensialnya** — itu perlu VPS (coturn) atau
   layanan berbayar, tidak dapat disediakan dari sisi kode. Sampai itu diisi, panggilan di balik
   NAT ketat tetap gagal, hanya sekarang pesan galatnya menyebut sebabnya.
5. **Nilai fisiologis masih simulasi bila tidak ada perangkat.** Mesin sirkadian di
   [app/js/engine.js](app/js/engine.js) tetap menjadi bawaan. Pembacaan GATT sungguhan sudah ada
   di [app/js/ble.js](app/js/ble.js) (Heart Rate, Battery, Thermometer, Blood Pressure, Pulse
   Oximeter) dan parsernya terverifikasi 42/42 terhadap vektor byte sesuai spesifikasi.
   **Belum diuji dengan perangkat fisik** — tidak ada wearable BLE di lingkungan pengembangan ini,
   jadi jalur `connect()`/notifikasi hanya terbukti benar secara struktur, bukan di lapangan.
6. **Balasan dokter masih otomatis.** Pola kata kunci di `REPLY_RULES`. Sudah dilabeli jelas
   di dalam aplikasi, tetapi tetap perlu diingat saat mendemokan ke pihak luar.
7. **Data pasien/faskes bersifat contoh.** `PATIENTS` dan `FACILITIES` di
   [app/js/data.js](app/js/data.js) adalah ilustrasi, bukan rekam medis. Catatan klinis yang
   ditulis dokter pun hanya tersimpan di `localStorage` perangkat itu — belum ada penyimpanan
   bersama, jadi dokter lain tidak dapat melihatnya.
8. **Belum ada uji otomatis.** Verifikasi selama ini manual lewat skrip headless sekali jalan.
9. **Peran belum tepercaya di sisi server.** `user.role` disimpan di `localStorage` dan dapat
   diubah pengguna. Aturan database hanya tahu "peserta percakapan", tidak tahu siapa dokter.
   Untuk membatasi berdasarkan peran, peran harus ikut di token (custom claims) — perlu Admin SDK.
10. **Model akses percakapan bersifat kapabilitas.** Siapa pun bersesi yang memegang ID
   konsultasi boleh bergabung. Ini tuntutan fitur tautan undangan; pengamanannya ada pada ID
   128-bit dari `crypto.getRandomValues` ([app/js/core.js](app/js/core.js) `secureId`).
   Percakapan lama berpengenal `uid()` (7 karakter) masih ada di database dan lebih lemah.

---

## 8. Rencana berikutnya (usulan)

Belum dikerjakan, tinggal pilih:

- [x] `git init` + commit awal, lalu commit per perubahan
- [x] Perketat aturan RTDB + aktifkan Firebase Authentication penuh
- [ ] Peran tepercaya di server (custom claims) agar aturan bisa membedakan dokter
- [x] Ganti angka Urgensi dengan data bersumber + sitasi
- [x] Dukungan TURN + diagnostik konektivitas (server & kredensialnya masih perlu disediakan)
- [x] PWA: manifest + service worker agar bisa dipasang dan jalan luring
- [x] Baca karakteristik GATT nyata dari perangkat BLE (Heart Rate `0x180D` + 4 service lain)
- [ ] Uji pembacaan GATT dengan wearable BLE sungguhan

- [x] Halaman detail pasien untuk dokter: riwayat konsultasi + catatan klinis tersimpan
- [x] Notifikasi eskalasi lokal (ambang di perangkat + notifikasi sistem)
- [ ] Push FCM sungguhan: perlu VAPID key dari Console + pengirim di sisi server
- [ ] Uji otomatis sapuan rute agar regresi ketahuan lebih awal

---

## 9. Peta berkas singkat

```
index.html · css/style.css · css/fx.css      situs penelitian
js/three-scenes.js                           3 scene Three.js
js/transitions.js · js/app.js                transisi & dashboard landing
js/firebase-init.js                          binding telecare/live (opsional)

app/index.html                               shell aplikasi + sprite ikon
app/css/app.css                              sistem desain aplikasi
app/js/core.js                               util, store, router, UI, grafik
app/js/data.js                               perangkat, dokter, makanan, PERAN, faskes, pasien
app/js/engine.js                             simulasi vital, hub perangkat, sesi makan, konsultasi
app/js/rtc-config.js                         server ICE/TURN (diisi pemilik proyek)
app/js/ble.js                                pembacaan GATT + parser IEEE-11073
app/js/push-config.js · app/js/push.js       ambang eskalasi, notifikasi, FCM
app/js/firebase.js                           chat RTDB + Google Sign-In + WebRTC
app/manifest.webmanifest · app/sw.js         PWA: installable + luring
app/assets/icons/                            ikon PWA (dibangun tools/build_icons.py)
tools/build_icons.py · tools/serve.py        generator ikon & server lokal ber-MIME benar
app/js/views-auth.js                         onboarding, masuk, daftar, tamu, Google
app/js/views-home.js                         beranda, vital, analisis, riwayat
app/js/views-session.js                      kamera → koreksi → sesi → ringkasan
app/js/views-care.js                         telemedisin: dokter, chat, panggilan
app/js/views-profile.js                      profil, perangkat, kalibrasi, pengaturan
app/js/views-roles.js                        layar dokter, admin faskes, admin platform
app/js/app.js                                rute, navigasi per peran, boot

blender/build_assets.py                      generator seluruh aset 3D
database.rules.json · firebase.json          aturan RTDB & konfigurasi hosting
```

---

## 10. Perintah yang sering dipakai

```bash
# jalankan lokal (wajib lewat HTTP, bukan file://)
python -m http.server 8899

# bangun ulang aset 3D  (± 2–5 menit; --stills-only melewati video)
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -noaudio \
  -P blender/build_assets.py -- --root "C:/Users/mosto/Desktop/telecare"

# deploy
npx firebase-tools deploy --only database,hosting --project telecare-id
```
