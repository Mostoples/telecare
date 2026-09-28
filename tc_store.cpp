#include <Arduino.h>
#include <Preferences.h>
#include <string.h>
#include "tc_store.h"

/* Satu namespace NVS. Hasil disimpan sebagai SATU blob berurutan (tertua
 * dulu): 64 x 16 byte = 1 KB, ditulis ulang utuh tiap berubah. Perubahannya
 * jarang (sekali per pengukuran / per HAPUS), jadi kesederhanaan ini jauh lebih
 * berharga daripada menghemat beberapa siklus tulis flash. */
#define NVS_NS "telecare"

static Preferences s_nvs;
static tc_hasil_t  s_hasil[TC_HASIL_KAP];
static uint8_t     s_n = 0;
static uint16_t    s_id_berikut = 1;
static uint8_t     s_label = 0;
static tc_kalib_t  s_kalib = { 0, 0, 0 };
static uint8_t     s_bat_pct = 0;

static void simpan_hasil(void) {
  s_nvs.putBytes("hasil", s_hasil, sizeof(tc_hasil_t) * s_n);
  s_nvs.putUChar("n", s_n);
  s_nvs.putUShort("id", s_id_berikut);
}

void tc_store_begin(void) {
  s_nvs.begin(NVS_NS, false);

  s_n = s_nvs.getUChar("n", 0);
  if (s_n > TC_HASIL_KAP) s_n = 0;
  size_t perlu = sizeof(tc_hasil_t) * s_n;
  if (s_n && s_nvs.getBytes("hasil", s_hasil, perlu) != perlu) s_n = 0;

  s_id_berikut = s_nvs.getUShort("id", 1);
  if (!s_id_berikut) s_id_berikut = 1;
  s_label   = s_nvs.getUChar("label", 0);
  s_kalib.glukosa = s_nvs.getShort("k_glu", 0);
  s_kalib.sis     = s_nvs.getChar("k_sis", 0);
  s_kalib.dia     = s_nvs.getChar("k_dia", 0);
  s_bat_pct = s_nvs.getUChar("bat", 0);

  Serial.printf("[store] %u hasil tersimpan, label=%u, kalibrasi glu=%+d td=%+d/%+d\n",
                (unsigned)s_n, (unsigned)s_label, (int)s_kalib.glukosa,
                (int)s_kalib.sis, (int)s_kalib.dia);
}

void tc_hasil_tambah(tc_hasil_t *h) {
  h->id = s_id_berikut++;
  if (!s_id_berikut) s_id_berikut = 1;
  if (s_n == TC_HASIL_KAP) {
    /* Penuh: yang tertua dikorbankan. Lebih baik daripada menolak hasil baru. */
    memmove(&s_hasil[0], &s_hasil[1], sizeof(tc_hasil_t) * (TC_HASIL_KAP - 1));
    s_n--;
    Serial.println("[store] penuh -- hasil tertua ditimpa");
  }
  s_hasil[s_n++] = *h;
  simpan_hasil();
}

bool tc_hasil_hapus(uint16_t id) {
  for (uint8_t i = 0; i < s_n; i++) {
    if (s_hasil[i].id != id) continue;
    memmove(&s_hasil[i], &s_hasil[i + 1], sizeof(tc_hasil_t) * (s_n - i - 1));
    s_n--;
    simpan_hasil();
    return true;
  }
  return false;
}

void tc_hasil_hapus_semua(void) {
  s_n = 0;
  simpan_hasil();
}

uint8_t tc_hasil_jumlah(void) { return s_n; }

bool tc_hasil_ambil(uint8_t i, tc_hasil_t *out) {
  if (i >= s_n) return false;
  *out = s_hasil[i];
  return true;
}

uint8_t tc_label_get(void) { return s_label; }

void tc_label_set(uint8_t label) {
  if (label < 1 || label > 99) return;
  s_label = label;
  s_nvs.putUChar("label", label);
  Serial.printf("[store] label unit = %02u -- nama BLE \"TeleCare-%02u\" "
                "berlaku setelah boot ulang\n", (unsigned)label, (unsigned)label);
}

void tc_kalib_get(tc_kalib_t *out) { *out = s_kalib; }

void tc_kalib_set(const tc_kalib_t *k) {
  s_kalib = *k;
  s_nvs.putShort("k_glu", k->glukosa);
  s_nvs.putChar("k_sis", k->sis);
  s_nvs.putChar("k_dia", k->dia);
  Serial.printf("[store] kalibrasi disimpan: glu=%+d td=%+d/%+d\n",
                (int)k->glukosa, (int)k->sis, (int)k->dia);
}

uint8_t tc_baterai_pct_get(void) { return s_bat_pct; }

void tc_baterai_pct_set(uint8_t pct) {
  if (pct == s_bat_pct) return;
  s_bat_pct = pct;
  s_nvs.putUChar("bat", pct);
}
