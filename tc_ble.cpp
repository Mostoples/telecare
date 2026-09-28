/*
 * Memakai pustaka BLE BAWAAN core Arduino-ESP32 (BLEDevice dkk.). Di ESP32-C6
 * pustaka itu sendiri adalah NimBLE, jadi tidak perlu NimBLE-Arduino -- dan
 * NimBLE-Arduino 2.x memang gagal di-link di C6 ("undefined reference"
 * r_os_mempool_*), jangan dipasang.
 */
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLESecurity.h>
#include <BLEAdvertising.h>
#include <host/ble_store.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <esp_mac.h>

#include "tc_ble.h"
#include "tc_store.h"
#include "config.h"

#if BLE_WAJIB_ENKRIPSI
#define PROP_R_ENC  BLECharacteristic::PROPERTY_READ_ENC
#define PROP_W_ENC  BLECharacteristic::PROPERTY_WRITE_ENC
#else
#define PROP_R_ENC  0
#define PROP_W_ENC  0
#endif

/* Iklan 100 ms: jam cepat ditemukan dan connect tidak timeout. Satuan 0,625 ms. */
#define ADV_ITVL  160

static BLEServer         *s_server = nullptr;
static BLECharacteristic *s_c_info, *s_c_kontrol, *s_c_status, *s_c_live, *s_c_hasil;
static QueueHandle_t      s_antrean = nullptr;

static uint8_t s_mac[6];
static char    s_nama[20];

static volatile bool     s_terhubung = false;
static volatile uint16_t s_conn = BLE_HS_CONN_HANDLE_NONE;
static volatile bool     s_sub_live = false, s_sub_hasil = false;
static volatile bool     s_flag_siap = false;
static volatile bool     s_perlu_iklan = false;
static volatile bool     s_perlu_param = false;
static uint32_t          s_cek_iklan_ms = 0;

/* ---------------- Callback (task host NimBLE) ---------------- */
class SrvCB : public BLEServerCallbacks {
  void onConnect(BLEServer *srv, ble_gap_conn_desc *desc) override {
    (void)srv;
    s_terhubung = true;
    s_conn = desc->conn_handle;
    s_sub_live = s_sub_hasil = false;   /* CCCD ditulis ulang tiap koneksi */
    s_perlu_param = true;
    Serial.printf("[ble] tersambung, interval %.1f ms\n", desc->conn_itvl * 1.25f);
  }
  void onDisconnect(BLEServer *srv, ble_gap_conn_desc *desc) override {
    (void)srv; (void)desc;
    s_terhubung = false;
    s_conn = BLE_HS_CONN_HANDLE_NONE;
    s_sub_live = s_sub_hasil = false;
    s_perlu_iklan = true;               /* iklan dinyalakan lagi dari loop */
    Serial.println("[ble] terputus");
  }
};

class KontrolCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    String v = c->getValue();
    tc_perintah_t p;
    size_t n = v.length();
    if (n > TC_MAKS_PERINTAH) n = TC_MAKS_PERINTAH;
    p.panjang = (uint8_t)n;
    memcpy(p.data, v.c_str(), n);
    if (xQueueSend(s_antrean, &p, 0) != pdTRUE)
      Serial.println("[ble] antrean perintah penuh");
  }
};

class LanggananCB : public BLECharacteristicCallbacks {
public:
  explicit LanggananCB(volatile bool *b, bool picu_siap) : m_b(b), m_picu(picu_siap) {}
  void onSubscribe(BLECharacteristic *c, ble_gap_conn_desc *d, uint16_t nilai) override {
    (void)d;
    *m_b = (nilai != 0);
    Serial.printf("[ble] web %s %s\n", nilai ? "langganan" : "berhenti langganan",
                  c == s_c_hasil ? "HASIL" : (c == s_c_live ? "LIVE" : "?"));
    if (m_picu && nilai) s_flag_siap = true;
  }
private:
  volatile bool *m_b;
  bool m_picu;
};

/* ---------------- Diagnosa GAP ----------------
 * Callback BLEServer tidak memberi alasan putus maupun hasil enkripsi, jadi
 * pasang pendengar GAP tambahan untuk mencetaknya. Kalau enkripsi gagal karena
 * kunci bond basi (HP/laptop sudah "Remove device" tapi jam masih menyimpan
 * bond lamanya), bond itu dihapus supaya percobaan berikutnya pairing baru. */
