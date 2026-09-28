# Protokol BLE TeleCare v1

Dokumen ini adalah kontrak antara firmware jam (`tc_proto.h`) dan web monitoring
(HTML/CSS/JS vanilla lewat **Web Bluetooth**). Kalau salah satu angka di sini
berubah, `tc_proto.h` wajib ikut diubah, dan sebaliknya.

- Semua angka multi-byte ditulis **little-endian**. Di JS dibaca dengan
  `DataView.getUint16(off, true)` / `getUint32(off, true)`.
- Metrik bernilai **0 berarti tidak terukur**, bukan nol sungguhan.
- Glukosa dan tekanan darah adalah estimasi **EKSPERIMENTAL** dan bukan alat medis.

## 1. Menemukan dan menyambung

| | |
|---|---|
| Nama perangkat | `TeleCare-NN` (nomor unit 1–99) atau `TeleCare-XXXXXX` (akhiran MAC) |
| Service UUID | `7e1e0001-5443-4172-652d-54656c654361` (ada di paket iklan) |
| Keamanan | Wajib pairing + enkripsi (`BLE_WAJIB_ENKRIPSI 1` di `config.h`). Browser memunculkan dialog pairing saat karakteristik pertama dibaca. |

```js
const SVC = '7e1e0001-5443-4172-652d-54656c654361';
const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }] });
const svc = await (await dev.gatt.connect()).getPrimaryService(SVC);
```

Syarat Web Bluetooth: harus Chrome/Edge (desktop atau Android) dan halaman dibuka
lewat HTTPS atau `localhost`. iOS Safari tidak didukung.

## 2. Karakteristik

| Nama | UUID | Sifat | Isi |
|---|---|---|---|
| INFO | `7e1e0002-…` | read | versi dan identitas jam |
| KONTROL | `7e1e0003-…` | write | perintah dari web |
| STATUS | `7e1e0004-…` | read + notify | keadaan jam (baterai, mengukur, jumlah hasil) |
| LIVE | `7e1e0005-…` | notify | angka realtime tiap 1 detik selama mengukur |
| HASIL | `7e1e0006-…` | notify | hasil ukur tersimpan (satu paket per hasil) |

Akhiran semua UUID sama, yaitu `-5443-4172-652d-54656c654361`.

## 3. Urutan saat tersambung (wajib)

1. Baca **INFO**. Langkah ini juga memicu pairing.
2. `startNotifications()` untuk **STATUS**, **LIVE**, dan **HASIL**.
3. Tulis **SET_WAKTU** dengan epoch sekarang, supaya jam dan stempel waktu hasil benar.
4. Jam otomatis mengirim semua hasil yang masih tersimpan lewat **HASIL** begitu
   HASIL dilanggani.
5. Untuk **setiap** paket HASIL yang sudah disimpan web (database/localStorage),
   kirim **HAPUS id**. Tanpa HAPUS, hasil tetap di jam dan dikirim ulang di
   koneksi berikutnya. Jadi tidak ada data yang hilang, tapi web harus membuang
   duplikat berdasarkan `id`.

## 4. KONTROL (web → jam)

Ditulis dengan `writeValueWithResponse(Uint8Array)`.

| Opcode | Nama | Payload | Arti |
|---|---|---|---|
| `0x01` | SET_WAKTU | u32 epoch UTC (detik) | setel jam + RTC |
| `0x02` | MULAI_UKUR | – | sensor menyala, LIVE mulai dikirim |
| `0x03` | STOP_UKUR | – | sensor mati, hasil disimpan dan dikirim lewat HASIL |
| `0x04` | SINKRON | – | kirim ulang semua hasil yang masih tersimpan |
| `0x05` | HAPUS | u16 id | hapus satu hasil (web sudah menyimpannya) |
| `0x06` | HAPUS_SEMUA | – | kosongkan penyimpanan hasil di jam |
| `0x07` | SET_KALIBRASI | i16 offset glukosa, i8 offset sistol, i8 offset diastol | offset per unit, ditambahkan ke hasil berikutnya |

Contoh:
```js
const ctl = await svc.getCharacteristic('7e1e0003-5443-4172-652d-54656c654361');
const setWaktu = new Uint8Array(5); setWaktu[0] = 0x01;
new DataView(setWaktu.buffer).setUint32(1, Math.floor(Date.now() / 1000), true);
await ctl.writeValueWithResponse(setWaktu);
await ctl.writeValueWithResponse(Uint8Array.of(0x02));              // mulai ukur
const hapus = new Uint8Array(3); hapus[0] = 0x05;
new DataView(hapus.buffer).setUint16(1, id, true);
await ctl.writeValueWithResponse(hapus);                            // HAPUS id
```

