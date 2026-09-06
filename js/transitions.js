/* ============================================================
   TeleCare — transitions.js
   Transisi antar-bagian bernuansa "pemindaian medis", pengungkap
   bertahap, penghitung angka, halo kursor, dan pemicu ikon SVG.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 1. OVERLAY TRANSISI ---------------- */
  const NAMES = {
    top: 'Beranda', urgensi: 'Urgensi', produk: 'Perangkat', banding: 'Perbandingan', aplikasi: 'Aplikasi', video: 'Render Produk',
    arsitektur: 'Arsitektur', health5: 'Health 5.0', dashboard: 'Dashboard',
    segmen: 'Segmen', alur: 'Alur Layanan', tim: 'Tim Peneliti', kontak: 'Kolaborasi'
  };

  const pt = document.createElement('div');
  pt.className = 'pt';
  pt.setAttribute('aria-hidden', 'true');
  pt.innerHTML = `
    <div class="pt__grid"></div>
    <div class="pt__scan"></div>
    <div class="pt__scanH"></div>
    <div class="pt__core">
      <i class="pt__ring"></i>
      <svg class="pt__ecg" viewBox="0 0 210 56">
        <path d="M2 34h24l7-19 11 38 8-27 6 8h22l7-14 9 26 7-16h20l8-18 11 34 8-24 6 7h44"/>
      </svg>
      <div class="pt__bar"><i></i></div>
      <div class="pt__label" id="ptLabel">Memuat</div>
    </div>`;
  document.body.appendChild(pt);
  const ptLabel = $('#ptLabel', pt);

  let busy = false;
  function goTo(hash) {
    const id = hash.replace('#', '');
    const target = document.getElementById(id);
    if (!target || busy) { if (target) target.scrollIntoView(); return; }

    if (reduce) {
      target.scrollIntoView();
      history.replaceState(null, '', '#' + id);
      return;
    }

    busy = true;
    ptLabel.textContent = NAMES[id] || id;
    pt.classList.remove('is-out');
    // paksa reflow agar animasi berulang dapat dijalankan kembali
    void pt.offsetWidth;
    pt.classList.add('is-in');

    setTimeout(() => {
      const prev = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      const y = target.getBoundingClientRect().top + window.scrollY -
                (id === 'top' ? 0 : 54);
      window.scrollTo(0, Math.max(0, y));
      document.documentElement.style.scrollBehavior = prev;
      history.replaceState(null, '', '#' + id);

      pt.classList.remove('is-in');
      pt.classList.add('is-out');
      setTimeout(() => { pt.classList.remove('is-out'); busy = false; }, 640);
    }, 600);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    if (!document.getElementById(href.slice(1))) return;
    e.preventDefault();
    goTo(href);
  });

  /* ---------------- 2. STAGGER + SCANLINE ---------------- */
  function observe(selector, cls, opts) {
    const els = $$(selector);
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add(cls));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add(cls); io.unobserve(en.target); }
      });
    }, opts || { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
  }
  observe('.stagger', 'is-in');
  observe('.scanline', 'is-in');
  observe('.aico-host', 'is-in', { threshold: 0.35 });

  // sisipkan berkas sinar ke setiap elemen .scanline
  $$('.scanline').forEach(el => {
    if (!$('.scanline__beam', el)) {
      const b = document.createElement('i');
      b.className = 'scanline__beam';
      el.appendChild(b);
    }
  });

  /* ---------------- 3. PENGHITUNG ANGKA ---------------- */
  function runCount(el) {
    const to = parseFloat(el.dataset.count);
    const dec = (el.dataset.dec | 0);
    const dur = 1250;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = to.toFixed(dec);
    })(t0);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach(en => {
        if (en.isIntersecting) { runCount(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    $$('.count[data-count]').forEach(el => io.observe(el));
  } else {
    $$('.count[data-count]').forEach(el => { el.textContent = el.dataset.count; });
  }

  /* ---------------- 4. HALO KURSOR ---------------- */
  if (!reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const halo = document.createElement('div');
    halo.className = 'cursor-halo';
    document.body.appendChild(halo);
    let x = 0, y = 0, tx = 0, ty = 0, on = false;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; document.body.classList.add('has-halo'); x = tx; y = ty; }
    }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      halo.style.transform = `translate(${x}px,${y}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- 5. PANJANG GARIS IKON SVG ---------------- */
  // menghitung panjang jalur sesungguhnya agar animasi "menggambar" pas
  requestAnimationFrame(() => {
    $$('.aico .stroke').forEach(p => {
      try {
        const len = Math.ceil(p.getTotalLength()) + 2;
        p.style.setProperty('--len', len);
      } catch (e) { /* jalur tanpa geometri terukur */ }
    });
  });

  /* ---------------- 6. SOROTAN NAV AKTIF ---------------- */
  const secs = ['urgensi', 'produk', 'banding', 'arsitektur', 'health5', 'dashboard', 'aplikasi', 'segmen', 'tim']
    .map(id => document.getElementById(id)).filter(Boolean);
  const links = {};
  $$('.nav__links a').forEach(a => { links[a.getAttribute('href').slice(1)] = a; });
  if (secs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        const a = links[en.target.id];
        if (!a) return;
        a.style.background = en.isIntersecting ? 'rgba(4,154,91,.12)' : '';
        a.style.color = en.isIntersecting ? 'var(--green-600)' : '';
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    secs.forEach(s => io.observe(s));
  }
})();
