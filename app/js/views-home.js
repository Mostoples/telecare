/* ============================================================
   TeleCare App — views-home.js
   Beranda, detail vital, analisis, riwayat, notifikasi, artikel.
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, clamp, Store, Router, setView, setTopbar, toast,
          hhmm, fullDate, relTime, greeting, initials, countdown } = TC;
  const D = TC.DATA;

  /* ---------------- KOMPONEN BERSAMA ---------------- */

  function deviceBar() {
    const st = TC.Devices.statusText();
    const pending = Store.state.pendingSamples;
    return `<button class="devbar${st.on ? '' : ' is-off'}" data-devbar>
      <span class="devbar__ico">${icon(st.on ? 'watch' : 'bt')}</span>
      <span style="min-width:0">
        <b>${esc(st.t)}</b>
        <small>${st.on
          ? (pending ? pending + ' sampel menunggu sinkronisasi' : 'buffer jam kosong')
          : 'ketuk untuk menyambungkan'}</small>
      </span>
      <span class="sync" data-sync>${icon('sync')}</span>
    </button>`;
  }

  function bindDeviceBar(root) {
    const bar = $('[data-devbar]', root);
    if (!bar) return;
    bar.onclick = async (e) => {
      if (e.target.closest('[data-sync]')) {
        e.stopPropagation();
        const btn = $('[data-sync]', bar);
        const dev = Store.activeDevice();
        if (!dev) { Router.navigate('/perangkat'); return; }
        if (!dev.connected) { toast('Perangkat terputus. Sambungkan ulang dulu.', 'err'); return; }
        btn.classList.add('is-busy');
        try {
          const n = await TC.Devices.sync();
          toast(n ? n + ' sampel berhasil dipindahkan.' : 'Buffer jam sudah kosong.');
        } catch (err) {
          toast(err.message, 'err');
        }
        btn.classList.remove('is-busy');
        Router.render();
        return;
      }
      Router.navigate('/perangkat');
    };
  }

  /**
   * Penanda asal angka. Dibedakan dengan jelas karena keduanya tampak sama
   * di layar: nilai simulasi bergerak semulus nilai sensor, jadi tanpa
   * penanda ini tidak ada cara membedakannya.
   */
  function sumberChip() {
    const dariPerangkat = TC.Vitals.source && TC.Vitals.source() === 'device';
    return dariPerangkat
      ? `<span class="chip chip--g"><i class="dotlive"></i> dari perangkat</span>`
      : `<span class="chip chip--a">${icon('info')} simulasi</span>`;
  }

  function vitalsGrid() {
    const v = TC.Vitals.snapshot();
    return `<div class="vital-grid">
      <button class="vital vital--hr" data-vital="hr">
        <span class="vital__lab">${icon('heart')} Detak jantung</span>
        <span class="vital__val" data-v="hr">${v.hr}<u>bpm</u></span>
        <canvas data-spark="hr"></canvas></button>
      <button class="vital vital--spo" data-vital="spo2">
        <span class="vital__lab">${icon('spo2')} SpO₂</span>
        <span class="vital__val" data-v="spo2">${v.spo2}<u>%</u></span>
        <canvas data-spark="spo2"></canvas></button>
      <button class="vital vital--tmp" data-vital="temp">
        <span class="vital__lab">${icon('temp')} Suhu</span>
        <span class="vital__val" data-v="temp">${v.temp}<u>°C</u></span>
        <canvas data-spark="temp"></canvas></button>
      <button class="vital vital--bp" data-vital="bp">
        <span class="vital__lab">${icon('bp')} Tekanan darah</span>
        <span class="vital__val" data-v="bp">${v.sys}/${v.dia}</span>
        <canvas data-spark="sys"></canvas></button>
    </div>`;
  }

  function paintSparks(root) {
    const H = TC.Vitals.hist;
    const map = { hr: '#E2543F', spo2: '#0E7FB8', temp: '#E09B12', sys: '#6C5CE7' };
    Object.keys(map).forEach((k) => {
      const cv = $(`[data-spark="${k}"]`, root);
      if (cv && H[k] && H[k].length > 1) TC.sparkline(cv, H[k].slice(-30), map[k]);
    });
  }

  function paintVitals(root) {
    const v = TC.Vitals.snapshot();
    const set = (k, txt) => {
      const el = $(`[data-v="${k}"]`, root);
      if (el) el.innerHTML = txt;
    };
    set('hr', v.hr + '<u>bpm</u>');
    set('spo2', v.spo2 + '<u>%</u>');
    set('temp', v.temp + '<u>°C</u>');
    set('bp', v.sys + '/' + v.dia);
    paintSparks(root);
  }

  function bindVitalTaps(root) {
    $$('[data-vital]', root).forEach((b) => {
      b.onclick = () => Router.navigate('/vital/' + b.dataset.vital);
    });
  }

  /* ---------------- BERANDA ----------------
     Catatan soal kartu EKG: yang dihitung aplikasi ini hanya LAJU (dari
     detak jantung), bukan klasifikasi irama. Sebelumnya di kartu itu
     tertulis "Sinus normal" secara literal, yang menyiratkan analisis
     morfologi yang tidak pernah dilakukan.

     Komentar ini sengaja berada di luar template: komentar HTML di dalam
     literal template ikut terkirim ke DOM peramban. */
  function viewHome() {
    const user = Store.user();
    const p = Store.profile();
    const now = new Date();
    const today = TC.Meals.today();
    const t = p.targets;
    const active = Store.state.activeMeal;
    const lastMeal = Store.state.meals[0];
    const unread = Store.unread();
    const dev = Store.activeDevice();

    setTopbar('');

    const macroRow = (label, emo, bg, val, target, unit) => {
      const pct = clamp(val / target, 0, 1.15);
      return `<div class="macro">
        <span class="macro__ico" style="background:${bg}">${emo}</span>
        <b>${label}</b>
        <span class="num">${val}<s> / ${target} ${unit}</s></span>
      </div>
      <div class="bar"><i class="${pct > 1 ? 'over' : ''}" style="width:${(pct * 100).toFixed(0)}%"></i></div>`;
    };

    setView(`
      <div class="hero-head">
        <span class="avatar avatar--lg" style="border-radius:18px">${esc(initials(user.name))}</span>
        <div style="min-width:0">
          <b>${esc(greeting(now))}, ${esc(p.nickname || user.name.split(' ')[0])} 👋</b>
          <small>${esc(fullDate(now))}</small>
        </div>
        <button class="icon-btn" data-notif style="margin-left:auto" aria-label="Notifikasi">
          ${icon('bell')}${unread ? `<i class="badge">${unread}</i>` : ''}</button>
      </div>

      ${deviceBar()}

      <div class="section-title">${icon('heart')} Vital terkini
        <span class="push"></span>
        <span data-sumber>${sumberChip()}</span></div>
      ${vitalsGrid()}

      ${dev && dev.connected ? `
        <div class="card mt">
          <div class="card__head">${icon('ecg')}<h3>Sinyal EKG · Lead I</h3>
            <span class="push"></span><span class="chip chip--r">MEREKAM</span></div>
          <div class="ecg-box"><canvas id="ecgHome"></canvas></div>
          <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap">
            <div class="tiny muted">Interval RR<b class="mono" style="display:block;color:var(--ink);font-size:.9rem" data-rr>—</b></div>
            <div class="tiny muted">HRV (RMSSD)<b class="mono" style="display:block;color:var(--ink);font-size:.9rem" data-hrv>—</b></div>
            <div class="tiny muted">Laju<b style="display:block;color:var(--green-600);font-size:.9rem" data-laju>—</b></div>
          </div>
        </div>` : ''}

      ${active ? `
        <div class="section-title">${icon('clock')} Sesi berjalan</div>
        <a class="card" href="#/sesi/berjalan" style="display:block">
          <div class="session-card">
            ${active.photo ? `<img src="${active.photo}" alt="">` : `<span class="ph">${icon('food')}</span>`}
            <div style="min-width:0;flex:1">
              <b>${esc(active.items.map((i) => i.n).join(', '))}</b>
              <small>${esc(active.kind)} · selesai makan ${hhmm(new Date(active.at))}</small>
              <div class="mt" style="display:flex;gap:6px;flex-wrap:wrap">
                ${active.points.map((pt) => `<span class="chip ${pt.done ? 'chip--g' : ''}" style="font-size:.66rem">${esc(pt.label)}</span>`).join('')}
              </div>
            </div>
            ${icon('chev', 'chev')}
          </div>
        </a>` : ''}

      <div class="section-title">${icon('food')} Ringkasan Hari Ini
        <span class="push"></span><span class="chip">${today.count} sesi</span></div>
      <div class="card">
        ${macroRow('Kalori', '🔥', '#FFF1D6', today.kcal, t.kcal, 'kkal')}
        ${macroRow('Karbohidrat', '🌾', '#DCEEF9', today.carb, t.carb, 'g')}
        ${macroRow('Protein', '🥚', '#EDF9F2', today.protein, t.protein, 'g')}
        ${macroRow('Lemak', '🥑', '#EEEBFD', today.fat, t.fat, 'g')}
      </div>

      <div class="section-title">${icon('sparkle')} Aksi cepat</div>
      <div class="quick">
        <a href="#/konsultasi"><i style="background:#EDF9F2;color:#03804C">${icon('stetho')}</i>Konsultasi</a>
        <a href="#/sesi/kamera"><i style="background:#FFF1D6;color:#8A5D00">${icon('cam')}</i>Catat Sesi</a>
        <a href="#/perangkat"><i style="background:#DCEEF9;color:#075A85">${icon('watch')}</i>Perangkat</a>
        <a href="#/riwayat"><i style="background:#EEEBFD;color:#4A3BB8">${icon('doc')}</i>Riwayat</a>
      </div>

      ${lastMeal ? `
        <div class="section-title">${icon('clock')} Sesi Terakhir
          <span class="push"></span><a class="link" href="#/riwayat">Lihat semua</a></div>
        <a class="card" href="#/sesi/${esc(lastMeal.id)}" style="display:block">
          <div class="session-card">
            ${lastMeal.photo ? `<img src="${lastMeal.photo}" alt="">` : `<span class="ph">${icon('food')}</span>`}
            <div style="min-width:0;flex:1">
              <small>${icon('clock')} ${hhmm(new Date(lastMeal.at))} · ${esc(lastMeal.kind)}</small>
              <b style="margin-top:2px">puncak +${lastMeal.delta} mg/dL · normal dalam ${lastMeal.recovery} jam</b>
              <span class="chip chip--${lastMeal.delta > 45 ? 'r' : lastMeal.delta > 28 ? 'a' : 'g'}" style="margin-top:6px">${esc(lastMeal.category)}</span>
            </div>
            ${icon('chev', 'chev')}
          </div>
        </a>` : `
        <div class="section-title">${icon('clock')} Sesi Terakhir</div>
        <div class="card"><div class="empty" style="padding:26px 10px">${icon('food')}
          <b>Belum ada sesi tercatat</b>
          <p>Potret makanan Anda untuk mulai melihat hubungan antara isi piring dan respons tubuh.</p>
          <a class="btn btn--primary btn--sm mt" href="#/sesi/kamera">Catat sesi pertama</a></div></div>`}

      ${TC.Meals.peakTrend(6).length > 1 ? `
        <div class="card mt">
          <div class="card__head">${icon('drop')}<h3>Puncak Gula Darah</h3>
            <span class="push"></span><span class="chip">${TC.Meals.peakTrend(6).length} sesi terakhir</span></div>
          <div style="display:flex;align-items:center;gap:16px">
            <div><b style="font-size:1.7rem;letter-spacing:-.04em">${TC.Meals.peakTrend(1)[0]}</b>
              <span class="tiny muted"> mg/dL</span></div>
            <div class="chart-wrap" style="flex:1"><canvas id="peakChart" style="height:60px"></canvas></div>
          </div>
        </div>` : ''}

      <div class="section-title">${icon('sparkle')} Wawasan TeleCare AI</div>
      <div class="insight">
        <div class="insight__glow"></div>
        <div class="tag">${icon('sparkle')} TeleCare AI</div>
        <h5>${esc(insightTitle())}</h5>
        <p>${esc(insightBody())}</p>
        <a class="btn btn--primary btn--sm mt" href="#/konsultasi">Diskusikan dengan dokter ${icon('arrow')}</a>
      </div>

      <div class="promo mt2">
        <svg class="promo__deco" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <circle cx="100" cy="100" r="92" stroke="#fff" stroke-width="2"/>
          <circle cx="100" cy="100" r="66" stroke="#fff" stroke-width="2" stroke-dasharray="5 9"/>
          <path d="M20 100h32l14-32 20 66 16-46 10 12h68" stroke="#fff" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h3>Hubungkan lebih banyak perangkat</h3>
        <p>Sabuk EKG, tensimeter, timbangan, hingga patch glukosa — semuanya masuk ke riwayat yang sama.</p>
        <a class="btn btn--soft btn--sm" href="#/perangkat/pindai">Pindai perangkat ${icon('arrow')}</a>
      </div>

      <div class="section-title">${icon('doc')} Bacaan untuk Anda</div>
      <div class="stack--sm stack">
        ${D.ARTICLES.slice(0, 3).map((a) => `
          <a class="row" style="border:1px solid var(--line);border-radius:16px;background:var(--surface)" href="#/artikel/${a.id}">
            <span class="row__ico" style="font-size:1.1rem">${a.emoji}</span>
            <div style="min-width:0"><b>${esc(a.title)}</b><small>${esc(a.cat)} · ${a.read} menit baca</small></div>
            ${icon('chev', 'chev')}
          </a>`).join('')}
      </div>
    `);

    const root = $('#view');
    bindDeviceBar(root);
    bindVitalTaps(root);
    paintSparks(root);
    $('[data-notif]').onclick = () => Router.navigate('/notifikasi');

    const peakCv = $('#peakChart');
    if (peakCv) {
      const data = TC.Meals.peakTrend(6);
      TC.lineChart(peakCv, [{ data, color: '#049A5B', fill: true, dots: true }],
        { padL: 8, yLabels: false });
    }

    // pembaruan langsung
    let ecg = null;
    const ecgCv = $('#ecgHome');
    if (ecgCv) ecg = TC.EcgRenderer(ecgCv);

    const un = TC.Vitals.subscribe(() => {
      paintVitals(root);
      const sc = $('[data-sumber]', root);
      if (sc) sc.innerHTML = sumberChip();
      const rr = $('[data-rr]', root), hv = $('[data-hrv]', root);
      if (rr) rr.textContent = Math.round(60000 / TC.Vitals.state.hr) + ' ms';
      if (hv) hv.textContent = TC.Vitals.state.hrv + ' ms';
      const lj = $('[data-laju]', root);
      if (lj) {
        const hr = TC.Vitals.state.hr;
        lj.textContent = hr < 50 ? 'Bradikardia' : hr > 100 ? 'Takikardia' : 'Normal';
      }
    });

    const mealTimer = setInterval(() => {
      if (TC.Meals.tick()) Router.render();
    }, 1000);

    Router.onLeave(() => {
      un();
      clearInterval(mealTimer);
      if (ecg) ecg.stop();
    });
  }

  function insightTitle() {
    const s = TC.Vitals.state.stress;
    if (s >= 66) return 'Beban stres tinggi terdeteksi hari ini';
    if (s >= 34) return 'Pola stres berulang pada sore hari';
    return 'Ritme Anda stabil beberapa hari ini';
  }
  function insightBody() {
    const s = TC.Vitals.state.stress;
    const meals = Store.state.meals.slice(0, 3);
    const avgDelta = meals.length
      ? Math.round(meals.reduce((a, m) => a + (m.delta || 0), 0) / meals.length) : null;
    if (s >= 66) {
      return 'Detak jantung istirahat naik dan HRV menurun dibanding pekan lalu. Coba jadwalkan jeda ' +
        'singkat setiap dua jam, dan pertimbangkan sesi konseling bila pola ini bertahan.';
    }
    if (s >= 34) {
      return 'Kenaikan detak jantung istirahat berulang pada rentang 14.00–16.00 selama beberapa hari. ' +
        (avgDelta ? 'Rata-rata kenaikan gula darah setelah makan Anda ' + avgDelta + ' mg/dL. ' : '') +
        'Perhatikan porsi karbohidrat pada makan siang.';
    }
    return 'HRV berada di rentang yang baik dan saturasi oksigen stabil. ' +
      (avgDelta ? 'Rata-rata kenaikan gula darah setelah makan ' + avgDelta + ' mg/dL — tergolong landai. ' : '') +
      'Pertahankan pola tidur dan aktivitas Anda saat ini.';
  }

  /* ---------------- DETAIL VITAL ---------------- */
  const VITAL_META = {
    hr:   { title: 'Detak Jantung', unit: 'bpm', color: '#E2543F', key: 'hr',
            normal: '60–100 bpm saat istirahat',
            about: 'Diukur lewat fotopletismografi (PPG) pada perangkat yang Anda kenakan. Nilai saat istirahat lebih bermakna daripada nilai saat bergerak.' },
    spo2: { title: 'Saturasi Oksigen', unit: '%', color: '#0E7FB8', key: 'spo2',
            normal: '95–100%',
            about: 'Perbandingan penyerapan cahaya merah dan inframerah oleh darah. Pembacaan mudah terganggu bila perangkat longgar atau tangan dingin.' },
    temp: { title: 'Suhu Tubuh', unit: '°C', color: '#E09B12', key: 'temp',
            normal: '36,1–37,2 °C',
            about: 'Diukur dari kulit lalu dikompensasi terhadap suhu ruangan, sehingga cenderung sedikit berbeda dari termometer.' },
    bp:   { title: 'Tekanan Darah', unit: 'mmHg', color: '#6C5CE7', key: 'sys',
            normal: '< 120/80 mmHg',
            about: 'Perkiraan tidak langsung dari bentuk gelombang nadi. Wajib dikalibrasi dengan tensimeter lengan dan hanya untuk melihat kecenderungan.' }
  };

  function viewVital(params) {
    const meta = VITAL_META[params.kind] || VITAL_META.hr;
    const v = TC.Vitals.snapshot();
    const cur = params.kind === 'bp' ? v.sys + '/' + v.dia : v[meta.key];

    // Subjudul mengikuti asal angka yang sebenarnya. Sebelumnya layar ini
    // selalu mengaku "langsung dari perangkat", padahal beranda sudah jujur
    // membedakan sensor dari simulasi.
    const dariPerangkat = TC.Vitals.source() === 'device';
    TC.topbar(meta.title, {
      sub: dariPerangkat ? 'Data langsung dari perangkat' : 'Nilai simulasi purwarupa'
    });
    setView(`
      <div class="card tc">
        <div class="tiny muted" style="text-transform:uppercase;letter-spacing:.08em;font-weight:800">Saat ini</div>
        <div style="font-size:2.6rem;font-weight:800;letter-spacing:-.04em;line-height:1.1;margin:4px 0">
          <span data-live>${cur}</span>
          <span style="font-size:.4em;color:var(--muted);font-weight:700">${esc(meta.unit)}</span>
        </div>
        <span class="chip chip--g"><i class="dotlive"></i> diperbarui ${TC.relTime(v.at)}</span>
      </div>

      <div class="card mt">
        <div class="card__head"><h3>60 pembacaan terakhir</h3>
          <span class="push"></span>${sumberChip()}</div>
        <div class="chart-wrap"><canvas id="vChart" style="height:170px"></canvas></div>
        ${params.kind === 'bp' ? `<div class="legend">
          <div><i style="background:#6C5CE7"></i>Sistolik</div>
          <div><i style="background:#7CC3E8"></i>Diastolik</div></div>` : ''}
      </div>

      <div class="card mt">
        <div class="card__head"><h3>Rentang acuan umum</h3></div>
        <p class="small muted">${esc(meta.normal)}</p>
      </div>

      <div class="card mt">
        <div class="card__head"><h3>Bagaimana ini diukur</h3></div>
        <p class="small" style="color:var(--ink-2)">${esc(meta.about)}</p>
      </div>

      <div class="note note--w mt">${icon('alert')}
        <div><b>Bukan hasil pemeriksaan medis</b>Angka ini perkiraan dari sensor wearable.
        Untuk keputusan klinis, gunakan alat ukur medis dan konsultasikan ke tenaga kesehatan.</div></div>

      <a class="btn btn--primary btn--block mt2" href="#/konsultasi">Tanyakan ke dokter ${icon('arrow')}</a>
    `);

    function paint() {
      const cv = $('#vChart');
      if (!cv) return;
      const H = TC.Vitals.hist;
      if (params.kind === 'bp') {
        TC.lineChart(cv, [
          { data: H.sys, color: '#6C5CE7', fill: true },
          { data: H.dia, color: '#7CC3E8' }
        ], {});
      } else {
        TC.lineChart(cv, [{ data: H[meta.key], color: meta.color, fill: true }], {});
      }
    }
    paint();

    const un = TC.Vitals.subscribe(() => {
      const el = $('[data-live]');
      const s = TC.Vitals.snapshot();
      if (el) el.textContent = params.kind === 'bp' ? s.sys + '/' + s.dia : s[meta.key];
      paint();
    });
    Router.onLeave(un);
  }

  /* ---------------- ANALISIS ---------------- */
  function viewAnalysis() {
    const tab = (location.hash.split('?tab=')[1]) || 'vital';
    TC.topbar('Analisis', { sub: 'Kecenderungan beberapa hari terakhir', back: false });

    const week = TC.weekTrend();
    const labels = week.map((d) => d.label);
    // Berapa hari yang benar-benar punya rekaman, dan berapa di antaranya
    // berasal dari sensor. Dipakai agar layar ini tidak pernah menyiratkan
    // tren yang datanya tidak ada.
    const hariAda = week.filter((d) => d.ada).length;
    const hariSensor = week.filter((d) => d.sumber === 'device').length;

    setView(`
      <div class="seg" id="anaSeg" role="tablist">
        <button data-atab="vital" class="${tab === 'vital' ? 'is-active' : ''}">Vital</button>
        <button data-atab="gizi" class="${tab === 'gizi' ? 'is-active' : ''}">Gizi</button>
        <button data-atab="sesi" class="${tab === 'sesi' ? 'is-active' : ''}">Respons</button>
      </div>
      <div id="tabBody" class="mt"></div>
    `);

    function renderTab(t) {
      const body = $('#tabBody');
      if (t === 'vital') {
        const stress = Math.round(TC.Vitals.state.stress);
        const lab = TC.Vitals.stressLabel(stress);
        body.innerHTML = `
          <div class="grid2">
            <div class="card">
              <div class="card__head">${icon('brain')}<h3>Indeks stres</h3>
                <span class="push"></span><span class="chip chip--${lab.c}">${esc(lab.t.toUpperCase())}</span></div>
              <figure class="gauge" style="margin:0">
                ${TC.gaugeSvg(stress)}
                <figcaption><b>${stress}</b><span>dari 100</span></figcaption>
              </figure>
              <p class="tiny muted tc mt">Disusun dari HRV, detak jantung istirahat, dan pola tidur.</p>
            </div>

            <div class="card">
              <div class="card__head">${icon('heart')}<h3>Detak jantung istirahat</h3></div>
              <div class="chart-wrap"><canvas id="cRhr" style="height:150px"></canvas></div>
              <div class="legend"><div><i style="background:#049A5B"></i>7 hari terakhir (bpm)</div></div>
            </div>

            <div class="card">
              <div class="card__head">${icon('spo2')}<h3>Saturasi terendah harian</h3></div>
              <div class="chart-wrap"><canvas id="cSpo2" style="height:150px"></canvas></div>
              <div class="legend"><div><i style="background:#0E7FB8"></i>SpO₂ terendah (%)</div></div>
            </div>

            <div class="card">
              <div class="card__head">${icon('steps')}<h3>Langkah harian</h3></div>
              <div class="chart-wrap"><canvas id="cSteps" style="height:150px"></canvas></div>
              <div class="legend"><div><i style="background:#28B87A"></i>langkah</div></div>
            </div>
          </div>

          <div class="card mt">
            <div class="card__head">${icon('moon')}<h3>Durasi tidur</h3>
              <span class="push"></span><span class="chip">belum tersedia</span></div>
            <div class="empty" style="padding:22px 10px">${icon('moon')}
              <b>Tidak ada perangkat yang melaporkan tidur</b>
              <p>TeleRing mencantumkan kemampuan ini, tetapi aplikasi belum membaca
                 karakteristik tidur dari perangkat. Grafik akan muncul setelah pembacaannya ada —
                 bukan diisi angka perkiraan.</p></div>
          </div>

          <div class="note note--${hariAda ? 'i' : 'w'} mt">${icon(hariAda ? 'info' : 'alert')}
            <div><b>${hariAda} dari 7 hari punya data</b>${
              hariAda
                ? 'Tren dihitung dari pembacaan yang benar-benar berjalan di perangkat ini' +
                  (hariSensor ? `, ${hariSensor} hari di antaranya dari sensor.` : ', seluruhnya dari simulasi purwarupa.')
                : 'Belum ada rekaman. Biarkan aplikasi terbuka beberapa saat, atau sambungkan perangkat, lalu buka lagi layar ini.'
            }</div></div>

          ${hariAda >= 2 ? `
            <div class="insight mt">
              <div class="insight__glow"></div>
              <div class="tag">${icon('sparkle')} Pola pekan ini</div>
              <h5>${esc(weekSummaryTitle(week))}</h5>
              <p>${esc(weekSummaryBody(week))}</p>
            </div>` : ''}`;

        TC.lineChart($('#cRhr'), [{ data: week.map((d) => d.rhr), color: '#049A5B', fill: true, dots: true }],
          { xLabels: labels });
        TC.lineChart($('#cSpo2'), [{ data: week.map((d) => d.spo2), color: '#0E7FB8', fill: true, dots: true }],
          { xLabels: labels });
        TC.barChart($('#cSteps'), week.map((d) => d.steps || 0), labels, '#28B87A');

      } else if (t === 'gizi') {
        const days = last7Meals();
        const p = Store.profile();
        body.innerHTML = `
          <div class="card">
            <div class="card__head">${icon('fire')}<h3>Asupan kalori 7 hari</h3>
              <span class="push"></span><span class="chip">target ${p.targets.kcal} kkal</span></div>
            <div class="chart-wrap"><canvas id="cKcal" style="height:170px"></canvas></div>
          </div>
          <div class="card mt">
            <div class="card__head">${icon('food')}<h3>Komposisi zat gizi</h3></div>
            <div class="chart-wrap"><canvas id="cMacro" style="height:170px"></canvas></div>
            <div class="legend">
              <div><i style="background:#0E7FB8"></i>Karbohidrat</div>
              <div><i style="background:#049A5B"></i>Protein</div>
              <div><i style="background:#6C5CE7"></i>Lemak</div>
            </div>
          </div>
          <div class="note note--i mt">${icon('info')}
            <div><b>Seakurat pencatatan Anda</b>Berbeda dengan detak jantung yang diukur sensor,
            data gizi bergantung pada sesi yang Anda catat sendiri.</div></div>`;

        TC.barChart($('#cKcal'), days.map((d) => d.kcal), days.map((d) => d.label), '#E09B12');
        TC.lineChart($('#cMacro'), [
          { data: days.map((d) => d.carb), color: '#0E7FB8', fill: true },
          { data: days.map((d) => d.protein), color: '#049A5B' },
          { data: days.map((d) => d.fat), color: '#6C5CE7' }
        ], { xLabels: days.map((d) => d.label) });

      } else {
        const meals = Store.state.meals.filter((m) => m.status === 'done').slice(0, 10);
        body.innerHTML = meals.length ? `
          <div class="card">
            <div class="card__head">${icon('drop')}<h3>Puncak gula darah antar sesi</h3></div>
            <div class="chart-wrap"><canvas id="cPeak" style="height:170px"></canvas></div>
            <div class="legend">
              <div><i style="background:#049A5B"></i>Puncak (mg/dL)</div>
              <div><i style="background:#A9E5C8"></i>Baseline</div></div>
          </div>
          <div class="section-title">${icon('doc')} Sesi dengan kenaikan terbesar</div>
          <div class="list">
            ${meals.slice().sort((a, b) => b.delta - a.delta).slice(0, 5).map((m) => `
              <a class="row" href="#/sesi/${esc(m.id)}">
                <span class="row__ico">${icon('food')}</span>
                <div style="min-width:0"><b>${esc(m.items.map((i) => i.n).join(', '))}</b>
                  <small>${esc(TC.shortDate(new Date(m.at)))} · ${esc(m.kind)}</small></div>
                <span class="chip chip--${m.delta > 45 ? 'r' : m.delta > 28 ? 'a' : 'g'}" style="margin-left:auto">+${m.delta}</span>
                ${icon('chev', 'chev')}
              </a>`).join('')}
          </div>
          <div class="note note--w mt">${icon('alert')}
            <div><b>Perkiraan, bukan hasil laboratorium</b>Nilai ini dihitung dari sensor dan catatan
            asupan. Tidak dapat dipakai untuk menegakkan diagnosis diabetes.</div></div>` : `
          <div class="empty">${icon('drop')}<b>Belum cukup data</b>
            <p>Catat beberapa sesi makan untuk melihat pola respons tubuh Anda.</p>
            <a class="btn btn--primary btn--sm mt" href="#/sesi/kamera">Catat sesi</a></div>`;

        if (meals.length) {
          const rev = meals.slice().reverse();
          TC.lineChart($('#cPeak'), [
            { data: rev.map((m) => m.peak), color: '#049A5B', fill: true, dots: true },
            { data: rev.map((m) => m.baseline), color: '#A9E5C8', dash: [4, 5] }
          ], { xLabels: rev.map((m) => TC.pad2(new Date(m.at).getDate())) });
        }
      }
    }

    renderTab(tab);

    // Segmen ini sengaja memakai `data-atab`, bukan `data-tab`: tab navigasi
    // bawah juga memakai `data-tab`, dan `$$` berlingkup seluruh dokumen —
    // sehingga menekan "Beranda" sebelumnya ikut menjalankan penggantian tab
    // Analisis sekaligus mencabut sorotan navigasi. Pencarian juga dibatasi
    // ke dalam wadah segmennya.
    const seg = $('#anaSeg');
    $$('[data-atab]', seg).forEach((b) => {
      b.onclick = () => {
        $$('[data-atab]', seg).forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        renderTab(b.dataset.atab);
        // URL diperbarui tanpa memicu navigasi, supaya tab yang sedang dibuka
        // ikut terbawa saat halaman dimuat ulang atau tautannya dibagikan.
        try {
          history.replaceState(null, '', '#/analisis?tab=' + b.dataset.atab);
        } catch (e) { /* peramban menolak, abaikan */ }
      };
    });
  }

  /** Rata-rata sebuah ukuran, hanya atas hari yang punya data. */
  function rerata(week, kunci) {
    const v = week.map((d) => d[kunci]).filter((x) => typeof x === 'number');
    return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
  }

  function weekSummaryTitle(week) {
    // Hanya hari berdata yang dibandingkan; hari kosong tidak boleh menarik
    // rata-rata dan menciptakan "kecenderungan" yang tidak ada.
    const ada = week.filter((d) => d.ada && d.rhr != null);
    if (ada.length < 2) return 'Data belum cukup untuk menyimpulkan pola';
    const separuh = Math.ceil(ada.length / 2);
    const awal = ada.slice(0, separuh).reduce((a, d) => a + d.rhr, 0) / separuh;
    const akhir = ada.slice(-separuh).reduce((a, d) => a + d.rhr, 0) / separuh;
    if (akhir - awal > 2.5) return 'Detak jantung istirahat cenderung naik';
    if (awal - akhir > 2.5) return 'Detak jantung istirahat membaik';
    return 'Ritme pekan ini relatif stabil';
  }

  function weekSummaryBody(week) {
    const bagian = [];
    const rhr = rerata(week, 'rhr');
    if (rhr != null) bagian.push(`Detak jantung istirahat rata-rata ${Math.round(rhr)} bpm`);
    const spo2 = rerata(week, 'spo2');
    if (spo2 != null) bagian.push(`saturasi terendah rata-rata ${Math.round(spo2)}%`);
    const langkah = week.map((d) => d.steps || 0);
    const totalLangkah = langkah.reduce((a, x) => a + x, 0);
    if (totalLangkah > 0) {
      const hariJalan = langkah.filter((x) => x > 0).length;
      bagian.push(`${Math.round(totalLangkah / hariJalan).toLocaleString('id-ID')} langkah per hari aktif`);
    }
    const tinggi = week.filter((d) => d.stress != null && d.stress > 55).length;
    const ekor = tinggi
      ? ` Ada ${tinggi} hari dengan indeks stres tinggi — perhatikan pemicunya pada hari-hari tersebut.`
      : ' Tidak ada hari dengan indeks stres tinggi pada periode ini.';
    return (bagian.length ? bagian.join(', ') + '.' : 'Belum ada ukuran yang terkumpul.') + ekor;
  }

  function last7Meals() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const end = d.getTime() + 86400000;
      const list = Store.state.meals.filter((m) => m.at >= d.getTime() && m.at < end);
      const t = { label: TC.DAYS[d.getDay()].slice(0, 3), kcal: 0, carb: 0, protein: 0, fat: 0 };
      list.forEach((m) => {
        t.kcal += m.nutrition.kcal; t.carb += m.nutrition.carb;
        t.protein += m.nutrition.protein; t.fat += m.nutrition.fat;
      });
      out.push(t);
    }
    return out;
  }

  /* ---------------- RIWAYAT ---------------- */
  function viewHistory() {
    const tab = 'sesi';
    TC.topbar('Riwayat', { sub: 'Seluruh catatan Anda', back: false });
    setView(`
      <div class="seg">
        <button data-h="sesi" class="is-active">Sesi Makan</button>
        <button data-h="konsul">Konsultasi</button>
        <button data-h="sync">Sinkronisasi</button>
      </div>
      <div id="hBody" class="mt"></div>`);

    function draw(t) {
      const b = $('#hBody');
      if (t === 'sesi') {
        const meals = Store.state.meals;
        b.innerHTML = meals.length ? groupByDay(meals) : `
          <div class="empty">${icon('food')}<b>Belum ada sesi</b>
          <p>Setiap kali Anda memotret makanan, catatannya muncul di sini.</p>
          <a class="btn btn--primary btn--sm mt" href="#/sesi/kamera">Catat sesi</a></div>`;
      } else if (t === 'konsul') {
        const cs = Store.state.consults;
        b.innerHTML = cs.length ? `<div class="list">${cs.map((c) => {
          const doc = D.doctor(c.doctorId);
          return `<a class="row" href="#/chat/${esc(c.id)}">
            <span class="avatar" style="background:${doc ? doc.color : '#049A5B'}">${esc(initials(doc ? doc.name : '?'))}</span>
            <div style="min-width:0"><b>${esc(doc ? doc.name : 'Dokter')}</b>
              <small>${esc(c.mode === 'video' ? 'Video call' : 'Chat')} · ${esc(TC.relTime(c.startedAt))}</small></div>
            <span class="chip chip--${c.status === 'active' ? 'g' : ''}" style="margin-left:auto">
              ${c.status === 'active' ? 'Berlangsung' : 'Selesai'}</span>
            ${icon('chev', 'chev')}</a>`;
        }).join('')}</div>` : `
          <div class="empty">${icon('stetho')}<b>Belum ada konsultasi</b>
          <p>Mulai percakapan dengan dokter kapan saja — riwayat vital Anda ikut terlampir.</p>
          <a class="btn btn--primary btn--sm mt" href="#/konsultasi">Cari dokter</a></div>`;
      } else {
        const vh = Store.state.vitalsHistory.slice().reverse().slice(0, 30);
        b.innerHTML = vh.length ? `<div class="list">${vh.map((v) => `
          <div class="row">
            <span class="row__ico">${icon('sync')}</span>
            <div><b>${v.hr} bpm · ${v.spo2}% · ${v.temp}°C</b>
              <small>${esc(TC.relTime(v.at))} · TD ${v.sys}/${v.dia} mmHg</small></div>
          </div>`).join('')}</div>` : `
          <div class="empty">${icon('sync')}<b>Belum ada sinkronisasi</b>
          <p>Ketuk tombol sinkronkan pada kartu perangkat di Beranda.</p></div>`;
      }
    }

    function groupByDay(meals) {
      const groups = {};
      meals.forEach((m) => {
        const d = new Date(m.at); d.setHours(0, 0, 0, 0);
        (groups[d.getTime()] = groups[d.getTime()] || []).push(m);
      });
      return Object.keys(groups).sort((a, b) => b - a).map((k) => {
        const d = new Date(+k);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const label = +k === today.getTime() ? 'Hari ini'
          : +k === today.getTime() - 86400000 ? 'Kemarin' : TC.shortDate(d);
        return `<div class="section-title" style="margin-top:16px">${esc(label)}</div>
          <div class="list">${groups[k].map((m) => `
            <a class="row" href="#/sesi/${esc(m.id)}">
              <span class="row__ico">${icon('food')}</span>
              <div style="min-width:0"><b>${esc(m.items.map((i) => i.n).join(', '))}</b>
                <small>${hhmm(new Date(m.at))} · ${m.nutrition.kcal} kkal · ${m.nutrition.carb} g karbo</small></div>
              ${m.status === 'done' ? `<span class="chip chip--${m.delta > 45 ? 'r' : m.delta > 28 ? 'a' : 'g'}" style="margin-left:auto">+${m.delta}</span>` : `<span class="chip chip--a" style="margin-left:auto">berjalan</span>`}
              ${icon('chev', 'chev')}
            </a>`).join('')}</div>`;
      }).join('');
    }

    draw(tab);
    $$('[data-h]').forEach((b) => {
      b.onclick = () => {
        $$('[data-h]').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        draw(b.dataset.h);
      };
    });
  }

  /* ---------------- NOTIFIKASI ---------------- */
  function viewNotifications() {
    TC.topbar('Notifikasi', {
      actions: `<button class="icon-btn" data-clear aria-label="Tandai terbaca">${icon('check')}</button>`
    });
    const list = Store.state.notifications;
    setView(list.length ? `<div class="list">${list.map((n) => `
      <div class="row" style="align-items:flex-start">
        <span class="row__ico" style="background:${n.kind === 'warn' ? '#FFF1D6' : n.kind === 'err' ? '#FFE6E2' : '#EDF9F2'};
          color:${n.kind === 'warn' ? '#8A5D00' : n.kind === 'err' ? '#E2543F' : '#03804C'}">
          ${icon(n.kind === 'warn' ? 'alert' : n.kind === 'err' ? 'alert' : 'check')}</span>
        <div style="min-width:0"><b>${esc(n.title)}</b><small>${esc(n.body)}</small>
          <small class="tiny" style="color:var(--faint)">${esc(TC.relTime(n.at))}</small></div>
        ${!n.read ? '<i class="dotlive" style="margin-left:auto"></i>' : ''}
      </div>`).join('')}</div>` : `
      <div class="empty">${icon('bell')}<b>Belum ada notifikasi</b>
      <p>Peringatan dari perangkat dan pengingat konsultasi akan muncul di sini.</p></div>`);

    $('[data-clear]').onclick = () => {
      Store.update((s) => { s.notifications.forEach((n) => { n.read = true; }); });
      toast('Semua notifikasi ditandai terbaca.');
      Router.render();
    };
  }

  /* ---------------- ARTIKEL ---------------- */
  function viewArticle(params) {
    const a = D.ARTICLES.find((x) => x.id === params.id);
    if (!a) { Router.navigate('/home', true); return; }
    TC.topbar(a.cat, { sub: a.read + ' menit baca' });
    setView(`
      <div class="card" style="text-align:center;padding:30px">
        <div style="font-size:3rem">${a.emoji}</div>
      </div>
      <h2 style="font-size:1.3rem;margin:18px 0 12px">${esc(a.title)}</h2>
      <p style="color:var(--ink-2);font-size:.95rem;line-height:1.7">${esc(a.body)}</p>
      <p style="color:var(--ink-2);font-size:.95rem;line-height:1.7;margin-top:14px">
        Bacaan ini bersifat edukatif dan tidak menggantikan penilaian tenaga kesehatan.
        Bila keluhan Anda menetap atau memberat, mulailah konsultasi agar dapat dinilai secara langsung.</p>
      <a class="btn btn--primary btn--block mt2" href="#/konsultasi">Konsultasi sekarang ${icon('arrow')}</a>`);
  }

  TC.views = TC.views || {};
  Object.assign(TC.views, {
    home: viewHome, vital: viewVital, analysis: viewAnalysis,
    history: viewHistory, notifications: viewNotifications, article: viewArticle,
    deviceBar, bindDeviceBar
  });
})(window.TC);
