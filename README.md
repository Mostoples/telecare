# TeleCare — firmware jam pemantau vital

Firmware untuk **Waveshare ESP32-C6-Touch-LCD-1.69** + sensor **MAX30102/30105**.
Jam menampilkan waktu, mengukur detak jantung, SpO2, serta estimasi glukosa* dan
tensi*, menyimpan hasil ukur di flash, dan mengirimkannya ke web lewat BLE.

\* Glukosa dan tensi adalah estimasi **eksperimental**, bukan alat medis.

## Cara pakai

| Aksi | Hasil |
|---|---|
| Tahan **PWR** 3 detik | jam menyala / mati |
| Klik **PWR** | layar menyala / mati |
| Klik ganda **PWR** | tampilkan nomor unit |
| Tekan **BOOT** | mulai mengukur (layar pindah ke halaman metrik) |
| Tekan **BOOT** lagi | stop, hasil disimpan dan dikirim ke web |

Pita hijau di tepi layar penuh artinya data sudah cukup untuk di-stop.

## Wiring sensor MAX3010x

| Sensor | Board |
|---|---|
| VIN | 3V3 |
| GND | GND |
| SDA | GPIO 8 |
| SCL | GPIO 7 |
| INT | tidak dipakai |

## Build & upload

Arduino IDE / arduino-cli dengan:
- Core **esp32 by Espressif 3.3.x**, board **ESP32C6 Dev Module**
- **Partition Scheme: Huge APP** (wajib, sketch ~1,8 MB)
- **USB CDC On Boot: Enabled**
- Library: **lvgl 8.3.11** (+ `lv_conf.h`: 16bpp, `LV_TICK_CUSTOM=1`, Montserrat 12),
  **GFX Library for Arduino**, **SensorLib**, **SparkFun MAX3010x**

```bash
FQBN=esp32:esp32:esp32c6:CDCOnBoot=cdc,PartitionScheme=huge_app
arduino-cli compile -b $FQBN --build-path build .
arduino-cli upload  -b $FQBN -p COM3 --input-dir build .
```

Tutup Serial Monitor sebelum upload (port hanya bisa dipakai satu program).
Jangan menahan BOOT saat menekan RESET, karena itu memasukkan chip ke mode download.

## Integrasi web

- Spesifikasi protokol: [`docs/PROTOKOL_BLE.md`](docs/PROTOKOL_BLE.md)
- Contoh web vanilla JS yang bisa langsung dicoba: [`tools/web-test/index.html`](tools/web-test/index.html)
  (buka lewat `https://` atau `http://localhost`, di Chrome/Edge)

## Struktur

```
TeleCare.ino      UI (LVGL), tombol PWR/BOOT, konsol Serial, setup/loop
config.h          zona waktu, keamanan BLE, pengukuran, kalibrasi baterai
tc_inti.*         mulai/stop ukur, simpan hasil, perintah dari web
tc_ble.*          GATT + iklan BLE
tc_store.*        NVS: hasil ukur (64), nomor unit, kalibrasi
tc_proto.h        UUID, opcode, ukuran paket
ppg.*             MAX3010x -> BPM, SpO2, glukosa*, tensi* (+ kalibrasi lapangan)
battery.*         ADC baterai + kurva Li-Po + deteksi mengisi
rtc.*, time_manager.*   PCF85063 + jam sekarang
ui_assets.h, splash_assets.h, font_*.c   aset tampilan
```

## Tampilan

Tema minimalis futuristik: latar hitam, aksen biru, satu warna per metrik.
Font `font_ft_*.c` dibuat dengan [lv_font_conv](https://github.com/lvgl/lv_font_conv)
(`--bpp 4 --no-compress`) dari:

- [Orbitron](https://fonts.google.com/specimen/Orbitron) -- jam, nomor unit, logo
- [Rajdhani](https://fonts.google.com/specimen/Rajdhani) -- angka metrik, teks

Keduanya berlisensi [SIL Open Font License 1.1](docs/LISENSI_FONT.md).

## Konsol Serial (115200)

`ukur` (sama dengan BOOT) · `status` · `daftar` (hasil tersimpan) · `hapus` ·
`id <1-99>` (nomor unit, nama BLE `TeleCare-NN`) · `glu <±N>` · `td <±S> <±D>`
(offset kalibrasi)

## Sisi web — `web/`

Repositori ini juga memuat **aplikasi web dan situs penelitian TeleCare** di
[`web/`](web/) — sisi lain dari sistem yang sama. Firmware di akar mengukur dan
mengirim hasilnya lewat BLE; aplikasi di `web/` menerima, menyimpan riwayatnya,
dan menghubungkan pengguna ke tenaga kesehatan.

| Bagian | Isi |
| --- | --- |
| [`web/index.html`](web/index.html) | situs profil penelitian (landing page) |
| [`web/app/`](web/app/) | aplikasi TeleCare: pemantauan vital, sesi makan, telemedisin |

Aplikasi web ditulis dengan HTML, CSS, dan JavaScript native — tanpa framework
dan tanpa langkah build. Chat konsultasi berjalan di Firebase Realtime Database,
panggilan suara/video memakai WebRTC. Empat peran tersedia: pasien, dokter,
admin faskes, dan admin platform.

Cara menjalankan, membangun ulang aset, dan men-deploy ada di
[`web/README.md`](web/README.md). Catatan progres dan keputusan teknis ada di
[`web/MEMORY.md`](web/MEMORY.md).