static struct ble_gap_event_listener s_pendengar;

static int gap_diagnosa(struct ble_gap_event *ev, void *arg) {
  (void)arg;
  struct ble_gap_conn_desc d;
  switch (ev->type) {
    case BLE_GAP_EVENT_ENC_CHANGE:
      if (ev->enc_change.status == 0) {
        Serial.println("[ble] pairing/enkripsi OK");
      } else {
        Serial.printf("[ble] pairing/enkripsi GAGAL, status=%d (0x%X)\n",
                      ev->enc_change.status, ev->enc_change.status);
        if (ble_gap_conn_find(ev->enc_change.conn_handle, &d) == 0) {
          ble_store_util_delete_peer(&d.peer_id_addr);
          Serial.println("[ble] bond lama perangkat ini dihapus -- coba sambung lagi");
        }
      }
      break;
    case BLE_GAP_EVENT_DISCONNECT:
      Serial.printf("[ble] alasan putus=%d (0x%X)\n",
                    ev->disconnect.reason, ev->disconnect.reason);
      break;
    default:
      break;
  }
  return 0;
}

/* ---------------- Iklan ---------------- */
static void iklan_mulai(void) {
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->stop();
  /* UUID layanan di paket IKLAN (filter requestDevice di browser bekerja pada
   * paket ini), nama di scan response -- 31 byte tidak cukup untuk keduanya. */
  BLEAdvertisementData iklan;
  iklan.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  iklan.setCompleteServices(BLEUUID(TC_UUID_SERVICE));
  BLEAdvertisementData scan;
  scan.setName(s_nama);
  adv->setAdvertisementData(iklan);
  adv->setScanResponseData(scan);
  adv->setScanResponse(true);
  adv->setMinInterval(ADV_ITVL);
  adv->setMaxInterval(ADV_ITVL);
  adv->start();
}

/* ---------------- Init ---------------- */
void tc_ble_begin(void) {
  esp_efuse_mac_get_default(s_mac);

  /* Label unit menang atas suffix MAC: suffix MAC terbukti bisa kembar pada unit
   * dari batch produksi yang sama. */
  uint8_t label = tc_label_get();
  if (label) snprintf(s_nama, sizeof(s_nama), "TeleCare-%02u", (unsigned)label);
  else       snprintf(s_nama, sizeof(s_nama), "TeleCare-%02X%02X%02X",
                      s_mac[3], s_mac[4], s_mac[5]);

  s_antrean = xQueueCreate(8, sizeof(tc_perintah_t));

  BLEDevice::init(String(s_nama));
  BLEDevice::setMTU(185);
  BLEDevice::setPower(ESP_PWR_LVL_P9, ESP_BLE_PWR_TYPE_ADV);
  BLEDevice::setPower(ESP_PWR_LVL_P9, ESP_BLE_PWR_TYPE_DEFAULT);

#if BLE_WAJIB_ENKRIPSI
  /* Bonding + LE Secure Connections + Just Works. MITM sengaja false: jam tidak
   * punya cara menampilkan/memasukkan passkey, jadi MITM tak pernah tercapai dan
   * memintanya cuma membuat pairing kadang ditolak. */
  BLESecurity::setAuthenticationMode(true, false, true);
  BLESecurity::setCapability(BLE_HS_IO_NO_INPUT_OUTPUT);
#else
  BLESecurity::setAuthenticationMode(false, false, false);
  BLESecurity::setCapability(BLE_HS_IO_NO_INPUT_OUTPUT);
  ble_store_clear();   /* bond sisa mode terenkripsi bikin koneksi putus */
#endif

  s_server = BLEDevice::createServer();
  s_server->setCallbacks(new SrvCB());
  ble_gap_event_listener_register(&s_pendengar, gap_diagnosa, NULL);

  BLEService *svc = s_server->createService(BLEUUID(TC_UUID_SERVICE), 20);

  s_c_info = svc->createCharacteristic(BLEUUID(TC_UUID_INFO),
      BLECharacteristic::PROPERTY_READ | PROP_R_ENC);
  {
    uint8_t b[TC_LEN_INFO];
    b[0] = TC_PROTO_VERSI; b[1] = TC_FW_MAYOR; b[2] = TC_FW_MINOR;
    memcpy(&b[3], s_mac, 6);
    b[9] = label;
    s_c_info->setValue(b, sizeof(b));
  }

  s_c_kontrol = svc->createCharacteristic(BLEUUID(TC_UUID_KONTROL),
      BLECharacteristic::PROPERTY_WRITE | PROP_W_ENC);
  s_c_kontrol->setCallbacks(new KontrolCB());

  s_c_status = svc->createCharacteristic(BLEUUID(TC_UUID_STATUS),
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY | PROP_R_ENC);
  { uint8_t b[TC_LEN_STATUS] = { 0 }; s_c_status->setValue(b, sizeof(b)); }

  s_c_live = svc->createCharacteristic(BLEUUID(TC_UUID_LIVE),
      BLECharacteristic::PROPERTY_NOTIFY | PROP_R_ENC);
  s_c_live->setCallbacks(new LanggananCB(&s_sub_live, false));

  s_c_hasil = svc->createCharacteristic(BLEUUID(TC_UUID_HASIL),
      BLECharacteristic::PROPERTY_NOTIFY | PROP_R_ENC);
  s_c_hasil->setCallbacks(new LanggananCB(&s_sub_hasil, true));

  svc->start();
  iklan_mulai();
  Serial.printf("[ble] \"%s\" mengiklan (%s)\n", s_nama,
                BLE_WAJIB_ENKRIPSI ? "terenkripsi, wajib pairing" : "TANPA enkripsi");
}