Tombol **BOOT** di jam melakukan hal yang sama dengan MULAI_UKUR/STOP_UKUR
(saklar). Hasil dari tombol maupun dari web sama-sama disimpan dan dikirim.

## 5. INFO (10 byte, read)

| Offset | Tipe | Isi |
|---|---|---|
| 0 | u8 | versi protokol (1) |
| 1 | u8 | versi firmware mayor |
| 2 | u8 | versi firmware minor |
| 3 | 6 byte | MAC/serial unik jam |
| 9 | u8 | nomor unit (0 = belum diatur) |

## 6. STATUS (10 byte, read + notify)

Dikirim saat berubah, dan setiap 10 detik sebagai tanda jam masih hidup.

| Offset | Tipe | Isi |
|---|---|---|
| 0 | u8 | baterai % (255 = belum terbaca) |
| 1 | u8 | flag: bit0 sedang mengukur, bit1 mengisi daya, bit2 sensor terpasang, bit3 jam sudah tersetel |
| 2 | u8 | jumlah hasil tersimpan (belum di-HAPUS) |
| 3 | u8 | state sensor (lihat tabel state) |
| 4 | u8 | kemajuan 0–100 (100 = data cukup) |
| 5 | u32 | epoch UTC menurut jam |
| 9 | u8 | nomor unit |

## 7. LIVE (14 byte, notify tiap ~1 detik selama mengukur)

| Offset | Tipe | Isi |
|---|---|---|
| 0 | u8 | nomor urut (berputar 0–255) |
| 1 | u8 | state sensor |
| 2 | u8 | kemajuan 0–100 |
| 3 | u8 | detak jantung (bpm) |
| 4 | u8 | SpO2 (%) |
| 5 | u16 | glukosa* (mg/dL) |
| 7 | u8 | sistol* (mmHg) |
| 8 | u8 | diastol* (mmHg) |
| 9 | u16 | lama mengukur (detik) |
| 11 | u8 | jumlah detak terbaca (maks 255) |
| 12 | u8 | flag: bit0 bpm ada, bit1 SpO2 ada, bit2 glukosa ada, bit3 tensi ada, bit4 **sementara** (belum stabil, tampilkan redup), bit5 **data cukup** (boleh di-stop) |
| 13 | u8 | cadangan (0) |

**State sensor:** 0 mati · 1 belum ada kulit menempel · 2 menstabilkan sinyal ·
3 mencari detak · 4 stabil · 5 sensor tidak terdeteksi.

## 8. HASIL (16 byte, notify)

Satu paket untuk setiap hasil ukur yang tersimpan di jam (maksimal 64; kalau
penuh, yang tertua ditimpa).

| Offset | Tipe | Isi |
|---|---|---|
| 0 | u16 | **id** (naik terus; dipakai untuk HAPUS dan membuang duplikat) |
| 2 | u32 | epoch UTC saat mulai mengukur (0 = jam belum tersetel) |
| 6 | u16 | lama mengukur (detik) |
| 8 | u8 | detak jantung (bpm) |
| 9 | u8 | SpO2 (%) |
| 10 | u16 | glukosa* (mg/dL) |
| 12 | u8 | sistol* |
| 13 | u8 | diastol* |
| 14 | u8 | sumber: 0 tombol BOOT, 1 web |
| 15 | u8 | flag: bit0–3 metrik yang ada (sama seperti LIVE), bit6 stempel waktu dapat dipercaya |

Contoh pembacaan:
```js
hasil.addEventListener('characteristicvaluechanged', async e => {
  const v = e.target.value;
  const r = {
    id: v.getUint16(0, true), epoch: v.getUint32(2, true), durasi: v.getUint16(6, true),
    bpm: v.getUint8(8), spo2: v.getUint8(9), glukosa: v.getUint16(10, true),
    sis: v.getUint8(12), dia: v.getUint8(13), sumber: v.getUint8(14), flag: v.getUint8(15),
  };
  simpan(r);                      // ke database / localStorage, buang duplikat per id
  const b = new Uint8Array(3); b[0] = 0x05;
  new DataView(b.buffer).setUint16(1, r.id, true);
  await ctl.writeValueWithResponse(b);   // HAPUS: jam boleh melupakannya
});
```

Contoh lengkap yang bisa langsung dicoba ada di `tools/web-test/index.html`.
