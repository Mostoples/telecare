/*
 * TeleCare -- jam tangan pemantau vital, LVGL 8.3
 * Board : Waveshare ESP32-C6-Touch-LCD-1.69 (240x280, ST7789V2 + CST816T)
 *
 * Alur pakai:
 *   - Halaman utama: jam besar + tanggal + ikon baterai.
 *   - Tekan BOOT: sensor PPG menyala, layar pindah ke halaman metrik (detak,
 *     SpO2, glukosa*, tensi*) dan pita di tepi layar menunjukkan kapan data
 *     sudah cukup. Tekan BOOT lagi: stop, hasil disimpan ke flash dan dikirim
 *     ke web lewat BLE (docs/PROTOKOL_BLE.md).
 *   - Web juga bisa memulai/menghentikan pengukuran dan menerima data LIVE.
 *   - PWR: klik = layar on/off, klik ganda = nomor unit, tahan 3 dtk = mati.
 *
 * Modul:
 *   tc_inti   mulai/stop ukur, simpan & kirim hasil, perintah dari web
 *   tc_ble    GATT + iklan (tipis)        tc_store  NVS (hasil, label, kalibrasi)
 *   ppg       MAX30105/30102              battery   ADC + kurva Li-Po
 *   rtc / time_manager  PCF85063 + jam sekarang
 *
 * PERINGATAN: glukosa dan tekanan darah EKSPERIMENTAL (lihat ppg.h), bukan
 * alat medis.
 */

#include <lvgl.h>
#include <Arduino_GFX_Library.h>
#include <Wire.h>
#include "TouchDrv.hpp"
#include "ui_assets.h"
#include "splash_assets.h"

#include "config.h"
#include "rtc.h"
#include "time_manager.h"
#include "battery.h"
#include "ppg.h"
#include "tc_inti.h"
#include "tc_ble.h"
#include "tc_store.h"

/* Typedef yang dipakai sebagai parameter fungsi harus berada di atas: Arduino
 * menyisipkan prototipe otomatis tepat setelah blok #include. */
#define BATT_N_KOTAK 4
typedef struct {
  lv_obj_t *cangkang, *nub, *petir;
  lv_obj_t *kotak[BATT_N_KOTAK];
} batt_widget_t;
typedef struct { lv_obj_t *titik, *teks; } ble_widget_t;

/* Font tema "futuristik" (lv_font_conv, bpp 4). Orbitron & Rajdhani: SIL OFL. */
extern "C" {
LV_FONT_DECLARE(font_ft_jam)         /* Orbitron Medium 46: 0-9 : -   jam utama, nomor unit */
LV_FONT_DECLARE(font_ft_jam_kecil)   /* Orbitron Medium 20: 0-9 :     jam halaman metrik    */
LV_FONT_DECLARE(font_ft_logo)        /* Orbitron Bold 20: huruf TELECARE (splash)           */
LV_FONT_DECLARE(font_ft_nilai)       /* Rajdhani Bold 40: 0-9 - /     angka metrik          */
LV_FONT_DECLARE(font_ft_nilai_kecil) /* Rajdhani Bold 30: 0-9 - /     angka tensi           */
LV_FONT_DECLARE(font_ft_teks)        /* Rajdhani SemiBold 16: ASCII   status, tanggal       */
LV_FONT_DECLARE(font_ft_mini)        /* Rajdhani SemiBold 13: ASCII   label kecil, satuan   */
LV_FONT_DECLARE(font_ft_home_jam)    /* Orbitron Bold 84: 0-9         jam & menit utama     */
LV_FONT_DECLARE(font_ft_home_tanggal)/* Rajdhani Bold 22: A-Z 0-9 , - tanggal halaman utama */
}

/* ---------------- Pin map ---------------- */
#define LCD_SCK    1
#define LCD_DIN    2
#define LCD_DC     3
#define LCD_RST    4
#define LCD_CS     5
#define LCD_BL     6
#define I2C_SCL    7
#define I2C_SDA    8
#define BOOT_KEY   9     /* aktif LOW; strapping pin -- ditahan saat reset = mode download */
#define BAT_EN    15     /* latch baterai: HARUS HIGH paling awal, kalau tidak board mati */
#define PWR_KEY   18     /* aktif LOW */

#define SCREEN_W 240
#define SCREEN_H 280

/* ---------------- Display ---------------- */
Arduino_DataBus *bus = new Arduino_HWSPI(LCD_DC, LCD_CS, LCD_SCK, LCD_DIN);
Arduino_GFX *gfx = new Arduino_ST7789(bus, LCD_RST, 0, true, SCREEN_W, SCREEN_H,
                                      0, 20, 0, 20);
TouchDrvCSTXXX touch;   /* hanya untuk ditidurkan -- UI ini tidak memakai sentuh */

#define BUF_LINES 60
static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;

static void my_disp_flush(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
#if (LV_COLOR_16_SWAP != 0)
  gfx->draw16bitBeRGBBitmap(area->x1, area->y1, (uint16_t *)&color_p->full, w, h);
#else
  gfx->draw16bitRGBBitmap(area->x1, area->y1, (uint16_t *)&color_p->full, w, h);
#endif
  lv_disp_flush_ready(drv);
}

/* ================= Layar hidup / mati ================= */
#define LCD_BL_TERANG         153      /* ~60%, backlight = beban terbesar */
#define LAYAR_MATI_TOMBOL_MS  12000UL  /* dinyalakan pengguna              */
#define LAYAR_AUTO_MATI_MS     6000UL  /* dinyalakan jam sendiri           */

static bool     s_layar_nyala = true;
static bool     s_bl_tunda = false;       /* backlight menyala setelah frame pertama */
static uint32_t layar_mati_pada = 0;      /* 0 = tanpa tenggat */
static bool     pwr_daya_lepas = false;   /* latch dilepas tapi masih hidup = USB */
static bool     s_boot_usb = false;

static bool     s_di_wajah = false;       /* halaman metrik yang tampil */
static uint32_t s_pulang_home_pada = 0;
static bool     s_tidur_setelah_pulang = false;

static void splash_batal(void);

static void layar_set(bool nyala) {
  if (nyala && pwr_daya_lepas) return;
  if (nyala == s_layar_nyala) return;
  s_layar_nyala = nyala;
  layar_mati_pada = 0;
  battery_beban_akan_berubah(nyala);   /* dipakai deteksi "sedang dicolok" */

  if (nyala) {
    gfx->displayOn();
    lv_obj_invalidate(lv_scr_act());   /* RAM panel tidak dijamin selamat dari SLPIN */
    s_bl_tunda = true;
  } else {
    splash_batal();
    ledcWrite(LCD_BL, 0);
    gfx->displayOff();
    s_bl_tunda = false;
  }
  Serial.printf("[pwr] layar %s\n", nyala ? "menyala" : "dimatikan");
}

static void layar_nyala_sementara(uint32_t ms) {
  const bool sudah = s_layar_nyala;
  layar_set(true);
  if (!sudah && s_layar_nyala) layar_mati_pada = millis() + ms;
}

/* ================= Palet (tema minimalis futuristik) =================
 * Latar hitam pekat (hemat daya di LCD, kontras tinggi), satu aksen biru
 * yang senada dengan logo, dan satu warna per metrik. */
#define C_BG        0x000000
#define C_PUTIH     0xE8F6FF
#define C_AKSEN     0x4F8EF7   /* biru: aksen utama, pita kemajuan, mengisi      */
#define C_AKSEN_2   0x3F6FB8   /* aksen redup: teks sekunder berwarna           */
#define C_TANGGAL   0xA9B8C6   /* teks sekunder, angka sementara                */
#define C_REDUP     0x5E6E7C   /* label, satuan                                 */
#define C_GARIS     0x16232C   /* garis rambut, lintasan cincin/bar             */
#define C_KARTU     0x0A1217
#define C_KARTU_BRD C_GARIS
#define C_ISI       C_AKSEN
#define C_TRACK     C_GARIS
#define C_HR        0xFF4D6D
#define C_SP        0x2DD4BF   /* teal, supaya beda dari aksen biru */
#define C_GL        0x9B8CFF
#define C_TD        0xFFB547

/* Halaman utama: dua lingkaran gradasi (teal->biru, ungu->cyan) di atas hitam. */
#define C_LING1_KIRI   0x0FA89A
#define C_LING1_KANAN  0x2450C8
#define C_LING2_KIRI   0x7B5CFF
#define C_LING2_KANAN  0x22B8E8
#define LING2_OPA      LV_OPA_70

/* ================= Geometri ================= */
#define SEL_W      100          /* sel metrik 2x2 */
#define SEL_X1      14
#define SEL_X2     128
#define SEL_Y1      74
#define SEL_Y2     172
#define SEL_BAR_DY  70
#define HDR_GARIS_Y 64

#define BATT_BRD     2
#define BATT_PAD     1
#define BATT_KOTAK_W 6
#define BATT_KOTAK_H 8
#define BATT_CELAH   2
#define BATT_KOTAK_D (BATT_KOTAK_W + BATT_CELAH)
#define BATT_NUB_W   3
#define BATT_NUB_H   7
#define BATT_W  (BATT_N_KOTAK * BATT_KOTAK_W + (BATT_N_KOTAK - 1) * BATT_CELAH \
                 + 2 * BATT_PAD + 2 * BATT_BRD)
