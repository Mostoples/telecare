#include <Arduino.h>
#include <string.h>
#include "tc_inti.h"
#include "tc_ble.h"
#include "tc_store.h"
#include "tc_proto.h"
#include "time_manager.h"
#include "battery.h"
#include "config.h"

/* ---------------- Keadaan pengukuran ---------------- */
static bool     s_aktif = false;
static uint8_t  s_sumber = TC_SUMBER_TOMBOL;
static uint32_t s_mulai_ms = 0;
static uint32_t s_mulai_epoch = 0;
static bool     s_mulai_waktu_ok = false;
static uint32_t s_live_ms = 0;
static uint8_t  s_live_seq = 0;

/* Hasil terakhir untuk layar setelah sensor dimatikan (ppg me-reset hold-nya
 * saat dimatikan, jadi angkanya disalin ke sini). */
static bool       s_ada_hasil = false;
static ppg_data_t s_hasil_layar;

/* Pengiriman hasil tersimpan: kirim entri ber-id >= s_kirim_id satu per satu.
 * Pakai id (bukan indeks) supaya HAPUS di tengah pengiriman tidak membuat entri
 * terlewat -- indeks bergeser, id tidak. */
static bool     s_kirim_aktif = false;
static uint16_t s_kirim_id = 0;
static uint32_t s_kirim_ms = 0;

/* ---------------- Util ---------------- */
static uint8_t klem_u8(float v)  { return v <= 0 ? 0 : (v >= 255 ? 255 : (uint8_t)(v + 0.5f)); }
static uint16_t klem_u16(float v){ return v <= 0 ? 0 : (v >= 65535 ? 65535 : (uint16_t)(v + 0.5f)); }

static uint8_t state_proto(const ppg_data_t *p) {
  if (!ppg_present()) return TC_ST_TAK_ADA;
  switch (p->state) {
    case PPG_NO_CONTACT: return TC_ST_TAK_MENEMPEL;
    case PPG_SETTLING:   return TC_ST_MENSTABIL;
    case PPG_ACQUIRING:  return TC_ST_MENCARI;
    case PPG_STABLE:     return TC_ST_STABIL;
    default:             return TC_ST_MATI;
  }
}

uint8_t inti_persen(void) {
  if (!s_aktif) return 0;
  ppg_data_t p;
  ppg_get(&p);
  float f_detak = (float)p.beats / (float)UKUR_MIN_DETAK;
  float f_waktu = (float)(millis() - s_mulai_ms) / (float)UKUR_MIN_MS;
  float f = f_detak < f_waktu ? f_detak : f_waktu;   /* yang paling tertinggal */
  if (f > 1.0f) f = 1.0f;
  return (uint8_t)(f * 100.0f);
}

uint16_t inti_detik(void) {
  return s_aktif ? (uint16_t)((millis() - s_mulai_ms) / 1000UL) : 0;
}

bool    inti_mengukur(void)  { return s_aktif; }
uint8_t inti_tersimpan(void) { return tc_hasil_jumlah(); }

/* ---------------- Paket ke web ---------------- */
static void susun_hasil(const tc_hasil_t *h, uint8_t *b) {
  tc_tulis_u16(&b[0], h->id);
  tc_tulis_u32(&b[2], h->epoch);
  tc_tulis_u16(&b[6], h->durasi_s);
  b[8] = h->bpm;
  b[9] = h->spo2;
  tc_tulis_u16(&b[10], h->glukosa);
  b[12] = h->sis;
  b[13] = h->dia;
  b[14] = h->sumber;
  b[15] = h->flag;
}

