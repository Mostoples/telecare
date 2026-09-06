/* ============================================================
   TeleCare App — engine.js
   Mesin simulasi fisiologis, pengelola perangkat AIoT, perekam EKG,
   dan model sesi makan (respons glukosa).

   CATATAN: seluruh nilai fisiologis di sini dibangkitkan secara
   simulatif untuk keperluan purwarupa. Bila perangkat sungguhan
   tersambung lewat Web Bluetooth, nilai dari perangkat itulah yang
   dipakai dan simulasi dimatikan.
   ============================================================ */
(function (TC) {
  'use strict';

  const { clamp, lerp, rnd, rint, pick, uid, Store } = TC;
  const D = TC.DATA;

  /* ============================================================
     1. VITALS — simulasi fisiologis berirama sirkadian
     ============================================================ */
  const Vitals = (function () {
    const HIST = 60;
    const state = {
      hr: 74, spo2: 98, temp: 36.7, sys: 118, dia: 76,
      stress: 28, steps: 0, glucose: 92, hrv: 46,
      source: 'sim', updatedAt: Date.now()
    };
    const hist = { hr: [], spo2: [], temp: [], sys: [], glucose: [] };
    const subs = new Set();
    let timer = null;

    /** Nilai dasar mengikuti jam (bangun, aktivitas siang, istirahat malam). */
    function circadian(h) {
      const day = Math.sin(((h - 8) / 24) * Math.PI * 2);
      return {
        hr: 66 + day * 10,
        temp: 36.55 + day * 0.28,
        sys: 116 + day * 7,
        stress: 26 + Math.max(0, day) * 22
      };
    }

    function step() {
      const now = new Date();
      const base = circadian(now.getHours() + now.getMinutes() / 60);

      if (state.source === 'sim') {
        state.hr = clamp(lerp(state.hr, base.hr + rnd(-4, 4), 0.14), 48, 132);
        state.spo2 = clamp(state.spo2 + rnd(-0.3, 0.3), 93, 100);
        state.temp = clamp(lerp(state.temp, base.temp + rnd(-0.08, 0.08), 0.1), 35.9, 37.8);
        state.sys = clamp(lerp(state.sys, base.sys + rnd(-4, 4), 0.1), 100, 145);
        state.dia = clamp(state.dia + rnd(-0.8, 0.8), 62, 94);

        const pp = state.sys - state.dia;
        const target = clamp((state.hr - 54) * 1.25 + (pp - 38) * 0.8 + base.stress * 0.25, 4, 96);
        state.stress = lerp(state.stress, target, 0.05);
        state.hrv = Math.round(clamp(98 - state.stress * 0.66, 14, 92));

        // langkah bertambah hanya pada jam aktif
        const h = now.getHours();
        if (h >= 6 && h <= 21 && Math.random() < 0.45) state.steps += rint(0, 14);

        // glukosa mengikuti sesi makan yang sedang berjalan
        state.glucose = Meals.currentGlucose(state.glucose);
      }

      state.updatedAt = Date.now();
      Object.keys(hist).forEach((k) => {
        hist[k].push(state[k]);
        if (hist[k].length > HIST) hist[k].shift();
      });
      subs.forEach((fn) => { try { fn(state); } catch (e) { /* abaikan */ } });
    }

    function start() {
      if (timer) return;
      if (!hist.hr.length) for (let i = 0; i < 30; i++) step();
      timer = setInterval(step, 2000);
    }
    function stop() { clearInterval(timer); timer = null; }

    return {
      state, hist, start, stop, step,
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      /**
       * Dipanggil ketika data sungguhan datang dari perangkat. Selama
       * `source` bernilai 'device', step() berhenti membangkitkan angka
       * sehingga nilai perangkat tidak tertimpa simulasi.
       */
      ingest(v) {
        state.source = 'device';
        ['hr', 'spo2', 'temp', 'sys', 'dia', 'stress', 'glucose', 'hrv'].forEach((k) => {
          if (typeof v[k] === 'number' && isFinite(v[k])) state[k] = v[k];
        });
        state.updatedAt = Date.now();
        subs.forEach((fn) => { try { fn(state); } catch (e) { /* abaikan */ } });
      },

      /**
       * Kembali ke simulasi setelah perangkat sungguhan lepas. Tanpa ini
       * layar vital akan membeku pada angka terakhir dari perangkat dan
       * tampak seolah masih hidup.
       */
      releaseDevice() {
        if (state.source !== 'device') return;
        state.source = 'sim';
        state.updatedAt = Date.now();
        subs.forEach((fn) => { try { fn(state); } catch (e) { /* abaikan */ } });
      },

      /** 'sim' atau 'device' — dipakai UI untuk menandai asal angka. */
      source() { return state.source; },
      snapshot() {
        return {
          hr: Math.round(state.hr), spo2: Math.round(state.spo2),
          temp: +state.temp.toFixed(1), sys: Math.round(state.sys),
          dia: Math.round(state.dia), stress: Math.round(state.stress),
          hrv: state.hrv, glucose: Math.round(state.glucose), at: Date.now()
        };
      },
      stressLabel(v) {
        const s = v == null ? state.stress : v;
        if (s >= 66) return { t: 'Tinggi', c: 'r' };
        if (s >= 34) return { t: 'Sedang', c: 'a' };
        return { t: 'Rendah', c: 'g' };
      }
    };
  })();

  /* ============================================================
     2. EKG — bentuk gelombang P-QRS-T sintetis
     ============================================================ */
  function ecgAt(p) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((p - c) / w, 2));
    return g(0.18, 0.035, 0.13) - g(0.36, 0.012, 0.11) + g(0.40, 0.011, 1.0)
         - g(0.44, 0.016, 0.24) + g(0.66, 0.062, 0.29);
  }

  /** Menggambar EKG yang bergulir pada sebuah <canvas>. */
  function EcgRenderer(canvas) {
    let raf = null, buf = [], phase = 0, W = 0, H = 0, ctx = null;
    const SPAN = 3.2; // detik yang terlihat

    function resize() {
      const f = TC.fitCanvas(canvas);
      if (!f) return false;
      ctx = f.ctx; W = f.w; H = f.h;
      const n = Math.max(60, Math.round(W));
      while (buf.length < n) buf.push(0);
      while (buf.length > n) buf.shift();
      return true;
    }

    function draw(dt) {
      if (!ctx && !resize()) return;
      const px = W / SPAN;
      const steps = Math.max(1, Math.round(px * dt));
      const cyc = 60 / clamp(Vitals.state.hr, 35, 200);
      for (let i = 0; i < steps; i++) {
        phase += (dt / steps) / cyc;
        if (phase >= 1) phase -= 1;
        buf.push(ecgAt(phase) + rnd(-0.012, 0.012));
        buf.shift();
      }
      const base = H * 0.66, amp = H * 0.44, n = buf.length;
      ctx.clearRect(0, 0, W, H);
      const path = () => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * W, y = base - buf[i] * amp;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      };
      path(); ctx.strokeStyle = 'rgba(111,211,166,.22)'; ctx.lineWidth = 5;
      ctx.lineJoin = 'round'; ctx.stroke();
      path(); ctx.strokeStyle = '#6FD3A6'; ctx.lineWidth = 1.9;
      ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath();
      ctx.arc(W - 1.5, base - buf[n - 1] * amp, 3, 0, 7);
      ctx.fillStyle = '#D6F2E3'; ctx.fill();
    }

    let last = performance.now();
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
    }

    const onResize = () => { ctx = null; };
    window.addEventListener('resize', onResize);
    resize();
    raf = requestAnimationFrame(loop);

    return {
      stop() {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      }
    };
  }

  /* ============================================================
     3. PERANGKAT AIoT
     ============================================================ */
  const Devices = (function () {
    let syncTimer = null;

    function makeCode(prefix) {
      const hex = '0123456789ABCDEF';
      let s = '';
      for (let i = 0; i < 4; i++) s += hex[Math.floor(Math.random() * 16)];
      return prefix + '-' + s;
    }

    /** Hasil pemindaian simulatif — selalu memuat TeleBand & TeleRing. */
    function simulateScan() {
      const types = D.DEVICE_TYPES;
      const chosen = [types[0], types[1]];
      // satu atau dua perangkat lain agar terasa seperti ruangan sungguhan
      const rest = types.slice(2).sort(() => Math.random() - 0.5).slice(0, rint(1, 2));
      const all = chosen.concat(rest);
      const owned = Store.state.devices.map((d) => d.code);
      const found = all.map((t) => ({
        id: uid('dev'),
        type: t.type,
        name: t.name,
        code: makeCode(t.prefix),
        rssi: rint(1, 4),
        battery: rint(t.battery[0], t.battery[1]),
        supported: true
      })).filter((d) => owned.indexOf(d.code) === -1);
      // satu perangkat asing yang tidak didukung, seperti di lapangan
      found.push({
        id: uid('dev'), type: 'unknown', name: 'Perangkat BLE tidak dikenal',
        code: '—', rssi: rint(1, 2), battery: null, supported: false
      });
      return found.sort((a, b) => b.rssi - a.rssi);
    }

    /** Mencoba pemindaian Web Bluetooth sungguhan bila tersedia. */
    async function realScan() {
      if (!TC.Ble || !TC.Ble.supported()) throw new Error('unsupported');
      const dev = await TC.Ble.requestDevice();
      return {
        id: uid('dev'),
        type: 'band',
        name: dev.name || 'Perangkat Bluetooth',
        code: (dev.name || 'BLE').toUpperCase().slice(0, 12),
        rssi: 4, battery: null, supported: true, real: true, ref: dev
      };
    }

    /* ---------------- sambungan GATT sungguhan ----------------
       Satu perangkat nyata aktif pada satu waktu; kuncinya adalah id
       perangkat pada store, supaya pemutusan dapat menyasar dengan tepat.
       ------------------------------------------------------- */
    const sesiBle = new Map();

    /**
     * Menyambungkan perangkat BLE sungguhan lalu mengalirkan nilainya ke
     * Vitals. Selama tersambung, simulasi berhenti menimpa angka.
     */
    async function connectReal(dev, ref) {
      if (!TC.Ble || !ref) return null;
      const sesi = await TC.Ble.connect(ref, {
        onData(v) {
          Vitals.ingest(v);
          // Kontak kulit longgar membuat angka tidak dapat dipercaya, jadi
          // pengguna diberi tahu alih-alih dibiarkan menduga.
          if (v.kontakKulit === false) {
            Store.notify('Sensor tidak menempel',
              'Perangkat melaporkan sensor lepas dari kulit — nilai bisa tidak akurat.', 'warn');
          }
        },
        onBattery(p) {
          Store.update((s) => {
            const d = s.devices.find((x) => x.id === dev.id);
            if (d) d.battery = p;
          });
        },
        onDisconnect() {
          sesiBle.delete(dev.id);
          Vitals.releaseDevice();
          Store.update((s) => {
            const d = s.devices.find((x) => x.id === dev.id);
            if (d) d.connected = false;
          });
          Store.notify('Perangkat terputus',
            dev.name + ' lepas dari Bluetooth. Vital kembali ke simulasi.', 'warn');
        },
        onLog(m) { console.info('[TeleCare BLE]', m); }
      });

      sesiBle.set(dev.id, sesi);

      Store.update((s) => {
        const d = s.devices.find((x) => x.id === dev.id);
        if (!d) return;
        d.services = sesi.layanan;
        if (sesi.batteryAwal != null) d.battery = sesi.batteryAwal;
      });

      if (!sesi.layanan.length) {
        Store.notify('Tidak ada layanan yang dikenali',
          'Perangkat tersambung tetapi tidak menyediakan profil kesehatan standar. ' +
          'Vital tetap memakai simulasi.', 'warn');
      } else {
        Store.notify('Membaca data perangkat',
          'Layanan aktif: ' + sesi.layanan.join(', '), 'ok');
      }
      return sesi;
    }

    /** Memutus sambungan GATT bila perangkat itu memang perangkat nyata. */
    function stopReal(id) {
      const sesi = sesiBle.get(id);
      if (!sesi) return false;
      sesi.stop();
      sesiBle.delete(id);
      Vitals.releaseDevice();
      return true;
    }

    const isReal = (id) => sesiBle.has(id);

    function pair(found) {
      const t = D.deviceType(found.type);
      const dev = {
        id: found.id, type: found.type, name: found.name, code: found.code,
        battery: found.battery != null ? found.battery : rint(t.battery[0], t.battery[1]),
        connected: true, real: !!found.real,
        pairedAt: Date.now(), lastSync: null, rssi: found.rssi || 4
      };
      Store.update((s) => {
        s.devices = s.devices.filter((d) => d.code !== dev.code);
        s.devices.push(dev);
        s.activeDeviceId = dev.id;
        s.pendingSamples = rint(0, 40);
      });
      Store.notify('Perangkat tersambung', dev.name + ' · ' + dev.code, 'ok');
      startBuffer();

      // Perangkat sungguhan disambungkan ke GATT-nya; kegagalan tidak
      // membatalkan pemasangan, aplikasi hanya kembali memakai simulasi.
      if (found.real && found.ref) {
        connectReal(dev, found.ref).catch((e) => {
          console.warn('[TeleCare] GATT gagal:', e && e.message);
          Store.notify('Gagal membaca perangkat',
            (e && e.message) || 'Sambungan GATT gagal. Vital memakai simulasi.', 'warn');
        });
      }
      return dev;
    }

    function disconnect(id) {
      stopReal(id);
      Store.update((s) => {
        const d = s.devices.find((x) => x.id === id);
        if (d) d.connected = false;
      });
    }

    function reconnect(id) {
      Store.update((s) => {
        const d = s.devices.find((x) => x.id === id);
        if (d) { d.connected = true; d.rssi = TC.rint(2, 4); }
        s.activeDeviceId = id;
      });
      Store.notify('Tersambung kembali', 'Perangkat berhasil disambungkan ulang.', 'ok');
    }

    function forget(id) {
      stopReal(id);
      Store.update((s) => {
        s.devices = s.devices.filter((d) => d.id !== id);
        if (s.activeDeviceId === id) s.activeDeviceId = s.devices.length ? s.devices[0].id : null;
      });
    }

    /** Buffer jam bertambah selama belum disinkronkan. */
    function startBuffer() {
      if (syncTimer) return;
      syncTimer = setInterval(() => {
        const s = Store.state;
        // Perangkat sungguhan mengalirkan nilai langsung lewat notifikasi GATT,
        // jadi tidak ada tumpukan yang menunggu disinkronkan. Menambah buffer
        // di sini akan menampilkan antrean yang tidak pernah ada.
        const adaNyataTersambung = s.devices.some((d) => d.connected && isReal(d.id));
        if (adaNyataTersambung) return;

        if (!s.devices.some((d) => d.connected)) {
          // tetap mengukur meski terputus — persis seperti perangkat asli
          Store.update((st) => { st.pendingSamples += TC.rint(1, 3); });
        } else if (Math.random() < 0.5) {
          Store.update((st) => { st.pendingSamples += 1; });
        }
      }, 12000);
    }

    /** Memindahkan sampel dari buffer perangkat ke aplikasi. */
    function sync() {
      return new Promise((resolve, reject) => {
        const dev = Store.activeDevice();
        if (!dev || !dev.connected) { reject(new Error('Perangkat tidak tersambung')); return; }
        const n = Store.state.pendingSamples;
        const dur = clamp(600 + n * 22, 700, 3200);
        setTimeout(() => {
          Store.update((s) => {
            s.pendingSamples = 0;
            s.lastSync = Date.now();
            const d = s.devices.find((x) => x.id === dev.id);
            if (d) { d.lastSync = Date.now(); d.battery = clamp(d.battery - TC.rint(0, 1), 5, 100); }
            s.vitalsHistory.push(Vitals.snapshot());
            s.vitalsHistory = s.vitalsHistory.slice(-200);
          });
          resolve(n);
        }, dur);
      });
    }

    function statusText() {
      const dev = Store.activeDevice();
      if (!dev) return { t: 'Belum ada perangkat', on: false };
      if (!dev.connected) return { t: dev.name + ' terputus', on: false };
      return { t: dev.name + ' · baterai ' + dev.battery + '%', on: true };
    }

    return {
      simulateScan, realScan, pair, disconnect, reconnect, forget, sync,
      startBuffer, statusText, makeCode,
      connectReal, stopReal, isReal,
      hasWebBluetooth: () => !!(TC.Ble && TC.Ble.supported())
    };
  })();

  /* ============================================================
     4. SESI MAKAN & RESPONS GLUKOSA
     ============================================================ */
  const Meals = (function () {
    const HOUR = 3600000;

    function mealKind(d) {
      const h = d.getHours();
      for (const k of D.MEAL_KINDS) {
        if (k.from < k.to ? (h >= k.from && h < k.to) : (h >= k.from || h < k.to)) return k;
      }
      return D.MEAL_KINDS[1];
    }

    /** Menjumlahkan gizi dari daftar makanan terpilih. */
    function nutrition(items) {
      const t = { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0, fiber: 0 };
      items.forEach((it) => {
        const f = D.food(it.n);
        if (!f) return;
        const q = it.qty || 1;
        t.kcal += f.kcal * q; t.carb += f.c * q; t.protein += f.p * q;
        t.fat += f.f * q; t.sugar += f.sugar * q; t.fiber += f.fiber * q;
      });
      Object.keys(t).forEach((k) => { t[k] = Math.round(t[k] * 10) / 10; });
      t.kcal = Math.round(t.kcal);
      return t;
    }

    /** Perkiraan kenaikan puncak glukosa dari komposisi makanan. */
    function predictDelta(n, items) {
      let giFactor = 1;
      items.forEach((it) => {
        const f = D.food(it.n);
        if (!f) return;
        giFactor += (f.gi === 'tinggi' ? 0.14 : f.gi === 'sedang' ? 0.05 : -0.03);
      });
      const raw = (n.carb * 0.42 + n.sugar * 0.55 - n.fiber * 2.6 - n.protein * 0.18 - n.fat * 0.12);
      return Math.round(clamp(raw * clamp(giFactor, 0.7, 1.6), 8, 78));
    }

    /** Membuat sesi baru; titik pengukuran dipercepat pada mode demo. */
    function create(items, photo, opts) {
      opts = opts || {};
      const now = Date.now();
      const n = nutrition(items);
      const speed = Store.state.settings.fastDemo ? 60 : 1; // 2 jam -> 2 menit
      const baseline = Math.round(clamp(Vitals.state.glucose + rnd(-4, 4), 78, 108));
      const delta = predictDelta(n, items);

      const meal = {
        id: uid('meal'), at: now, photo: photo || null,
        kind: mealKind(new Date(now)).name,
        items, nutrition: n, confidence: opts.confidence || 82,
        speed, baseline, predictedDelta: delta,
        status: 'running',
        points: [
          { key: 'baseline', label: 'Baseline', offset: -300000, value: baseline, done: true },
          { key: 't0', label: 'Selesai makan', offset: 0, value: null, done: false },
          { key: 'h1', label: '+1 jam', offset: HOUR, value: null, done: false },
          { key: 'h2', label: '+2 jam', offset: 2 * HOUR, value: null, done: false }
        ]
      };
      Store.update((s) => { s.activeMeal = meal; });
      tick();
      return meal;
    }

    /** Waktu nyata (ms) sebuah titik akan tiba. */
    function pointDue(meal, p) {
      return meal.at + p.offset / meal.speed;
    }

    /** Nilai glukosa pada sebuah titik, mengikuti kurva respons. */
    function valueAt(meal, offsetMs) {
      const h = offsetMs / HOUR;
      const d = meal.predictedDelta;
      if (h <= 0) return meal.baseline + Math.round(rnd(2, 8));
      // kurva naik cepat lalu turun perlahan (gamma sederhana)
      const shape = Math.pow(h / 1.0, 1.6) * Math.exp(1.6 * (1 - h / 1.0));
      return Math.round(meal.baseline + d * clamp(shape, 0, 1.05) + rnd(-3, 3));
    }

    /** Memperbarui titik yang waktunya sudah lewat. */
    function tick() {
      const m = Store.state.activeMeal;
      if (!m || m.status !== 'running') return;
      let changed = false;
      const now = Date.now();
      m.points.forEach((p) => {
        if (p.done || p.offset < 0) return;
        if (now >= pointDue(m, p)) {
          p.value = valueAt(m, p.offset);
          p.done = true;
          changed = true;
        }
      });
      if (changed) {
        if (m.points.every((p) => p.done)) finish(m);
        else Store.save();
      }
      return changed;
    }

    function finish(m) {
      const measured = m.points.filter((p) => p.done && p.value != null);
      const peakP = measured.reduce((a, b) => (b.value > a.value ? b : a), measured[0]);
      m.peak = peakP.value;
      m.peakAt = peakP.label;
      m.delta = m.peak - m.baseline;
      m.recovery = m.delta > 45 ? 3 : m.delta > 28 ? 2 : 1.5;
      m.category = m.delta > 45 ? 'Tinggi' : m.delta > 28 ? 'Sedang' : 'Landai';
      m.status = 'done';
      m.doneAt = Date.now();
      Store.update((s) => {
        s.meals.unshift(m);
        s.meals = s.meals.slice(0, 60);
        s.activeMeal = null;
      });
      Store.notify('Sesi selesai',
        `${m.kind} · puncak ${m.peak} mg/dL (+${m.delta} dari baseline)`, 'ok');
    }

    function cancel() {
      Store.update((s) => { s.activeMeal = null; });
    }

    /** Glukosa saat ini, dipengaruhi sesi yang sedang berjalan. */
    function currentGlucose(prev) {
      const m = Store.state.activeMeal;
      if (!m) return clamp(lerp(prev, 92 + rnd(-5, 5), 0.06), 72, 130);
      const elapsed = (Date.now() - m.at) * m.speed;
      const target = valueAt(m, Math.max(0, elapsed));
      return clamp(lerp(prev, target, 0.25), 65, 260);
    }

    /** Ringkasan hari ini dari seluruh sesi. */
    function today() {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const list = Store.state.meals.filter((m) => m.at >= start.getTime());
      const t = { kcal: 0, carb: 0, protein: 0, fat: 0, count: list.length };
      list.forEach((m) => {
        t.kcal += m.nutrition.kcal; t.carb += m.nutrition.carb;
        t.protein += m.nutrition.protein; t.fat += m.nutrition.fat;
      });
      Object.keys(t).forEach((k) => { t[k] = Math.round(t[k]); });
      return t;
    }

    function peakTrend(n) {
      return Store.state.meals.filter((m) => m.status === 'done')
        .slice(0, n || 6).map((m) => m.peak).reverse();
    }

    /** Mensimulasikan pengenalan makanan dari sebuah foto. */
    function recognize() {
      const combo = pick(D.FOOD_COMBOS);
      const items = combo.map((n) => {
        const f = D.food(n);
        const qty = Math.random() < 0.75 ? 1 : (Math.random() < 0.5 ? 0.5 : 2);
        return { n, qty, g: Math.round(f.g * qty) };
      });
      const confidence = rint(46, 94);
      return { items, confidence };
    }

    return {
      create, tick, cancel, finish, nutrition, predictDelta, valueAt,
      pointDue, currentGlucose, today, peakTrend, recognize, mealKind
    };
  })();

  /* ============================================================
     5. KONSULTASI — pesan disinkronkan lewat Firebase Realtime DB
     ============================================================
     Sumber kebenaran percakapan adalah Realtime Database bila
     tersambung; salinan lokal tetap disimpan agar riwayat terbaca
     saat luring dan agar pesan tidak hilang bila jaringan putus.
     ============================================================ */
  const Consult = (function () {

    function record(id) { return Store.state.consults.find((c) => c.id === id) || null; }

    function start(doctorId, mode) {
      const doc = D.doctor(doctorId);
      // ID konsultasi sekaligus menjadi ID ruang panggilan dan dibagikan lewat
      // tautan undangan, sehingga ikut menentukan hak akses — pakai pembangkit
      // kriptografis, bukan uid() yang berbasis Math.random.
      const id = TC.secureId('cs');
      const c = {
        id, doctorId, mode: mode || 'chat',
        startedAt: Date.now(), status: 'active', messages: []
      };
      Store.update((s) => { s.consults.unshift(c); });

      if (TC.FB && TC.FB.ready) TC.Chat.ensure(id, c);

      push(id, { from: 'sys', text: 'Konsultasi dimulai. Sampaikan keluhan Anda selengkap mungkin.' });
      push(id, {
        from: 'doc',
        text: `Selamat datang, saya ${doc.name}. Ada yang bisa saya bantu hari ini? ` +
              'Silakan ceritakan keluhan yang Anda rasakan.'
      });
      return c;
    }

    /** Menyimpan pesan ke salinan lokal bila belum ada (dedup lewat mid). */
    function mirror(id, msg) {
      let added = false;
      Store.update((s) => {
        const c = s.consults.find((x) => x.id === id);
        if (!c) return;
        if (msg.mid && c.messages.some((m) => m.mid === msg.mid)) return;
        c.messages.push(msg);
        c.messages.sort((a, b) => (a.at || 0) - (b.at || 0));
        added = true;
      });
      return added;
    }

    /**
     * Mengirim pesan. Bila Firebase tersambung, pesan dikirim ke server
     * dan salinan lokal diisi oleh pendengar child_added. Bila luring,
     * pesan langsung masuk ke salinan lokal.
     */
    function push(id, msg) {
      const m = Object.assign({ mid: uid('m'), at: Date.now() }, msg);
      // Salinan lokal ditulis lebih dulu agar pesan tetap muncul walau
      // jaringan lambat; pendengar child_added menyaringnya lewat mid.
      mirror(id, m);
      if (TC.FB && TC.FB.ready) TC.Chat.send(id, m).catch(() => {});
      return m;
    }

    /**
     * Membuat catatan lokal untuk percakapan yang sudah ada di server —
     * dipakai ketika tautan undangan dibuka di perangkat lain.
     */
    function adopt(id) {
      if (record(id)) return Promise.resolve(record(id));
      if (!(TC.FB && TC.FB.ready)) return Promise.resolve(null);
      return TC.Chat.meta(id).then((meta) => {
        if (!meta) return null;
        const c = {
          id, doctorId: meta.doctorId, mode: meta.mode || 'chat',
          startedAt: meta.startedAt || Date.now(),
          status: meta.status || 'active', messages: []
        };
        Store.update((s) => { s.consults.unshift(c); });
        return c;
      });
    }

    /** Berlangganan pesan dari server; mengembalikan pemutus langganan. */
    function subscribe(id, onChange) {
      if (!(TC.FB && TC.FB.ready)) return () => {};
      return TC.Chat.subscribe(id, (m) => {
        if (mirror(id, m) && onChange) onChange(m);
      });
    }

    function replyTo(text) {
      const t = String(text || '').toLowerCase();
      for (const rule of D.REPLY_RULES) {
        if (rule.k.some((k) => t.indexOf(k) !== -1)) return rule.r;
      }
      return pick(D.REPLY_FALLBACK);
    }

    function end(id, note) {
      Store.update((s) => {
        const c = s.consults.find((x) => x.id === id);
        if (!c) return;
        c.status = 'done';
        c.endedAt = Date.now();
        c.note = note || null;
      });
      if (TC.FB && TC.FB.online) TC.Chat.setStatus(id, 'done');
    }

    return { start, get: record, adopt, push, mirror, subscribe, replyTo, end };
  })();

  /* ============================================================
     6. TREN 7 HARI (dibangkitkan sekali, disimpan)
     ============================================================ */
  function weekTrend() {
    const s = Store.state;
    if (!s._week || s._week.day !== new Date().getDate()) {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push({
          label: TC.DAYS[d.getDay()].slice(0, 3),
          rhr: Math.round(62 + rnd(-4, 7)),
          sleep: Math.round(clamp(rnd(5.2, 8.2) * 10) / 10 * 10) / 10,
          stress: Math.round(clamp(24 + rnd(-8, 34), 8, 88)),
          steps: rint(3200, 11800)
        });
      }
      Store.update((st) => { st._week = { day: new Date().getDate(), days }; });
    }
    return s._week.days;
  }

  TC.Vitals = Vitals;
  TC.Devices = Devices;
  TC.Meals = Meals;
  TC.Consult = Consult;
  TC.EcgRenderer = EcgRenderer;
  TC.ecgAt = ecgAt;
  TC.weekTrend = weekTrend;
})(window.TC);
