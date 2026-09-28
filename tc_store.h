/*
 * TeleCare -- penyimpanan NVS (flash).
 *
 *   hasil ukur  : maksimal TC_HASIL_KAP entri. Keluar dari flash HANYA lewat
 *                 HAPUS dari web (tanda web sudah menyimpannya). Kalau penuh,
 *                 entri tertua ditimpa.
 *   label unit  : nomor 1..99 (nama BLE "TeleCare-NN"), diatur "id N" di Serial
 *   kalibrasi   : offset glukosa / sistol / diastol, dari web atau Serial
 *   baterai %   : persen terakhir, supaya ikon tidak mulai dari nol saat boot
 *
 * Konteks loop saja (akses flash). Callback BLE tidak boleh memanggil ini.
 */
#pragma once

#include <stdint.h>

#define TC_HASIL_KAP  64

typedef struct {
  uint16_t id;          /* naik terus, 1..65535 (0 = slot kosong) */
  uint32_t epoch;       /* UTC saat mulai ukur, 0 kalau jam belum tersetel */
  uint16_t durasi_s;
  uint8_t  bpm;         /* 0 = gagal diukur, berlaku untuk semua metrik */
  uint8_t  spo2;
  uint16_t glukosa;
  uint8_t  sis, dia;
  uint8_t  sumber;      /* TC_SUMBER_TOMBOL / TC_SUMBER_WEB */
  uint8_t  flag;        /* TC_F_* */
} tc_hasil_t;

void tc_store_begin(void);

/* Simpan hasil baru (langsung ditulis ke flash). Mengisi h->id. */
void tc_hasil_tambah(tc_hasil_t *h);
bool tc_hasil_hapus(uint16_t id);     /* false kalau id tidak ada */
void tc_hasil_hapus_semua(void);
uint8_t tc_hasil_jumlah(void);
/* Entri ke-i (0 = tertua). false kalau i di luar jumlah. */
bool tc_hasil_ambil(uint8_t i, tc_hasil_t *out);

uint8_t tc_label_get(void);
void    tc_label_set(uint8_t label);  /* 1..99, berlaku setelah boot ulang */

typedef struct { int16_t glukosa; int8_t sis, dia; } tc_kalib_t;
void tc_kalib_get(tc_kalib_t *out);
void tc_kalib_set(const tc_kalib_t *k);

uint8_t tc_baterai_pct_get(void);
void    tc_baterai_pct_set(uint8_t pct);