static void kirim_live(void) {
  ppg_data_t p;
  ppg_get(&p);
  bool semen = p.awal;
  uint8_t f = 0;
  if (p.bpm_valid  || (semen && p.bpm > 0))     f |= TC_F_BPM;
  if (p.spo2_valid || (semen && p.spo2 > 0))    f |= TC_F_SPO2;
  if (p.glu_valid  || (semen && p.glucose > 0)) f |= TC_F_GLUKOSA;
  if (p.bp_valid   || (semen && p.sbp > 0))     f |= TC_F_TENSI;
  if (semen) f |= TC_F_SEMENTARA;
  uint8_t persen = inti_persen();
  if (persen >= 100) f |= TC_F_CUKUP;

  uint8_t b[TC_LEN_LIVE];
  b[0] = s_live_seq++;
  b[1] = state_proto(&p);
  b[2] = persen;
  b[3] = (f & TC_F_BPM)     ? klem_u8(p.bpm) : 0;
  b[4] = (f & TC_F_SPO2)    ? klem_u8(p.spo2) : 0;
  tc_tulis_u16(&b[5], (f & TC_F_GLUKOSA) ? klem_u16(p.glucose) : 0);
  b[7] = (f & TC_F_TENSI)   ? klem_u8(p.sbp) : 0;
  b[8] = (f & TC_F_TENSI)   ? klem_u8(p.dbp) : 0;
  tc_tulis_u16(&b[9], inti_detik());
  b[11] = p.beats > 255 ? 255 : (uint8_t)p.beats;
  b[12] = f;
  b[13] = 0;
  tc_ble_kirim_live(b);
}

/* Status dikirim saat isinya berubah, dan tiap 10 detik sebagai detak hidup. */
static void perbarui_status(bool paksa) {
  static uint8_t lalu[TC_LEN_STATUS];
  static uint32_t terakhir_ms = 0;

  ppg_data_t p;
  ppg_get(&p);
  uint8_t b[TC_LEN_STATUS];
  b[0] = battery_valid() ? (uint8_t)battery_percent() : 0xFF;
  b[1] = (s_aktif ? TC_S_MENGUKUR : 0) | (battery_charging() ? TC_S_MENGISI : 0) |
         (ppg_present() ? TC_S_SENSOR : 0) | (tm_valid() ? TC_S_WAKTU : 0);
  b[2] = tc_hasil_jumlah();
  b[3] = s_aktif ? state_proto(&p) : (ppg_present() ? TC_ST_MATI : TC_ST_TAK_ADA);
  b[4] = inti_persen();
  tc_tulis_u32(&b[5], tm_epoch_utc());
  b[9] = tc_label_get();

  /* Byte epoch (5..8) diabaikan saat membandingkan, kalau tidak status
   * dikirim tiap detik hanya karena jam berjalan. */
  bool berubah = memcmp(b, lalu, 5) != 0 || b[9] != lalu[9];
  if (!paksa && !berubah && (uint32_t)(millis() - terakhir_ms) < 10000UL) return;
  memcpy(lalu, b, sizeof(b));
  terakhir_ms = millis();
  tc_ble_set_status(b);
}

static void kirim_hasil_mulai(uint16_t dari_id) {
  if (!s_kirim_aktif || dari_id < s_kirim_id) s_kirim_id = dari_id;
  s_kirim_aktif = true;
}

static void kirim_hasil_putar(void) {
  if (!s_kirim_aktif) return;
  if (!tc_ble_langganan_hasil()) { s_kirim_aktif = false; return; }
  if ((uint32_t)(millis() - s_kirim_ms) < 40) return;   /* jangan membanjiri link */

  tc_hasil_t h;
  for (uint8_t i = 0; tc_hasil_ambil(i, &h); i++) {
    if (h.id < s_kirim_id) continue;
    uint8_t b[TC_LEN_HASIL];
    susun_hasil(&h, b);
    tc_ble_kirim_hasil(b);
    s_kirim_id = h.id + 1;
    s_kirim_ms = millis();
    return;
  }
  s_kirim_aktif = false;   /* semua sudah terkirim */
}

