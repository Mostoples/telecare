/*
 * TeleCare -- definisi protokol BLE (jam <-> web).
 * Spesifikasi lengkap untuk sisi web: docs/PROTOKOL_BLE.md. Kalau salah satu
 * angka di sini diubah, dokumen itu WAJIB ikut diubah.
 *
 * Semua field multi-byte little-endian, ditulis byte demi byte (tanpa memcpy
 * struct) supaya tata letak paket tidak bergantung pada compiler.
 */
#pragma once

#include <stdint.h>

#define TC_PROTO_VERSI   1
#define TC_FW_MAYOR      1
#define TC_FW_MINOR      0

/* ---------------- UUID ---------------- */
#define TC_UUID_SERVICE  "7E1E0001-5443-4172-652D-54656C654361"
#define TC_UUID_INFO     "7E1E0002-5443-4172-652D-54656C654361"  /* read           */
#define TC_UUID_KONTROL  "7E1E0003-5443-4172-652D-54656C654361"  /* write          */
#define TC_UUID_STATUS   "7E1E0004-5443-4172-652D-54656C654361"  /* read + notify  */
#define TC_UUID_LIVE     "7E1E0005-5443-4172-652D-54656C654361"  /* notify         */
#define TC_UUID_HASIL    "7E1E0006-5443-4172-652D-54656C654361"  /* notify         */

/* ---------------- Ukuran paket ---------------- */
#define TC_LEN_INFO     10
#define TC_LEN_STATUS   10
#define TC_LEN_LIVE     14
#define TC_LEN_HASIL    16
#define TC_MAKS_PERINTAH 8

/* ---------------- Opcode Kontrol (web -> jam) ---------------- */
enum {
  TC_OP_SET_WAKTU    = 0x01,  /* u32 epoch UTC                               */
  TC_OP_MULAI_UKUR   = 0x02,  /* --                                          */
  TC_OP_STOP_UKUR    = 0x03,  /* --  (hasil disimpan + dikirim lewat HASIL)  */
  TC_OP_SINKRON      = 0x04,  /* --  kirim ulang semua hasil tersimpan       */
  TC_OP_HAPUS        = 0x05,  /* u16 id -- hasil sudah diterima web, hapus    */
  TC_OP_HAPUS_SEMUA  = 0x06,  /* --                                          */
  TC_OP_SET_KALIBRASI= 0x07,  /* i16 offset glukosa, i8 sistol, i8 diastol    */
};

/* ---------------- State pengukuran (LIVE byte 1) ---------------- */
enum {
  TC_ST_MATI        = 0,   /* sensor tidak menyala                   */
  TC_ST_TAK_MENEMPEL= 1,   /* sensor menyala, belum ada kulit        */
  TC_ST_MENSTABIL   = 2,   /* kulit menempel, sinyal menstabil       */
  TC_ST_MENCARI     = 3,   /* mencari detak                          */
  TC_ST_STABIL      = 4,   /* angka sudah stabil (valid)             */
  TC_ST_TAK_ADA     = 5,   /* sensor MAX3010x tidak terdeteksi       */
};

/* ---------------- Flag ---------------- */
/* LIVE byte 12 & HASIL byte 15: metrik mana yang berisi angka. */
#define TC_F_BPM       0x01
#define TC_F_SPO2      0x02
#define TC_F_GLUKOSA   0x04
#define TC_F_TENSI     0x08
#define TC_F_SEMENTARA 0x10   /* LIVE: angka belum stabil (tampil redup)   */
#define TC_F_CUKUP     0x20   /* LIVE: data sudah cukup, boleh di-stop     */
#define TC_F_WAKTU_OK  0x40   /* HASIL: stempel waktu dari jam yg tersetel */

/* STATUS byte 1 */
#define TC_S_MENGUKUR  0x01
#define TC_S_MENGISI   0x02
#define TC_S_SENSOR    0x04
#define TC_S_WAKTU     0x08   /* jam sudah pernah disetel (RTC/web)        */

/* Sumber pengukuran (HASIL byte 14) */
#define TC_SUMBER_TOMBOL 0
#define TC_SUMBER_WEB    1

/* ---------------- Penulis / pembaca little-endian ---------------- */
static inline void tc_tulis_u16(uint8_t *p, uint16_t v) {
  p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8);
}
static inline void tc_tulis_u32(uint8_t *p, uint32_t v) {
  p[0] = (uint8_t)v; p[1] = (uint8_t)(v >> 8);
  p[2] = (uint8_t)(v >> 16); p[3] = (uint8_t)(v >> 24);
}
static inline uint16_t tc_baca_u16(const uint8_t *p) {
  return (uint16_t)(p[0] | ((uint16_t)p[1] << 8));
}
static inline uint32_t tc_baca_u32(const uint8_t *p) {
  return (uint32_t)p[0] | ((uint32_t)p[1] << 8) |
         ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
