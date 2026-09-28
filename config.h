/*
 * TeleCare -- konfigurasi firmware.
 * Semua angka yang wajar diubah per unit/per kebutuhan dikumpulkan di sini.
 */
#pragma once

/* ---------------- Zona waktu ----------------
 * WIB = UTC+7, WITA = 8, WIT = 9. Web mengirim epoch UTC (SET_WAKTU),
 * offset ini yang mengubahnya jadi jam lokal di layar. */
#define TZ_OFFSET_SEC   (7 * 3600)

#define RTC_RESYNC_MS   (60UL * 1000UL)   /* baca ulang RTC tiap 1 menit */

/* ---------------- BLE ----------------
 * 1 = wajib pairing + enkripsi (LE Secure Connections, Just Works). Browser
 *     memunculkan dialog pairing sekali; setelah itu tersambung biasa.
 * 0 = tanpa pairing/enkripsi -- mudah untuk uji, tapi siapa pun di dekat jam
 *     bisa membaca data & mengirim perintah. Jangan dipakai di lapangan. */
#define BLE_WAJIB_ENKRIPSI 1

/* ---------------- Pengukuran ----------------
 * Tombol BOOT / perintah web: sekali mulai, sekali lagi stop. Pengukuran TIDAK
 * berhenti sendiri saat datanya cukup; yang menghentikannya hanya stop, jam
 * dimatikan, atau batas keras di bawah (penjaga baterai kalau lupa stop). */
#define UKUR_BATAS_KERAS_MS  (10UL * 60UL * 1000UL)  /* 10 menit */

/* "Data cukup" untuk pita kemajuan di tepi layar & flag di paket LIVE:
 * minimal sekian detak DAN sekian detik sejak mulai. */
#define UKUR_MIN_DETAK   10
#define UKUR_MIN_MS      10000UL

/* Paket LIVE dikirim ke web tiap sekian ms selama mengukur. */
#define LIVE_PERIODE_MS  1000UL

/* Tolak mulai ukur kalau baterai di bawah ini (%). LED PPG menyedot puluhan mA. */
#define BATERAI_KRITIS_PCT  5

/* Log diagnostik tambahan (ppg / rtc) di Serial. */
#define TC_DEBUG_LOG 1

/* ---------------- Baterai ----------------
 * GPIO0 adalah satu-satunya pin ADC1 yang tidak dipakai LCD (GPIO1..6 terpakai),
 * jadi di situlah pembagi tegangan baterai board ini.
 *
 * BATT_DIVIDER = Vbaterai / Vpin. Nilai 2.0 berarti pembagi 1:2 (mis. 100k/100k).
 * KALIBRASI: lihat angka "raw" di baris [batt] pada Serial, lalu ukur tegangan
 * baterai dengan multimeter. BATT_DIVIDER = Vukur / Vraw.
 */
#define BATT_ADC_PIN    0

/* Dikalibrasi memakai charger sebagai referensi tegangan.
 *
 * Nominal pembagi 200k/100k = 3.00, tapi itu mengabaikan toleransi resistor dan
 * offset ADC. Charger Li-Po CC/CV meregulasi ke 4.200 V (+-1%) di akhir
 * pengisian, jadi itu referensi fisik yang bisa dipakai: dengan pin membaca
 * 1414 mV saat pengisian selesai, rasio sebenarnya = 4200 / 1414 = 2.97.
 *
 * Kenapa 1% ini penting: rasio 3.00 memberi 4242 mV, 42 mV di atas 4.200 V.
 * Karena kurva memetakan apa pun >= 4200 mV menjadi 100%, kelebihan itu menelan
 * sekitar 4% penurunan pertama -- baterai mulai terkuras tapi angkanya diam di
 * 100%. Itulah sebabnya "selalu 100%" terlihat seperti sensor macet.
 *
 * Multimeter tetap acuan terbaik: BATT_DIVIDER = Vukur / raw yang tercetak. */
#define BATT_DIVIDER    2.97f

/* ---- Persen saat DICAS (battery.cpp) ----
 *
 * Selama kabel tertancap, tegangan di pin BUKAN tegangan sel: charger menaikkannya
 * sebesar arus x hambatan dalam. Terukur di board ini: mencolok kabel menggeser
 * tegangan +100 mV dalam 1-2 detik, sebelum sel menerima muatan sedikit pun.
 * Kurva Li-Po membaca +100 mV itu sebagai ~+8% -- itulah "cepat penuh" dan
 * itulah "ngedrop" 8-15% saat kabel dicabut.
 *
 *   BATT_CHG_IR_MV       koreksi yang dikurangkan dari tegangan saat mengisi.
 *   BATT_CV_MV           tegangan (sisi baterai) yang dianggap sudah fase CV.
 *                        Tidak wajib tepat: rata-nya tegangan (naik < 6 mV per
 *                        3 menit di atas 4100 mV) juga dianggap CV.
 *   BATT_CV_FULL_MIN     menit di fase CV sebelum angka diizinkan 100%. Sebelum
 *                        itu angka mentok 99% -- fase CV memang butuh puluhan
 *                        menit untuk mengisi ~10-20% terakhir dan tegangannya
 *                        rata, jadi tidak ada cara membacanya dari tegangan.
 *                        TEBAKAN untuk sel 1500 mAh yang dipakai (fase CV sel
 *                        sebesar itu pada charger ~0,3-0,5C kira-kira 45-90
 *                        menit), belum diukur: pantau baris "[batt] fase CV"
 *                        di Serial dan sesuaikan.
 *   BATT_CHG_MAX_PCT_MIN persen tertinggi yang boleh bertambah per menit saat
 *                        mengisi. Batas fisik: sel tidak bisa terisi lebih cepat
 *                        dari arus chargernya, jadi angka yang melompat lebih
 *                        cepat dari ini pasti artefak tegangan. Untuk sel 1500
 *                        mAh, 1%/menit setara ~900 mA -- di atas arus charger
 *                        board semacam ini, jadi ia hanya pagar, bukan penentu.
 *                        Sel 1500 mAh pada ~500 mA butuh ~3 jam dari kosong;
 *                        "penuh dalam beberapa puluh menit" pasti artefak. */
#define BATT_CHG_IR_MV        100
#define BATT_CV_MV            4170
#define BATT_CV_FULL_MIN      60
/* Batas bawah "plateau" yang dianggap fase CV. Plateau di bawah ini (charger
 * atau port USB yang tertahan di ~4,05-4,10 V) BUKAN sel yang penuh, jadi tidak
 * boleh menjalankan penghitung CV maupun merayap ke 100%. Sengaja sedikit di
 * bawah 4200 supaya toleransi BATT_DIVIDER (+-1% = +-42 mV) tidak membuat sel
 * yang benar-benar penuh terlewat. */
#define BATT_CV_PLATEAU_MIN_MV 4150
#define BATT_CHG_MAX_PCT_MIN  1
