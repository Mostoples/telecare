/* ============================================================
   TeleCare App — views-care.js
   Lapisan telemedisin: pencarian dokter, profil dokter, konsultasi
   chat, panggilan video, dan jadwal temu.

   Dokter, tarif, dan balasan pada modul ini adalah data contoh untuk
   purwarupa. Tidak ada tenaga kesehatan sungguhan di balik layar.
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, rupiah, Store, Router, setView, setTopbar, toast,
          hhmm, relTime, initials, sheet, closeSheet, confirmSheet } = TC;
  const D = TC.DATA;

  /* ---------------- KARTU DOKTER ---------------- */
  function docCard(doc) {
    const sp = D.spec(doc.spec);
    return `<button class="doc" data-doc="${doc.id}">
      <span class="doc__av">
        <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
        <i class="st${doc.online ? ' on' : ''}"></i>
      </span>
      <span class="doc__body">
        <b>${esc(doc.name)}</b>
        <span class="spec-name">${esc(sp.name)}${doc.sub ? ' · ' + esc(doc.sub) : ''}</span>
        <span class="meta">
          <span>${icon('star')} ${doc.rating} <span class="muted">(${doc.reviews})</span></span>
          <span>${icon('doc')} ${doc.exp} thn</span>
          <span>${icon('clock')} ${esc(doc.wait)}</span>
        </span>
        <span class="doc__foot">
          <span class="doc__price"><b>${rupiah(doc.price)}</b><small>per konsultasi</small></span>
          <span class="btn ${doc.online ? 'btn--primary' : 'btn--ghost'} btn--sm">
            ${doc.online ? 'Chat sekarang' : 'Buat janji'}</span>
        </span>
      </span>
    </button>`;
  }

  function bindDocCards(root) {
    $$('[data-doc]', root).forEach((b) => {
      b.onclick = () => Router.navigate('/dokter/' + b.dataset.doc);
    });
  }

  /* ---------------- 1. BERANDA KONSULTASI ---------------- */
  function viewConsult() {
    TC.topbar('Konsultasi', { sub: 'Terhubung ke dokter & psikolog', back: false });

    const active = Store.state.consults.filter((c) => c.status === 'active');
    const attachMealId = sessionStorage.getItem('tc.attachMeal');
    const online = D.DOCTORS.filter((d) => d.online);

    setView(`
      <div class="searchbar">${icon('search')}
        <input id="q" type="search" placeholder="Cari dokter, spesialisasi, atau keluhan"
               autocomplete="off" aria-label="Cari dokter">
      </div>
      <div class="mt" id="fbStatus"></div>

      ${attachMealId ? `<div class="note note--b mt">${icon('link')}
        <div><b>Satu sesi makan siap dilampirkan</b>Ringkasan sesi akan dikirim otomatis
        di awal percakapan berikutnya.</div></div>` : ''}

      ${active.length ? `
        <div class="section-title">${icon('chat')} Sedang berlangsung</div>
        <div class="list">
          ${active.map((c) => {
            const doc = D.doctor(c.doctorId);
            const last = c.messages[c.messages.length - 1];
            return `<a class="row" href="#/chat/${esc(c.id)}">
              <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
              <div style="min-width:0"><b>${esc(doc.name)}</b>
                <small style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last ? last.text : '')}</small></div>
              <span class="chip chip--g" style="margin-left:auto"><i class="dotlive"></i> aktif</span>
            </a>`;
          }).join('')}
        </div>` : ''}

      <div class="section-title">${icon('stetho')} Pilih spesialisasi</div>
      <div class="spec-grid">
        ${D.SPECIALTIES.map((s) => `
          <a class="spec" href="#/konsultasi/spesialis/${s.id}">
            <i class="tile3d">${s.i3d ? TC.i3d(s.i3d) : s.emoji}</i>${esc(s.name)}</a>`).join('')}
      </div>

      <div class="promo mt2">
        ${TC.ilus3d('konsultasi', 'promo__art')}
        <h3>Data vital Anda ikut terkirim</h3>
        <p>Saat konsultasi dimulai, dokter menerima ringkasan detak jantung, SpO₂, suhu, dan
           tekanan darah terbaru dari perangkat Anda — tanpa perlu diketik ulang.</p>
      </div>

      <div class="section-title">${icon('heart')} Tersedia sekarang
        <span class="push"></span><span class="chip chip--g">${online.length} dokter online</span></div>
      <div class="stack" id="docList">
        ${D.DOCTORS.slice().sort((a, b) => (b.online - a.online) || (b.rating - a.rating))
          .map(docCard).join('')}
      </div>
    `);

    const root = $('#view');
    bindDocCards(root);

    function drawFb() {
      const el = $('#fbStatus');
      if (!el) return;
      const fb = TC.FB;
      if (!fb || !fb.settled) {
        el.innerHTML = `<span class="chip">${icon('sync')} Menghubungkan ke server…</span>`;
      } else if (fb.canSync && fb.canSync()) {
        el.innerHTML = `<span class="chip chip--g"><i class="dotlive"></i> Pesan &amp; panggilan tersambung ke server</span>`;
      } else if (fb.authFatal) {
        // Tersambung tetapi tanpa sesi sah: aturan database menolak tulisan,
        // jadi jangan mengaku tersinkron.
        el.innerHTML = `<span class="chip chip--a">${icon('alert')} Sesi server belum aktif — pesan disimpan lokal</span>`;
      } else {
        el.innerHTML = `<span class="chip chip--a">${icon('alert')} Luring — pesan disimpan lokal, panggilan hanya pratinjau</span>`;
      }
    }
    drawFb();
    if (TC.FB) Router.onLeave(TC.FB.onStatus(drawFb));

    $('#q').oninput = (e) => {
      const q = e.target.value.trim().toLowerCase();
      const list = D.DOCTORS.filter((d) => {
        if (!q) return true;
        const sp = D.spec(d.spec);
        return (d.name + ' ' + sp.name + ' ' + (d.sub || '') + ' ' + d.hospital + ' ' + d.about)
          .toLowerCase().indexOf(q) !== -1;
      });
      $('#docList').innerHTML = list.length ? list.map(docCard).join('') :
        `<div class="empty">${icon('search')}<b>Tidak ditemukan</b>
         <p>Coba kata kunci lain, misalnya “jantung”, “stres”, atau “gizi”.</p></div>`;
      bindDocCards($('#docList'));
    };
  }

  /* ---------------- 2. DAFTAR PER SPESIALISASI ---------------- */
  function viewSpecialty(params) {
    const sp = D.spec(params.id);
    const list = D.DOCTORS.filter((d) => d.spec === params.id);
    TC.topbar(sp.name, { sub: list.length + ' dokter tersedia' });
    setView(list.length ? `<div class="stack">${list.map(docCard).join('')}</div>` : `
      <div class="empty">${icon('stetho')}<b>Belum ada dokter</b>
      <p>Spesialisasi ini belum memiliki mitra aktif pada purwarupa.</p>
      <a class="btn btn--primary btn--sm mt" href="#/konsultasi">Lihat semua dokter</a></div>`);
    bindDocCards($('#view'));
  }

  /* ---------------- 3. PROFIL DOKTER ---------------- */
  function viewDoctor(params) {
    const doc = D.doctor(params.id);
    if (!doc) { Router.navigate('/konsultasi', true); return; }
    const sp = D.spec(doc.spec);

    TC.topbar('Profil Dokter');
    setView(`
      <div class="card tc" style="padding:24px">
        <span class="avatar avatar--xl" style="background:${doc.color};margin:0 auto 14px">
          ${esc(initials(doc.name))}</span>
        <h2 style="font-size:1.15rem">${esc(doc.name)}</h2>
        <p class="small" style="color:var(--green-600);font-weight:700;margin-top:3px">
          ${esc(sp.name)}${doc.sub ? ' · ' + esc(doc.sub) : ''}</p>
        <p class="tiny muted mt">${esc(doc.hospital)}</p>
        <div class="mt">
          <span class="chip chip--${doc.online ? 'g' : ''}">
            ${doc.online ? '<i class="dotlive"></i> Online' : icon('clock')} ${esc(doc.wait)}</span>
        </div>
      </div>

      <div class="stat-row mt">
        <div><b>${doc.rating}</b><span>Rating</span></div>
        <div><b>${doc.exp} thn</b><span>Pengalaman</span></div>
        <div><b>${(doc.reviews / 1000).toFixed(1)}rb</b><span>Ulasan</span></div>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('doc')}<h3>Tentang</h3></div>
        <p class="small" style="color:var(--ink-2);line-height:1.65">${esc(doc.about)}</p>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('link')}<h3>Data yang akan dibagikan</h3></div>
        <p class="tiny muted" style="margin-bottom:10px">Dikirim otomatis di awal percakapan
          agar dokter punya konteks. Anda dapat membatalkannya sebelum memulai.</p>
        <label class="row" style="border-radius:14px">
          <input type="checkbox" id="shareVitals" checked
                 style="width:18px;height:18px;accent-color:var(--green-500)">
          <div><b>Ringkasan vital terbaru</b><small>Detak jantung, SpO₂, suhu, tekanan darah</small></div>
        </label>
        <label class="row" style="border-radius:14px">
          <input type="checkbox" id="shareMeals" ${Store.state.meals.length ? 'checked' : 'disabled'}
                 style="width:18px;height:18px;accent-color:var(--green-500)">
          <div><b>Sesi makan terakhir</b>
            <small>${Store.state.meals.length ? 'Puncak dan komposisi gizi' : 'Belum ada sesi tercatat'}</small></div>
        </label>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('shield')}<h3>Biaya konsultasi</h3></div>
        <div style="display:flex;align-items:center;gap:12px">
          <div><b style="font-size:1.4rem">${rupiah(doc.price)}</b>
            <p class="tiny muted">sekali sesi, chat &amp; video</p></div>
          <span class="chip chip--g" style="margin-left:auto">Mode demo · tidak ditagih</span>
        </div>
      </div>

      <div class="grid2 mt2">
        <button class="btn btn--primary btn--lg btn--block" data-chat>${icon('chat')} Mulai Chat</button>
        <button class="btn btn--ghost btn--lg btn--block" data-video>${icon('video')} Video Call</button>
      </div>
      <div class="grid2 mt">
        <button class="btn btn--ghost btn--block" data-voice>${icon('phone')} Panggilan Suara</button>
        <button class="btn btn--soft btn--block" data-book>${icon('cal')} Buat janji temu</button>
      </div>

      <div class="note note--b mt2">${icon('link')}
        <div><b>Bagaimana ini bekerja</b>Pesan dikirim sungguhan lewat Firebase Realtime Database,
        dan panggilan memakai WebRTC langsung antarperangkat (sinyal lewat Firebase).
        Bagikan tautan percakapan agar orang lain ikut dari perangkat berbeda.</div></div>

      <div class="note note--w mt">${icon('alert')}
        <div><b>Tidak ada dokter sungguhan di purwarupa ini</b>Balasan teks dihasilkan otomatis dari
        pola kata kunci. Untuk keluhan nyata, hubungi layanan kesehatan resmi.</div></div>
    `);

    function begin(mode) {
      const c = TC.Consult.start(doc.id, mode);
      if ($('#shareVitals').checked) {
        TC.Consult.push(c.id, { from: 'me', kind: 'vitals', data: TC.Vitals.snapshot(), text: '' });
      }
      const mealId = sessionStorage.getItem('tc.attachMeal');
      const meal = Store.state.meals.find((m) => m.id === mealId) || Store.state.meals[0];
      if ($('#shareMeals').checked && meal) {
        TC.Consult.push(c.id, { from: 'me', kind: 'meal', data: { id: meal.id }, text: '' });
      }
      sessionStorage.removeItem('tc.attachMeal');
      Router.navigate((mode === 'video' || mode === 'audio') ? '/call/' + c.id : '/chat/' + c.id);
    }

    $('[data-chat]').onclick = () => begin('chat');
    $('[data-video]').onclick = () => {
      if (!doc.online) { toast('Dokter sedang tidak online. Coba buat janji temu.', 'err'); return; }
      begin('video');
    };
    $('[data-voice]').onclick = () => {
      if (!doc.online) { toast('Dokter sedang tidak online. Coba buat janji temu.', 'err'); return; }
      begin('audio');
    };
    $('[data-book]').onclick = () => bookSheet(doc);
  }

  function bookSheet(doc) {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      days.push(d);
    }
    const slots = ['09.00', '10.30', '13.00', '15.30', '19.00'];
    sheet(`
      <h3>Buat janji temu</h3>
      <p class="sub">${esc(doc.name)}</p>
      <label class="field"><span>Tanggal</span>
        <span class="wrap"><select id="bDay">
          ${days.map((d, i) => `<option value="${d.getTime()}">${i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : TC.DAYS[d.getDay()]}, ${TC.shortDate(d)}</option>`).join('')}
        </select></span></label>
      <label class="field"><span>Jam</span>
        <span class="wrap"><select id="bSlot">
          ${slots.map((s) => `<option>${s}</option>`).join('')}
        </select></span></label>
      <label class="field"><span>Keluhan singkat</span>
        <span class="wrap"><textarea id="bNote" rows="3" placeholder="Contoh: sering pusing sejak seminggu"></textarea></span></label>
      <button class="btn btn--primary btn--block" id="bSave">Konfirmasi janji</button>`);

    $('#bSave').onclick = () => {
      const at = +$('#bDay').value;
      const slot = $('#bSlot').value;
      Store.update((s) => {
        s.appointments.unshift({
          id: TC.uid('ap'), doctorId: doc.id, at, slot,
          note: $('#bNote').value.trim(), createdAt: Date.now(), status: 'terjadwal'
        });
      });
      Store.notify('Janji temu dibuat',
        `${doc.name} · ${TC.shortDate(new Date(at))} pukul ${slot}`, 'ok');
      closeSheet();
      toast('Janji temu tersimpan.');
      Router.navigate('/jadwal');
    };
  }

  /* ---------------- 4. JADWAL ---------------- */
  function viewSchedule() {
    TC.topbar('Janji Temu', { sub: 'Jadwal konsultasi Anda' });
    const aps = Store.state.appointments;
    setView(aps.length ? `<div class="stack">${aps.map((a) => {
      const doc = D.doctor(a.doctorId);
      return `<div class="card">
        <div style="display:flex;gap:12px;align-items:center">
          <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
          <div style="min-width:0"><b style="font-size:.92rem">${esc(doc.name)}</b>
            <small class="muted" style="display:block;font-size:.78rem">${esc(D.spec(doc.spec).name)}</small></div>
          <span class="chip chip--g" style="margin-left:auto">${esc(a.status)}</span>
        </div>
        <div class="row" style="background:var(--canvas);border-radius:14px;margin-top:12px">
          <span class="row__ico">${icon('cal')}</span>
          <div><b>${esc(TC.shortDate(new Date(a.at)))}</b><small>pukul ${esc(a.slot)} WIB</small></div>
        </div>
        ${a.note ? `<p class="small muted mt">“${esc(a.note)}”</p>` : ''}
        <div class="grid2 mt">
          <button class="btn btn--primary btn--sm" data-start="${a.doctorId}">${icon('chat')} Mulai lebih awal</button>
          <button class="btn btn--dangerSoft btn--sm" data-cancel="${a.id}">Batalkan</button>
        </div>
      </div>`;
    }).join('')}</div>` : `
      <div class="empty">${icon('cal')}<b>Belum ada janji temu</b>
      <p>Buat janji dari halaman profil dokter bila ingin berkonsultasi pada waktu tertentu.</p>
      <a class="btn btn--primary btn--sm mt" href="#/konsultasi">Cari dokter</a></div>`);

    $$('[data-start]').forEach((b) => {
      b.onclick = () => Router.navigate('/dokter/' + b.dataset.start);
    });
    $$('[data-cancel]').forEach((b) => {
      b.onclick = async () => {
        const ok = await confirmSheet({
          title: 'Batalkan janji temu?', body: 'Jadwal ini akan dihapus dari daftar Anda.',
          ok: 'Batalkan janji', danger: true
        });
        if (!ok) return;
        Store.update((s) => { s.appointments = s.appointments.filter((a) => a.id !== b.dataset.cancel); });
        toast('Janji temu dibatalkan.');
        Router.render();
      };
    });
  }

  /* ---------------- 5. CHAT KONSULTASI ---------------- */
  /**
   * Bila percakapan belum ada di perangkat ini (tautan undangan dibuka di
   * perangkat lain), ambil metadatanya dari Firebase lebih dulu.
   */
  function joining(id, then) {
    TC.topbar('Bergabung', { sub: 'Mengambil percakapan dari server' });
    setView(`<div class="empty" style="padding-top:60px">
      <svg viewBox="0 0 48 48" fill="none" style="width:52px;height:52px;margin:0 auto 14px">
        <circle cx="24" cy="24" r="20" style="stroke:var(--gice)" stroke-width="4"/>
        <circle cx="24" cy="24" r="20" style="stroke:var(--g2)" stroke-width="4" stroke-linecap="round"
                stroke-dasharray="32 100">
          <animateTransform attributeName="transform" type="rotate"
            from="0 24 24" to="360 24 24" dur="1s" repeatCount="indefinite"/></circle></svg>
      <b>Menghubungkan…</b><p>Mengambil percakapan <span class="mono">${esc(id)}</span> dari Realtime Database.</p>
    </div>`);

    TC.Consult.adopt(id).then((c) => {
      if (c) { then(c); return; }
      setView(`<div class="empty">${icon('alert')}
        <b>Percakapan tidak ditemukan</b>
        <p>Tautan mungkin sudah kedaluwarsa, atau percakapan ini belum pernah dibuat di server.</p>
        <a class="btn btn--primary btn--sm mt" href="#/konsultasi">Cari dokter</a></div>`);
    });
  }

  function viewChat(params) {
    const c = TC.Consult.get(params.id);
    if (!c) { joining(params.id, () => viewChat(params)); return; }
    const doc = D.doctor(c.doctorId) || D.DOCTORS[0];
    const FB = TC.FB;
    const asDoctor = Store.is('dokter');
    const myFrom = asDoctor ? 'doc' : 'me';
    const quick = asDoctor ? D.QUICK_REPLIES_DOC : D.QUICK_REPLIES;
    let docPresent = false;

    setTopbar('');
    setView(`
      <div class="chat">
        <header class="chat__head">
          <button class="topbar__back" data-back aria-label="Kembali">${icon('back')}</button>
          <span class="avatar" style="background:${asDoctor ? 'var(--green-500)' : doc.color}">
            ${esc(asDoctor ? 'PS' : initials(doc.name))}</span>
          <div style="min-width:0;flex:1">
            <b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(asDoctor ? ('Pasien · ' + c.id.slice(-4).toUpperCase()) : doc.name)}</b>
            <small id="chatStatus"></small>
          </div>
          <button class="icon-btn" data-voice aria-label="Panggilan suara">${icon('phone')}</button>
          <button class="icon-btn" data-video aria-label="Panggilan video">${icon('video')}</button>
          <button class="icon-btn" data-menu aria-label="Menu">${icon('doc')}</button>
        </header>

        <div class="chat__body" id="msgs"></div>

        ${c.status === 'active' ? `
          <div class="quickreplies" id="qr">
            ${quick.map((q) => `<button data-qr="${esc(q)}">${esc(q)}</button>`).join('')}
          </div>
          <div class="chat__foot">
            <button class="icon-btn" data-attach aria-label="Lampirkan data">${icon('link')}</button>
            <textarea id="inp" rows="1" placeholder="Tulis keluhan Anda…" aria-label="Pesan"></textarea>
            <button class="send" data-send aria-label="Kirim">${icon('send')}</button>
          </div>` : `
          <div class="chat__foot" style="justify-content:center">
            <button class="btn btn--soft btn--block" data-reopen>Mulai konsultasi baru dengan dokter ini</button>
          </div>`}
      </div>`, { cls: 'view view--full' });

    const box = $('#msgs');

    function drawStatus() {
      const el = $('#chatStatus');
      if (!el) return;
      if (c.status !== 'active') { el.innerHTML = 'konsultasi selesai'; return; }
      if (!FB || !FB.settled) { el.innerHTML = '<span style="color:var(--muted)">menghubungkan…</span>'; return; }
      if (!FB.online) {
        el.innerHTML = '<span style="color:var(--amber-700)">mode luring · pesan disimpan lokal</span>';
        return;
      }
      if (!FB.canSync()) {
        el.innerHTML = '<span style="color:var(--amber-700)">sesi server belum aktif · pesan disimpan lokal</span>';
        return;
      }
      el.innerHTML = asDoctor
        ? '<i class="dotlive"></i> Anda menjawab sebagai dokter'
        : (docPresent
            ? '<i class="dotlive"></i> dokter sedang online'
            : '<i class="dotlive"></i> tersinkron · Realtime Database');
    }

    function bubble(m) {
      const t = hhmm(new Date(m.at));
      if (m.from === 'sys' && m.kind !== 'call') return `<div class="msg msg--sys">${esc(m.text)}</div>`;

      if (m.kind === 'vitals') {
        const v = m.data;
        return `<div class="msg msg--card${m.from === myFrom ? ' msg--cardme' : ''}">
          <h5>${icon('heart')} Ringkasan vital terbaru</h5>
          <div class="vital-mini">
            <div><span>Detak jantung</span><b>${v.hr} bpm</b></div>
            <div><span>SpO₂</span><b>${v.spo2}%</b></div>
            <div><span>Suhu</span><b>${v.temp} °C</b></div>
            <div><span>Tekanan darah</span><b>${v.sys}/${v.dia}</b></div>
          </div>
          <p class="tiny muted" style="margin-top:9px">Dikirim otomatis dari perangkat · ${esc(t)}</p>
        </div>`;
      }

      if (m.kind === 'meal') {
        const meal = Store.state.meals.find((x) => x.id === m.data.id);
        if (!meal) return '';
        return `<div class="msg msg--card">
          <h5>${icon('food')} Sesi makan terakhir</h5>
          <p class="small"><b>${esc(meal.items.map((i) => i.n).join(', '))}</b></p>
          <div class="vital-mini" style="margin-top:9px">
            <div><span>Puncak</span><b>${meal.peak} mg/dL</b></div>
            <div><span>Delta</span><b>+${meal.delta}</b></div>
            <div><span>Karbohidrat</span><b>${meal.nutrition.carb} g</b></div>
            <div><span>Kalori</span><b>${meal.nutrition.kcal} kkal</b></div>
          </div>
          <p class="tiny muted" style="margin-top:9px">${esc(TC.shortDate(new Date(meal.at)))} · ${esc(t)}</p>
        </div>`;
      }

      if (m.kind === 'call') {
        return `<div class="msg msg--sys">${icon('video')} ${esc(m.text)}</div>`;
      }

      return `<div class="msg msg--${m.from === myFrom ? 'me' : 'doc'}">
        ${esc(m.text)}<time>${esc(t)}</time></div>`;
    }

    function draw() {
      const cc = TC.Consult.get(params.id);
      if (!cc) return;
      box.innerHTML = cc.messages.map(bubble).join('');
      box.scrollTop = box.scrollHeight;
    }
    draw();
    drawStatus();

    // Pesan baru dari Realtime Database langsung tergambar.
    const unsub = TC.Consult.subscribe(params.id, () => draw());
    const unstatus = FB ? FB.onStatus(drawStatus) : function () {};

    // Kehadiran dokter: saat dokter sungguhan membuka percakapan, balasan
    // otomatis dimatikan agar tidak bertabrakan dengan jawaban manusia.
    const unpres = FB ? FB.presence(params.id, Store.role()) : function () {};
    const unwatch = FB ? FB.watchPresence(params.id, (on) => {
      docPresent = on; drawStatus();
    }) : function () {};
    Router.onLeave(() => { unsub(); unstatus(); unpres(); unwatch(); });

    $('[data-video]').onclick = () => Router.navigate('/call/' + params.id);
    $('[data-voice]').onclick = () => {
      Store.update((st) => {
        const x = st.consults.find((k) => k.id === params.id);
        if (x) x.mode = 'audio';
      });
      Router.navigate('/call/' + params.id);
    };

    bindMenu();

    if (c.status !== 'active') {
      const re = $('[data-reopen]');
      if (re) re.onclick = () => Router.navigate(asDoctor ? '/klinik/antrean' : '/dokter/' + doc.id);
      return;
    }

    const inp = $('#inp');
    inp.addEventListener('input', () => {
      inp.style.height = 'auto';
      inp.style.height = Math.min(110, inp.scrollHeight) + 'px';
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 900) {
        e.preventDefault(); send();
      }
    });

    let busy = false;
    function send(text) {
      const t = (text != null ? text : inp.value).trim();
      if (!t || busy) return;
      TC.Consult.push(params.id, { from: myFrom, text: t });
      inp.value = ''; inp.style.height = 'auto';
      draw();

      // Dokter sungguhan menjawab sendiri; balasan otomatis hanya berlaku
      // pada sisi pasien ketika belum ada dokter yang hadir.
      if (asDoctor || docPresent) return;

      busy = true;
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      box.appendChild(typing);
      box.scrollTop = box.scrollHeight;

      const delay = 900 + Math.min(2200, t.length * 28);
      const timer = setTimeout(() => {
        typing.remove();
        if (!docPresent) TC.Consult.push(params.id, { from: 'doc', text: TC.Consult.replyTo(t) });
        busy = false;
        draw();
      }, delay);
      Router.onLeave(() => clearTimeout(timer));
    }

    $('[data-send]').onclick = () => send();
    $$('[data-qr]').forEach((b) => { b.onclick = () => send(b.dataset.qr); });

    $('[data-attach]').onclick = () => {
      sheet(`
        <h3>Lampirkan data</h3>
        <p class="sub">Kirimkan konteks dari perangkat Anda ke dokter.</p>
        <div class="list">
          <button class="row" data-at="vitals"><span class="row__ico">${icon('heart')}</span>
            <div><b>Vital terbaru</b><small>Detak jantung, SpO₂, suhu, tekanan darah</small></div>
            ${icon('chev', 'chev')}</button>
          <button class="row" data-at="meal" ${Store.state.meals.length ? '' : 'disabled style="opacity:.5"'}>
            <span class="row__ico">${icon('food')}</span>
            <div><b>Sesi makan terakhir</b><small>${Store.state.meals.length ? 'Puncak dan komposisi gizi' : 'Belum ada sesi'}</small></div>
            ${icon('chev', 'chev')}</button>
          <button class="row" data-at="ecg"><span class="row__ico">${icon('ecg')}</span>
            <div><b>Rekaman EKG 30 detik</b><small>Lead-I dari TeleBand</small></div>
            ${icon('chev', 'chev')}</button>
        </div>`);
      $$('[data-at]').forEach((b) => {
        b.onclick = () => {
          const k = b.dataset.at;
          if (k === 'vitals') {
            TC.Consult.push(params.id, { from: myFrom, kind: 'vitals', data: TC.Vitals.snapshot(), text: '' });
          } else if (k === 'meal') {
            const m = Store.state.meals[0];
            if (m) TC.Consult.push(params.id, { from: myFrom, kind: 'meal', data: { id: m.id }, text: '' });
          } else {
            TC.Consult.push(params.id, { from: myFrom, text: 'Saya lampirkan rekaman EKG lead-I 30 detik dari TeleBand.' });
          }
          closeSheet(); draw();
          if (!asDoctor) setTimeout(() => send('Mohon dibantu dibaca ya, Dok.'), 300);
        };
      });
    };

    function bindMenu() {
      $('[data-menu]').onclick = () => {
        sheet(`
          <h3>Konsultasi</h3>
          <p class="sub">${esc(doc.name)} · dimulai ${esc(relTime(c.startedAt))}</p>
          <div class="list">
            <a class="row" href="#/dokter/${esc(doc.id)}"><span class="row__ico">${icon('user')}</span>
              <div><b>Lihat profil dokter</b><small>Pengalaman dan bidang praktik</small></div>${icon('chev', 'chev')}</a>
            <button class="row" data-invite><span class="row__ico">${icon('link')}</span>
              <div><b>Salin tautan percakapan</b><small>Buka di perangkat lain untuk ikut percakapan yang sama</small></div>
              ${icon('chev', 'chev')}</button>
            ${c.status === 'active' ? `<button class="row row--danger" data-end><span class="row__ico">${icon('x')}</span>
              <div><b>Akhiri konsultasi</b><small>Percakapan tetap tersimpan di riwayat</small></div></button>` : ''}
          </div>`);

        const inv = $('[data-invite]');
        if (inv) inv.onclick = () => { copyLink('/chat/' + params.id); closeSheet(); };

        const endBtn = $('[data-end]');
        if (endBtn) endBtn.onclick = async () => {
          closeSheet();
          const ok = await confirmSheet({
            title: 'Akhiri konsultasi?',
            body: 'Anda tidak dapat mengirim pesan baru setelah sesi ditutup, tetapi riwayatnya tetap tersimpan.',
            ok: 'Akhiri', danger: true
          });
          if (!ok) return;
          TC.Consult.push(params.id, { from: 'sys', text: 'Konsultasi ditutup. Terima kasih.' });
          TC.Consult.end(params.id);
          Store.notify('Konsultasi selesai', doc.name + ' · ringkasan tersimpan di riwayat', 'ok');
          toast('Konsultasi diakhiri.');
          Router.render();
        };
      };
    }
  }

  /** Menyalin tautan yang dapat dibuka di perangkat lain. */
  function copyLink(hash) {
    const url = location.origin + location.pathname + '?demo=1#' + hash;
    const done = () => toast('Tautan disalin. Buka di perangkat lain untuk bergabung.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => window.prompt('Salin tautan ini:', url));
    } else {
      window.prompt('Salin tautan ini:', url);
    }
  }

  /* ---------------- 6. PANGGILAN VIDEO ---------------- */
  function viewCall(params) {
    const c = TC.Consult.get(params.id);
    if (!c) { joining(params.id, () => viewCall(params)); return; }
    const doc = D.doctor(c.doctorId) || D.DOCTORS[0];
    const audioOnly = c.mode === 'audio';
    // Dokter tidak mendering dirinya sendiri; hanya pasien yang memanggil.
    const asDoctor = Store.is('dokter');

    setTopbar('');
    setView(`
      <div class="call">
        <div class="call__remote">
          <video id="remoteVid" class="call__remotevid" playsinline autoplay hidden></video>

          <div class="call__vitals" id="callVitals"></div>

          <div class="call__self" id="selfWrap">
            <video id="selfCam" playsinline muted autoplay></video>
            <div class="off" id="camOff" hidden>${icon('video-off')}</div>
          </div>

          <div class="call__docwrap" id="docWrap">
            <div style="position:relative;width:112px;margin:0 auto">
              <i class="call__pulse"></i><i class="call__pulse"></i>
              <span class="avatar" style="background:${doc.color}">${esc(initials(doc.name))}</span>
            </div>
            <b>${esc(doc.name)}</b>
            <small>${esc(D.spec(doc.spec).name)}${audioOnly ? ' · panggilan suara' : ''}</small>
            <div class="call__timer">${icon('clock')} <span id="callTimer">00:00</span></div>
            <p class="call__state" id="callState">Menyiapkan kamera dan mikrofon…</p>
            <div class="callring" id="ringState" hidden><i></i><span></span></div>
            <button class="btn btn--soft btn--sm" id="btnInvite" hidden style="margin-top:12px">
              ${icon('link')} Salin tautan undangan</button>
          </div>
        </div>

        <div class="call__bar">
          <button class="call__btn" id="btnMic" aria-label="Bisukan mikrofon">${icon('mic')}</button>
          ${audioOnly ? '' : `<button class="call__btn" id="btnCam" aria-label="Matikan kamera">${icon('video')}</button>
          <button class="call__btn" id="btnFlip" aria-label="Ganti kamera">${icon('refresh')}</button>`}
          <button class="call__btn call__btn--end" id="btnEnd" aria-label="Akhiri panggilan">${icon('phone-off')}</button>
        </div>
      </div>`, { cls: 'view view--full' });

    const selfVideo = $('#selfCam');
    const remoteVid = $('#remoteVid');
    const stateEl = $('#callState');
    let sess = null, micOn = true, camOn = true, connected = false;
    const t0 = Date.now();

    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      const el = $('#callTimer');
      if (el) el.textContent = TC.pad2(Math.floor(s / 60)) + ':' + TC.pad2(s % 60);
    }, 1000);

    function paintVitals() {
      const v = TC.Vitals.snapshot();
      const el = $('#callVitals');
      if (el) el.innerHTML = `
        <div>${icon('heart')} ${v.hr} bpm</div>
        <div>${icon('spo2')} ${v.spo2}%</div>
        <div>${icon('bp')} ${v.sys}/${v.dia}</div>`;
    }
    paintVitals();
    const unVitals = TC.Vitals.subscribe(paintVitals);

    function setState(txt) { if (stateEl) stateEl.textContent = txt; }

    /**
     * Setelah tersambung, laporkan jalur yang sungguh dipakai. Membedakan
     * "TURN dikonfigurasi" dari "TURN terpakai" — dua hal yang sering
     * disamakan saat memeriksa masalah panggilan.
     */
    /* ---------------- memanggil dokter ---------------- */
    let panggilan = null;

    function ringInfo(teks, kelas) {
      const el = $('#ringState');
      if (!el) return;
      el.hidden = false;
      el.className = 'callring' + (kelas ? ' callring--' + kelas : '');
      el.querySelector('span').textContent = teks;
    }

    /**
     * Membunyikan dering di perangkat dokter lewat kotak masuk di Realtime
     * Database. Bila dokter tidak sedang jaga, tidak ada yang bisa didering —
     * pasien diberi tahu agar memakai tautan undangan, bukan dibiarkan
     * menunggu tanpa penjelasan.
     */
    async function deringkanDokter() {
      if (!TC.Ring || !TC.Ring.tersedia() || asDoctor) return;
      try {
        panggilan = await TC.Ring.panggil({
          doctorId: c.doctorId,
          consultId: params.id,
          mode: audioOnly ? 'audio' : 'video',
          fromName: (Store.profile().nickname || (Store.user() || {}).name || 'Pasien')
        });
      } catch (e) {
        console.warn('[TeleCare] gagal memanggil:', e.message);
      }

      if (!panggilan) {
        ringInfo('Dokter tidak sedang menerima panggilan. Bagikan tautan undangan agar ' +
                 'dia dapat bergabung dari perangkatnya.', 'lewat');
        return;
      }

      ringInfo('Memanggil ' + panggilan.doctorName + '… perangkatnya sedang berdering.');

      panggilan.pantau((status) => {
        if (status === 'accepted') {
          ringInfo('Panggilan diterima. Menyambungkan…');
          panggilan.selesai();
        } else if (status === 'declined') {
          ringInfo('Dokter menolak panggilan ini.', 'tolak');
          panggilan.selesai();
        } else if (status === 'missed') {
          ringInfo('Tidak dijawab. Coba lagi, atau buat janji temu.', 'lewat');
          panggilan.selesai();
        }
      });
    }

    // Panggilan dibatalkan bila pasien meninggalkan layar sebelum dijawab,
    // supaya perangkat dokter tidak berdering untuk panggilan yang sudah tidak ada.
    Router.onLeave(() => {
      if (panggilan) { panggilan.batalkan().catch(() => {}); panggilan = null; }
    });

    async function laporkanJalur() {
      if (!sess || !sess.jalurTerpakai) return;
      const j = await sess.jalurTerpakai();
      if (!j) return;
      setState(j.viaTurn ? 'Tersambung · media lewat TURN'
                         : 'Tersambung · jalur langsung (' + (j.lokal || '?') + ')');
    }

    (async function connect() {
      if (!TC.RTC.supported()) {
        setState('Peramban ini tidak mendukung WebRTC.');
        toast('WebRTC tidak tersedia di peramban ini.', 'err');
        return;
      }
      try {
        sess = await TC.RTC.join(params.id, { video: !audioOnly, audio: true }, {
          onLocal(stream) {
            selfVideo.srcObject = stream;
            if (audioOnly) $('#selfWrap').hidden = true;
          },
          onRemote(stream) {
            remoteVid.srcObject = stream;
            connected = true;
            if (!audioOnly) {
              remoteVid.hidden = false;
              $('#docWrap').classList.add('is-mini');
            }
            setState('Tersambung');
            toast('Peserta lain bergabung.');
          },
          onRole(role) {
            if (role === 'solo') {
              setState('Server sinyal tidak terjangkau — hanya pratinjau lokal.');
            } else if (role === 'caller') {
              setState('Menunggu peserta lain bergabung…');
              const b = $('#btnInvite');
              if (b) { b.hidden = false; b.onclick = () => copyLink('/call/' + params.id); }
              // Peserta pertama adalah pemanggil, jadi di sinilah dering
              // dibunyikan pada perangkat dokter.
              deringkanDokter();
            } else {
              setState('Menyambungkan ke peserta…');
            }
          },
          onState(st) {
            if (st === 'connected') {
              setState('Tersambung');
              laporkanJalur();
            } else if (st === 'disconnected') {
              setState('Sambungan terputus, mencoba lagi…');
            } else if (st === 'failed') {
              // Inilah gejala khas tidak adanya TURN, jadi sebabnya disebutkan
              // langsung supaya tidak ditebak-tebak.
              setState(TC.RTC.turnTersedia()
                ? 'Sambungan gagal. Akhiri lalu mulai ulang panggilan.'
                : 'Sambungan gagal — kemungkinan jaringan memblokir jalur langsung. ' +
                  'Panggilan di balik NAT ketat memerlukan server TURN (Profil → Pengaturan).');
            }
          }
        });
      } catch (err) {
        setState('Kamera atau mikrofon tidak dapat diakses.');
        toast(err.message || 'Perangkat media tidak dapat diakses.', 'err');
      }
    })();

    $('#btnMic').onclick = () => {
      micOn = !micOn;
      if (sess) sess.toggleAudio(micOn);
      $('#btnMic').classList.toggle('is-off', !micOn);
      $('#btnMic').innerHTML = icon(micOn ? 'mic' : 'mic-off');
    };

    const camBtn = $('#btnCam');
    if (camBtn) camBtn.onclick = () => {
      camOn = !camOn;
      if (sess) sess.toggleVideo(camOn);
      camBtn.classList.toggle('is-off', !camOn);
      camBtn.innerHTML = icon(camOn ? 'video' : 'video-off');
      $('#camOff').hidden = camOn;
      selfVideo.style.visibility = camOn ? 'visible' : 'hidden';
    };

    const flipBtn = $('#btnFlip');
    if (flipBtn) flipBtn.onclick = async () => {
      if (!sess) return;
      const ok = await sess.switchCamera();
      toast(ok ? 'Kamera dialihkan.' : 'Hanya satu kamera yang tersedia.', ok ? '' : 'err');
    };

    function cleanup(removeRoom) {
      clearInterval(timer);
      unVitals();
      if (sess) sess.hangup(removeRoom);
      sess = null;
    }

    $('#btnEnd').onclick = () => {
      const secs = Math.floor((Date.now() - t0) / 1000);
      const dur = TC.pad2(Math.floor(secs / 60)) + ':' + TC.pad2(secs % 60);
      cleanup(true);
      TC.Consult.push(params.id, {
        from: 'sys', kind: 'call',
        text: (audioOnly ? 'Panggilan suara' : 'Panggilan video') +
              ' berakhir · durasi ' + dur + (connected ? '' : ' (tidak tersambung)')
      });
      if (connected) {
        TC.Consult.push(params.id, {
          from: 'doc',
          text: 'Terima kasih atas waktunya. Ringkasan diskusi kita sudah saya catat. ' +
                'Silakan lanjutkan pemantauan lewat perangkat, dan kabari saya bila keluhannya berubah.'
        });
      }
      Router.navigate('/chat/' + params.id, true);
    };

    Router.onLeave(() => cleanup(false));
  }

  TC.views = TC.views || {};
  Object.assign(TC.views, {
    consult: viewConsult, specialty: viewSpecialty, doctor: viewDoctor,
    chat: viewChat, call: viewCall, schedule: viewSchedule
  });
})(window.TC);