#define BATT_H  (BATT_KOTAK_H + 2 * BATT_PAD + 2 * BATT_BRD)
#define BATT_KANAN  226         /* halaman metrik */
#define BATT_Y       13
#define BLE_X        16
#define BLE_Y        12
#define BATT_KANAN_HOME  64     /* halaman utama: baterai kiri atas, BLE kanan atas */
#define BATT_Y_HOME       4
#define BLE_X_HOME      196
#define BLE_Y_HOME        3

#define LING1_CX  102
#define LING1_CY  126
#define LING1_R    98
#define LING2_CX  175
#define LING2_CY  212
#define LING2_R    71

#define HOME_JAM_W     150
#define HOME_JAM_Y      56
#define HOME_MENIT_Y   133
#define HOME_TANGGAL_X  30
#define HOME_TANGGAL_Y 214

/* ================= Widget ================= */
static lv_obj_t *scr_wajah, *scr_home;
static lv_obj_t *lbl_status;
static batt_widget_t batt_wajah, batt_home;
static ble_widget_t ble_wajah, ble_home;
static lv_obj_t *bar_hr, *bar_sp, *bar_gl, *bar_bp;
static lv_obj_t *lbl_jam_kecil;
static lv_obj_t *lbl_hr, *lbl_sp, *lbl_gl, *lbl_bp;
static lv_obj_t *sat_hr, *sat_sp, *sat_gl, *sat_bp;
static lv_obj_t *lbl_home_jam, *lbl_home_menit, *lbl_home_tanggal, *lbl_home_id;
static lv_obj_t *obj_id_overlay, *lbl_id_overlay;

static lv_obj_t *mk_box(lv_obj_t *parent, int x, int y, int w, int h,
                        uint32_t bg, int radius) {
  lv_obj_t *o = lv_obj_create(parent);
  lv_obj_remove_style_all(o);
  lv_obj_set_pos(o, x, y);
  lv_obj_set_size(o, w, h);
  lv_obj_set_style_bg_color(o, lv_color_hex(bg), 0);
  lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(o, radius, 0);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  return o;
}

static lv_obj_t *mk_label(lv_obj_t *parent, const char *txt, const lv_font_t *font,
                          uint32_t color, int x, int y) {
  lv_obj_t *l = lv_label_create(parent);
  lv_label_set_text(l, txt);
  lv_obj_set_style_text_font(l, font, 0);
  lv_obj_set_style_text_color(l, lv_color_hex(color), 0);
  lv_obj_set_pos(l, x, y);
  return l;
}

static lv_obj_t *mk_img(lv_obj_t *parent, const lv_img_dsc_t *src, int x, int y) {
  lv_obj_t *i = lv_img_create(parent);
  lv_img_set_src(i, src);
  lv_obj_set_pos(i, x, y);
  return i;
}

static lv_obj_t *mk_arc(lv_obj_t *parent, int d, int rotasi) {
  lv_obj_t *a = lv_arc_create(parent);
  lv_obj_remove_style(a, NULL, LV_PART_KNOB);   /* penampil, bukan kendali */
  lv_obj_clear_flag(a, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_size(a, d, d);
  lv_arc_set_rotation(a, rotasi);
  lv_arc_set_bg_angles(a, 0, 360);
  lv_arc_set_range(a, 0, 1000);
  lv_arc_set_value(a, 0);
  return a;
}

/* Satuan disejajarkan pada garis dasar angkanya (dari metrik font). */
static void satuan_sejajar(lv_obj_t *satuan, lv_obj_t *nilai, const lv_font_t *fn) {
  if (!satuan) return;
  int dy = (int)(fn->line_height - fn->base_line)
         - (int)(font_ft_mini.line_height - font_ft_mini.base_line);
  lv_obj_align_to(satuan, nilai, LV_ALIGN_OUT_RIGHT_TOP, 4, dy);
}

/* Bar tipis di bawah angka: posisi nilai dalam rentang gambar (bukan ambang medis). */
static lv_obj_t *mk_bar(lv_obj_t *parent, int x, int y, uint32_t warna) {
  lv_obj_t *b = lv_bar_create(parent);
  lv_obj_remove_style_all(b);
  lv_obj_set_pos(b, x, y);
  lv_obj_set_size(b, SEL_W - 4, 3);
  lv_bar_set_range(b, 0, 1000);
  lv_obj_set_style_bg_color(b, lv_color_hex(C_GARIS), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_radius(b, 2, LV_PART_MAIN);
  lv_obj_set_style_bg_color(b, lv_color_hex(warna), LV_PART_INDICATOR);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_PART_INDICATOR);
  lv_obj_set_style_radius(b, 2, LV_PART_INDICATOR);
  return b;
}

/* Satu sel metrik: titik warna + label, angka besar + satuan, bar rentang. */
static void mk_sel(lv_obj_t *parent, int x, int y, uint32_t warna, const char *judul,
                   const char *satuan, const lv_font_t *font_nilai,
                   lv_obj_t **out_nilai, lv_obj_t **out_satuan, lv_obj_t **out_bar) {
  mk_box(parent, x + 1, y + 5, 6, 6, warna, LV_RADIUS_CIRCLE);
  lv_obj_t *j = mk_label(parent, judul, &font_ft_mini, C_REDUP, x + 13, y);
  lv_obj_set_style_text_letter_space(j, 1, 0);
  int dy = font_nilai == &font_ft_nilai ? 24 : 30;   /* angka tensi lebih kecil: turunkan */
  *out_nilai = mk_label(parent, "--", font_nilai, C_PUTIH, x, y + dy);
  *out_satuan = mk_label(parent, satuan, &font_ft_mini, C_REDUP, 0, 0);
  satuan_sejajar(*out_satuan, *out_nilai, font_nilai);
  *out_bar = mk_bar(parent, x, y + SEL_BAR_DY, warna);
}

/* Indikator BLE: titik + "BLE", teal saat web tersambung. */
static void ble_buat(lv_obj_t *parent, ble_widget_t *w, int x, int y) {
  w->titik = mk_box(parent, x, y + 5, 6, 6, C_REDUP, LV_RADIUS_CIRCLE);
  w->teks  = mk_label(parent, "BLE", &font_ft_mini, C_REDUP, x + 10, y);
  lv_obj_set_style_text_letter_space(w->teks, 1, 0);
}

static void ble_gambar(ble_widget_t *w, bool on) {
  uint32_t c = on ? C_AKSEN : C_REDUP;
  lv_obj_set_style_bg_color(w->titik, lv_color_hex(c), 0);
  lv_obj_set_style_text_color(w->teks, lv_color_hex(c), 0);
}

static lv_obj_t *mk_garis(lv_obj_t *parent, int x, int y, int w, int h) {
  return mk_box(parent, x, y, w, h, C_GARIS, 0);
}

/* ================= Pita kemajuan di tepi layar =================
 * Garis hijau merayap searah jarum jam dari tengah atas selama mengukur;
 * penuh = data sudah cukup, boleh di-stop. Sembilan potong (5 lurus + 4 sudut
 * lv_arc) dua lapis (halo + garis) -- canvas seukuran layar tidak muat di heap. */
#define TEPI_INSET  4
#define TEPI_R     24
#define TEPI_LEBAR  3
#define TEPI_HALO   9
#define TEPI_BUSUR 38    /* (pi/2) * 24 */

typedef enum { TP_DATAR, TP_TEGAK, TP_SUDUT } tepi_jenis_t;
typedef struct { tepi_jenis_t jenis; int panjang, p1, p2, p3; } tepi_potong_t;

#define TEPI_X0  TEPI_INSET
#define TEPI_X1  (SCREEN_W - TEPI_INSET)
#define TEPI_Y0  TEPI_INSET
#define TEPI_Y1  (SCREEN_H - TEPI_INSET)
#define TEPI_XK  (TEPI_X0 + TEPI_R)
#define TEPI_XN  (TEPI_X1 - TEPI_R)
#define TEPI_YA  (TEPI_Y0 + TEPI_R)
#define TEPI_YB  (TEPI_Y1 - TEPI_R)
#define TEPI_XT  (SCREEN_W / 2)

/* DATAR: p1=y, p2=x mulai, p3=arah. TEGAK: p1=x, p2=y mulai, p3=arah.
 * SUDUT: p1=cx, p2=cy, p3=sudut mulai. */
static const tepi_potong_t TEPI[9] = {
  { TP_DATAR, TEPI_XN - TEPI_XT, TEPI_Y0, TEPI_XT, +1 },
  { TP_SUDUT, TEPI_BUSUR,        TEPI_XN, TEPI_YA, 270 },
  { TP_TEGAK, TEPI_YB - TEPI_YA, TEPI_X1, TEPI_YA, +1 },
  { TP_SUDUT, TEPI_BUSUR,        TEPI_XN, TEPI_YB,   0 },
  { TP_DATAR, TEPI_XN - TEPI_XK, TEPI_Y1, TEPI_XN, -1 },
  { TP_SUDUT, TEPI_BUSUR,        TEPI_XK, TEPI_YB,  90 },
  { TP_TEGAK, TEPI_YB - TEPI_YA, TEPI_X0, TEPI_YB, -1 },
  { TP_SUDUT, TEPI_BUSUR,        TEPI_XK, TEPI_YA, 180 },
  { TP_DATAR, TEPI_XT - TEPI_XK, TEPI_Y0, TEPI_XK, +1 },
};
static lv_obj_t *tepi_obj[2][9];
static const int TEPI_TEBAL[2] = { TEPI_HALO, TEPI_LEBAR };

static void build_tepi(lv_obj_t *scr) {
  static const lv_opa_t OPA[2] = { LV_OPA_30, LV_OPA_COVER };
  for (int lap = 0; lap < 2; lap++) {
    for (int i = 0; i < 9; i++) {
      lv_obj_t *o;
      if (TEPI[i].jenis == TP_SUDUT) {
        o = mk_arc(scr, TEPI_R * 2 + TEPI_TEBAL[lap], 0);
        lv_arc_set_bg_angles(o, TEPI[i].p3, TEPI[i].p3 + 90);
        lv_obj_set_style_arc_opa(o, LV_OPA_TRANSP, LV_PART_MAIN);
        lv_obj_set_style_arc_width(o, TEPI_TEBAL[lap], LV_PART_INDICATOR);
        lv_obj_set_style_arc_color(o, lv_color_hex(C_ISI), LV_PART_INDICATOR);
        lv_obj_set_style_arc_opa(o, OPA[lap], LV_PART_INDICATOR);
        lv_obj_set_style_arc_rounded(o, true, LV_PART_INDICATOR);
      } else {
        o = mk_box(scr, 0, 0, 1, 1, C_ISI, TEPI_TEBAL[lap] / 2);
        lv_obj_set_style_bg_opa(o, OPA[lap], 0);
      }
      lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
      tepi_obj[lap][i] = o;
    }
  }
}

static void tepi_potong_gambar(lv_obj_t *o, int i, int panjang, int lebar) {
  const tepi_potong_t *t = &TEPI[i];
  if (panjang <= 0) { lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); return; }
  lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN);
  if (t->jenis == TP_DATAR) {
    lv_obj_set_pos(o, t->p3 > 0 ? t->p2 : t->p2 - panjang, t->p1 - lebar / 2);
    lv_obj_set_size(o, panjang, lebar);
  } else if (t->jenis == TP_TEGAK) {
    lv_obj_set_pos(o, t->p1 - lebar / 2, t->p3 > 0 ? t->p2 : t->p2 - panjang);
    lv_obj_set_size(o, lebar, panjang);
  } else {
    int d = TEPI_R * 2 + lebar;
    lv_obj_set_pos(o, t->p1 - d / 2, t->p2 - d / 2);
    lv_arc_set_value(o, (int32_t)((long)panjang * 1000 / t->panjang));
  }
}

