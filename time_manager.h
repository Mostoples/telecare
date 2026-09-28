/*
 * Pemilik tunggal "jam sekarang".
 *
 *   boot            -> dibaca dari PCF85063 (RTC jadi sumber utama)
 *   SET_WAKTU (web) -> waktu dikoreksi DAN ditulis balik ke RTC
 *   antar detik     -> diinterpolasi dari millis(), RTC dibaca ulang tiap menit
 *
 * Interpolasi millis() dipakai supaya bus I2C tidak diakses setiap detik.
 * Waktu disimpan sebagai "epoch lokal" (sudah digeser TZ_OFFSET_SEC) lalu
 * dipecah gmtime_r, jadi tidak perlu variabel TZ global.
 *
 * Semua fungsi di sini dipanggil dari konteks loop (menyentuh I2C).
 */
#pragma once

#include <stdint.h>
#include <time.h>

typedef enum {
  TIME_SRC_NONE = 0,   /* belum ada waktu yang bisa dipercaya */
  TIME_SRC_RTC,        /* dari PCF85063                       */
  TIME_SRC_BLE         /* disetel dari web lewat SET_WAKTU    */
} time_src_t;

void tm_begin(void);                 /* sekali di setup(), SETELAH rtc_begin() */
void tm_tick(void);                  /* rutin dari loop / timer LVGL           */
bool tm_now(struct tm *out);         /* false kalau belum ada waktu valid      */
bool tm_valid(void);
time_src_t tm_source(void);

/* Epoch UTC sekarang, 0 kalau belum ada waktu. Dipakai stempel hasil ukur. */
uint32_t tm_epoch_utc(void);

/* Setel jam dari epoch UTC kiriman web. Offset zona waktu ditambahkan di sini. */
void tm_terapkan_epoch_utc(uint32_t epoch_utc);

const char *tm_boot_info(void);      /* asal waktu saat boot, untuk log  */
const char *tm_day_name(int wday);        /* "Sun".."Sat"  (0 = Minggu) */
const char *tm_month_name(int mon_0_11);  /* "Jan".."Dec"               */
