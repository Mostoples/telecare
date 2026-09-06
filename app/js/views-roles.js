/* ============================================================
   TeleCare App — views-roles.js
   Layar untuk tiga peran selain pasien:
     · dokter        → klinik, antrean konsultasi, pasien binaan
     · admin-faskes  → dashboard unit, anggota, perangkat, nakes
     · admin         → ringkasan platform, pengguna, faskes, dokter
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, clamp, rupiah, Store, Router, setView, setTopbar, toast,
          hhmm, relTime, shortDate, greeting, initials, sheet, closeSheet, confirmSheet } = TC;
  const D = TC.DATA;

  /* ============================================================
     KOMPONEN BERSAMA
     ============================================================ */

  function statusChip(st) {
    const m = D.STATUS_META[st] || D.STATUS_META.ok;
    return `<span class="chip chip--${m.c}">${esc(m.t)}</span>`;
  }

  function patientRow(p, href) {
    const m = D.STATUS_META[p.status];
    return `<a class="row" href="${href}">
      <span class="avatar" style="background:${m.color}">${esc(initials(p.name))}</span>
      <div style="min-width:0">
        <b>${esc(p.name)}</b>
        <small>${esc(p.unit)} · ${p.age} th · ${esc(p.device)}</small>
      </div>
      <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
        ${statusChip(p.status)}${icon('chev', 'chev')}</span>
    </a>`;
  }

  /** Batang komposisi Normal / Waspada / Kritis. */
  function triaseBar(ok, warn, crit) {
    const total = Math.max(1, ok + warn + crit);
    return `<div class="bar" style="height:10px;display:flex;overflow:hidden">
        <i style="width:${(ok / total * 100).toFixed(1)}%;background:var(--green-500)"></i>
        <i style="width:${(warn / total * 100).toFixed(1)}%;background:var(--amber-500)"></i>
        <i style="width:${(crit / total * 100).toFixed(1)}%;background:var(--coral-500)"></i>
      </div>
      <div class="legend" style="margin-top:9px">
        <div><i style="background:#049A5B"></i>Normal ${ok}</div>
        <div><i style="background:#E09B12"></i>Waspada ${warn}</div>
        <div><i style="background:#E2543F"></i>Kritis ${crit}</div>
      </div>`;
  }

  /** Deret 7 hari untuk grafik ringkas pada layar pengelola. */
  function series7(seedKey, lo, hi) {
    const s = Store.state;
    s._roleSeries = s._roleSeries || {};
    const day = new Date().getDate();
    if (!s._roleSeries[seedKey] || s._roleSeries[seedKey].day !== day) {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push({ label: TC.DAYS[d.getDay()].slice(0, 3), v: TC.rint(lo, hi) });
      }
      Store.update((st) => { st._roleSeries[seedKey] = { day, days }; });
    }
    return s._roleSeries[seedKey].days;
  }

  /* ============================================================
     1. DOKTER — beranda klinik
     ============================================================ */
  function viewClinic() {
    const u = Store.user();
    const doc = D.doctor(u.doctorId) || D.DOCTORS[0];
    const consults = Store.state.consults;
    const active = consults.filter((c) => c.status === 'active');
    const attention = D.PATIENTS.filter((p) => p.status !== 'ok');
    const online = Store.state.settings.doctorOnline !== false;

    setTopbar('');
    setView(`
      <div class="hero-head">
        <span class="avatar avatar--lg" style="background:${doc.color};border-radius:18px">
          ${esc(initials(doc.name))}</span>
        <div style="min-width:0">
          <b>${esc(greeting(new Date()))}, ${esc(u.nickname || doc.name)}</b>
          <small>${esc(D.spec(doc.spec).name)} · ${esc(doc.hospital)}</small>
        </div>
        <button class="icon-btn" data-notif style="margin-left:auto" aria-label="Notifikasi">
          ${icon('bell')}</button>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="row__ico" style="background:${online ? 'var(--green-50)' : 'var(--canvas-2)'};
            color:${online ? 'var(--green-600)' : 'var(--faint)'}">${icon('stetho')}</span>
          <div style="min-width:0">
            <b style="font-size:.95rem">${online ? 'Menerima konsultasi' : 'Sedang tidak menerima'}</b>
            <small class="muted" style="display:block;font-size:.78rem">
              ${online ? 'Pasien dapat memulai percakapan dengan Anda' : 'Anda tidak muncul sebagai online'}</small>
          </div>
          <label style="margin-left:auto;display:flex;align-items:center">
            <input type="checkbox" id="tOnline" ${online ? 'checked' : ''}
                   style="width:22px;height:22px;accent-color:var(--green-500)"></label>
        </div>
      </div>

      <div class="stat-row mt">
        <div><b>${active.length}</b><span>Antrean aktif</span></div>
        <div><b>${D.PATIENTS.length}</b><span>Pasien binaan</span></div>
        <div><b>${Store.state.appointments.length}</b><span>Janji temu</span></div>
      </div>

      <div class="section-title">${icon('inbox')} Antrean konsultasi
        <span class="push"></span><a class="link" href="#/klinik/antrean">Lihat semua</a></div>
      ${active.length ? `<div class="list">${active.slice(0, 4).map((c) => {
        const last = c.messages[c.messages.length - 1];
        return `<a class="row" href="#/chat/${esc(c.id)}">
          <span class="avatar" style="background:var(--green-500)">${esc(initials('Pasien ' + c.id.slice(-2)))}</span>
          <div style="min-width:0"><b>Pasien · ${esc(c.id.slice(-4).toUpperCase())}</b>
            <small style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(last ? (last.text || '[lampiran data]') : '')}</small></div>
          <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <span class="chip chip--g"><i class="dotlive"></i> ${esc(relTime(c.startedAt))}</span>
            ${icon('chev', 'chev')}</span>
        </a>`;
      }).join('')}</div>` : `
        <div class="card"><div class="empty" style="padding:24px 10px">${icon('inbox')}
          <b>Antrean kosong</b><p>Konsultasi yang masuk akan muncul di sini.</p></div></div>`}

      <div class="section-title">${icon('alert')} Pasien perlu perhatian
        <span class="push"></span><span class="chip chip--a">${attention.length}</span></div>
      <div class="list">
        ${attention.map((p) => patientRow(p, '#/klinik/pasien/' + p.id)).join('')}
      </div>

      <div class="card mt">
        <div class="card__head">${icon('chart')}<h3>Konsultasi 7 hari terakhir</h3></div>
        <div class="chart-wrap"><canvas id="cDocWeek" style="height:150px"></canvas></div>
      </div>

      <div class="section-title">${icon('cal')} Janji temu terdekat</div>
      ${Store.state.appointments.length ? `<div class="list">
        ${Store.state.appointments.slice(0, 3).map((a) => `
          <div class="row"><span class="row__ico">${icon('cal')}</span>
            <div><b>${esc(shortDate(new Date(a.at)))} · ${esc(a.slot)}</b>
              <small>${esc(a.note || 'Tanpa catatan keluhan')}</small></div></div>`).join('')}
      </div>` : `<div class="card"><p class="small muted tc" style="padding:14px">Belum ada janji temu terjadwal.</p></div>`}
    `);

    const w = series7('docWeek', 3, 18);
    TC.barChart($('#cDocWeek'), w.map((d) => d.v), w.map((d) => d.label), '#0E7FB8');

    $('#tOnline').onchange = (e) => {
      Store.update((s) => { s.settings.doctorOnline = e.target.checked; });
      // Status jaga di server ikut berubah: kalau tidak, pasien masih dapat
      // mendering perangkat yang pemiliknya sudah menyatakan tidak menerima.
      if (TC.segarkanJaga) TC.segarkanJaga();
      toast(e.target.checked ? 'Anda kini menerima konsultasi.' : 'Status diubah menjadi tidak menerima.');
      Router.render();
    };
    $('[data-notif]').onclick = () => Router.navigate('/notifikasi');
  }

  /* ---------------- Dokter · antrean ---------------- */
  function viewQueue() {
    TC.topbar('Antrean Konsultasi', { sub: 'Percakapan masuk dan riwayat', back: false });
    const all = Store.state.consults;
    setView(`
      <div class="seg">
        <button data-q="aktif" class="is-active">Aktif</button>
        <button data-q="selesai">Selesai</button>
      </div>
      <div id="qBody" class="mt"></div>`);

    function draw(kind) {
      const list = all.filter((c) => (kind === 'aktif' ? c.status === 'active' : c.status !== 'active'));
      $('#qBody').innerHTML = list.length ? `<div class="list">${list.map((c) => {
        const last = c.messages[c.messages.length - 1];
        return `<a class="row" href="#/chat/${esc(c.id)}">
          <span class="avatar" style="background:var(--green-500)">${esc(initials('Pasien ' + c.id.slice(-2)))}</span>
          <div style="min-width:0"><b>Pasien · ${esc(c.id.slice(-4).toUpperCase())}</b>
            <small style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(last ? (last.text || '[lampiran data]') : '')}</small>
            <small class="tiny" style="color:var(--faint)">${esc(relTime(c.startedAt))} · ${esc(c.mode)}</small></div>
          ${icon('chev', 'chev')}</a>`;
      }).join('')}</div>` : `
        <div class="empty">${icon('inbox')}<b>Tidak ada percakapan</b>
        <p>${kind === 'aktif' ? 'Belum ada konsultasi yang sedang berlangsung.' : 'Belum ada konsultasi yang selesai.'}</p></div>`;
    }
    draw('aktif');
    $$('[data-q]').forEach((b) => {
      b.onclick = () => {
        $$('[data-q]').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        draw(b.dataset.q);
      };
    });
  }

  /* ---------------- Dokter · daftar pasien ---------------- */
  function viewPatients() {
    TC.topbar('Pasien Binaan', { sub: D.PATIENTS.length + ' orang terpantau', back: false });
    setView(`
      <div class="searchbar">${icon('search')}
        <input id="pq" type="search" placeholder="Cari nama atau unit" aria-label="Cari pasien"></div>
      <div class="seg mt">
        <button data-f="all" class="is-active">Semua</button>
        <button data-f="crit">Kritis</button>
        <button data-f="warn">Waspada</button>
        <button data-f="ok">Normal</button>
      </div>
      <div class="list mt" id="pList"></div>`);

    let filter = 'all', q = '';
    function draw() {
      const list = D.PATIENTS.filter((p) => {
        if (filter !== 'all' && p.status !== filter) return false;
        if (!q) return true;
        return (p.name + ' ' + p.unit).toLowerCase().indexOf(q) !== -1;
      });
      $('#pList').innerHTML = list.length
        ? list.map((p) => patientRow(p, '#/klinik/pasien/' + p.id)).join('')
        : `<div class="empty" style="background:var(--surface)">${icon('search')}
           <b>Tidak ditemukan</b><p>Coba kata kunci atau filter lain.</p></div>`;
    }
    draw();
    $('#pq').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    $$('[data-f]').forEach((b) => {
      b.onclick = () => {
        $$('[data-f]').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        filter = b.dataset.f; draw();
      };
    });
  }

  /* ---------------- Dokter · detail pasien ---------------- */

  const MODE_LABEL = { chat: 'Chat', audio: 'Panggilan suara', video: 'Panggilan video' };

  function gambarRiwayat(riwayat) {
    if (!riwayat.length) {
      return `<div class="empty">${icon('stetho')}<b>Belum ada konsultasi</b>
        <p>Konsultasi yang Anda mulai dari halaman ini akan tercatat di sini.</p></div>`;
    }
    return `<div class="list">${riwayat.map((c) => {
      const doc = D.doctor(c.doctorId);
      const selesai = c.status !== 'active';
      const jml = (c.messages || []).length;
      return `<a class="row" href="#/chat/${esc(c.id)}">
        <span class="row__ico">${icon(c.mode === 'chat' ? 'chat' : 'video')}</span>
        <div style="min-width:0">
          <b>${esc(MODE_LABEL[c.mode] || 'Konsultasi')}${doc ? ' · ' + esc(doc.name) : ''}</b>
          <small>${esc(shortDate(c.startedAt))} · ${jml} pesan${
            c.note ? ' · ' + esc(c.note) : ''}</small>
        </div>
        <span style="margin-left:auto" class="chip ${selesai ? '' : 'chip--g'}">${
          selesai ? 'selesai' : 'aktif'}</span>
      </a>`;
    }).join('')}</div>`;
  }

  function gambarCatatan(patientId, bolehHapus) {
    const notes = TC.Notes.list(patientId);
    if (!notes.length) {
      return `<div class="empty">${icon('doc')}<b>Belum ada catatan klinis</b>
        <p>Catatan yang tersimpan akan tampil di sini, terbaru lebih dulu.</p></div>`;
    }
    return `<div class="list">${notes.map((n) => `
      <div class="row" style="align-items:flex-start">
        <span class="row__ico">${icon('doc')}</span>
        <div style="min-width:0;flex:1">
          <b style="font-size:.87rem">${esc(n.author)}${
            n.role ? ' · ' + esc(D.role(n.role).name) : ''}</b>
          <small class="tiny muted" style="display:block">${esc(shortDate(n.at))} ·
            ${esc(hhmm(n.at))} · ${esc(relTime(n.at))}</small>
          <p class="small" style="margin:.5rem 0 0;white-space:pre-wrap;color:var(--ink-2)">${esc(n.text)}</p>
        </div>
        ${bolehHapus ? `<button class="icon-btn" data-note-del="${esc(n.id)}"
          aria-label="Hapus catatan" title="Hapus catatan">${icon('trash')}</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function viewPatientDetail(params) {
    const p = D.patient(params.id);
    if (!p) {
      // Layar ini dipakai dua peran; mengembalikan ke daftar milik peran lain
      // akan tertahan penjaga rute lalu memantul ke beranda.
      Router.navigate(Store.is('admin-faskes') ? '/faskes/anggota' : '/klinik/pasien', true);
      return;
    }
    const m = D.STATUS_META[p.status];
    const fac = D.facility(p.fac);
    const riwayat = TC.Consult.forPatient(p.id);
    // Admin faskes memakai layar yang sama lewat /faskes/anggota/:id, tetapi
    // bukan klinisi — catatan klinis dibuka baca saja untuknya.
    const bolehMenulis = Store.is('dokter');

    TC.topbar(p.name, { sub: p.unit });
    setView(`
      <div class="card" style="display:flex;gap:14px;align-items:center">
        <span class="avatar avatar--lg" style="background:${m.color}">${esc(initials(p.name))}</span>
        <div style="min-width:0">
          <b style="font-size:1rem">${esc(p.name)}</b>
          <small class="muted" style="display:block;font-size:.8rem">
            ${p.age} tahun · ${p.sex === 'P' ? 'Perempuan' : 'Laki-laki'}</small>
          <small class="tiny muted">${esc(fac.name)}</small>
        </div>
        <span style="margin-left:auto">${statusChip(p.status)}</span>
      </div>

      <div class="vital-grid mt">
        <div class="vital vital--hr"><span class="vital__lab">${icon('heart')} Detak jantung</span>
          <span class="vital__val">${p.hr}<u>bpm</u></span></div>
        <div class="vital vital--spo"><span class="vital__lab">${icon('spo2')} SpO₂</span>
          <span class="vital__val">${p.spo2}<u>%</u></span></div>
        <div class="vital vital--tmp"><span class="vital__lab">${icon('temp')} Suhu</span>
          <span class="vital__val">${p.temp}<u>°C</u></span></div>
        <div class="vital vital--bp"><span class="vital__lab">${icon('bp')} Tekanan darah</span>
          <span class="vital__val">${p.sys}/${p.dia}</span></div>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('brain')}<h3>Indeks stres</h3>
          <span class="push"></span>${statusChip(p.stress >= 66 ? 'crit' : p.stress >= 34 ? 'warn' : 'ok')}</div>
        <figure class="gauge" style="margin:0">
          ${TC.gaugeSvg(p.stress)}
          <figcaption><b>${p.stress}</b><span>dari 100</span></figcaption></figure>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('chart')}<h3>Detak jantung istirahat · 7 hari</h3></div>
        <div class="chart-wrap"><canvas id="cPat" style="height:150px"></canvas></div>
      </div>

      <div class="note note--${p.status === 'crit' ? 'd' : p.status === 'warn' ? 'w' : 'i'} mt">
        ${icon(p.status === 'ok' ? 'info' : 'alert')}
        <div><b>Catatan pemantauan</b>${esc(p.note)}</div></div>

      <div class="list mt">
        <div class="row"><span class="row__ico">${icon('watch')}</span>
          <div><b>Perangkat</b><small>${esc(p.device)} · sinkron ${esc(relTime(Date.now() - 3600000))}</small></div></div>
        <div class="row"><span class="row__ico">${icon('building')}</span>
          <div><b>Unit</b><small>${esc(fac.name)} · ${esc(fac.city)}</small></div></div>
      </div>

      <div class="section-title">${icon('stetho')} Riwayat konsultasi
        <span class="push"></span>
        <span class="chip">${riwayat.length}</span></div>
      <div id="patRiwayat">${gambarRiwayat(riwayat)}</div>

      <div class="section-title">${icon('doc')} Catatan klinis
        <span class="push"></span>
        <span class="chip" data-note-count>${TC.Notes.count(p.id)}</span></div>

      ${bolehMenulis ? `
        <div class="card">
          <label class="field">
            <span>Catatan baru</span>
            <textarea id="noteText" rows="4" maxlength="4000"
              placeholder="Temuan pemeriksaan, penilaian, dan rencana tindak lanjut…"></textarea>
            <small>Setelah disimpan, isi catatan tidak dapat diubah — hanya dihapus.</small>
          </label>
          <button class="btn btn--primary btn--block mt" data-note-save>
            ${icon('check')} Simpan catatan</button>
        </div>` : `
        <div class="note note--i">${icon('info')}
          <div><b>Hanya dapat dibaca</b>Catatan klinis ditulis oleh dokter. Peran Anda
          (${esc(D.role(Store.role()).name)}) dapat membacanya tetapi tidak menambahkannya.</div></div>`}

      <div id="patNotes" class="mt">${gambarCatatan(p.id, bolehMenulis)}</div>

      <div class="grid2 mt2">
        <button class="btn btn--primary btn--block" data-chat>${icon('chat')} Mulai konsultasi</button>
        <button class="btn btn--ghost btn--block" data-esc>${icon('alert')} Tandai eskalasi</button>
      </div>

      <div class="note note--w mt2">${icon('alert')}
        <div><b>Data contoh</b>Angka pada halaman ini adalah ilustrasi purwarupa, bukan rekam medis nyata.
        Catatan klinis tersimpan di peramban perangkat ini saja, belum dibagikan antar-dokter.</div></div>
    `);

    const w = series7('pat' + p.id, Math.max(50, p.hr - 12), p.hr + 6);
    TC.lineChart($('#cPat'), [{ data: w.map((d) => d.v), color: m.color, fill: true, dots: true }],
      { xLabels: w.map((d) => d.label) });

    /* ---------------- catatan klinis ---------------- */
    function segarkanCatatan() {
      const box = $('#patNotes');
      if (box) box.innerHTML = gambarCatatan(p.id, bolehMenulis);
      const c = $('[data-note-count]');
      if (c) c.textContent = TC.Notes.count(p.id);
      pasangHapus();
    }

    function pasangHapus() {
      if (!bolehMenulis) return;
      $$('[data-note-del]').forEach((b) => {
        b.onclick = async () => {
          const ok = await confirmSheet({
            title: 'Hapus catatan klinis?',
            body: 'Catatan yang dihapus tidak dapat dikembalikan.',
            ok: 'Hapus', danger: true
          });
          if (!ok) return;
          TC.Notes.remove(p.id, b.dataset.noteDel);
          segarkanCatatan();
          toast('Catatan dihapus.');
        };
      });
    }
    pasangHapus();

    if (bolehMenulis) {
      $('[data-note-save]').onclick = () => {
        const ta = $('#noteText');
        const isi = ta.value.trim();
        if (!isi) { toast('Catatan masih kosong.'); ta.focus(); return; }
        const u = Store.user();
        const penulis = (D.doctor(u && u.doctorId) || {}).name || (u && u.name) || 'Dokter';
        TC.Notes.add(p.id, isi, penulis, Store.role());
        ta.value = '';
        segarkanCatatan();
        toast('Catatan klinis disimpan.');
      };
    }

    $('[data-chat]').onclick = () => {
      const doc = D.doctor(Store.user().doctorId) || D.DOCTORS[0];
      // patientId dikirim agar percakapan ini ikut terkumpul di riwayat pasien.
      const c = TC.Consult.start(doc.id, 'chat', p.id);
      TC.Consult.push(c.id, {
        from: 'doc',
        text: `Selamat siang ${p.name.split(' ')[0]}, saya melihat pemantauan Anda beberapa hari ini. ` +
              'Boleh ceritakan bagaimana kondisi yang Anda rasakan?'
      });
      Router.navigate('/chat/' + c.id);
    };
    $('[data-esc]').onclick = () => {
      Store.notify('Eskalasi ditandai', p.name + ' · ' + p.unit, 'warn');
      toast('Pasien ditandai untuk tindak lanjut.');
    };
  }

  /* ============================================================
     2. ADMIN FASKES
     ============================================================ */
  function facilityOf(u) {
    return D.facility(u.facilityId || 'f1');
  }

  function viewFacility() {
    const u = Store.user();
    const f = facilityOf(u);
    const members = D.PATIENTS.filter((p) => p.fac === f.id);
    const crit = f.critical, warn = f.warn;
    const ok = Math.max(0, f.members - crit - warn);

    setTopbar('');
    setView(`
      <div class="hero-head">
        <span class="avatar avatar--lg" style="background:#6C5CE7;border-radius:18px">
          ${icon(f.icon)}</span>
        <div style="min-width:0">
          <b>${esc(f.name)}</b>
          <small>${esc(f.kind)} · ${esc(f.city)} · paket ${esc(f.plan)}</small>
        </div>
        <button class="icon-btn" data-notif style="margin-left:auto" aria-label="Notifikasi">
          ${icon('bell')}</button>
      </div>

      <div class="stat-row">
        <div><b>${f.members}</b><span>Anggota</span></div>
        <div><b>${f.devices}</b><span>Perangkat</span></div>
        <div><b style="color:var(--coral-500)">${crit}</b><span>Eskalasi kritis</span></div>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('users')}<h3>Status triase unit</h3>
          <span class="push"></span><span class="chip">${f.members} orang</span></div>
        ${triaseBar(ok, warn, crit)}
      </div>

      <div class="card mt">
        <div class="card__head">${icon('chart')}<h3>Eskalasi 7 hari terakhir</h3></div>
        <div class="chart-wrap"><canvas id="cFac" style="height:150px"></canvas></div>
      </div>

      <div class="section-title">${icon('alert')} Perlu tindak lanjut
        <span class="push"></span><a class="link" href="#/faskes/anggota">Semua anggota</a></div>
      ${members.filter((p) => p.status !== 'ok').length ? `<div class="list">
        ${members.filter((p) => p.status !== 'ok').map((p) => patientRow(p, '#/faskes/anggota/' + p.id)).join('')}
      </div>` : `<div class="card"><p class="small muted tc" style="padding:16px">
        Tidak ada anggota yang memerlukan tindak lanjut saat ini.</p></div>`}

      <div class="section-title">${icon('sparkle')} Kelola unit</div>
      <div class="quick">
        <a href="#/faskes/anggota"><i style="background:#EDF9F2;color:#03804C">${icon('users')}</i>Anggota</a>
        <a href="#/faskes/perangkat"><i style="background:#DCEEF9;color:#075A85">${icon('watch')}</i>Perangkat</a>
        <a href="#/faskes/nakes"><i style="background:#EEEBFD;color:#4A3BB8">${icon('stetho')}</i>Nakes</a>
        <a href="#/notifikasi"><i style="background:#FFF1D6;color:#8A5D00">${icon('bell')}</i>Peringatan</a>
      </div>

      <div class="promo mt2">
        <svg class="promo__deco" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <circle cx="100" cy="100" r="86" stroke="#fff" stroke-width="2"/>
          <circle cx="100" cy="100" r="58" stroke="#fff" stroke-width="2" stroke-dasharray="4 8"/></svg>
        <h3>Laporan berkala unit</h3>
        <p>Rekap bulanan kondisi anggota, kepatuhan pemakaian perangkat, dan jumlah eskalasi
           dapat diunduh untuk kebutuhan pelaporan internal.</p>
        <button class="btn btn--soft btn--sm" data-report>${icon('doc')} Susun laporan</button>
      </div>
    `);

    const w = series7('facWeek', 2, 16);
    TC.lineChart($('#cFac'), [{ data: w.map((d) => d.v), color: '#6C5CE7', fill: true, dots: true }],
      { xLabels: w.map((d) => d.label) });

    $('[data-notif]').onclick = () => Router.navigate('/notifikasi');
    $('[data-report]').onclick = () => toast('Penyusunan laporan belum tersedia pada purwarupa ini.', 'err');
  }

  function viewFacilityMembers() {
    const f = facilityOf(Store.user());
    TC.topbar('Anggota Unit', { sub: f.name, back: false });
    const members = D.PATIENTS.filter((p) => p.fac === f.id);
    setView(`
      <div class="searchbar">${icon('search')}
        <input id="mq" type="search" placeholder="Cari nama atau unit" aria-label="Cari anggota"></div>
      <div class="note note--i mt">${icon('info')}
        <div><b>${members.length} dari ${f.members} anggota</b>Purwarupa menampilkan sebagian data
        sebagai contoh; sisanya diwakili oleh angka ringkasan.</div></div>
      <div class="list mt" id="mList"></div>`);

    function draw(q) {
      const list = members.filter((p) => !q ||
        (p.name + ' ' + p.unit).toLowerCase().indexOf(q) !== -1);
      $('#mList').innerHTML = list.length
        ? list.map((p) => patientRow(p, '#/faskes/anggota/' + p.id)).join('')
        : `<div class="empty" style="background:var(--surface)">${icon('search')}
           <b>Tidak ditemukan</b><p>Coba kata kunci lain.</p></div>`;
    }
    draw('');
    $('#mq').oninput = (e) => draw(e.target.value.trim().toLowerCase());
  }

  function viewFacilityDevices() {
    const f = facilityOf(Store.user());
    TC.topbar('Perangkat Unit', { sub: f.name, back: false });

    // Inventaris dibangkitkan sekali per hari agar angkanya stabil saat dilihat ulang.
    const inv = D.DEVICE_TYPES.map((t, i) => {
      const s = series7('inv' + t.type, 4, 60)[6].v;
      return { t, count: s + (i === 0 ? 40 : 0), battery: TC.rint(46, 96), synced: TC.rint(88, 100) };
    });
    const total = inv.reduce((a, x) => a + x.count, 0);

    setView(`
      <div class="stat-row">
        <div><b>${total}</b><span>Perangkat</span></div>
        <div><b>${Math.round(inv.reduce((a, x) => a + x.synced, 0) / inv.length)}%</b><span>Tersinkron</span></div>
        <div><b>${inv.filter((x) => x.battery < 55).length}</b><span>Baterai rendah</span></div>
      </div>

      <div class="section-title">${icon('watch')} Inventaris per jenis</div>
      <div class="stack--sm stack">
        ${inv.map((x) => `
          <div class="dev-card">
            <span class="dev-card__ico" style="background:var(--green-100);color:var(--green-600)">
              ${icon(x.t.icon)}</span>
            <span style="min-width:0;flex:1">
              <b>${esc(x.t.name)}</b><small>${esc(x.t.tagline)}</small>
              <span class="meta">
                <span class="chip" style="font-size:.66rem">${x.count} unit</span>
                <span class="chip ${x.battery < 55 ? 'chip--a' : 'chip--g'}" style="font-size:.66rem">
                  ${icon('battery')} rata-rata ${x.battery}%</span>
                <span class="chip" style="font-size:.66rem">${x.synced}% sinkron</span>
              </span>
            </span>
          </div>`).join('')}
      </div>

      <div class="card mt2">
        <div class="card__head">${icon('sync')}<h3>Kepatuhan sinkronisasi 7 hari</h3></div>
        <div class="chart-wrap"><canvas id="cSync" style="height:150px"></canvas></div>
        <p class="tiny muted mt">Persentase perangkat yang menyinkronkan datanya minimal sekali sehari.</p>
      </div>
    `);
    const w = series7('syncWeek', 78, 99);
    TC.barChart($('#cSync'), w.map((d) => d.v), w.map((d) => d.label), '#049A5B');
  }

  function viewFacilityStaff() {
    const f = facilityOf(Store.user());
    TC.topbar('Tenaga Kesehatan', { sub: f.name, back: false });
    const staff = D.DOCTORS.slice(0, f.staff);
    setView(`
      <div class="note note--i">${icon('info')}
        <div><b>${staff.length} nakes terhubung</b>Mereka menerima eskalasi dari unit ini dan dapat
        memulai konsultasi dengan anggota binaan.</div></div>

      <div class="stack mt">
        ${staff.map((doc) => `
          <div class="doc">
            <span class="doc__av">
              <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
              <i class="st${doc.online ? ' on' : ''}"></i></span>
            <span class="doc__body">
              <b>${esc(doc.name)}</b>
              <span class="spec-name">${esc(D.spec(doc.spec).name)}</span>
              <span class="meta">
                <span>${icon('star')} ${doc.rating}</span>
                <span>${icon('doc')} ${doc.exp} thn</span>
                <span>${icon('clock')} ${esc(doc.wait)}</span></span>
            </span>
          </div>`).join('')}
      </div>

      <button class="btn btn--ghost btn--block mt2" data-add>${icon('plus')} Undang nakes lain</button>
    `);
    $('[data-add]').onclick = () => toast('Pengundangan nakes belum tersedia pada purwarupa ini.', 'err');
  }

  /* ============================================================
     3. ADMIN PLATFORM
     ============================================================ */
  function viewSystem() {
    const users = Object.values(Store.state.users);
    const totalMembers = D.FACILITIES.reduce((a, f) => a + f.members, 0);
    const totalDevices = D.FACILITIES.reduce((a, f) => a + f.devices, 0);

    setTopbar('');
    setView(`
      <div class="hero-head">
        <span class="avatar avatar--lg" style="background:#E09B12;border-radius:18px">
          ${icon('shield')}</span>
        <div style="min-width:0">
          <b>Ringkasan Platform</b>
          <small>${esc(TC.fullDate(new Date()))}</small>
        </div>
        <button class="icon-btn" data-notif style="margin-left:auto" aria-label="Notifikasi">
          ${icon('bell')}</button>
      </div>

      <div class="vital-grid">
        <div class="vital"><span class="vital__lab">${icon('users')} Pengguna</span>
          <span class="vital__val">${totalMembers.toLocaleString('id-ID')}</span></div>
        <div class="vital"><span class="vital__lab">${icon('stetho')} Dokter</span>
          <span class="vital__val">${D.DOCTORS.length}</span></div>
        <div class="vital"><span class="vital__lab">${icon('building')} Faskes</span>
          <span class="vital__val">${D.FACILITIES.length}</span></div>
        <div class="vital"><span class="vital__lab">${icon('watch')} Perangkat</span>
          <span class="vital__val">${totalDevices.toLocaleString('id-ID')}</span></div>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('chart')}<h3>Konsultasi harian platform</h3></div>
        <div class="chart-wrap"><canvas id="cSys" style="height:160px"></canvas></div>
      </div>

      <div class="section-title">${icon('verify')} Menunggu verifikasi
        <span class="push"></span><span class="chip chip--a">2</span></div>
      <div class="list">
        ${D.DOCTORS.slice(6, 8).map((doc) => `
          <div class="row">
            <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
            <div style="min-width:0"><b>${esc(doc.name)}</b>
              <small>${esc(D.spec(doc.spec).name)} · ${esc(doc.hospital)}</small></div>
            <button class="btn btn--soft btn--sm" style="margin-left:auto"
                    data-verify="${doc.id}">Verifikasi</button>
          </div>`).join('')}
      </div>

      <div class="section-title">${icon('building')} Faskes teratas</div>
      <div class="list">
        ${D.FACILITIES.map((f) => `
          <a class="row" href="#/sistem/faskes">
            <span class="row__ico">${icon(f.icon)}</span>
            <div style="min-width:0"><b>${esc(f.name)}</b>
              <small>${esc(f.kind)} · ${f.members} anggota · ${esc(f.city)}</small></div>
            <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
              ${f.critical ? `<span class="chip chip--r">${f.critical} kritis</span>` : statusChip('ok')}
              ${icon('chev', 'chev')}</span>
          </a>`).join('')}
      </div>

      <div class="section-title">${icon('sparkle')} Kelola</div>
      <div class="quick">
        <a href="#/sistem/pengguna"><i style="background:#EDF9F2;color:#03804C">${icon('users')}</i>Pengguna</a>
        <a href="#/sistem/dokter"><i style="background:#DCEEF9;color:#075A85">${icon('stetho')}</i>Dokter</a>
        <a href="#/sistem/faskes"><i style="background:#EEEBFD;color:#4A3BB8">${icon('building')}</i>Faskes</a>
        <a href="#/profil/pengaturan"><i style="background:#FFF1D6;color:#8A5D00">${icon('sync')}</i>Sistem</a>
      </div>

      <div class="note note--w mt2">${icon('alert')}
        <div><b>Angka contoh</b>Statistik pada layar ini dibangkitkan untuk purwarupa dan
        tidak mencerminkan penggunaan sesungguhnya. Akun lokal di perangkat ini: ${users.length}.</div></div>
    `);

    const w = series7('sysWeek', 120, 420);
    TC.lineChart($('#cSys'), [{ data: w.map((d) => d.v), color: '#E09B12', fill: true, dots: true }],
      { xLabels: w.map((d) => d.label) });

    $('[data-notif]').onclick = () => Router.navigate('/notifikasi');
    $$('[data-verify]').forEach((b) => {
      b.onclick = () => {
        const doc = D.doctor(b.dataset.verify);
        Store.notify('Dokter terverifikasi', doc.name, 'ok');
        b.outerHTML = `<span class="chip chip--g" style="margin-left:auto">${icon('check')} Terverifikasi</span>`;
        toast(doc.name + ' diverifikasi.');
      };
    });
  }

  function viewSystemUsers() {
    TC.topbar('Kelola Pengguna', { sub: 'Akun pada perangkat ini', back: false });
    const users = Object.values(Store.state.users);
    const me = Store.user();

    setView(`
      <div class="note note--i">${icon('info')}
        <div><b>Cakupan purwarupa</b>Daftar ini memuat akun yang tersimpan di peramban ini.
        Pada sistem sungguhan, data pengguna berada di server dengan kontrol akses per peran.</div></div>

      <div class="section-title">${icon('users')} Akun lokal
        <span class="push"></span><span class="chip">${users.length}</span></div>
      <div class="list">
        ${users.map((u) => {
          const r = D.role(u.role || 'pasien');
          return `<div class="row">
            <span class="avatar" style="background:${r.color}">${esc(initials(u.name))}</span>
            <div style="min-width:0"><b>${esc(u.name)}${u.id === me.id ? ' · Anda' : ''}</b>
              <small>${esc(u.email)}</small>
              <small class="tiny" style="color:var(--faint)">
                ${u.provider === 'google' ? 'Masuk lewat Google' : u.demo ? 'Akun tamu' : 'Email & kata sandi'}</small></div>
            <button class="chip" style="margin-left:auto;background:${r.color}1a;color:${r.color};border-color:transparent"
                    data-urole="${u.id}">${esc(r.short)}</button>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">${icon('shield')} Sebaran peran</div>
      <div class="card">
        ${D.ROLES.map((r) => {
          const n = users.filter((u) => (u.role || 'pasien') === r.id).length;
          return `<div class="macro">
            <span class="macro__ico" style="background:${r.color}1a;color:${r.color}">${icon(r.icon)}</span>
            <b>${esc(r.name)}</b><span class="num">${n}</span></div>`;
        }).join('')}
      </div>
    `);

    $$('[data-urole]').forEach((b) => {
      b.onclick = () => roleSheet(b.dataset.urole);
    });
  }

  /** Mengubah peran sebuah akun (dipakai admin dan mode demo). */
  function roleSheet(userId) {
    const u = Store.state.users[userId];
    if (!u) return;
    sheet(`
      <h3>Ubah peran</h3>
      <p class="sub">${esc(u.name)} · ${esc(u.email)}</p>
      <div class="stack--sm stack">
        ${D.ROLES.map((r) => `
          <button class="row" data-setrole="${r.id}" style="border-radius:16px;
            ${(u.role || 'pasien') === r.id ? 'box-shadow:inset 0 0 0 1.5px var(--green-400);background:var(--green-50)' : ''}">
            <span class="row__ico" style="background:${r.color}1a;color:${r.color}">${icon(r.icon)}</span>
            <div style="min-width:0"><b>${esc(r.name)}</b><small>${esc(r.desc)}</small></div>
            ${(u.role || 'pasien') === r.id ? `<span class="chip chip--g" style="margin-left:auto">aktif</span>` : icon('chev', 'chev')}
          </button>`).join('')}
      </div>`);

    $$('[data-setrole]').forEach((b) => {
      b.onclick = () => {
        const role = b.dataset.setrole;
        Store.update((s) => {
          const x = s.users[userId];
          x.role = role;
          if (role === 'dokter' && !x.doctorId) x.doctorId = 'd1';
          if (role === 'admin-faskes' && !x.facilityId) x.facilityId = 'f1';
        });
        closeSheet();
        toast('Peran diubah menjadi ' + D.role(role).name + '.');
        const me = Store.user();
        if (me && me.id === userId) Router.navigate(D.role(role).home, true);
        else Router.render();
      };
    });
  }

  function viewSystemDoctors() {
    TC.topbar('Kelola Dokter', { sub: D.DOCTORS.length + ' mitra terdaftar', back: false });
    setView(`
      <div class="searchbar">${icon('search')}
        <input id="dq" type="search" placeholder="Cari nama atau spesialisasi" aria-label="Cari dokter"></div>
      <div class="list mt" id="dList"></div>`);

    function draw(q) {
      const list = D.DOCTORS.filter((d) => !q ||
        (d.name + ' ' + D.spec(d.spec).name + ' ' + d.hospital).toLowerCase().indexOf(q) !== -1);
      $('#dList').innerHTML = list.map((doc) => `
        <div class="row">
          <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
          <div style="min-width:0"><b>${esc(doc.name)}</b>
            <small>${esc(D.spec(doc.spec).name)} · ${esc(doc.hospital)}</small>
            <small class="tiny" style="color:var(--faint)">${rupiah(doc.price)} · ${doc.reviews} ulasan</small></div>
          <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
            ${doc.online ? `<span class="chip chip--g"><i class="dotlive"></i> online</span>`
                         : `<span class="chip">luring</span>`}</span>
        </div>`).join('');
    }
    draw('');
    $('#dq').oninput = (e) => draw(e.target.value.trim().toLowerCase());
  }

  function viewSystemFacilities() {
    TC.topbar('Kelola Faskes', { sub: D.FACILITIES.length + ' unit terdaftar', back: false });
    setView(`
      <div class="stack">
        ${D.FACILITIES.map((f) => {
          const ok = Math.max(0, f.members - f.critical - f.warn);
          return `<div class="card">
            <div style="display:flex;gap:12px;align-items:center">
              <span class="row__ico" style="width:44px;height:44px;border-radius:14px">${icon(f.icon)}</span>
              <div style="min-width:0"><b style="font-size:.95rem">${esc(f.name)}</b>
                <small class="muted" style="display:block;font-size:.78rem">
                  ${esc(f.kind)} · ${esc(f.city)}</small></div>
              <span class="chip" style="margin-left:auto">${esc(f.plan)}</span>
            </div>
            <div class="stat-row mt" style="gap:7px">
              <div style="box-shadow:none;background:var(--canvas);border:0">
                <b style="font-size:1rem">${f.members}</b><span>Anggota</span></div>
              <div style="box-shadow:none;background:var(--canvas);border:0">
                <b style="font-size:1rem">${f.devices}</b><span>Perangkat</span></div>
              <div style="box-shadow:none;background:var(--canvas);border:0">
                <b style="font-size:1rem">${f.staff}</b><span>Nakes</span></div>
            </div>
            <div class="mt">${triaseBar(ok, f.warn, f.critical)}</div>
          </div>`;
        }).join('')}
      </div>`);
  }

  TC.views = TC.views || {};
  Object.assign(TC.views, {
    clinic: viewClinic, queue: viewQueue, patients: viewPatients, patientDetail: viewPatientDetail,
    facility: viewFacility, facilityMembers: viewFacilityMembers,
    facilityDevices: viewFacilityDevices, facilityStaff: viewFacilityStaff,
    system: viewSystem, systemUsers: viewSystemUsers,
    systemDoctors: viewSystemDoctors, systemFacilities: viewSystemFacilities,
    roleSheet
  });
})(window.TC);