static void tepi_set(int persen) {
  static int lalu = -1;
  if (persen == lalu) return;
  lalu = persen;
  int total = 0;
  for (int i = 0; i < 9; i++) total += TEPI[i].panjang;
  for (int lap = 0; lap < 2; lap++) {
    long sisa = (long)total * persen / 100;
    for (int i = 0; i < 9; i++) {
      int p = sisa >= TEPI[i].panjang ? TEPI[i].panjang : (sisa > 0 ? (int)sisa : 0);
      sisa -= p;
      tepi_potong_gambar(tepi_obj[lap][i], i, p, TEPI_TEBAL[lap]);
    }
  }
}

/* ================= Bar metrik =================
 * Rentang di bawah SEMATA untuk menggambar, bukan ambang medis. Metrik yang
 * belum ada angkanya = bar kosong. */
#define HR_MIN   40.0f
#define HR_MAKS 180.0f
#define SP_MIN   85.0f
#define SP_MAKS 100.0f
#define GL_MIN   70.0f
#define GL_MAKS 200.0f
#define TD_MIN   80.0f
#define TD_MAKS 180.0f

static void bar_set(lv_obj_t *b, bool sah, float v, float lo, float hi) {
  int nilai = 0;
  if (sah && v > 0) {
    float f = (v - lo) / (hi - lo);
    f = f < 0.03f ? 0.03f : (f > 1 ? 1 : f);   /* ada angka = bar tidak pernah nol */
    nilai = (int)(f * 1000.0f + 0.5f);
  }
  if (lv_bar_get_value(b) != nilai) lv_bar_set_value(b, nilai, LV_ANIM_OFF);
}

/* Cincin tipis berjari-jari garis tengah r (lebar arc LVGL digambar ke dalam
 * dari tepi objek, jadi ukuran objek menyesuaikan lebarnya). */