/* ---------------- Putaran (konteks loop) ---------------- */
void tc_ble_putar(void) {
  if (s_perlu_param) {
    s_perlu_param = false;
    /* Interval rapat (15-30 ms) supaya penelusuran GATT di browser cepat. */
    if (s_terhubung && s_conn != BLE_HS_CONN_HANDLE_NONE)
      s_server->updateConnParams(s_conn, 12, 24, 0, 600);
  }
  if (s_perlu_iklan) {
    s_perlu_iklan = false;
    iklan_mulai();
    return;
  }
  /* Penjaga: kalau adv->start() pernah gagal diam-diam, jam tak terlihat
   * selamanya. Cek ke stack tiap 5 detik. */
  if (!s_terhubung && (uint32_t)(millis() - s_cek_iklan_ms) >= 5000) {
    s_cek_iklan_ms = millis();
    if (!ble_gap_adv_active()) {
      Serial.println("[ble] iklan mati padahal tidak tersambung -- dinyalakan ulang");
      iklan_mulai();
    }
  }
}

bool tc_ble_ambil_perintah(tc_perintah_t *out) {
  return s_antrean && xQueueReceive(s_antrean, out, 0) == pdTRUE;
}

bool tc_ble_suntik_perintah(const uint8_t *data, uint8_t panjang) {
  if (!s_antrean) return false;
  tc_perintah_t p;
  if (panjang > TC_MAKS_PERINTAH) panjang = TC_MAKS_PERINTAH;
  p.panjang = panjang;
  memcpy(p.data, data, panjang);
  return xQueueSend(s_antrean, &p, 0) == pdTRUE;
}

bool tc_ble_terhubung(void)       { return s_terhubung; }
bool tc_ble_langganan_live(void)  { return s_terhubung && s_sub_live; }
bool tc_ble_langganan_hasil(void) { return s_terhubung && s_sub_hasil; }

bool tc_ble_ambil_flag_siap(void) {
  bool f = s_flag_siap;
  s_flag_siap = false;
  return f;
}

void tc_ble_set_status(const uint8_t *paket) {
  if (!s_c_status) return;
  s_c_status->setValue((uint8_t *)paket, TC_LEN_STATUS);
  if (s_terhubung) s_c_status->notify();
}

bool tc_ble_kirim_live(const uint8_t *paket) {
  if (!tc_ble_langganan_live()) return false;
  s_c_live->setValue((uint8_t *)paket, TC_LEN_LIVE);
  s_c_live->notify();
  return true;
}

bool tc_ble_kirim_hasil(const uint8_t *paket) {
  if (!tc_ble_langganan_hasil()) return false;
  s_c_hasil->setValue((uint8_t *)paket, TC_LEN_HASIL);
  s_c_hasil->notify();
  Serial.printf("[ble] HASIL id %u terkirim\n", (unsigned)tc_baca_u16(paket));
  return true;
}

const char *tc_ble_nama(void) { return s_nama; }
