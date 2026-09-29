/* ============================================================
   TeleCare App — ble.js
   Pembacaan karakteristik GATT sungguhan lewat Web Bluetooth.

   Sebelumnya aplikasi hanya sampai pada tahap *memindai* perangkat;
   nilainya tetap dari simulasi. Modul ini membaca karakteristik
   standar Bluetooth SIG, sehingga perangkat kesehatan mana pun yang
   mematuhi profil berikut dapat dipakai tanpa penyesuaian khusus:

     0x180D Heart Rate            -> 0x2A37 Heart Rate Measurement
     0x180F Battery               -> 0x2A19 Battery Level
     0x1809 Health Thermometer    -> 0x2A1C Temperature Measurement
     0x1810 Blood Pressure        -> 0x2A35 Blood Pressure Measurement
     0x1822 Pulse Oximeter        -> 0x2A5F PLX Continuous Measurement

   Angka pada karakteristik ini tidak disimpan sebagai bilangan biasa.
   Suhu dan tekanan darah memakai format titik-mengambang desimal
   IEEE-11073 (FLOAT 32-bit dan SFLOAT 16-bit) — mantissa dan eksponen
   basis sepuluh — supaya nilai seperti 36,7 tidak kehilangan ketepatan
   sebagaimana pada biner basis dua. Pembacaannya ada di `parse` di bawah
   dan sengaja dipisahkan agar dapat diuji tanpa perangkat.

   Catatan dukungan: Web Bluetooth hanya ada di peramban berbasis
   Chromium dan menuntut origin aman. Safari dan Firefox belum
   mendukungnya; di sana aplikasi tetap memakai simulasi.
   ============================================================ */