static lv_obj_t *mk_cincin_tipis(lv_obj_t *scr, int cx, int cy, int r, int lebar,
                                 uint32_t warna, lv_opa_t opa, bool lintasan) {
  int d = 2 * r + lebar;
  lv_obj_t *a = mk_arc(scr, d, 270);
  lv_obj_set_pos(a, cx - d / 2, cy - d / 2);
  lv_obj_set_style_arc_width(a, lebar, LV_PART_MAIN);
  lv_obj_set_style_arc_width(a, lebar, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(a, lv_color_hex(C_GARIS), LV_PART_MAIN);
  lv_obj_set_style_arc_opa(a, lintasan ? LV_OPA_COVER : LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_arc_color(a, lv_color_hex(warna), LV_PART_INDICATOR);
  lv_obj_set_style_arc_opa(a, opa, LV_PART_INDICATOR);
  lv_obj_set_style_arc_rounded(a, true, LV_PART_INDICATOR);
  return a;
}

/* ================= Ikon baterai (4 kotak, tanpa angka persen) =================
 * Persen dari tegangan Li-Po cuma akurat +-5..10%, jadi yang ditampilkan kotak.
 * Ambang naik/turun dipisah (histeresis) supaya kotak tidak berkedip. */
static const int BATT_TURUN[BATT_N_KOTAK] = { 20, 45, 70, 95 };
static const int BATT_NAIK [BATT_N_KOTAK] = { 25, 50, 75, 100 };

static int batt_hitung_kotak(int persen, int lalu) {
  if (lalu < 0) {
    int n = 0;
    while (n < BATT_N_KOTAK && persen >= (BATT_TURUN[n] + BATT_NAIK[n]) / 2) n++;
    return n;
  }
  int n = lalu;
  while (n < BATT_N_KOTAK && persen >= BATT_NAIK[n]) n++;
  while (n > 0 && persen < BATT_TURUN[n - 1]) n--;
  return n;
}

static void batt_gambar(batt_widget_t *w, int kotak, bool mengisi) {
  uint32_t warna = mengisi ? C_ISI : (kotak == 0 ? C_HR : C_TANGGAL);
  lv_obj_set_style_border_color(w->cangkang, lv_color_hex(warna), 0);
  lv_obj_set_style_bg_color(w->nub, lv_color_hex(warna), 0);
  for (int i = 0; i < BATT_N_KOTAK; i++) {
    if (i < kotak) {
      lv_obj_set_style_bg_color(w->kotak[i], lv_color_hex(warna), 0);
      lv_obj_clear_flag(w->kotak[i], LV_OBJ_FLAG_HIDDEN);
    } else {
      lv_obj_add_flag(w->kotak[i], LV_OBJ_FLAG_HIDDEN);
    }
  }
  if (mengisi) lv_obj_clear_flag(w->petir, LV_OBJ_FLAG_HIDDEN);
  else         lv_obj_add_flag(w->petir, LV_OBJ_FLAG_HIDDEN);
}

static void batt_buat(lv_obj_t *parent, batt_widget_t *w, int kanan, int y) {
  int bx = kanan - BATT_NUB_W - BATT_W;
  w->cangkang = lv_obj_create(parent);
  lv_obj_remove_style_all(w->cangkang);
  lv_obj_set_pos(w->cangkang, bx, y);
  lv_obj_set_size(w->cangkang, BATT_W, BATT_H);
  lv_obj_set_style_bg_opa(w->cangkang, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(w->cangkang, BATT_BRD, 0);
  lv_obj_set_style_border_color(w->cangkang, lv_color_hex(C_REDUP), 0);
  lv_obj_set_style_border_opa(w->cangkang, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(w->cangkang, 3, 0);
  lv_obj_clear_flag(w->cangkang, LV_OBJ_FLAG_SCROLLABLE);

  w->nub = mk_box(parent, bx + BATT_W, y + (BATT_H - BATT_NUB_H) / 2,
                  BATT_NUB_W, BATT_NUB_H, C_REDUP, 1);
  for (int i = 0; i < BATT_N_KOTAK; i++)
    w->kotak[i] = mk_box(parent, bx + BATT_BRD + BATT_PAD + i * BATT_KOTAK_D,
                         y + BATT_BRD + BATT_PAD, BATT_KOTAK_W, BATT_KOTAK_H, C_REDUP, 1);

  w->petir = mk_label(parent, LV_SYMBOL_CHARGE, &lv_font_montserrat_12, C_ISI, 0, 0);
  lv_obj_update_layout(parent);
  lv_obj_align_to(w->petir, w->cangkang, LV_ALIGN_OUT_LEFT_MID, -3, 0);
  batt_gambar(w, 0, false);
}

/* ================= Halaman metrik =================
 * Baris atas: BLE | jam kecil | baterai. Di bawahnya baris status, lalu grid
 * 2x2 tanpa kartu -- dipisah garis rambut -- dengan bar rentang per metrik. */
static void build_wajah(void) {
  scr_wajah = lv_obj_create(NULL);
  lv_obj_remove_style_all(scr_wajah);
  lv_obj_clear_flag(scr_wajah, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr_wajah, lv_color_hex(C_BG), 0);
  lv_obj_set_style_bg_opa(scr_wajah, LV_OPA_COVER, 0);

  ble_buat(scr_wajah, &ble_wajah, BLE_X, BLE_Y);
  batt_buat(scr_wajah, &batt_wajah, BATT_KANAN, BATT_Y);
  lbl_jam_kecil = mk_label(scr_wajah, "--:--", &font_ft_jam_kecil, C_PUTIH, 0, 0);
  lv_obj_set_width(lbl_jam_kecil, SCREEN_W);
  lv_obj_set_style_text_align(lbl_jam_kecil, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_y(lbl_jam_kecil, 14);

  lbl_status = mk_label(scr_wajah, "--", &font_ft_teks, C_TANGGAL, 0, 38);
  lv_obj_set_width(lbl_status, SCREEN_W);
  lv_obj_set_style_text_align(lbl_status, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_letter_space(lbl_status, 1, 0);

  mk_garis(scr_wajah, 20, HDR_GARIS_Y, SCREEN_W - 40, 1);
  mk_garis(scr_wajah, SCREEN_W / 2, SEL_Y1, 1, SEL_Y2 + SEL_BAR_DY - SEL_Y1 + 3);
  mk_garis(scr_wajah, 20, (SEL_Y1 + SEL_BAR_DY + SEL_Y2) / 2 + 1, SCREEN_W - 40, 1);

  mk_sel(scr_wajah, SEL_X1, SEL_Y1, C_HR, "DETAK",   "BPM",   &font_ft_nilai,
         &lbl_hr, &sat_hr, &bar_hr);
  mk_sel(scr_wajah, SEL_X2, SEL_Y1, C_SP, "SPO2",    "%",     &font_ft_nilai,
         &lbl_sp, &sat_sp, &bar_sp);
  mk_sel(scr_wajah, SEL_X1, SEL_Y2, C_GL, "GLUKOSA", "mg/dL", &font_ft_nilai,
         &lbl_gl, &sat_gl, &bar_gl);
  mk_sel(scr_wajah, SEL_X2, SEL_Y2, C_TD, "TENSI mmHg", "",   &font_ft_nilai_kecil,
         &lbl_bp, &sat_bp, &bar_bp);

  build_tepi(scr_wajah);   /* paling akhir: di atas segalanya */
}

/* ================= Halaman utama =================
 * Tata letak jam tangan klasik: jam & menit besar bertumpuk di atas dua
 * lingkaran gradasi yang saling menumpuk, tanggal di bawah. */
static lv_obj_t *mk_lingkaran(lv_obj_t *scr, int cx, int cy, int r,
                              uint32_t kiri, uint32_t kanan, lv_opa_t opa) {
  lv_obj_t *o = lv_obj_create(scr);
  lv_obj_remove_style_all(o);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(o, cx - r, cy - r);
  lv_obj_set_size(o, r * 2, r * 2);
  lv_obj_set_style_radius(o, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_color(o, lv_color_hex(kiri), 0);
  lv_obj_set_style_bg_grad_color(o, lv_color_hex(kanan), 0);
  lv_obj_set_style_bg_grad_dir(o, LV_GRAD_DIR_HOR, 0);
  lv_obj_set_style_bg_opa(o, opa, 0);
  return o;
}

static void build_home(void) {
  scr_home = lv_obj_create(NULL);
  lv_obj_remove_style_all(scr_home);
  lv_obj_clear_flag(scr_home, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr_home, lv_color_hex(C_BG), 0);
  lv_obj_set_style_bg_opa(scr_home, LV_OPA_COVER, 0);

  batt_buat(scr_home, &batt_home, BATT_KANAN_HOME, BATT_Y_HOME);
  ble_buat(scr_home, &ble_home, BLE_X_HOME, BLE_Y_HOME);

  /* Badge nomor unit tengah atas, tampil 5 detik setelah menyala. */
  lbl_home_id = mk_label(scr_home, "", &font_ft_mini, C_AKSEN, 0, BLE_Y_HOME);
  lv_obj_set_width(lbl_home_id, SCREEN_W);
  lv_obj_set_style_text_align(lbl_home_id, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_letter_space(lbl_home_id, 2, 0);
  lv_obj_add_flag(lbl_home_id, LV_OBJ_FLAG_HIDDEN);

  mk_lingkaran(scr_home, LING1_CX, LING1_CY, LING1_R, C_LING1_KIRI, C_LING1_KANAN, LV_OPA_COVER);
  mk_lingkaran(scr_home, LING2_CX, LING2_CY, LING2_R, C_LING2_KIRI, C_LING2_KANAN, LING2_OPA);

  /* Lebar digit Orbitron tidak sama ("1" sempit), jadi dirata-tengah di
   * lingkaran besar, bukan rata kiri. */
  lbl_home_jam   = mk_label(scr_home, "00", &font_ft_home_jam, C_PUTIH,
                            LING1_CX - HOME_JAM_W / 2, HOME_JAM_Y);
  lbl_home_menit = mk_label(scr_home, "00", &font_ft_home_jam, C_PUTIH,
                            LING1_CX - HOME_JAM_W / 2, HOME_MENIT_Y);
  lv_obj_set_width(lbl_home_jam, HOME_JAM_W);
  lv_obj_set_width(lbl_home_menit, HOME_JAM_W);
  lv_obj_set_style_text_align(lbl_home_jam, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_align(lbl_home_menit, LV_TEXT_ALIGN_CENTER, 0);

  lbl_home_tanggal = mk_label(scr_home, "--", &font_ft_home_tanggal, C_PUTIH,
                              HOME_TANGGAL_X, HOME_TANGGAL_Y);
  lv_obj_set_style_text_letter_space(lbl_home_tanggal, 1, 0);
}

/* Badge nomor unit tampil 5 detik sekali per nyala (setelah NVS dimuat). */
static void id_badge_tutup_cb(lv_timer_t *t) {
  lv_timer_del(t);
  lv_obj_add_flag(lbl_home_id, LV_OBJ_FLAG_HIDDEN);
}

static void id_badge_tampilkan(void) {
  uint8_t label = tc_label_get();
  if (!label) return;
  lv_label_set_text_fmt(lbl_home_id, "UNIT %02u", (unsigned)label);
  lv_obj_clear_flag(lbl_home_id, LV_OBJ_FLAG_HIDDEN);
  lv_timer_t *t = lv_timer_create(id_badge_tutup_cb, 5000, NULL);
  lv_timer_set_repeat_count(t, 1);
}

/* ================= Splash ================= */
#define SPL_BG      0x090A10   /* HARUS sama dengan latar yang dipanggang di bitmap */
#define SPL_CX      120
#define SPL_CY      109
#define SPL_R       72
#define SPL_ARC_W   3
#define SPL_C_ARC   C_AKSEN    /* senada logo (spl_mark digeser ke biru) */
#define SPL_C_SUB   C_AKSEN_2
#define SPL_R_LUAR  84         /* lintasan luar + segmen "pemindai" yang berputar */
#define SPL_KATA_Y  197
#define SPL_KATA_DY 8
#define SPL_SUB_Y   228

#define SPL_ARC_MS     880
#define SPL_MARK_TUNDA 270
#define SPL_MARK_MS    550
#define SPL_KATA_TUNDA 790
#define SPL_KATA_MS    520
#define SPL_SUB_TUNDA  1130
#define SPL_SUB_MS     450
#define SPL_TOTAL_MS   1760
#define SPL_REFR_MS    16     /* refresh & animasi dipercepat selama splash saja */

static lv_obj_t *scr_splash, *spl_busur, *spl_pindai, *spl_o_mark, *spl_o_kata, *spl_o_sub;
static lv_timer_t *spl_timer = NULL;
static bool s_splash_tampil = false;

static void spl_periode(uint32_t ms) {
  lv_timer_set_period(lv_disp_get_default()->refr_timer, ms);
  lv_timer_set_period(lv_anim_get_timer(), ms);
}

static void spl_exec_busur(void *o, int32_t v) { lv_arc_set_value((lv_obj_t *)o, v); }
static void spl_exec_gbr(void *o, int32_t v)   { lv_obj_set_style_img_opa((lv_obj_t *)o, (lv_opa_t)v, 0); }
static void spl_exec_teks(void *o, int32_t v)  { lv_obj_set_style_text_opa((lv_obj_t *)o, (lv_opa_t)v, 0); }
static void spl_exec_y(void *o, int32_t v)     { lv_obj_set_y((lv_obj_t *)o, v); }
static void spl_exec_putar(void *o, int32_t v) { lv_arc_set_rotation((lv_obj_t *)o, (uint16_t)(v % 360)); }

static void spl_anim(lv_obj_t *o, lv_anim_exec_xcb_t cb, int32_t dari, int32_t ke,
                     uint32_t tunda, uint32_t lama, lv_anim_path_cb_t jalur) {
  lv_anim_t a;
  lv_anim_init(&a);
  lv_anim_set_var(&a, o);
  lv_anim_set_exec_cb(&a, cb);
  lv_anim_set_values(&a, dari, ke);
  lv_anim_set_delay(&a, tunda);
  lv_anim_set_time(&a, lama);
  lv_anim_set_path_cb(&a, jalur);
  lv_anim_start(&a);
}

static void build_splash(void) {
  scr_splash = lv_obj_create(NULL);
  lv_obj_remove_style_all(scr_splash);
  lv_obj_clear_flag(scr_splash, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr_splash, lv_color_hex(SPL_BG), 0);
  lv_obj_set_style_bg_opa(scr_splash, LV_OPA_COVER, 0);

  mk_cincin_tipis(scr_splash, SPL_CX, SPL_CY, SPL_R_LUAR, 1, C_GARIS, LV_OPA_TRANSP, true);
  spl_pindai = mk_cincin_tipis(scr_splash, SPL_CX, SPL_CY, SPL_R_LUAR, 2, SPL_C_ARC,
                               LV_OPA_COVER, false);
  lv_arc_set_bg_angles(spl_pindai, 0, 50);
  lv_arc_set_angles(spl_pindai, 0, 50);

  spl_busur = mk_arc(scr_splash, SPL_R * 2 + 1, 270);
  lv_obj_set_pos(spl_busur, SPL_CX - SPL_R, SPL_CY - SPL_R);
  lv_obj_set_style_arc_opa(spl_busur, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_arc_width(spl_busur, SPL_ARC_W, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(spl_busur, lv_color_hex(SPL_C_ARC), LV_PART_INDICATOR);
  lv_obj_set_style_arc_rounded(spl_busur, true, LV_PART_INDICATOR);

  spl_o_mark = mk_img(scr_splash, &spl_mark, SPL_CX - spl_mark.header.w / 2,
                      SPL_CY - spl_mark.header.h / 2);
  spl_o_kata = mk_label(scr_splash, "TELECARE", &font_ft_logo, C_PUTIH, 0, SPL_KATA_Y);
  lv_obj_set_width(spl_o_kata, SCREEN_W);
  lv_obj_set_style_text_align(spl_o_kata, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_letter_space(spl_o_kata, 5, 0);
  spl_o_sub = mk_label(scr_splash, "VITAL HEALTH MONITORING", &font_ft_mini,
                       SPL_C_SUB, 0, 0);
  lv_obj_set_style_text_letter_space(spl_o_sub, 2, 0);
  lv_obj_align(spl_o_sub, LV_ALIGN_TOP_MID, 0, SPL_SUB_Y);
}

static void splash_tutup(void) {
  lv_anim_del(spl_busur, NULL);
  lv_anim_del(spl_pindai, NULL);
  lv_anim_del(spl_o_mark, NULL);
  lv_anim_del(spl_o_kata, NULL);
  lv_anim_del(spl_o_sub, NULL);
  spl_periode(LV_DISP_DEF_REFR_PERIOD);
  s_di_wajah = false;
  lv_scr_load(scr_home);
  s_splash_tampil = false;
}

static void splash_selesai_cb(lv_timer_t *t) {
  LV_UNUSED(t);
  spl_timer = NULL;   /* repeat_count 1: LVGL menghapus timernya sendiri */
  splash_tutup();
}

static void splash_mulai(void) {
  if (s_splash_tampil) return;
  s_splash_tampil = true;
  lv_arc_set_value(spl_busur, 0);
  lv_obj_set_style_img_opa(spl_o_mark, LV_OPA_TRANSP, 0);
  lv_obj_set_style_text_opa(spl_o_kata, LV_OPA_TRANSP, 0);
  lv_obj_set_style_text_opa(spl_o_sub, LV_OPA_TRANSP, 0);
  lv_obj_set_y(spl_o_kata, SPL_KATA_Y + SPL_KATA_DY);
  lv_scr_load(scr_splash);

  spl_anim(spl_busur, spl_exec_busur, 0, 1000, 0, SPL_ARC_MS, lv_anim_path_ease_out);
  spl_anim(spl_pindai, spl_exec_putar, 270, 270 + 720, 0, SPL_TOTAL_MS,
           lv_anim_path_ease_in_out);
  spl_anim(spl_o_mark, spl_exec_gbr, LV_OPA_TRANSP, LV_OPA_COVER,
           SPL_MARK_TUNDA, SPL_MARK_MS, lv_anim_path_ease_out);
  spl_anim(spl_o_kata, spl_exec_teks, LV_OPA_TRANSP, LV_OPA_COVER,
           SPL_KATA_TUNDA, SPL_KATA_MS, lv_anim_path_linear);
  spl_anim(spl_o_kata, spl_exec_y, SPL_KATA_Y + SPL_KATA_DY, SPL_KATA_Y,
           SPL_KATA_TUNDA, SPL_KATA_MS, lv_anim_path_ease_out);
  spl_anim(spl_o_sub, spl_exec_teks, LV_OPA_TRANSP, LV_OPA_COVER,
           SPL_SUB_TUNDA, SPL_SUB_MS, lv_anim_path_linear);

  spl_timer = lv_timer_create(splash_selesai_cb, SPL_TOTAL_MS, NULL);
  lv_timer_set_repeat_count(spl_timer, 1);
  spl_periode(SPL_REFR_MS);
}

static void splash_batal(void) {
  if (!s_splash_tampil) return;
  if (spl_timer) { lv_timer_del(spl_timer); spl_timer = NULL; }
  splash_tutup();
}

/* Hanya saat boot: putar splash sampai habis sebelum BLE menyita CPU. */
static void splash_tunggu(void) {
  uint32_t batas = millis() + SPL_TOTAL_MS + 500;
  while (s_splash_tampil && (int32_t)(millis() - batas) < 0) {
    lv_timer_handler();
    delay(1);
  }
  if (s_splash_tampil) splash_batal();
}

/* ================= Toast "MENGISI DAYA" ================= */
#define CAS_TOAST_MS       3000
#define CAS_TOAST_FADE_MS   250
#define CAS_TOAST_ISI_MS    900
#define CAS_TOAST_KEDIP_MS  500
#define CAS_TOAST_D         110
#define CAS_TOAST_W           8

static lv_obj_t *cas_toast, *cas_toast_cincin, *cas_toast_petir;
static lv_timer_t *cas_toast_timer = NULL;

static void cas_opa_cb(void *o, int32_t v) { lv_obj_set_style_opa((lv_obj_t *)o, (lv_opa_t)v, 0); }
static void cas_isi_cb(void *o, int32_t v) { lv_arc_set_value((lv_obj_t *)o, v); }
static void cas_sembunyi_cb(lv_anim_t *a) { (void)a; lv_obj_add_flag(cas_toast, LV_OBJ_FLAG_HIDDEN); }

static void cas_toast_tutup_cb(lv_timer_t *t) {
  lv_timer_del(t);
  cas_toast_timer = NULL;
  lv_anim_del(cas_toast_petir, NULL);
  lv_anim_del(cas_toast_cincin, NULL);
  lv_anim_t a;
  lv_anim_init(&a);
  lv_anim_set_var(&a, cas_toast);
  lv_anim_set_exec_cb(&a, cas_opa_cb);
  lv_anim_set_values(&a, LV_OPA_COVER, LV_OPA_TRANSP);
  lv_anim_set_time(&a, CAS_TOAST_FADE_MS);
  lv_anim_set_ready_cb(&a, cas_sembunyi_cb);
  lv_anim_start(&a);
}

static void cas_toast_bangun(void) {
  cas_toast = lv_obj_create(lv_layer_top());
  lv_obj_remove_style_all(cas_toast);
  lv_obj_clear_flag(cas_toast, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(cas_toast, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_size(cas_toast, CAS_TOAST_D, CAS_TOAST_D);
  lv_obj_align(cas_toast, LV_ALIGN_CENTER, 0, 0);

  lv_obj_t *latar = mk_box(cas_toast, 0, 0, CAS_TOAST_D, CAS_TOAST_D, C_KARTU, LV_RADIUS_CIRCLE);
  lv_obj_set_style_border_width(latar, 1, 0);
  lv_obj_set_style_border_color(latar, lv_color_hex(C_KARTU_BRD), 0);
  lv_obj_set_style_border_opa(latar, LV_OPA_COVER, 0);

  cas_toast_cincin = mk_arc(cas_toast, CAS_TOAST_D, 270);
  lv_arc_set_range(cas_toast_cincin, 0, 100);
  lv_obj_set_style_arc_width(cas_toast_cincin, CAS_TOAST_W, LV_PART_MAIN);
  lv_obj_set_style_arc_width(cas_toast_cincin, CAS_TOAST_W, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(cas_toast_cincin, lv_color_hex(C_TRACK), LV_PART_MAIN);
  lv_obj_set_style_arc_color(cas_toast_cincin, lv_color_hex(C_ISI), LV_PART_INDICATOR);
  lv_obj_set_style_arc_rounded(cas_toast_cincin, true, LV_PART_MAIN);
  lv_obj_set_style_arc_rounded(cas_toast_cincin, true, LV_PART_INDICATOR);

  cas_toast_petir = mk_label(cas_toast, LV_SYMBOL_CHARGE, &lv_font_montserrat_12, C_ISI, 0, 0);
  lv_obj_align(cas_toast_petir, LV_ALIGN_CENTER, 0, -14);
  lv_obj_t *teks = mk_label(cas_toast, "MENGISI DAYA", &font_ft_mini, C_PUTIH, 0, 0);
  lv_obj_set_style_text_letter_space(teks, 1, 0);
  lv_obj_align(teks, LV_ALIGN_CENTER, 0, 8);

  lv_obj_add_flag(cas_toast, LV_OBJ_FLAG_HIDDEN);
}

static void cas_toast_tampilkan(void) {
  if (cas_toast_timer) { lv_timer_del(cas_toast_timer); cas_toast_timer = NULL; }
  lv_anim_del(cas_toast, NULL);
  lv_anim_del(cas_toast_petir, NULL);
  lv_anim_del(cas_toast_cincin, NULL);
  lv_obj_set_style_opa(cas_toast, LV_OPA_COVER, 0);
  lv_obj_clear_flag(cas_toast, LV_OBJ_FLAG_HIDDEN);
  lv_obj_move_foreground(cas_toast);
  lv_arc_set_value(cas_toast_cincin, 0);

  lv_anim_t isi;
  lv_anim_init(&isi);
  lv_anim_set_var(&isi, cas_toast_cincin);
  lv_anim_set_exec_cb(&isi, cas_isi_cb);
  lv_anim_set_values(&isi, 0, battery_percent());
  lv_anim_set_time(&isi, CAS_TOAST_ISI_MS);
  lv_anim_set_path_cb(&isi, lv_anim_path_ease_out);
  lv_anim_start(&isi);

  lv_anim_t kedip;
  lv_anim_init(&kedip);
  lv_anim_set_var(&kedip, cas_toast_petir);
  lv_anim_set_exec_cb(&kedip, cas_opa_cb);
  lv_anim_set_values(&kedip, LV_OPA_30, LV_OPA_COVER);
  lv_anim_set_time(&kedip, CAS_TOAST_KEDIP_MS);
  lv_anim_set_playback_time(&kedip, CAS_TOAST_KEDIP_MS);
  lv_anim_set_repeat_count(&kedip, LV_ANIM_REPEAT_INFINITE);
  lv_anim_start(&kedip);

  cas_toast_timer = lv_timer_create(cas_toast_tutup_cb, CAS_TOAST_MS, NULL);
  lv_timer_set_repeat_count(cas_toast_timer, 1);
}

/* ================= Halaman nomor unit (klik ganda PWR) ================= */
#define ID_OVERLAY_MS 3000
static lv_timer_t *id_overlay_timer = NULL;

static void id_overlay_tutup_cb(lv_timer_t *t) {
  lv_timer_del(t);
  id_overlay_timer = NULL;
  lv_obj_add_flag(obj_id_overlay, LV_OBJ_FLAG_HIDDEN);
}

static void id_overlay_bangun(void) {
  obj_id_overlay = mk_box(lv_layer_top(), 0, 0, SCREEN_W, SCREEN_H, C_BG, 0);
  lv_obj_clear_flag(obj_id_overlay, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_t *cincin = mk_cincin_tipis(obj_id_overlay, SCREEN_W / 2, SCREEN_H / 2, 70, 2,
                                     C_AKSEN, LV_OPA_COVER, false);
  lv_arc_set_value(cincin, 1000);
  lv_obj_t *judul = mk_label(obj_id_overlay, "UNIT", &font_ft_teks, C_AKSEN, 0, 0);
  lv_obj_set_style_text_letter_space(judul, 3, 0);
  lv_obj_align(judul, LV_ALIGN_CENTER, 0, -36);
  lbl_id_overlay = mk_label(obj_id_overlay, "--", &font_ft_jam, C_PUTIH, 0, 0);
  lv_obj_align(lbl_id_overlay, LV_ALIGN_CENTER, 0, 0);
  lv_obj_add_flag(obj_id_overlay, LV_OBJ_FLAG_HIDDEN);
}

static void id_overlay_tampilkan(void) {
  if (id_overlay_timer) { lv_timer_del(id_overlay_timer); id_overlay_timer = NULL; }
  uint8_t label = tc_label_get();
  if (label) lv_label_set_text_fmt(lbl_id_overlay, "%02u", (unsigned)label);
  else       lv_label_set_text(lbl_id_overlay, "--");
  lv_obj_align(lbl_id_overlay, LV_ALIGN_CENTER, 0, 0);
  lv_obj_clear_flag(obj_id_overlay, LV_OBJ_FLAG_HIDDEN);
  lv_obj_move_foreground(obj_id_overlay);
  id_overlay_timer = lv_timer_create(id_overlay_tutup_cb, ID_OVERLAY_MS, NULL);
  lv_timer_set_repeat_count(id_overlay_timer, 1);
}

/* ================= Pembaruan isi ================= */
static bool set_jika_beda(lv_obj_t *lbl, const char *txt) {
  if (strcmp(lv_label_get_text(lbl), txt) == 0) return false;
  lv_label_set_text(lbl, txt);
  return true;
}

static void set_warna(lv_obj_t *lbl, uint32_t warna) {
  if (lv_obj_get_style_text_color(lbl, 0).full != lv_color_hex(warna).full)
    lv_obj_set_style_text_color(lbl, lv_color_hex(warna), 0);
}

/* Angka sementara (belum stabil) tampil redup, angka stabil putih. */
static void nilai_set(lv_obj_t *lbl, lv_obj_t *satuan, const lv_font_t *fn,
                      bool sah, bool sementara, const char *fmt, float a, float b) {
  char buf[16];
  if ((!sah && !sementara) || a <= 0) snprintf(buf, sizeof(buf), "--");
  else if (b < 0.0f)                  snprintf(buf, sizeof(buf), fmt, a);
  else                                snprintf(buf, sizeof(buf), fmt, a, b);
  if (set_jika_beda(lbl, buf)) satuan_sejajar(satuan, lbl, fn);
  set_warna(lbl, (sementara && !sah) ? C_TANGGAL : C_PUTIH);
}

/* Baris status halaman metrik: pesan sesaat > status ukur > tanggal. */
static uint32_t pesan_sampai_ms = 0;
static char     pesan_teks[24] = "";

static void status_pesan(const char *txt) {
  strncpy(pesan_teks, txt, sizeof(pesan_teks) - 1);
  pesan_teks[sizeof(pesan_teks) - 1] = '\0';
  pesan_sampai_ms = millis() + 2000;
}

static void status_baris(void) {
  char buf[32];
  if (pesan_sampai_ms && (int32_t)(millis() - pesan_sampai_ms) < 0) {
    set_jika_beda(lbl_status, pesan_teks);
    set_warna(lbl_status, C_PUTIH);
    return;
  }
  pesan_sampai_ms = 0;

  if (inti_mengukur()) {
    if (inti_persen() >= 100) snprintf(buf, sizeof(buf), "CUKUP: BOOT=STOP");
    else                      snprintf(buf, sizeof(buf), "MENGUKUR %us", (unsigned)inti_detik());
    set_jika_beda(lbl_status, buf);
    set_warna(lbl_status, C_ISI);
    return;
  }

  struct tm t;
  if (!tm_now(&t)) { set_jika_beda(lbl_status, "--"); set_warna(lbl_status, C_TANGGAL); return; }
  snprintf(buf, sizeof(buf), "%s, %d %s %02d", tm_day_name(t.tm_wday), t.tm_mday,
           tm_month_name(t.tm_mon), (t.tm_year + 1900) % 100);
  set_jika_beda(lbl_status, buf);
  set_warna(lbl_status, C_TANGGAL);
}

static const char *HARI_ID[7] = { "MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU" };
static const char *BULAN_ID[12] = { "JAN", "FEB", "MAR", "APR", "MEI", "JUN",
                                    "JUL", "AGU", "SEP", "OKT", "NOV", "DES" };

static void jam_refresh(void) {
  struct tm t;
  if (!tm_now(&t)) return;
  static int menit_lalu = -1;
  if (t.tm_min != menit_lalu) {
    menit_lalu = t.tm_min;
    char b[8];
    snprintf(b, sizeof(b), "%02d", t.tm_hour);
    set_jika_beda(lbl_home_jam, b);
    snprintf(b, sizeof(b), "%02d", t.tm_min);
    set_jika_beda(lbl_home_menit, b);
    snprintf(b, sizeof(b), "%02d:%02d", t.tm_hour, t.tm_min);
    set_jika_beda(lbl_jam_kecil, b);
  }
  char buf[24];
  snprintf(buf, sizeof(buf), "%s, %s %d", HARI_ID[t.tm_wday % 7], BULAN_ID[t.tm_mon % 12], t.tm_mday);
  set_jika_beda(lbl_home_tanggal, buf);
}

/* Halaman metrik saat mengukur; kembali ke halaman utama 5 dtk setelah stop. */
#define HALAMAN_PULANG_MS 5000UL

static void halaman_set(bool wajah) {
  if (wajah == s_di_wajah) return;
  s_di_wajah = wajah;
  s_pulang_home_pada = 0;
  lv_scr_load(wajah ? scr_wajah : scr_home);
}

static void halaman_evaluasi(void) {
  if (inti_mengukur()) {
    s_tidur_setelah_pulang = false;
    halaman_set(true);
    return;
  }
  if (!s_di_wajah) return;
  if (!s_pulang_home_pada) s_pulang_home_pada = millis() + HALAMAN_PULANG_MS;
  else if ((int32_t)(millis() - s_pulang_home_pada) >= 0) {
    halaman_set(false);
    if (s_tidur_setelah_pulang) { layar_set(false); s_tidur_setelah_pulang = false; }
  }
}

static void baterai_refresh(void) {
  static bool tersimpan_dimuat = false;
  if (!tersimpan_dimuat) {
    tersimpan_dimuat = true;
    battery_set_tersimpan((int)tc_baterai_pct_get());
  }
  battery_update();
  if (!battery_valid()) return;

  const int pct = battery_percent();
  static uint32_t simpan_ms = 0;
  static int simpan_pct = -100;
  if (abs(pct - simpan_pct) >= 5 || (pct != simpan_pct && millis() - simpan_ms >= 600000UL)) {
    tc_baterai_pct_set((uint8_t)pct);
    simpan_pct = pct;
    simpan_ms = millis();
  }

  static int kotak_lalu = -1, isi_lalu = -1;
  static uint32_t chg_terakhir_ms = 0;
  int kotak = batt_hitung_kotak(pct, kotak_lalu);
  int chg = (battery_charging() && pct < 100) ? 1 : 0;   /* 100% tidak dibilang mengisi */
  if (kotak != kotak_lalu || chg != isi_lalu) {
    /* Toast hanya untuk colokan yang BARU (status mengisi padam >= 2 menit). */
    bool colok_baru = chg_terakhir_ms == 0 || millis() - chg_terakhir_ms > 120000UL;
    if (chg && colok_baru && (isi_lalu == 0 || (isi_lalu == -1 && s_boot_usb))) {
      layar_nyala_sementara(LAYAR_AUTO_MATI_MS);
      cas_toast_tampilkan();
    }
    kotak_lalu = kotak;
    isi_lalu = chg;
    batt_gambar(&batt_wajah, kotak, chg);
    batt_gambar(&batt_home, kotak, chg);
  }
  if (chg) chg_terakhir_ms = millis();
}

static void refresh_cb(lv_timer_t *tm) {
  (void)tm;
  tm_tick();
  jam_refresh();
  status_baris();
  tepi_set(inti_mengukur() ? (int)inti_persen() : 0);
  halaman_evaluasi();

  /* Pengukuran yang dimulai dari web membangunkan layar sekali. */
  static bool ukur_lalu = false;
  bool ukur = inti_mengukur();
  if (ukur && !ukur_lalu) layar_nyala_sementara(LAYAR_AUTO_MATI_MS);
  ukur_lalu = ukur;

  baterai_refresh();

  if (layar_mati_pada && (int32_t)(millis() - layar_mati_pada) >= 0) {
    if (inti_mengukur()) layar_mati_pada = millis() + 5000UL;   /* jangan mati saat mengukur */
    else                 layar_set(false);
  }

  ppg_data_t p;
  inti_snapshot(&p);
  bool semen = p.awal;
  nilai_set(lbl_hr, sat_hr, &font_ft_nilai,       p.bpm_valid,  semen, "%.0f", p.bpm, -1);
  nilai_set(lbl_sp, sat_sp, &font_ft_nilai,       p.spo2_valid, semen, "%.0f", p.spo2, -1);
  nilai_set(lbl_gl, sat_gl, &font_ft_nilai,       p.glu_valid,  semen, "%.0f", p.glucose, -1);
  nilai_set(lbl_bp, sat_bp, &font_ft_nilai_kecil, p.bp_valid,   semen, "%.0f/%.0f", p.sbp, p.dbp);
  bar_set(bar_hr, p.bpm_valid  || semen, p.bpm,     HR_MIN, HR_MAKS);
  bar_set(bar_sp, p.spo2_valid || semen, p.spo2,    SP_MIN, SP_MAKS);
  bar_set(bar_gl, p.glu_valid  || semen, p.glucose, GL_MIN, GL_MAKS);
  bar_set(bar_bp, p.bp_valid   || semen, p.sbp,     TD_MIN, TD_MAKS);

  static int ble_lalu = -1;
  int ble = tc_ble_terhubung() ? 1 : 0;
  if (ble != ble_lalu) {
    ble_lalu = ble;
    ble_gambar(&ble_wajah, ble);
    ble_gambar(&ble_home, ble);
  }

  /* Heartbeat serial tiap 5 detik. */
  static uint8_t n = 0;
  if (++n < 10) return;
  n = 0;
  struct tm t;
  bool ada = tm_now(&t);
  Serial.printf("[hb] %02d:%02d:%02d ble=%d ukur=%d tersimpan=%u batt=%d%%%s heap=%lu\n",
                ada ? t.tm_hour : 0, ada ? t.tm_min : 0, ada ? t.tm_sec : 0,
                tc_ble_terhubung() ? 1 : 0, inti_mengukur() ? 1 : 0,
                (unsigned)inti_tersimpan(), battery_percent(),
                battery_charging() ? " [mengisi]" : "", (unsigned long)ESP.getFreeHeap());
  if (inti_mengukur())
    Serial.printf("[ppg] %s bpm=%.0f spo2=%.1f glu*=%.0f td*=%.0f/%.0f%s\n",
                  ppg_state_text(), p.bpm, p.spo2, p.glucose, p.sbp, p.dbp,
                  p.awal ? " [sementara]" : "");
}

/* ================= Tombol PWR =================
 * klik = layar on/off, klik ganda = nomor unit, tahan 3 dtk = on/off sungguhan.
 * Board menyambung baterai secara hardware selama PWR ditekan; firmware menahan
 * latch BAT_EN supaya tetap hidup, dan melepasnya untuk mati. */
#define PWR_DEBOUNCE_MS 50
#define PWR_LAMA_MS     3000
#define PWR_DOBEL_MS    350

static bool     pwr_siap = false;
static int      pwr_level_lalu = HIGH, pwr_stabil_lvl = HIGH;
static uint32_t pwr_stabil_ms = 0, pwr_tekan_ms = 0;
static bool     pwr_lama_jalan = false;
static bool     pwr_klik_tertunda = false;
static uint32_t pwr_klik_tertunda_ms = 0;

/* Gerbang menyala: kalau dinyalakan dari tombol, harus ditahan 3 detik penuh
 * supaya senggolan di tas tidak menyalakan jam. false = dilepas terlalu cepat
 * tapi tetap hidup (dicatu USB). */
static bool pwr_gerbang_nyala(void) {
  if (digitalRead(PWR_KEY) != LOW) return true;
  while (millis() < PWR_LAMA_MS) {
    if (digitalRead(PWR_KEY) != LOW) {
      digitalWrite(BAT_EN, LOW);    /* di baterai: board berhenti di sini */
      delay(50);
      digitalWrite(BAT_EN, HIGH);
      return false;
    }
    delay(10);
  }
  return true;
}

static void pwr_matikan(void) {
  Serial.println("[pwr] tombol PWR ditahan -- mematikan");
  layar_set(false);
  inti_siap_mati();
  if (battery_valid()) tc_baterai_pct_set((uint8_t)battery_percent());
  digitalWrite(BAT_EN, LOW);        /* di baterai: board berhenti di sini */
  pwr_daya_lepas = true;            /* masih hidup = dicatu USB */
  battery_usb_pasti();
  Serial.println("[pwr] masih hidup karena USB -- tahan PWR 3 dtk untuk menyalakan lagi");
}

static void pwr_hidupkan_lagi(void) {
  digitalWrite(BAT_EN, HIGH);
  pwr_daya_lepas = false;
  layar_nyala_sementara(LAYAR_MATI_TOMBOL_MS);
}

static void pwr_klik(void) {
  if (pwr_daya_lepas) return;
  if (s_layar_nyala) layar_set(false);
  else               layar_nyala_sementara(LAYAR_MATI_TOMBOL_MS);
}

static void pwr_klik_dobel(void) {
  if (pwr_daya_lepas) return;
  const bool sudah = s_layar_nyala;
  layar_set(true);
  id_overlay_tampilkan();
  if (!sudah) layar_mati_pada = millis() + ID_OVERLAY_MS;
}

static void pwr_poll(void) {
  int level = digitalRead(PWR_KEY);
  if (level != pwr_level_lalu) {
    pwr_level_lalu = level;
    pwr_stabil_ms = millis();
  } else if (millis() - pwr_stabil_ms >= PWR_DEBOUNCE_MS && level != pwr_stabil_lvl) {
    pwr_stabil_lvl = level;
    if (level == LOW) {
      pwr_tekan_ms = millis();
      pwr_lama_jalan = false;
    } else if (!pwr_siap) {
      pwr_siap = true;              /* tekanan yang menyalakan board tidak dihitung */
    } else if (!pwr_lama_jalan) {
      if (pwr_klik_tertunda && millis() - pwr_klik_tertunda_ms < PWR_DOBEL_MS) {
        pwr_klik_tertunda = false;
        pwr_klik_dobel();
      } else {
        pwr_klik_tertunda = true;   /* tunggu kemungkinan klik kedua */
        pwr_klik_tertunda_ms = millis();
      }
    }
  }
  if (pwr_klik_tertunda && millis() - pwr_klik_tertunda_ms >= PWR_DOBEL_MS) {
    pwr_klik_tertunda = false;
    pwr_klik();
  }
  if (pwr_siap && pwr_stabil_lvl == LOW && !pwr_lama_jalan &&
      millis() - pwr_tekan_ms >= PWR_LAMA_MS) {
    pwr_lama_jalan = true;
    if (pwr_daya_lepas) pwr_hidupkan_lagi();
    else                pwr_matikan();
  }
}

/* ================= Tombol BOOT: mulai / stop ukur ================= */
#define BOOT_DEBOUNCE_MS 30

static bool     boot_siap = false;
static int      boot_level_lalu = HIGH, boot_stabil_lvl = HIGH;
static uint32_t boot_stabil_ms = 0;

static void boot_aktifkan(void) {
  if (pwr_daya_lepas) return;
  halaman_set(true);   /* umpan balik selalu terlihat di halaman metrik */
  switch (inti_tombol()) {
    case INTI_MULAI:          status_pesan("MULAI MENGUKUR"); break;
    case INTI_STOP_TERSIMPAN: status_pesan("TERSIMPAN");
                              s_tidur_setelah_pulang = true;  break;
    case INTI_STOP_KOSONG:    status_pesan("TIDAK ADA DATA");
                              s_tidur_setelah_pulang = true;  break;
    case INTI_TOLAK_SENSOR:   status_pesan("SENSOR TIDAK ADA"); break;
    case INTI_TOLAK_BATERAI:  status_pesan("BATERAI LEMAH");  break;
  }
}

static void boot_poll(void) {
  int level = digitalRead(BOOT_KEY);
  if (level != boot_level_lalu) {
    boot_level_lalu = level;
    boot_stabil_ms = millis();
  } else if (millis() - boot_stabil_ms >= BOOT_DEBOUNCE_MS && level != boot_stabil_lvl) {
    boot_stabil_lvl = level;
    if (level == LOW) {
      if (!s_layar_nyala) layar_nyala_sementara(LAYAR_MATI_TOMBOL_MS);
    } else if (!boot_siap) {
      boot_siap = true;             /* masih ditahan sejak boot/flash, abaikan */
    } else {
      boot_aktifkan();              /* aksi saat tombol DILEPAS */
    }
  }
}

/* ================= Konsol Serial (uji tanpa web) =================
 *   ukur          = sama dengan menekan BOOT (mulai/stop)
 *   status        = cetak keadaan
 *   daftar        = cetak hasil tersimpan
 *   hapus         = hapus semua hasil tersimpan
 *   id <1-99>     = nomor unit (nama BLE "TeleCare-NN", setelah boot ulang)
 *   glu <+-N>     = offset kalibrasi glukosa (mg/dL)
 *   td <+-S> <+-D>= offset kalibrasi tensi (mmHg)
 */
static void konsol_jalankan(char *baris) {
  char *arg = strchr(baris, ' ');
  if (arg) *arg++ = 0;
  tc_kalib_t k;
  tc_kalib_get(&k);

  if (!strcmp(baris, "ukur")) boot_aktifkan();
  else if (!strcmp(baris, "status")) {
    Serial.printf("[konsol] %s  ble=%s  ukur=%d (%u%%, %us)  tersimpan=%u  waktu=%s\n",
                  tc_ble_nama(), tc_ble_terhubung() ? "tersambung" : "tidak",
                  inti_mengukur() ? 1 : 0, (unsigned)inti_persen(), (unsigned)inti_detik(),
                  (unsigned)inti_tersimpan(), tm_boot_info());
  }
  else if (!strcmp(baris, "daftar")) {
    tc_hasil_t h;
    for (uint8_t i = 0; tc_hasil_ambil(i, &h); i++)
      Serial.printf("  id=%u epoch=%lu %us bpm=%u spo2=%u glu=%u td=%u/%u sumber=%u\n",
                    h.id, (unsigned long)h.epoch, h.durasi_s, h.bpm, h.spo2, h.glukosa,
                    h.sis, h.dia, h.sumber);
  }
  else if (!strcmp(baris, "hapus")) { tc_hasil_hapus_semua(); Serial.println("[konsol] dihapus"); }
  else if (!strcmp(baris, "id") && arg) tc_label_set((uint8_t)atoi(arg));
  else if (!strcmp(baris, "glu") && arg) { k.glukosa = (int16_t)atoi(arg); tc_kalib_set(&k); }
  else if (!strcmp(baris, "td") && arg) {
    char *arg2 = strchr(arg, ' ');
    k.sis = (int8_t)atoi(arg);
    k.dia = arg2 ? (int8_t)atoi(arg2 + 1) : k.dia;
    tc_kalib_set(&k);
  }
  else if (baris[0]) Serial.println("[konsol] perintah: ukur status daftar hapus id glu td");
}

static void konsol_poll(void) {
  static char buf[40];
  static uint8_t n = 0;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') { buf[n] = 0; konsol_jalankan(buf); n = 0; continue; }
    if (n < sizeof(buf) - 1) buf[n++] = c;
  }
}

/* ================= Setup / Loop ================= */
void setup() {
  /* PALING AWAL: tahan latch baterai, kalau tidak board mati saat PWR dilepas. */
  pinMode(BAT_EN, OUTPUT);
  digitalWrite(BAT_EN, HIGH);
  pinMode(PWR_KEY, INPUT_PULLUP);
  pinMode(BOOT_KEY, INPUT_PULLUP);
  const bool pwr_ditekan_awal = (digitalRead(PWR_KEY) == LOW);
  const bool nyala_disengaja = pwr_gerbang_nyala();

  /* Menyala tanpa PWR ditekan dan daya baru masuk = pasti dicatu USB. */
  const esp_reset_reason_t r = esp_reset_reason();
  const bool daya_baru = (r == ESP_RST_POWERON || r == ESP_RST_BROWNOUT || r == ESP_RST_PWR_GLITCH);
  if (!nyala_disengaja || (!pwr_ditekan_awal && daya_baru)) {
    s_boot_usb = true;
    battery_usb_pasti();
  }

  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);   /* jangan pernah blokir loop kalau tidak ada yang membaca */
  delay(200);
  Serial.println("\n[boot] TeleCare");

  ledcAttach(LCD_BL, 5000, 8);
  ledcWrite(LCD_BL, 0);

  /* Touch HARUS di-begin SEBELUM gfx->begin() (kalau dibalik, CST816T mengunci
   * baseline salah = ghost touch), lalu langsung ditidurkan: UI tidak pakai sentuh. */
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);      /* 400 kHz tidak stabil di bus ini */
  if (touch.begin(Wire, CST816_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
    delay(150);
    touch.sleep();
  }

  if (!gfx->begin()) Serial.println("[err] gfx->begin() gagal");
  gfx->fillScreen(RGB565_BLACK);

  lv_init();
  size_t buf_px = SCREEN_W * BUF_LINES;
  lv_color_t *buf1 = (lv_color_t *)heap_caps_malloc(buf_px * sizeof(lv_color_t), MALLOC_CAP_8BIT);
  lv_color_t *buf2 = (lv_color_t *)heap_caps_malloc(buf_px * sizeof(lv_color_t), MALLOC_CAP_8BIT);
  if (!buf1) { Serial.println("[err] alokasi draw buffer gagal"); while (1) delay(1000); }
  lv_disp_draw_buf_init(&draw_buf, buf1, buf2, buf_px);
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = SCREEN_W;
  disp_drv.ver_res = SCREEN_H;
  disp_drv.flush_cb = my_disp_flush;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  rtc_begin();
  tm_begin();
  battery_begin();
  ppg_begin();

  build_wajah();
  build_home();
  cas_toast_bangun();
  id_overlay_bangun();
  build_splash();
  splash_mulai();

  lv_timer_handler();                 /* frame pertama sebelum backlight menyala */
  battery_beban_akan_berubah(true);
  ledcWrite(LCD_BL, LCD_BL_TERANG);
  splash_tunggu();

  lv_timer_create(refresh_cb, 500, NULL);
  lv_timer_handler();

  /* Tombol yang sudah terlepas sejak boot langsung siap dipakai. */
  pwr_stabil_lvl = pwr_level_lalu = digitalRead(PWR_KEY);
  pwr_siap = (pwr_stabil_lvl == HIGH);
  boot_stabil_lvl = boot_level_lalu = digitalRead(BOOT_KEY);
  boot_siap = (boot_stabil_lvl == HIGH);

  /* Paling akhir: UI sudah tampil sebelum BLE menyita CPU dan heap. */
  tc_store_begin();
  tc_ble_begin();
  inti_mulai();
  id_badge_tampilkan();

  Serial.printf("[ok] siap. BOOT = mulai/stop ukur. heap=%lu\n", (unsigned long)ESP.getFreeHeap());
}

void loop() {
  konsol_poll();
  pwr_poll();
  boot_poll();
  ppg_update();
  inti_putar();
  lv_timer_handler();
  if (s_bl_tunda) {                   /* backlight setelah frame tergambar */
    s_bl_tunda = false;
    ledcWrite(LCD_BL, LCD_BL_TERANG);
  }
  delay(2);
}
