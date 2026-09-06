# MEMORY — Catatan Progres TeleCare

Berkas ini melacak **keadaan proyek, keputusan yang sudah diambil, dan apa yang belum
selesai** — supaya siapa pun (termasuk sesi kerja berikutnya) bisa melanjutkan tanpa
menebak-nebak. Untuk cara memakai dan menjalankan proyek, lihat [README.md](README.md);
berkas ini khusus soal *progres* dan *alasan di balik keputusan*.

**Diperbarui:** 6 September 2026

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
| **Masuk sebagai Tamu** | ✅ | Pilih peran dulu, lalu data contoh disiapkan |
| **4 peran** | ✅ | pasien · dokter · admin-faskes · admin |
| Hub perangkat AIoT | ✅ | 6 jenis perangkat, pindai, sinkron buffer, lupakan |
| Web Bluetooth (perangkat nyata) | 🟡 | Jalan bila peramban mendukung; selain itu daftar simulasi |
| Vital + EKG langsung | 🟡 | **Nilai disimulasikan** (sirkadian), bukan sensor nyata |
| Sesi makan 4 titik | ✅ | Kamera → koreksi → kurva respons |
| Analisis (vital/gizi/respons) | ✅ | |
| **Chat via Firebase RTDB** | ✅ | Tersinkron antarperangkat, ada mirror lokal luring |
| **Panggilan WebRTC** | 🟡 | Offer/answer/ICE terverifikasi; **belum ada TURN** |
| Balasan dokter otomatis | 🟡 | Pola kata kunci; berhenti saat dokter nyata hadir |
| Layar dokter (klinik) | ✅ | Antrean, pasien binaan, detail vital |
| Layar admin faskes | ✅ | Triase unit, inventaris, nakes |
| Layar admin platform | ✅ | Statistik, verifikasi dokter, kelola pengguna |
| Profil, kalibrasi TD, pengaturan | ✅ | Termasuk ekspor data JSON |

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

---

## 6. Cara verifikasi yang dipakai

Supaya klaim "sudah jalan" bisa diperiksa ulang:

- **Sapuan rute.** Chrome headless `--dump-dom` ke tiap rute, dicari string `Terjadi kesalahan`
  (penanda layar gagal). Dijalankan untuk keempat peran.
- **Aturan RTDB.** `curl` REST API: tulis pesan sah → berhasil; tulis di luar `telecare/demo` →
  ditolak; teks 2.100 karakter → ditolak; `from` tidak sah → ditolak.
- **Handshake WebRTC.** Dua Chrome headless dengan `--use-fake-device-for-media-stream`
  bergabung ke ruang yang sama; DB diperiksa: `offer` + `answer` tertulis, 14 dan 7 kandidat ICE
  dipertukarkan.
- **Provider Google.** `POST identitytoolkit.googleapis.com/v1/accounts:signInWithIdp` dengan
  token dummy → balasan `INVALID_IDP_RESPONSE` (bukan `OPERATION_NOT_ALLOWED`), artinya
  provider aktif. Domain terizinkan: `localhost`, `telecare-id.firebaseapp.com`,
  `telecare-id.web.app`.
- **Tangkapan layar.** Render 390 px lewat iframe (lebar jendela headless punya batas minimum,
  jadi tangkapan langsung pada 390 px memotong isi — itu artefak, bukan bug tata letak).

---

## 7. Utang teknis & batasan yang diketahui

Urut dari yang paling perlu diselesaikan.

1. **⚠️ Aturan database masih terbuka.** `telecare/demo/**` bisa dibaca-tulis **tanpa
   autentikasi** (dibatasi bentuk & panjang data). Layak untuk peragaan, **tidak layak untuk
   data kesehatan sungguhan.** Sebelum dipakai di luar demo: aktifkan Authentication, ubah
   aturan jadi `auth != null`, batasi akses per pengguna.
   → [database.rules.json](database.rules.json)
2. ~~**Angka pada seksi Urgensi belum bersumber.**~~ **Selesai.** Kini memakai Riskesdas 2018
   (34,1% prevalensi hasil pengukuran; 8,4% berdasarkan diagnosis nakes) dan WHO (PTM ± tiga
   perempat kematian), dengan daftar sumber `#sumber-urgensi` di bawah kartu statistik.
   Kartu "Stres" sengaja dilabeli *fokus penelitian, bukan angka survei*.
3. ~~**Belum ada Git.**~~ **Selesai.** Repositori aktif pada branch `main`, `.gitignore`
   mengecualikan `*.blend1`, log, dan `.firebase/`.
4. **TURN server belum ada.** Panggilan hanya memakai STUN publik. Di balik NAT ketat
   (jaringan kampus/kantor, CGNAT seluler) sambungan bisa gagal. Butuh TURN untuk pemakaian nyata.
5. **Nilai fisiologis masih simulasi.** Mesin sirkadian di [app/js/engine.js](app/js/engine.js).
   Integrasi sensor nyata baru sebatas pemindaian Web Bluetooth — belum membaca karakteristik GATT.
6. **Balasan dokter masih otomatis.** Pola kata kunci di `REPLY_RULES`. Sudah dilabeli jelas
   di dalam aplikasi, tetapi tetap perlu diingat saat mendemokan ke pihak luar.
7. **Data pasien/faskes bersifat contoh.** `PATIENTS` dan `FACILITIES` di
   [app/js/data.js](app/js/data.js) adalah ilustrasi, bukan rekam medis.
8. **Belum ada uji otomatis.** Verifikasi selama ini manual lewat skrip headless sekali jalan.

---

## 8. Rencana berikutnya (usulan)

Belum dikerjakan, tinggal pilih:

- [x] `git init` + commit awal, lalu commit per perubahan
- [ ] Perketat aturan RTDB + aktifkan Firebase Authentication penuh
- [x] Ganti angka Urgensi dengan data bersumber + sitasi
- [ ] Tambah TURN server (coturn sendiri atau layanan pihak ketiga)
- [ ] Baca karakteristik GATT nyata dari perangkat BLE (Heart Rate Service `0x180D`)
- [ ] PWA: manifest + service worker agar bisa dipasang dan jalan luring
- [ ] Halaman detail pasien untuk dokter: riwayat konsultasi + catatan klinis tersimpan
- [ ] Notifikasi push (FCM) untuk eskalasi kritis
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
app/js/firebase.js                           chat RTDB + Google Sign-In + WebRTC
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
