/* ============================================================
   TeleCare — uji ujung-ke-ujung (e2e)
   Lihat keterangan di tests/e2e.html.
   ============================================================ */
(function () {
  'use strict';

  const F = document.getElementById('panggung');
  const OUT = document.getElementById('hasil');
  const catatan = [];
  let lulus = 0, gagal = 0;
  const galatJs = [];

  /* ---------------- util ---------------- */
  function tulis(kelas, pesan) {
    catatan.push({ kelas, pesan });
    const s = document.createElement('span');
    s.className = kelas;
    s.textContent = pesan + '\n';
    OUT.appendChild(s);
  }
  const win = () => F.contentWindow;
  const doc = () => F.contentDocument;
  const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

  async function tunggu(fn, ms, jeda) {
    ms = ms || 8000; jeda = jeda || 100;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { const v = fn(); if (v) return v; } catch (e) { /* belum siap */ }
      await tidur(jeda);
    }
    return null;
  }

  function pastikan(kond, pesan) { if (!kond) throw new Error(pesan); }

  /** Penyadap galat: dipasang ulang setiap kali iframe memuat dokumen baru. */
  function pasangPenyadap() {
    const w = win();
    if (!w || w.__tcSadap) return;
    w.__tcSadap = true;
    w.addEventListener('error', (e) => galatJs.push({ jalur: jalurAman(), pesan: String(e.message) }));
    w.addEventListener('unhandledrejection', (e) => {
      const r = e.reason;
      galatJs.push({ jalur: jalurAman(), pesan: 'promise: ' + String((r && (r.stack || r.message)) || r) });
    });
  }

  let nomorMuat = 0;
  /**
   * Memuat URL di iframe sebagai pemuatan PENUH. URL yang hanya berbeda hash
   * dari dokumen yang sedang terbuka adalah navigasi dalam dokumen yang sama —
   * event `load` tidak pernah terpicu dan penantian menggantung selamanya.
   * Parameter _e2e yang unik memaksa pemuatan ulang setiap kali.
   */
  function muat(url) {
    const hash = url.indexOf('#') === -1 ? '' : url.slice(url.indexOf('#'));
    const dasar = hash ? url.slice(0, url.indexOf('#')) : url;
    const unik = dasar + (dasar.indexOf('?') === -1 ? '?' : '&') + '_e2e=' + (++nomorMuat) + hash;
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('memuat ' + url + ' melebihi 25 detik')), 25000);
      F.onload = () => { clearTimeout(t); pasangPenyadap(); res(); };
      F.src = unik;
    });
  }

  /** Laporan sementara setelah tiap skenario, agar titik macet terlihat. */
  function lapor(selesai) {
    return fetch('/__hasil-uji', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lulus, gagal, catatan, galatJs, selesai: !!selesai, waktu: new Date().toISOString() })
    }).catch(() => {});
  }

  /**
   * Mengosongkan keadaan aplikasi. Iframe HARUS dikosongkan lebih dulu:
   * aplikasi menyimpan keadaannya pada `pagehide` (engine.js), jadi bila
   * penyimpanan dihapus selagi aplikasi masih terbuka, sesi lama akan
   * ditulis ulang tepat saat iframe berpindah halaman.
   */
  async function bersih() {
    await new Promise((res) => {
      const t = setTimeout(res, 3000);
      F.onload = () => { clearTimeout(t); res(); };
      F.src = 'about:blank';
    });
    try { localStorage.clear(); } catch (e) { /* abaikan */ }
    try { sessionStorage.clear(); } catch (e) { /* abaikan */ }
  }

  const siapApp = () => tunggu(() => win().TC && win().TC.Router &&
    win().TC.Router.current && win().TC.Router.current.path, 20000);

  function jalurAman() {
    try { return win().TC.Router.current.path; } catch (e) { return '?'; }
  }

  function el(sel) { return doc().querySelector(sel); }
  function semua(sel) { return Array.prototype.slice.call(doc().querySelectorAll(sel)); }

  function klik(sel) {
    const e = el(sel);
    if (!e) throw new Error('elemen tidak ada: ' + sel);
    e.click();
    return e;
  }

  function isiKolom(sel, nilai) {
    const e = el(sel);
    if (!e) throw new Error('kolom tidak ada: ' + sel);
    e.value = nilai;
    const Ev = win().Event;
    e.dispatchEvent(new Ev('input', { bubbles: true }));
    e.dispatchEvent(new Ev('change', { bubbles: true }));
    return e;
  }

  async function keRute(r, bolehDialihkan) {
    const tujuan = r.replace(/^#/, '');
    win().location.hash = tujuan;
    const sampai = await tunggu(() => jalurAman() === tujuan, 6000);
    if (!sampai && !bolehDialihkan) {
      throw new Error('tidak sampai ' + tujuan + ', berhenti di ' + jalurAman() +
                      ' (peran ' + ((win().TC.Store.user() || {}).role || '-') + ')');
    }
    await tidur(450);             // biar render + animasi masuk selesai
  }

  /** Galat JS yang menandakan cacat kode, bukan gangguan jaringan. */
  function galatKode(sejak) {
    return galatJs.slice(sejak).filter((g) => /TypeError|ReferenceError|SyntaxError|RangeError/.test(g.pesan));
  }

  async function uji(nama, fn) {
    const sejak = galatJs.length;
    try {
      await Promise.race([fn(), tidur(45000).then(() => {
        throw new Error('skenario melebihi 45 detik');
      })]);
      const g = galatKode(sejak);
      if (g.length) throw new Error('galat JS: ' + g[0].pesan.split('\n')[0]);
      lulus++; tulis('ok', 'LULUS  ' + nama);
    } catch (e) {
      gagal++; tulis('gagal', 'GAGAL  ' + nama + ' — ' + ((e && e.message) || e));
    }
    lapor(false);
  }

  /* ---------------- cek layar ---------------- */
  function cekLayar(rute, harapJalur) {
    const d = doc();
    const teks = (d.body && d.body.innerText) || '';
    pastikan(!/Terjadi kesalahan/.test(teks), 'layar menampilkan "Terjadi kesalahan"');
    const tujuan = harapJalur || rute.replace(/^#/, '');
    pastikan(jalurAman() === tujuan, 'dialihkan ke ' + jalurAman() + ' (diharapkan ' + tujuan + ')');
    const v = d.getElementById('view');
    const n = ((v ? v.innerText : teks) || '').trim().length;
    pastikan(n > 40, 'isi layar terlalu sedikit (' + n + ' karakter)');
    // tidak boleh meluap ke samping pada lebar ponsel
    const sw = d.documentElement.scrollWidth, cw = d.documentElement.clientWidth;
    pastikan(sw <= cw + 1, 'meluap ke samping: scrollWidth ' + sw + ' > ' + cw);
  }

  /* ---------------- daftar rute per peran ---------------- */
  const RUTE = {
    'pasien': ['#/home', '#/vital/hr', '#/vital/spo2', '#/vital/temp', '#/vital/bp', '#/analisis',
      '#/riwayat', '#/notifikasi', '#/artikel/a1', '#/konsultasi', '#/konsultasi/spesialis/jantung',
      '#/dokter/d1', '#/chat/cs-demo', '#/jadwal', '#/perangkat', '#/perangkat/pindai',
      '#/profil', '#/profil/pribadi', '#/profil/tujuan', '#/profil/kalibrasi',
      '#/profil/pengaturan', '#/tentang'],
    'dokter': ['#/klinik', '#/klinik/antrean', '#/klinik/pasien', '#/klinik/pasien/p1', '#/jadwal', '#/profil'],
    'admin-faskes': ['#/faskes', '#/faskes/anggota', '#/faskes/anggota/p5', '#/faskes/perangkat',
      '#/faskes/nakes', '#/profil'],
    'admin': ['#/sistem', '#/sistem/pengguna', '#/sistem/dokter', '#/sistem/faskes',
      '#/sistem/kalibrasi', '#/profil']
  };

  /* ============================================================
     SKENARIO
     ============================================================ */
  async function jalankan() {
    tulis('info', 'mulai ' + new Date().toISOString());
    await lapor(false);

    /* ---- 1. situs penelitian di lebar ponsel ---- */
    await uji('situs: preloader hilang & hero tampil di lebar ponsel', async () => {
      await bersih();
      await muat('../');
      const selesai = await tunggu(() => {
        const p = el('#preload');
        return !p || p.classList.contains('is-done');
      }, 9000);
      pastikan(selesai, 'preloader masih menutupi halaman setelah 9 detik');
      pastikan(el('h1'), 'judul hero tidak ada');
      const sw = doc().documentElement.scrollWidth, cw = doc().documentElement.clientWidth;
      pastikan(sw <= cw + 1, 'situs meluap ke samping: ' + sw + ' > ' + cw);
    });

    /* ---- 2. onboarding → daftar ---- */
    await uji('onboarding: dua slide lalu ke pendaftaran', async () => {
      await bersih();
      await muat('../app/');
      await siapApp();
      pastikan(await tunggu(() => jalurAman() === '/mulai'), 'tidak membuka /mulai, malah ' + jalurAman());
      let slide = 0;
      while (jalurAman() === '/mulai' && slide < 5) {
        const b = await tunggu(() => el('[data-next]'), 3000);
        pastikan(b, 'tombol lanjut tidak ada pada slide ' + (slide + 1));
        b.click();
        slide++;
        await tidur(700);
      }
      pastikan(await tunggu(() => jalurAman() === '/daftar', 4000),
        'tidak sampai /daftar setelah ' + slide + ' klik, berhenti di ' + jalurAman());
    });

    /* ---- 3. pendaftaran akun baru ---- */
    await uji('daftar: formulir valid membuat akun lalu ke /lengkapi', async () => {
      await tunggu(() => el('#fReg'), 4000);
      const stamp = Date.now().toString().slice(-6);
      isiKolom('#fReg [name=name]', 'Penguji E2E');
      isiKolom('#fReg [name=email]', 'e2e' + stamp + '@contoh.id');
      isiKolom('#fReg [name=phone]', '0812' + stamp + '00');
      isiKolom('#fReg [name=pass]', 'rahasia1234');
      const f = el('#fReg');
      f.dispatchEvent(new (win().Event)('submit', { bubbles: true, cancelable: true }));
      pastikan(await tunggu(() => jalurAman() === '/lengkapi', 6000), 'tidak sampai /lengkapi, malah ' + jalurAman());
    });

    /* ---- 4. layar masuk: Google + tamu + pilih peran ---- */
    await uji('masuk: tombol Google & Tamu ada, tamu→dokter mendarat di /klinik', async () => {
      await bersih();
      await muat('../app/#/masuk');
      await siapApp();
      await tunggu(() => el('[data-guest]'), 6000);
      pastikan(el('[data-google]'), 'tombol Google tidak ada');
      klik('[data-guest]');
      pastikan(await tunggu(() => semua('[data-role]').length === 4, 4000),
        'lembar peran tidak menampilkan 4 pilihan');
      klik('[data-role="dokter"]');
      pastikan(await tunggu(() => jalurAman() === '/klinik', 8000), 'tidak mendarat di /klinik');
    });

    /* ---- 5. sapuan rute seluruh peran ---- */
    for (const peran of Object.keys(RUTE)) {
      await bersih();
      await muat('../app/?demo=' + peran + RUTE[peran][0]);
      await siapApp();
      await tidur(900);
      for (const r of RUTE[peran]) {
        await uji('rute ' + peran + ' ' + r, async () => {
          await keRute(r, true);
          cekLayar(r);
        });
      }
    }

    /* ---- 6. penjaga peran ---- */
    await uji('penjaga: pasien yang membuka /sistem dialihkan ke /home', async () => {
      await bersih();
      await muat('../app/?demo=pasien#/home');
      await siapApp();
      win().location.hash = '/sistem';
      pastikan(await tunggu(() => jalurAman() === '/home', 5000), 'tidak dialihkan, jalur ' + jalurAman());
    });

    /* ---- 7. memasangkan perangkat (pemindaian simulasi) ---- */
    await uji('perangkat: pindai lalu pasangkan menambah perangkat', async () => {
      const sebelum = win().TC.Store.state.devices.length;
      await keRute('#/perangkat/pindai');
      const tombol = await tunggu(() => semua('[data-pair]').find((b) => !b.disabled), 9000);
      pastikan(tombol, 'hasil pindai tidak muncul');
      tombol.click();
      pastikan(await tunggu(() => win().TC.Store.state.devices.length > sebelum, 7000),
        'jumlah perangkat tidak bertambah');
      pastikan(await tunggu(() => jalurAman() === '/perangkat', 5000), 'tidak kembali ke /perangkat');
    });

    /* ---- 8. sesi makan: hasil analisis → mulai sesi ---- */
    await uji('sesi makan: mulai dari hasil analisis sampai titik pengukuran tampil', async () => {
      const w = win();
      const r = w.TC.Meals.recognize();
      w.sessionStorage.setItem('tc.draft', JSON.stringify({ items: r.items, confidence: r.confidence, photo: null }));
      await keRute('#/sesi/hasil');
      await tunggu(() => el('[data-start]'), 4000);
      klik('[data-start]');
      pastikan(await tunggu(() => jalurAman() === '/sesi/berjalan', 6000), 'tidak masuk /sesi/berjalan');
      pastikan(await tunggu(() => semua('.point').length >= 4, 4000), 'titik pengukuran kurang dari 4');
      pastikan(w.TC.Store.state.activeMeal, 'activeMeal kosong');
    });

    /* ---- 9. chat: kirim pesan ---- */
    await uji('chat: pesan yang diketik muncul sebagai gelembung', async () => {
      await keRute('#/chat/cs-demo');
      await tunggu(() => el('#inp'), 5000);
      const teks = 'uji e2e ' + Date.now().toString().slice(-5);
      isiKolom('#inp', teks);
      klik('[data-send]');
      pastikan(await tunggu(() => (doc().body.innerText || '').indexOf(teks) !== -1, 5000),
        'pesan tidak muncul');
    });

    /* ---- 10. pengaturan tersimpan ---- */
    await uji('pengaturan: sakelar percepat waktu tersimpan di Store', async () => {
      await keRute('#/profil/pengaturan');
      const cb = await tunggu(() => el('#tFast'), 4000);
      pastikan(cb, 'sakelar #tFast tidak ada');
      const awal = win().TC.Store.state.settings.fastDemo;
      cb.click();
      pastikan(await tunggu(() => win().TC.Store.state.settings.fastDemo === !awal, 3000), 'nilai tidak berubah');
      cb.click();
      pastikan(await tunggu(() => win().TC.Store.state.settings.fastDemo === awal, 3000), 'tidak kembali');
    });

    /* ---- 11. ganti peran lewat profil ---- */
    await uji('profil: ganti peran ke admin mendarat di /sistem', async () => {
      await keRute('#/profil');
      await tunggu(() => el('[data-switch]'), 4000);
      klik('[data-switch]');
      await tunggu(() => el('[data-setrole="admin"]'), 4000);
      klik('[data-setrole="admin"]');
      pastikan(await tunggu(() => jalurAman() === '/sistem', 6000), 'tidak mendarat di /sistem');
    });

    /* ---- 12. keluar ---- */
    await uji('profil: keluar kembali ke /masuk', async () => {
      await keRute('#/profil');
      await tunggu(() => el('[data-logout]'), 4000);
      klik('[data-logout]');
      const ya = await tunggu(() => el('[data-yes]'), 4000);
      pastikan(ya, 'dialog konfirmasi tidak muncul');
      ya.click();
      pastikan(await tunggu(() => jalurAman() === '/masuk', 6000), 'tidak kembali ke /masuk');
    });

    /* ---- ringkasan ---- */
    tulis('info', '');
    if (galatJs.length) {
      tulis('info', 'galat JS tercatat (' + galatJs.length + '), termasuk yang bukan cacat kode:');
      galatJs.slice(0, 25).forEach((g) => tulis('info', '  [' + g.jalur + '] ' + g.pesan.split('\n')[0]));
    }
    tulis(gagal ? 'gagal' : 'ok', 'RINGKAS lulus=' + lulus + ' gagal=' + gagal);
    document.title = 'SELESAI';

    await lapor(true);
  }

  jalankan().catch((e) => {
    tulis('gagal', 'PENGUJI MACET: ' + ((e && e.stack) || e));
    fetch('/__hasil-uji', { method: 'POST',
      body: JSON.stringify({ macet: String(e), catatan, selesai: true }) }).catch(() => {});
  });
})();
