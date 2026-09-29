/* ============================================================
   TeleCare — app.js
   Navigasi, animasi reveal, dan seluruh logika dashboard:
   EKG sintetis, sparkline, tren 24 jam, gauge stres.
   Sumber data: Firebase Realtime DB (bila ada) → fallback simulasi.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const rnd   = (a, b) => a + Math.random() * (b - a);

  /* ---------------- 1. PRELOADER ---------------- */
  window.addEventListener('load', () => {
    setTimeout(() => $('#preload').classList.add('is-done'), 420);
  });
  setTimeout(() => $('#preload') && $('#preload').classList.add('is-done'), 4200);

  /* ---------------- 2. NAVBAR ---------------- */
  const nav = $('#nav'), burger = $('#burger'), mmenu = $('#mobileMenu');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  burger.addEventListener('click', () => {
    const open = mmenu.classList.toggle('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
    mmenu.classList.remove('is-open');
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  /* ---------------- 3. TICKER ---------------- */
  const TICKER = [
    ['i-heart', 'Detak jantung & variabilitas (HRV)'],
    ['i-spo2', 'Saturasi oksigen perifer SpO₂'],
    ['i-temp', 'Suhu tubuh terkompensasi ambien'],
    ['i-ecg', 'Sinyal EKG lead-I 250 Hz'],
    ['i-bp', 'Estimasi tekanan darah berbasis PPG'],
    ['i-brain', 'Indeks stres & pola tidur'],
    ['i-cloud', 'Sinkronisasi cloud terenkripsi'],
    ['i-doctor', 'Teleconsult dokter & psikolog'],
    ['i-shield', 'Privasi data per unit institusi'],
    ['i-chip', 'Pra-proses sinyal di perangkat']
  ];
  const track = $('#tickerTrack');
  if (track) {
    const html = TICKER.map(t =>
      `<span class="ticker__item"><svg><use href="#${t[0]}"/></svg>${t[1]}</span>`).join('');
    track.innerHTML = html + html; // digandakan untuk marquee mulus
  }

  /* ---------------- 4. REVEAL ---------------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }

  /* ---------------- 5. TAB PERANGKAT ---------------- */
  const PROD = {
    teleband: {
      badge: 'TeleBand · v1',
      title: 'TeleBand — gelang pemantau multiparameter',
      desc: 'Dikenakan di pergelangan tangan dengan modul PPG empat kanal, elektroda EKG lead-I ' +
            'pada bezel, dan termistor kontak kulit. Ditujukan untuk pemantauan intensif harian ' +
            'pada karyawan dan lansia yang membutuhkan pengawasan lebih ketat.'
    },
    telering: {
      badge: 'TeleRing · v1',
      title: 'TeleRing — cincin pemantau berdaya rendah',
      desc: 'Bentuk cincin titanium dengan tiga jendela sensor menghadap ke dalam. Sinyal PPG dari ' +
            'arteri jari lebih stabil saat tidur, sehingga cocok untuk pemantauan pasif jangka ' +
            'panjang pada santri, siswa berasrama, dan lansia.'
    }
  };
  $$('.prod-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.prod-tabs button').forEach(b => {
        b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const key = btn.dataset.model;
      const info = PROD[key];
      $('#viewerBadge').textContent = info.badge;
      $('[data-tb]', $('#prodInfo')).textContent = info.title;
      $$('[data-tb]', $('#prodInfo'))[1].textContent = info.desc;
      window.dispatchEvent(new CustomEvent('telecare:model', { detail: key }));
    });
  });

  /* ---------------- 6. KONTROL VIDEO ---------------- */
  const vid = $('#prodVideo'), vBtn = $('#videoToggle');
  if (vid && vBtn) {
    vBtn.addEventListener('click', () => {
      const playing = !vid.paused;
      if (playing) vid.pause(); else vid.play();
      vBtn.querySelector('use').setAttribute('href', playing ? '#i-play' : '#i-pause');
      vBtn.querySelector('span').textContent = playing ? 'Putar' : 'Jeda';
    });
    // Tab video: showreel, promo, use case. Video yang belum ada dilewati
    // dengan menyembunyikan tabnya, bukan membuang seluruh pemutar.
    const cap = $('#videoCap');
    $$('.vtabs [data-vid]').forEach((t) => t.addEventListener('click', () => {
      $$('.vtabs [data-vid]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      vid.src = t.dataset.vid;
      if (cap) cap.textContent = t.dataset.cap;
      vid.play().catch(() => {});
      vBtn.querySelector('use').setAttribute('href', '#i-pause');
      vBtn.querySelector('span').textContent = 'Jeda';
    }));
    const sBtn = $('#videoSound');
    if (sBtn) sBtn.addEventListener('click', () => {
      vid.muted = !vid.muted;
      if (!vid.muted) vid.play().catch(() => {});
      sBtn.querySelector('span').textContent = vid.muted ? 'Suara' : 'Bisukan';
    });
    vid.addEventListener('error', () => {
      const aktif = $('.vtabs [aria-selected="true"]');
      if (aktif) aktif.hidden = true;
      const lain = $('.vtabs [data-vid]:not([hidden])');
      if (lain && lain !== aktif) lain.click();
      else { const w = vid.closest('.film-wrap'); if (w) w.style.display = 'none'; }
    });
  }

  /* ============================================================
     7. MODEL FISIOLOGIS (fallback bila DB kosong)
     ============================================================ */
  const vitals = {
    hr: 78, spo2: 98, temp: 36.7, sys: 118, dia: 76, stress: 28,
    source: 'sim'
  };

  // random walk terbatas agar terlihat wajar secara fisiologis
  function stepSim(dt) {
    if (vitals.source !== 'sim') return;
    vitals.hr    = clamp(vitals.hr    + rnd(-1.4, 1.4), 58, 104);
    vitals.spo2  = clamp(vitals.spo2  + rnd(-.28, .28), 94, 100);
    vitals.temp  = clamp(vitals.temp  + rnd(-.03, .03), 36.1, 37.6);
    vitals.sys   = clamp(vitals.sys   + rnd(-1.1, 1.1), 104, 138);
    vitals.dia   = clamp(vitals.dia   + rnd(-.8, .8), 66, 90);
    // indeks stres mengikuti HR & tekanan nadi
    const pp = vitals.sys - vitals.dia;
    const target = clamp((vitals.hr - 56) * 1.35 + (pp - 38) * 0.9, 4, 96);
    vitals.stress = lerp(vitals.stress, target, 0.05);
  }

  /* ---------------- 8. SPARKLINE ---------------- */
  function makeSpark(canvas, color, capacity) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const data = [];
    function resize() {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    return {
      push(v) { data.push(v); if (data.length > capacity) data.shift(); },
      draw() {
        const r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;
        let mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
        if (mx - mn < 1e-6) { mx += 1; mn -= 1; }
        const pad = 3;
        const X = i => (i / (data.length - 1)) * w;
        const Y = v => h - pad - ((v - mn) / (mx - mn)) * (h - pad * 2);

        // area
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, color + '38'); g.addColorStop(1, color + '00');
        ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
        for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = g; ctx.fill();

        // garis
        ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
        for (let i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(data[i]));
        ctx.strokeStyle = color; ctx.lineWidth = 1.7;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

        // titik terakhir
        ctx.beginPath();
        ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 2.4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      }
    };
  }

  const sparks = {
    hr:  makeSpark($('#sparkHr'),  '#E2543F', 46),
    spo: makeSpark($('#sparkSpo'), '#0E7FB8', 46),
    tmp: makeSpark($('#sparkTmp'), '#E09B12', 46),
    bp:  makeSpark($('#sparkBp'),  '#6C5CE7', 46)
  };

  /* ---------------- 9. EKG SINTETIS ---------------- */
  // Superposisi gaussian untuk gelombang P-QRS-T pada satu siklus [0,1)
  function ecgAt(p) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((p - c) / w, 2));
    return g(0.18, 0.035, 0.13)    // P
         - g(0.36, 0.012, 0.11)    // Q
         + g(0.40, 0.011, 1.00)    // R
         - g(0.44, 0.016, 0.24)    // S
         + g(0.66, 0.062, 0.29);   // T
  }

  const ecgCanvas = $('#ecgCanvas');
  let ecgCtx = null, ecgBuf = [], ecgPhase = 0, ecgW = 0, ecgH = 0;
  const ECG_SPAN = 3.4; // detik terlihat pada layar

  function ecgResize() {
    if (!ecgCanvas) return;
    const r = ecgCanvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    ecgW = r.width; ecgH = r.height;
    ecgCanvas.width = Math.max(1, r.width * dpr);
    ecgCanvas.height = Math.max(1, r.height * dpr);
    ecgCtx = ecgCanvas.getContext('2d');
    ecgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(60, Math.round(r.width));
    while (ecgBuf.length < n) ecgBuf.push(0);
    while (ecgBuf.length > n) ecgBuf.shift();
  }
  if (ecgCanvas) { ecgResize(); window.addEventListener('resize', ecgResize); }

  function ecgStep(dt) {
    if (!ecgCtx) return;
    const px = ecgW / ECG_SPAN;              // piksel per detik
    const steps = Math.max(1, Math.round(px * dt));
    const cyc = 60 / Math.max(35, vitals.hr); // durasi 1 siklus (detik)
    for (let i = 0; i < steps; i++) {
      ecgPhase += (dt / steps) / cyc;
      if (ecgPhase >= 1) ecgPhase -= 1;
      ecgBuf.push(ecgAt(ecgPhase) + rnd(-0.012, 0.012));
      ecgBuf.shift();
    }
  }

  function ecgDraw() {
    if (!ecgCtx) return;
    const w = ecgW, h = ecgH;
    ecgCtx.clearRect(0, 0, w, h);
    const base = h * 0.66, amp = h * 0.46;
    const n = ecgBuf.length;

    // jejak samar (afterglow)
    ecgCtx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w, y = base - ecgBuf[i] * amp;
      i ? ecgCtx.lineTo(x, y) : ecgCtx.moveTo(x, y);
    }
    ecgCtx.strokeStyle = 'rgba(111,211,166,.22)';
    ecgCtx.lineWidth = 5; ecgCtx.lineJoin = 'round'; ecgCtx.stroke();

    // garis utama
    ecgCtx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w, y = base - ecgBuf[i] * amp;
      i ? ecgCtx.lineTo(x, y) : ecgCtx.moveTo(x, y);
    }
    ecgCtx.strokeStyle = '#6FD3A6';
    ecgCtx.lineWidth = 1.9; ecgCtx.lineCap = 'round'; ecgCtx.stroke();

    // kepala sapuan
    const hy = base - ecgBuf[n - 1] * amp;
    ecgCtx.beginPath(); ecgCtx.arc(w - 1.5, hy, 3.1, 0, Math.PI * 2);
    ecgCtx.fillStyle = '#D6F2E3'; ecgCtx.fill();
  }

  /* ---------------- 10. TREN 24 JAM ---------------- */
  const trendCanvas = $('#trendChart');
  const trendSeries = (function () {
    // profil harian yang dibangkitkan sekali, bentuknya menyerupai ritme sirkadian
    const N = 48;
    const mk = (fn) => Array.from({ length: N }, (_, i) => fn(i / (N - 1)));
    return {
      hr:   mk(t => 62 + 14 * Math.sin((t - 0.18) * Math.PI * 2) + 4 * Math.sin(t * Math.PI * 6) + rnd(-1.5, 1.5)),
      sleep: mk(t => 46 + 44 * Math.exp(-Math.pow((t - 0.12) / 0.16, 2)) + 10 * Math.exp(-Math.pow((t - 0.55) / 0.07, 2)) + rnd(-2, 2)),
      stress: mk(t => 22 + 34 * Math.exp(-Math.pow((t - 0.62) / 0.12, 2)) + 16 * Math.exp(-Math.pow((t - 0.36) / 0.09, 2)) + rnd(-2, 2))
    };
  })();

  function drawTrend() {
    if (!trendCanvas) return;
    const ctx = trendCanvas.getContext('2d');
    const r = trendCanvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    trendCanvas.width = Math.max(1, r.width * dpr);
    trendCanvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height, padB = 20, padT = 8;

    ctx.clearRect(0, 0, w, h);

    // kisi & label jam
    ctx.strokeStyle = '#DDEAE3'; ctx.lineWidth = 1;
    ctx.fillStyle = '#5F8477';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let k = 0; k <= 4; k++) {
      const x = (k / 4) * w;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
      ctx.fillText(['00', '06', '12', '18', '24'][k] + ':00', clamp(x, 18, w - 18), h - 6);
    }
    for (let k = 1; k <= 3; k++) {
      const y = padT + (k / 4) * (h - padB - padT);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.strokeStyle = '#EFF6F2'; ctx.stroke();
    }

    const plot = (arr, color, fill) => {
      const mn = 0, mx = 110;
      const X = i => (i / (arr.length - 1)) * w;
      const Y = v => padT + (1 - (v - mn) / (mx - mn)) * (h - padB - padT);
      if (fill) {
        const g = ctx.createLinearGradient(0, padT, 0, h - padB);
        g.addColorStop(0, color + '30'); g.addColorStop(1, color + '00');
        ctx.beginPath(); ctx.moveTo(X(0), Y(arr[0]));
        for (let i = 1; i < arr.length; i++) ctx.lineTo(X(i), Y(arr[i]));
        ctx.lineTo(w, h - padB); ctx.lineTo(0, h - padB); ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(X(0), Y(arr[0]));
      for (let i = 1; i < arr.length; i++) {
        const xc = (X(i - 1) + X(i)) / 2;
        ctx.quadraticCurveTo(X(i - 1), Y(arr[i - 1]), xc, (Y(arr[i - 1]) + Y(arr[i])) / 2);
      }
      ctx.lineTo(X(arr.length - 1), Y(arr[arr.length - 1]));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    };

    plot(trendSeries.sleep, '#0E7FB8', true);
    plot(trendSeries.stress, '#6C5CE7', false);
    plot(trendSeries.hr, '#049A5B', true);
  }
  drawTrend();
  window.addEventListener('resize', drawTrend);

  /* ---------------- 11. DAFTAR PASIEN ---------------- */
  const PATIENTS = [
    { n: 'Nurhaliza P.',  u: 'Unit A · Karyawan', s: 'crit', c: '#E2543F' },
    { n: 'Ahmad Fauzi',   u: 'Unit B · Santri',   s: 'ok',   c: '#049A5B' },
    { n: 'Siti Rahmawati',u: 'Unit A · Karyawan', s: 'warn', c: '#E09B12' },
    { n: 'Bagas Pratama', u: 'Unit C · Siswa',    s: 'ok',   c: '#0E7FB8' },
    { n: 'Ibu Kartini',   u: 'Unit D · Lansia',   s: 'warn', c: '#6C5CE7' },
    { n: 'Rizky Aditya',  u: 'Unit B · Santri',   s: 'ok',   c: '#02643C' }
  ];
  const plist = $('#patientList');
  if (plist) {
    plist.innerHTML = PATIENTS.map((p, i) => {
      const ini = p.n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
      return `<div class="side-item${i === 0 ? ' is-active' : ''}">
        <span class="side-item__av" style="background:${p.c}">${ini}</span>
        <div><b>${p.n}</b><small>${p.u}</small></div>
        <i class="st st--${p.s}"></i></div>`;
    }).join('');
    $$('.side-item', plist).forEach(el => el.addEventListener('click', () => {
      $$('.side-item', plist).forEach(x => x.classList.remove('is-active'));
      el.classList.add('is-active');
    }));
  }

  /* ---------------- 12. RENDER NILAI ---------------- */
  const el = {
    hr: $('#kpiHr'), spo: $('#kpiSpo'), tmp: $('#kpiTmp'), bp: $('#kpiBp'),
    rr: $('#mRR'), hrv: $('#mHRV'),
    stressVal: $('#stressVal'), stressChip: $('#stressChip'),
    needle: $('#gaugeNeedle'), arc: $('#gaugeArc'),
    pill: $('#livePill'), pillLabel: $('#liveLabel')
  };

  function paint() {
    if (!el.hr) return;
    el.hr.textContent  = Math.round(vitals.hr);
    el.spo.textContent = Math.round(vitals.spo2);
    el.tmp.textContent = vitals.temp.toFixed(1);
    el.bp.textContent  = Math.round(vitals.sys) + '/' + Math.round(vitals.dia);

    const rrMs = Math.round(60000 / vitals.hr);
    el.rr.textContent  = rrMs + ' ms';
    el.hrv.textContent = Math.round(clamp(96 - vitals.stress * 0.62, 14, 92)) + ' ms';

    const s = Math.round(vitals.stress);
    el.stressVal.textContent = s;
    // busur 0–100 dipetakan ke dasharray 258 (setengah lingkaran)
    el.arc.setAttribute('stroke-dashoffset', String(Math.round(258 - (s / 100) * 258)));
    el.needle.setAttribute('transform', `rotate(${(-90 + (s / 100) * 180).toFixed(1)} 100 106)`);

    let label = 'RENDAH', col = 'var(--green-50)', fg = 'var(--green-600)', bd = 'var(--green-100)';
    if (s >= 66) { label = 'TINGGI'; col = 'var(--coral-100)'; fg = 'var(--coral-500)'; bd = '#FBD3CC'; }
    else if (s >= 34) { label = 'SEDANG'; col = 'var(--amber-100)'; fg = '#8A5D00'; bd = '#F6DFAE'; }
    el.stressChip.textContent = label;
    el.stressChip.style.background = col;
    el.stressChip.style.color = fg;
    el.stressChip.style.borderColor = bd;
  }

  function setStatus(text, offline) {
    if (!el.pill) return;
    el.pillLabel.textContent = text;
    el.pill.classList.toggle('is-offline', !!offline);
  }

  /* ---------------- 13. FIREBASE (opsional) ---------------- */
  // js/firebase-init.js memancarkan event ini jika Realtime DB berisi data.
  window.addEventListener('telecare:vitals', (e) => {
    const d = e.detail || {};
    vitals.source = 'db';
    if (typeof d.hr === 'number')     vitals.hr = clamp(d.hr, 30, 220);
    if (typeof d.spo2 === 'number')   vitals.spo2 = clamp(d.spo2, 60, 100);
    if (typeof d.temp === 'number')   vitals.temp = clamp(d.temp, 30, 43);
    if (typeof d.sys === 'number')    vitals.sys = clamp(d.sys, 70, 220);
    if (typeof d.dia === 'number')    vitals.dia = clamp(d.dia, 40, 140);
    if (typeof d.stress === 'number') vitals.stress = clamp(d.stress, 0, 100);
    setStatus('LANGSUNG · PERANGKAT', false);
    paint();
  });
  window.addEventListener('telecare:dbstate', (e) => {
    const st = e.detail;
    if (st === 'connected') {
      if (vitals.source !== 'db') setStatus('TERHUBUNG · MODE SIMULASI', false);
    } else if (st === 'error') {
      setStatus('SIMULASI LOKAL', true);
    }
  });
  setTimeout(() => {
    if (vitals.source === 'sim' && el.pillLabel &&
        el.pillLabel.textContent === 'MENGHUBUNGKAN') setStatus('SIMULASI LOKAL', true);
  }, 3500);

  /* ---------------- 14. LOOP ---------------- */
  let last = performance.now(), acc = 0, running = true;

  if ('IntersectionObserver' in window && $('#dashboard')) {
    new IntersectionObserver(es => { running = es[0].isIntersecting; }, { threshold: 0 })
      .observe($('#dashboard'));
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (running) {
      ecgStep(dt);
      ecgDraw();
      acc += dt;
      if (acc >= 1) {
        acc = 0;
        stepSim(dt);
        paint();
        sparks.hr  && sparks.hr.push(vitals.hr);
        sparks.spo && sparks.spo.push(vitals.spo2);
        sparks.tmp && sparks.tmp.push(vitals.temp);
        sparks.bp  && sparks.bp.push(vitals.sys);
        Object.keys(sparks).forEach(k => sparks[k] && sparks[k].draw());
      }
    }
    requestAnimationFrame(frame);
  }

  // isi awal sparkline agar tidak kosong
  for (let i = 0; i < 46; i++) {
    stepSim(1);
    sparks.hr  && sparks.hr.push(vitals.hr);
    sparks.spo && sparks.spo.push(vitals.spo2);
    sparks.tmp && sparks.tmp.push(vitals.temp);
    sparks.bp  && sparks.bp.push(vitals.sys);
  }
  Object.keys(sparks).forEach(k => sparks[k] && sparks[k].draw());
  paint();
  requestAnimationFrame(frame);
})();