/* ---------------- Mulai / stop ---------------- */
static inti_aksi_t ukur_mulai(uint8_t sumber) {
  if (s_aktif) return INTI_MULAI;
  if (!ppg_present()) return INTI_TOLAK_SENSOR;
  if (battery_valid() && battery_percent() < BATERAI_KRITIS_PCT) return INTI_TOLAK_BATERAI;

  s_aktif = true;
  s_sumber = sumber;
  s_mulai_ms = millis();
  s_mulai_waktu_ok = tm_valid();
  s_mulai_epoch = tm_epoch_utc();
  s_live_ms = 0;
  s_ada_hasil = false;

  ppg_clear_hold();          /* buang angka sesi sebelumnya SEBELUM LED menyala */
  ppg_set_enabled(true);
  Serial.printf("[ukur] mulai (%s)\n", sumber == TC_SUMBER_WEB ? "web" : "tombol");
  perbarui_status(true);
  return INTI_MULAI;
}

static inti_aksi_t ukur_stop(void) {
  if (!s_aktif) return INTI_STOP_KOSONG;

  /* Panen SEBELUM sensor dimatikan -- ppg_set_enabled(false) menghapus semua. */
  ppg_data_t p;
  ppg_get(&p);
  tc_hasil_t h;
  memset(&h, 0, sizeof(h));
  h.bpm     = p.bpm_valid  ? klem_u8(p.stats_valid && p.bpm_avg > 0 ? p.bpm_avg : p.bpm) : 0;
  h.spo2    = p.spo2_valid ? klem_u8(p.stats_valid && p.spo2_avg > 0 ? p.spo2_avg : p.spo2) : 0;
  h.glukosa = p.glu_valid  ? klem_u16(p.glucose) : 0;
  if (p.bp_valid) {
    h.sis = klem_u8(p.stats_valid && p.sbp_avg > 0 ? p.sbp_avg : p.sbp);
    h.dia = klem_u8(p.stats_valid && p.dbp_avg > 0 ? p.dbp_avg : p.dbp);
  }

  /* Offset kalibrasi per unit diterapkan ke angka mentah; nol (= gagal) dibiarkan. */
  tc_kalib_t k;
  tc_kalib_get(&k);
  if (h.glukosa) h.glukosa = (uint16_t)constrain((long)h.glukosa + k.glukosa, 1L, 65535L);
  if (h.sis)     h.sis = (uint8_t)constrain((int)h.sis + k.sis, 1, 255);
  if (h.dia)     h.dia = (uint8_t)constrain((int)h.dia + k.dia, 1, 255);

  h.epoch    = s_mulai_epoch;
  h.durasi_s = inti_detik();
  h.sumber   = s_sumber;
  h.flag     = (h.bpm ? TC_F_BPM : 0) | (h.spo2 ? TC_F_SPO2 : 0) |
               (h.glukosa ? TC_F_GLUKOSA : 0) | (h.sis ? TC_F_TENSI : 0) |
               (s_mulai_waktu_ok ? TC_F_WAKTU_OK : 0);

  ppg_set_enabled(false);
  s_aktif = false;

  bool ada = h.bpm || h.spo2 || h.glukosa || h.sis;
  if (ada) {
    tc_hasil_tambah(&h);
    /* Salinan untuk layar: angka final yang sama dengan yang disimpan. */
    memset(&s_hasil_layar, 0, sizeof(s_hasil_layar));
    s_hasil_layar.bpm = h.bpm;         s_hasil_layar.bpm_valid  = h.bpm != 0;
    s_hasil_layar.spo2 = h.spo2;       s_hasil_layar.spo2_valid = h.spo2 != 0;
    s_hasil_layar.glucose = h.glukosa; s_hasil_layar.glu_valid  = h.glukosa != 0;
    s_hasil_layar.sbp = h.sis; s_hasil_layar.dbp = h.dia; s_hasil_layar.bp_valid = h.sis != 0;
    s_hasil_layar.held = true;
    s_ada_hasil = true;
    kirim_hasil_mulai(h.id);
  }
  Serial.printf("[ukur] stop: bpm=%u spo2=%u glu=%u td=%u/%u %lus -> %s\n",
                h.bpm, h.spo2, h.glukosa, h.sis, h.dia, (unsigned long)h.durasi_s,
                ada ? "disimpan" : "tidak ada angka, tidak disimpan");
  perbarui_status(true);
  return ada ? INTI_STOP_TERSIMPAN : INTI_STOP_KOSONG;
}

