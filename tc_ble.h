/*
 * TeleCare -- lapisan BLE, SENGAJA tipis: iklan, GATT, dan memindahkan byte.
 * Tidak tahu apa-apa soal pengukuran; itu urusan tc_inti.
 *
 * ATURAN THREAD: callback NimBLE berjalan di task host NimBLE. Di sana DILARANG
 * menyentuh LVGL, NVS/flash, atau I2C. onWrite hanya menaruh byte mentah ke
 * antrean FreeRTOS; tc_inti mengambilnya lewat tc_ble_ambil_perintah() di loop.
 */
#pragma once

#include <stdint.h>
#include "tc_proto.h"

typedef struct {
  uint8_t panjang;
  uint8_t data[TC_MAKS_PERINTAH];
} tc_perintah_t;

void tc_ble_begin(void);          /* setelah tc_store_begin() (butuh label) */
void tc_ble_putar(void);          /* tiap loop: jaga iklan tetap hidup      */

bool tc_ble_ambil_perintah(tc_perintah_t *out);
/* Untuk konsol Serial: suntik perintah lewat antrean yang sama dengan BLE. */
bool tc_ble_suntik_perintah(const uint8_t *data, uint8_t panjang);

bool tc_ble_terhubung(void);
bool tc_ble_langganan_live(void);
bool tc_ble_langganan_hasil(void);
/* true SEKALI setelah web berlangganan HASIL -- pemicu kirim hasil tersimpan. */
bool tc_ble_ambil_flag_siap(void);

void tc_ble_set_status(const uint8_t *paket);   /* TC_LEN_STATUS byte */
bool tc_ble_kirim_live(const uint8_t *paket);   /* TC_LEN_LIVE byte   */
bool tc_ble_kirim_hasil(const uint8_t *paket);  /* TC_LEN_HASIL byte  */

const char *tc_ble_nama(void);
