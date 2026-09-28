/*
 * TeleCare -- inti alat: mulai/stop pengukuran, simpan hasil, dan melayani
 * perintah dari web. Berjalan di konteks loop (task yang sama dengan LVGL),
 * jadi UI boleh memanggil fungsi di sini langsung tanpa mutex.
 *
 * Alur:
 *   BOOT / MULAI_UKUR  -> sensor menyala, paket LIVE ke web tiap detik
 *   BOOT / STOP_UKUR   -> sensor mati, hasil disimpan ke flash + dikirim HASIL
 *   web HAPUS id       -> hasil itu dihapus dari flash (web sudah menyimpannya)
 */
#pragma once

#include <stdint.h>
#include "ppg.h"

void inti_mulai(void);       /* setup(): setelah tc_store_begin() & tc_ble_begin() */
void inti_putar(void);       /* tiap loop(), setelah ppg_update() */
void inti_siap_mati(void);   /* sebelum latch daya dilepas */

typedef enum {
  INTI_MULAI = 0,        /* pengukuran dimulai                        */
  INTI_STOP_TERSIMPAN,   /* dihentikan, ada hasil -> disimpan         */
  INTI_STOP_KOSONG,      /* dihentikan, belum ada angka yang terbaca  */
  INTI_TOLAK_SENSOR,     /* MAX3010x tidak terdeteksi                 */
  INTI_TOLAK_BATERAI,    /* baterai kritis                            */
} inti_aksi_t;

/* Tombol BOOT: saklar mulai/stop. */
inti_aksi_t inti_tombol(void);

bool     inti_mengukur(void);
uint8_t  inti_persen(void);     /* 0..100: seberapa "cukup" datanya       */
uint16_t inti_detik(void);      /* lama pengukuran berjalan               */
uint8_t  inti_tersimpan(void);  /* hasil di flash yang belum dihapus web  */

/* Angka untuk layar: bacaan langsung selama mengukur, hasil terakhir sesudahnya. */
void inti_snapshot(ppg_data_t *out);