(function (TC) {
  'use strict';

  /* ============================================================
     1. UUID standar
     ============================================================ */
  const SVC = {
    heartRate: 0x180D,
    battery: 0x180F,
    thermometer: 0x1809,
    bloodPressure: 0x1810,
    pulseOximeter: 0x1822,
    deviceInfo: 0x180A
  };

  const CHR = {
    heartRateMeasurement: 0x2A37,
    batteryLevel: 0x2A19,
    temperatureMeasurement: 0x2A1C,
    bloodPressureMeasurement: 0x2A35,
    plxContinuous: 0x2A5F,
    plxSpotCheck: 0x2A5E,
    manufacturerName: 0x2A29
  };

  /* ============================================================
     2. Pembacaan format angka IEEE-11073
     ============================================================
     Keduanya bernilai mantissa x 10^eksponen, dengan beberapa pola
     bit khusus yang berarti "bukan angka" dan harus dikembalikan
     sebagai null, bukan dihitung.
     ============================================================ */

  /** SFLOAT 16-bit: eksponen 4 bit + mantissa 12 bit, keduanya bertanda. */
  function sfloat(view, offset) {
    const raw = view.getUint16(offset, true);
    let mantissa = raw & 0x0FFF;
    let exponent = (raw >> 12) & 0x0F;

    // Pola khusus diperiksa sebelum tanda diterapkan.
    if (mantissa === 0x07FF) return null;                       // NaN
    if (mantissa === 0x0800) return null;                       // NRes
    if (mantissa === 0x07FE) return Infinity;
    if (mantissa === 0x0802) return -Infinity;

    if (exponent >= 0x08) exponent -= 0x10;                     // 4 bit bertanda
    if (mantissa >= 0x0800) mantissa -= 0x1000;                 // 12 bit bertanda
    return mantissa * Math.pow(10, exponent);
  }

  /** FLOAT 32-bit: eksponen 8 bit + mantissa 24 bit, keduanya bertanda. */
  function float(view, offset) {
    const raw = view.getUint32(offset, true);
    let mantissa = raw & 0x00FFFFFF;
    let exponent = (raw >> 24) & 0xFF;

    if (mantissa === 0x007FFFFF) return null;                   // NaN
    if (mantissa === 0x00800000) return null;                   // NRes
    if (mantissa === 0x007FFFFE) return Infinity;
    if (mantissa === 0x00800002) return -Infinity;

    if (exponent >= 0x80) exponent -= 0x100;                    // 8 bit bertanda
    if (mantissa >= 0x800000) mantissa -= 0x1000000;            // 24 bit bertanda
    return mantissa * Math.pow(10, exponent);
  }

  function asView(data) {
    if (data instanceof DataView) return data;
    if (data instanceof ArrayBuffer) return new DataView(data);
    if (data && data.buffer) return new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (Array.isArray(data)) return new DataView(new Uint8Array(data).buffer);
    return null;
  }

  /* ============================================================
     3. Pembacaan karakteristik
     ============================================================ */
  const parse = {

    /**
     * 0x2A37 Heart Rate Measurement.
     * Panjangnya berubah-ubah menurut bit pada bita bendera, jadi setiap
     * bidang opsional harus dilewati dengan hitungan yang tepat — kalau
     * tidak, interval RR terbaca dari posisi yang salah.
     */
    heartRate(data) {
      const v = asView(data);
      if (!v || v.byteLength < 2) return null;

      const flags = v.getUint8(0);
      const lebar16 = !!(flags & 0x01);
      const kontakDidukung = !!(flags & 0x04);
      const kontakAda = !!(flags & 0x02);
      const adaEnergi = !!(flags & 0x08);
      const adaRR = !!(flags & 0x10);

      let off = 1;
      const hr = lebar16 ? v.getUint16(off, true) : v.getUint8(off);
      off += lebar16 ? 2 : 1;

      let energi = null;
      if (adaEnergi && off + 2 <= v.byteLength) {
        energi = v.getUint16(off, true);                         // kilojoule
        off += 2;
      }

      // Interval RR bersatuan 1/1024 detik, diubah ke milidetik.
      const rr = [];
      if (adaRR) {
        while (off + 2 <= v.byteLength) {
          rr.push(v.getUint16(off, true) * 1000 / 1024);
          off += 2;
        }
      }

      return {
        hr,
        rr,
        energi,
        // Tiga keadaan berbeda: tidak melaporkan, menempel, tidak menempel.
        kontakKulit: kontakDidukung ? kontakAda : null
      };
    },

    /** 0x2A19 Battery Level — persen bulat 0..100. */
    battery(data) {
      const v = asView(data);
      if (!v || v.byteLength < 1) return null;
      const p = v.getUint8(0);
      return p >= 0 && p <= 100 ? p : null;
    },

    /** 0x2A1C Temperature Measurement — FLOAT 32-bit, bisa Celsius atau Fahrenheit. */
    temperature(data) {
      const v = asView(data);
      if (!v || v.byteLength < 5) return null;
      const flags = v.getUint8(0);
      const fahrenheit = !!(flags & 0x01);
      let nilai = float(v, 1);
      if (nilai == null || !isFinite(nilai)) return null;
      if (fahrenheit) nilai = (nilai - 32) * 5 / 9;
      return { celsius: nilai, asli: fahrenheit ? 'F' : 'C' };
    },

    /**
     * 0x2A35 Blood Pressure Measurement — tiga SFLOAT berurutan,
     * lalu bidang opsional. Denyut nadi berada setelah cap waktu
     * 7 bita bila cap waktu itu ada.
     */
    bloodPressure(data) {
      const v = asView(data);
      if (!v || v.byteLength < 7) return null;
      const flags = v.getUint8(0);
      const kPa = !!(flags & 0x01);
      const adaWaktu = !!(flags & 0x02);
      const adaNadi = !!(flags & 0x04);

      let sys = sfloat(v, 1);
      let dia = sfloat(v, 3);
      let map = sfloat(v, 5);
      if (sys == null || dia == null) return null;

      // 1 kPa = 7,50062 mmHg
      const keMmhg = (x) => (x == null ? null : (kPa ? x * 7.50062 : x));
      sys = keMmhg(sys); dia = keMmhg(dia); map = keMmhg(map);

      let off = 7;
      if (adaWaktu) off += 7;
      let nadi = null;
      if (adaNadi && off + 2 <= v.byteLength) nadi = sfloat(v, off);

      return { sys, dia, map, nadi, satuanAsli: kPa ? 'kPa' : 'mmHg' };
    },

    /** 0x2A5F / 0x2A5E — SpO₂ dan denyut nadi, masing-masing SFLOAT. */
    pulseOximeter(data) {
      const v = asView(data);
      if (!v || v.byteLength < 5) return null;
      const spo2 = sfloat(v, 1);
      const nadi = sfloat(v, 3);
      if (spo2 == null || !isFinite(spo2)) return null;
      return { spo2, nadi: nadi != null && isFinite(nadi) ? nadi : null };
    },

    /**
     * RMSSD dari deretan interval RR — akar rata-rata kuadrat selisih
     * antar denyut berurutan, ukuran variabilitas detak jantung yang
     * lazim dipakai. Perlu sedikitnya dua interval.
     */
    rmssd(rr) {
      if (!Array.isArray(rr) || rr.length < 2) return null;
      let jml = 0;
      for (let i = 1; i < rr.length; i++) {
        const d = rr[i] - rr[i - 1];
        jml += d * d;
      }
      return Math.sqrt(jml / (rr.length - 1));
    }
  };

  /* ============================================================
     4. Sambungan
     ============================================================ */
  const Ble = {
    SVC, CHR, parse,
    _sfloat: sfloat,
    _float: float,

    supported() {
      return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
    },

    /** Perlu dipanggil dari gestur pengguna; peramban mensyaratkannya. */
    async requestDevice() {
      if (!Ble.supported()) throw new Error('Web Bluetooth tidak tersedia di peramban ini.');
      return navigator.bluetooth.requestDevice({
        // Menerima semua perangkat supaya wearable yang tidak mengiklankan
        // service-nya tetap muncul di daftar pemilihan.
        acceptAllDevices: true,
        optionalServices: [
          SVC.heartRate, SVC.battery, SVC.thermometer,
          SVC.bloodPressure, SVC.pulseOximeter, SVC.deviceInfo
        ]
      });
    },

    /**
     * Menyambung, menelusuri service yang benar-benar ada, lalu berlangganan
     * notifikasi. Service yang tidak dimiliki perangkat dilewati tanpa
     * menggagalkan keseluruhan — wearable umumnya hanya punya sebagian.
     *
     * @param {BluetoothDevice} device
     * @param {object} on { onData, onBattery, onDisconnect, onLog }
     * @returns {{ layanan: string[], batteryAwal: number|null, stop: Function }}
     */
    async connect(device, on) {
      on = on || {};
      const catat = (m) => { if (on.onLog) on.onLog(m); };
      const server = await device.gatt.connect();

      const langganan = [];
      const layanan = [];
      let batteryAwal = null;

      // Heart rate: sumber utama, memberi HR dan interval RR.
      await coba(async () => {
        const s = await server.getPrimaryService(SVC.heartRate);
        const c = await s.getCharacteristic(CHR.heartRateMeasurement);
        await c.startNotifications();
        const h = (ev) => {
          const d = parse.heartRate(ev.target.value);
          if (!d) return;
          const hrv = parse.rmssd(d.rr);
          if (on.onData) {
            on.onData({
              hr: d.hr,
              hrv: hrv != null ? Math.round(hrv) : undefined,
              kontakKulit: d.kontakKulit,
              rr: d.rr
            });
          }
        };
        c.addEventListener('characteristicvaluechanged', h);
        langganan.push(() => lepas(c, h));
        layanan.push('heart_rate');
      }, 'heart_rate', catat);

      // Baterai: dibaca sekali, lalu diikuti bila perangkat mendukung notifikasi.
      await coba(async () => {
        const s = await server.getPrimaryService(SVC.battery);
        const c = await s.getCharacteristic(CHR.batteryLevel);
        batteryAwal = parse.battery(await c.readValue());
        if (batteryAwal != null && on.onBattery) on.onBattery(batteryAwal);
        await coba(async () => {
          await c.startNotifications();
          const h = (ev) => {
            const p = parse.battery(ev.target.value);
            if (p != null && on.onBattery) on.onBattery(p);
          };
          c.addEventListener('characteristicvaluechanged', h);
          langganan.push(() => lepas(c, h));
        }, 'battery_notify', catat);
        layanan.push('battery');
      }, 'battery', catat);

      // Termometer
      await coba(async () => {
        const s = await server.getPrimaryService(SVC.thermometer);
        const c = await s.getCharacteristic(CHR.temperatureMeasurement);
        await c.startNotifications();
        const h = (ev) => {
          const d = parse.temperature(ev.target.value);
          if (d && on.onData) on.onData({ temp: d.celsius });
        };
        c.addEventListener('characteristicvaluechanged', h);
        langganan.push(() => lepas(c, h));
        layanan.push('thermometer');
      }, 'thermometer', catat);

      // Tekanan darah
      await coba(async () => {
        const s = await server.getPrimaryService(SVC.bloodPressure);
        const c = await s.getCharacteristic(CHR.bloodPressureMeasurement);
        await c.startNotifications();
        const h = (ev) => {
          const d = parse.bloodPressure(ev.target.value);
          if (!d || !on.onData) return;
          const out = { sys: d.sys, dia: d.dia };
          if (d.nadi != null) out.hr = d.nadi;
          on.onData(out);
        };
        c.addEventListener('characteristicvaluechanged', h);
        langganan.push(() => lepas(c, h));
        layanan.push('blood_pressure');
      }, 'blood_pressure', catat);

      // Oksimeter
      await coba(async () => {
        const s = await server.getPrimaryService(SVC.pulseOximeter);
        let c = null;
        try { c = await s.getCharacteristic(CHR.plxContinuous); }
        catch (e) { c = await s.getCharacteristic(CHR.plxSpotCheck); }
        await c.startNotifications();
        const h = (ev) => {
          const d = parse.pulseOximeter(ev.target.value);
          if (!d || !on.onData) return;
          const out = { spo2: d.spo2 };
          if (d.nadi != null) out.hr = d.nadi;
          on.onData(out);
        };
        c.addEventListener('characteristicvaluechanged', h);
        langganan.push(() => lepas(c, h));
        layanan.push('pulse_oximeter');
      }, 'pulse_oximeter', catat);

      const onLost = () => { if (on.onDisconnect) on.onDisconnect(); };
      device.addEventListener('gattserverdisconnected', onLost);

      return {
        layanan,
        batteryAwal,
        stop() {
          device.removeEventListener('gattserverdisconnected', onLost);
          langganan.forEach((f) => { try { f(); } catch (e) { /* abaikan */ } });
          try { if (device.gatt.connected) device.gatt.disconnect(); } catch (e) { /* abaikan */ }
        }
      };
    }
  };

  function lepas(c, h) {
    c.removeEventListener('characteristicvaluechanged', h);
    // stopNotifications gagal bila perangkat sudah lepas; itu wajar.
    if (c.stopNotifications) c.stopNotifications().catch(() => {});
  }

  /** Menjalankan langkah opsional; kegagalan dicatat, bukan dilempar. */
  async function coba(fn, nama, catat) {
    try { await fn(); }
    catch (e) { catat(nama + ': tidak tersedia (' + (e && e.name || e) + ')'); }
  }

  TC.Ble = Ble;
})(window.TC);