inti_aksi_t inti_tombol(void) {
  return s_aktif ? ukur_stop() : ukur_mulai(TC_SUMBER_TOMBOL);
}

void inti_snapshot(ppg_data_t *out) {
  if (s_aktif || !s_ada_hasil) { ppg_get(out); return; }
  *out = s_hasil_layar;
}

/* ---------------- Perintah dari web ---------------- */
static void jalankan(const tc_perintah_t *c) {
  if (!c->panjang) return;
  const uint8_t *d = c->data;
  switch (d[0]) {
    case TC_OP_SET_WAKTU:
      if (c->panjang >= 5) tm_terapkan_epoch_utc(tc_baca_u32(&d[1]));
      break;
    case TC_OP_MULAI_UKUR: {
      inti_aksi_t a = ukur_mulai(TC_SUMBER_WEB);
      if (a != INTI_MULAI) Serial.printf("[ukur] MULAI dari web ditolak (%d)\n", (int)a);
      break;
    }
    case TC_OP_STOP_UKUR:
      ukur_stop();
      break;
    case TC_OP_SINKRON:
      kirim_hasil_mulai(0);
      break;
    case TC_OP_HAPUS:
      if (c->panjang >= 3) {
        uint16_t id = tc_baca_u16(&d[1]);
        Serial.printf("[store] HAPUS id %u: %s\n", id, tc_hasil_hapus(id) ? "ok" : "tidak ada");
      }
      break;
    case TC_OP_HAPUS_SEMUA:
      tc_hasil_hapus_semua();
      Serial.println("[store] semua hasil dihapus");
      break;
    case TC_OP_SET_KALIBRASI:
      if (c->panjang >= 5) {
        tc_kalib_t k = { (int16_t)tc_baca_u16(&d[1]), (int8_t)d[3], (int8_t)d[4] };
        tc_kalib_set(&k);
      }
      break;
    default:
      Serial.printf("[ble] opcode tidak dikenal 0x%02X\n", d[0]);
      return;
  }
  perbarui_status(true);
}

/* ---------------- Siklus hidup ---------------- */
void inti_mulai(void) {
  perbarui_status(true);
}

void inti_putar(void) {
  tc_ble_putar();

  tc_perintah_t c;
  while (tc_ble_ambil_perintah(&c)) jalankan(&c);

  /* Web baru berlangganan HASIL: kirim semua yang masih tersimpan. */
  if (tc_ble_ambil_flag_siap()) {
    perbarui_status(true);
    kirim_hasil_mulai(0);
  }
  kirim_hasil_putar();

  if (s_aktif) {
    if ((uint32_t)(millis() - s_live_ms) >= LIVE_PERIODE_MS) {
      s_live_ms = millis();
      kirim_live();
    }
    if ((uint32_t)(millis() - s_mulai_ms) >= UKUR_BATAS_KERAS_MS) {
      Serial.println("[ukur] batas keras tercapai -- dihentikan otomatis");
      ukur_stop();
    }
  }

  static uint32_t status_ms = 0;
  if ((uint32_t)(millis() - status_ms) >= 1000UL) {
    status_ms = millis();
    perbarui_status(false);
  }
}

void inti_siap_mati(void) {
  if (s_aktif) ukur_stop();   /* hasil yang sudah terbaca tetap disimpan */
  ppg_set_enabled(false);
}
