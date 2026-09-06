/* ============================================================
   TeleCare App — ring-ui.js
   Tampilan panggilan masuk pada perangkat dokter.

   Dibuat sebagai lapisan terpisah dari [ring.js](ring.js) karena
   kanal panggilan dan tampilannya berubah karena alasan berbeda:
   yang satu soal aturan database dan status, yang satu soal apa
   yang dilihat dan didengar dokter.

   Tiga jalur pemberitahuan dipakai sekaligus, sebab masing-masing
   bisa gagal sendiri-sendiri:

     1. Overlay layar penuh  — selalu tampil bila tab terlihat.
     2. Nada dering + getar  — bisa diblokir peramban sampai ada
                               interaksi pertama pengguna.
     3. Notifikasi sistem    — satu-satunya yang terlihat ketika
                               tab berada di latar belakang; perlu
                               izin pengguna.

   Ditambah judul tab yang berkedip, supaya di desktop panggilan
   tetap kelihatan lewat bilah tab meski jendelanya tertutup jendela
   lain.
   ============================================================ */
(function (TC) {
  'use strict';

  const { esc, icon, initials } = TC;

  let wadah = null;         // elemen overlay yang sedang tampil
  let judulTimer = null;
  let judulAsli = document.title;
  let hitungTimer = null;
  let aktif = null;         // ring yang sedang ditampilkan

  /* ---------------- judul tab berkedip ---------------- */
  function mulaiKedipJudul(nama) {
    if (judulTimer) return;
    judulAsli = document.title;
    const panggil = '\u260E Panggilan masuk — ' + nama;
    // Judul diganti seketika, bukan menunggu ketukan pertama timer: dokter
    // yang jendelanya tertutup jendela lain harus langsung melihatnya di
    // bilah tab, tidak setelah hampir satu detik.
    document.title = panggil;
    let nyala = false;
    judulTimer = setInterval(() => {
      document.title = nyala ? panggil : judulAsli;
      nyala = !nyala;
    }, 900);
  }

  function hentikanKedipJudul() {
    if (judulTimer) { clearInterval(judulTimer); judulTimer = null; }
    document.title = judulAsli;
  }

  /* ---------------- notifikasi sistem ---------------- */
  function beriNotifikasi(ring) {
    if (!TC.Push || TC.Push.permission() !== 'granted') return;
    const jenis = ring.mode === 'audio' ? 'Panggilan suara' : 'Panggilan video';
    TC.Push.show(jenis + ' masuk', {
      body: ring.fromName + ' sedang memanggil Anda.',
      tag: 'telecare-ring',
      renotify: true,
      requireInteraction: true,
      data: { url: '/app/#/klinik' }
    }).catch(() => {});
  }

  function tutupNotifikasi() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (!reg.getNotifications) return;
      reg.getNotifications({ tag: 'telecare-ring' })
        .then((list) => list.forEach((n) => n.close()))
        .catch(() => {});
    }).catch(() => {});
  }

  /* ---------------- overlay ---------------- */
  const RingUI = {

    sedangTampil() { return !!wadah; },
    ringAktif() { return aktif; },

    /**
     * Menampilkan panggilan masuk.
     * @param {object} ring  entri dari TC.Ring
     * @param {object} on    { onTerima(ring), onTolak(ring) }
     */
    tampilkan(ring, on) {
      on = on || {};
      // Satu panggilan pada satu waktu; yang datang belakangan diabaikan
      // supaya dokter tidak dihujani overlay bertumpuk.
      if (wadah) return false;
      aktif = ring;

      const jenis = ring.mode === 'audio' ? 'Panggilan suara' : 'Panggilan video';
      const sisa = Math.round((TC.Ring.TIMEOUT_MS || 45000) / 1000);

      wadah = document.createElement('div');
      wadah.className = 'ringcall';
      wadah.setAttribute('role', 'dialog');
      wadah.setAttribute('aria-modal', 'true');
      wadah.setAttribute('aria-label', jenis + ' masuk dari ' + ring.fromName);
      wadah.innerHTML = `
        <div class="ringcall__box">
          <span class="ringcall__jenis">${icon(ring.mode === 'audio' ? 'phone' : 'video')} ${esc(jenis)} masuk</span>

          <div class="ringcall__ava">
            <i class="ringcall__pulse"></i><i class="ringcall__pulse"></i><i class="ringcall__pulse"></i>
            <span class="avatar avatar--xl avatar--round">${esc(initials(ring.fromName || 'P'))}</span>
          </div>

          <b class="ringcall__nama">${esc(ring.fromName || 'Pasien')}</b>
          <small class="ringcall__sub">Menunggu dijawab · <span data-sisa>${sisa}</span> detik</small>

          <div class="ringcall__aksi">
            <button class="ringcall__btn ringcall__btn--tolak" data-tolak>
              ${icon('phone-off')}<span>Tolak</span></button>
            <button class="ringcall__btn ringcall__btn--terima" data-terima>
              ${icon('phone')}<span>Terima</span></button>
          </div>

          <p class="ringcall__catatan" data-catatan hidden></p>
        </div>`;
      document.body.appendChild(wadah);
      document.body.classList.add('is-ringing');

      // Nada dering. Bila diblokir peramban, katakan terus terang di layar
      // alih-alih membiarkan dokter menyangka perangkatnya berbunyi.
      TC.Ring.nada.mulai().then((bunyi) => {
        if (bunyi) return;
        const c = wadah && wadah.querySelector('[data-catatan]');
        if (!c) return;
        c.hidden = false;
        c.innerHTML = `${icon('info')} Nada dering diblokir peramban sampai Anda
          berinteraksi dengan halaman. Panggilan tetap terlihat di sini.`;
      });

      mulaiKedipJudul(ring.fromName || 'Pasien');
      beriNotifikasi(ring);

      // Hitungan sisa waktu, sekaligus menutup sendiri saat kedaluwarsa.
      let n = sisa;
      hitungTimer = setInterval(() => {
        n -= 1;
        const el = wadah && wadah.querySelector('[data-sisa]');
        if (el) el.textContent = Math.max(0, n);
        if (n <= 0) {
          RingUI.tutup();
          if (on.onLewat) on.onLewat(ring);
        }
      }, 1000);

      const tombolTerima = wadah.querySelector('[data-terima]');
      const tombolTolak = wadah.querySelector('[data-tolak]');

      tombolTerima.onclick = () => {
        tombolTerima.disabled = true;
        tombolTolak.disabled = true;
        RingUI.tutup();
        if (on.onTerima) on.onTerima(ring);
      };
      tombolTolak.onclick = () => {
        tombolTerima.disabled = true;
        tombolTolak.disabled = true;
        RingUI.tutup();
        if (on.onTolak) on.onTolak(ring);
      };

      // Escape menolak panggilan — jalan pintas yang diharapkan di desktop.
      wadah._esc = (e) => { if (e.key === 'Escape') tombolTolak.click(); };
      window.addEventListener('keydown', wadah._esc);

      tombolTerima.focus();
      return true;
    },

    tutup() {
      TC.Ring.nada.berhenti();
      hentikanKedipJudul();
      tutupNotifikasi();
      if (hitungTimer) { clearInterval(hitungTimer); hitungTimer = null; }
      if (wadah) {
        if (wadah._esc) window.removeEventListener('keydown', wadah._esc);
        wadah.remove();
        wadah = null;
      }
      document.body.classList.remove('is-ringing');
      aktif = null;
    },

    /** Menutup hanya bila yang tampil memang panggilan itu. */
    tutupBila(ringId) {
      if (aktif && aktif.ringId === ringId) RingUI.tutup();
    }
  };

  TC.RingUI = RingUI;
})(window.TC);
