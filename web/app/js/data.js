/* ============================================================
   TeleCare App — data.js
   Data benih: katalog perangkat AIoT, spesialisasi, dokter mitra,
   basis makanan untuk pengenalan, dan artikel edukasi.
   Seluruh dokter dan angka di sini bersifat contoh (mode demo).
   ============================================================ */
(function (TC) {
  'use strict';

  /* ---------------- KATALOG PERANGKAT AIoT ---------------- */
  // Inilah pembeda TeleCare: satu platform untuk banyak jenis wearable.
  const DEVICE_TYPES = [
    {
      type: 'band', name: 'TeleBand', icon: 'watch', prefix: 'TC-BAND',
      tagline: 'Gelang multiparameter',
      caps: ['hr', 'spo2', 'temp', 'ecg', 'bp', 'steps'],
      desc: 'PPG 4 kanal, elektroda EKG lead-I pada bezel, dan termistor kontak kulit.',
      battery: [55, 92], rateHz: 100
    },
    {
      type: 'ring', name: 'TeleRing', icon: 'ring', prefix: 'TC-RING',
      tagline: 'Cincin berdaya rendah',
      caps: ['hr', 'spo2', 'temp', 'sleep'],
      desc: 'PPG arteri jari yang stabil saat tidur, nyaris tak terasa dipakai.',
      battery: [60, 98], rateHz: 25
    },
    {
      type: 'strap', name: 'TeleStrap', icon: 'ecg', prefix: 'TC-STRP',
      tagline: 'Sabuk dada EKG',
      caps: ['hr', 'ecg'],
      desc: 'EKG kontak dada untuk perekaman ritme berkualitas klinis saat aktivitas.',
      battery: [40, 90], rateHz: 250
    },
    {
      type: 'cuff', name: 'TeleCuff', icon: 'cuff', prefix: 'TC-CUFF',
      tagline: 'Tensimeter lengan',
      caps: ['bp'],
      desc: 'Tensimeter osilometri sebagai acuan kalibrasi tekanan darah wearable.',
      battery: [50, 96], rateHz: 0
    },
    {
      type: 'scale', name: 'TeleScale', icon: 'scale', prefix: 'TC-SCAL',
      tagline: 'Timbangan komposisi tubuh',
      caps: ['weight', 'bodyfat'],
      desc: 'Bioimpedansi untuk berat badan, massa lemak, dan massa otot.',
      battery: [70, 100], rateHz: 0
    },
    {
      type: 'patch', name: 'TelePatch', icon: 'patch', prefix: 'TC-PTCH',
      tagline: 'Patch glukosa kontinu',
      caps: ['glucose', 'temp'],
      desc: 'Sensor interstisial untuk memperkirakan tren glukosa sepanjang hari.',
      battery: [30, 88], rateHz: 5
    }
  ];

  const CAP_LABEL = {
    hr: 'Detak jantung', spo2: 'SpO₂', temp: 'Suhu', ecg: 'EKG',
    bp: 'Tekanan darah', steps: 'Langkah', sleep: 'Tidur',
    weight: 'Berat badan', bodyfat: 'Komposisi', glucose: 'Glukosa'
  };

  /* ---------------- SPESIALISASI ---------------- */
  const SPECIALTIES = [
    { id: 'umum',    name: 'Dokter Umum',   emoji: '🩺', color: '#EDF9F2', fg: '#03804C' },
    { id: 'jantung', name: 'Jantung',       emoji: '❤️', color: '#FFF3F1', fg: '#E2543F' },
    { id: 'penyakit-dalam', name: 'Penyakit Dalam', emoji: '🫀', color: '#EFF8FD', fg: '#075A85' },
    { id: 'psikolog', name: 'Psikolog',     emoji: '🧠', color: '#F3F1FE', fg: '#4A3BB8' },
    { id: 'gizi',    name: 'Gizi Klinik',   emoji: '🥗', color: '#EDF9F2', fg: '#03804C' },
    { id: 'saraf',   name: 'Saraf',         emoji: '🧬', color: '#EFF8FD', fg: '#075A85' },
    { id: 'paru',    name: 'Paru',          emoji: '🫁', color: '#FFF9EC', fg: '#8A5D00' },
    { id: 'geriatri', name: 'Geriatri',     emoji: '🧓', color: '#F3F1FE', fg: '#4A3BB8' }
  ];

  /* ---------------- DOKTER MITRA (contoh) ---------------- */
  const DOCTORS = [
    { id: 'd1', name: 'dr. Anindya Kusuma, Sp.JP', spec: 'jantung', sub: 'Kardiologi Intervensi',
      exp: 12, rating: 4.9, reviews: 1284, price: 65000, online: true, wait: '± 3 menit',
      hospital: 'RS Jantung Harapan', color: '#E2543F',
      about: 'Menangani aritmia, hipertensi, dan pemantauan pasca-tindakan jantung. Terbiasa membaca rekaman EKG lead tunggal dari perangkat wearable.' },
    { id: 'd2', name: 'dr. Bagas Prayoga', spec: 'umum', sub: 'Layanan Primer',
      exp: 7, rating: 4.8, reviews: 2140, price: 25000, online: true, wait: '± 1 menit',
      hospital: 'Klinik Sehat Bersama', color: '#049A5B',
      about: 'Keluhan harian, skrining awal, dan rujukan. Cocok sebagai titik masuk pertama sebelum ke dokter spesialis.' },
    { id: 'd3', name: 'Rani Maheswari, M.Psi., Psikolog', spec: 'psikolog', sub: 'Psikologi Klinis Dewasa',
      exp: 9, rating: 4.9, reviews: 876, price: 90000, online: true, wait: '± 5 menit',
      hospital: 'Pusat Konseling Tenang', color: '#6C5CE7',
      about: 'Fokus pada stres kerja, kecemasan, dan gangguan tidur. Terbiasa memakai data HRV sebagai bahan diskusi, bukan alat diagnosis.' },
    { id: 'd4', name: 'dr. Farhan Maulana, Sp.PD', spec: 'penyakit-dalam', sub: 'Endokrin & Metabolik',
      exp: 15, rating: 4.8, reviews: 1610, price: 70000, online: false, wait: 'Kembali 14.00',
      hospital: 'RSUD Kota', color: '#0E7FB8',
      about: 'Diabetes, sindrom metabolik, dan tata laksana gaya hidup. Menerima diskusi tren glukosa dari perangkat pemantau.' },
    { id: 'd5', name: 'Dewi Larasati, S.Gz., RD', spec: 'gizi', sub: 'Dietisien Terdaftar',
      exp: 6, rating: 4.7, reviews: 654, price: 45000, online: true, wait: '± 2 menit',
      hospital: 'Klinik Gizi Nusantara', color: '#28B87A',
      about: 'Menyusun rencana makan berbasis catatan sesi harian, termasuk pengaturan porsi karbohidrat.' },
    { id: 'd6', name: 'dr. Sekar Ayu, Sp.S', spec: 'saraf', sub: 'Neurologi Umum',
      exp: 11, rating: 4.8, reviews: 743, price: 75000, online: true, wait: '± 6 menit',
      hospital: 'RS Neuro Medika', color: '#075A85',
      about: 'Nyeri kepala, gangguan tidur, dan neuropati. Membantu membedakan keluhan saraf dari keluhan psikosomatis.' },
    // `verified: false` menandai mitra yang masih menunggu verifikasi admin.
    // Sebelumnya layar admin memakai potongan indeks `slice(6, 8)` dan lencana
    // berangka literal `2`, sehingga keduanya lepas sinkron begitu katalog ini
    // berubah.
    { id: 'd7', name: 'dr. Yusuf Ramadhan, Sp.P', spec: 'paru', sub: 'Pulmonologi',
      exp: 10, rating: 4.7, reviews: 512, price: 68000, online: false, wait: 'Kembali 16.30',
      hospital: 'RS Paru Sehat', color: '#E09B12', verified: false,
      about: 'Sesak napas, asma, dan penurunan saturasi oksigen. Memakai tren SpO₂ malam sebagai bahan penilaian.' },
    { id: 'd8', name: 'dr. Ratna Wulandari, Sp.PD-KGer', spec: 'geriatri', sub: 'Geriatri',
      exp: 18, rating: 4.9, reviews: 398, price: 80000, online: true, wait: '± 4 menit',
      hospital: 'RS Lansia Sejahtera', color: '#4A3BB8', verified: false,
      about: 'Perawatan lansia dengan banyak penyakit penyerta, termasuk pemantauan jarak jauh di panti.' },
    { id: 'd9', name: 'dr. Adhitya Nugroho', spec: 'umum', sub: 'Kedokteran Okupasi',
      exp: 8, rating: 4.6, reviews: 921, price: 30000, online: true, wait: '± 2 menit',
      hospital: 'Klinik Perusahaan Mandiri', color: '#03804C',
      about: 'Kesehatan kerja, kelayakan kerja, dan penilaian beban kerja berbasis data wearable.' }
  ];

  /* ---------------- BASIS MAKANAN ---------------- */
  // dipakai untuk mensimulasikan pengenalan makanan dari foto
  const FOODS = [
    { n: 'Nasi putih',      unit: 'centong', g: 120, kcal: 156, c: 34, p: 3, f: 0.3, sugar: 0.1, fiber: 0.5, emoji: '🍚', gi: 'tinggi' },
    { n: 'Nasi merah',      unit: 'centong', g: 120, kcal: 133, c: 28, p: 3, f: 1.0, sugar: 0.4, fiber: 2.1, emoji: '🍚', gi: 'sedang' },
    { n: 'Ayam panggang',   unit: 'potong',  g: 110, kcal: 187, c: 4,  p: 26, f: 7.4, sugar: 1.2, fiber: 0,   emoji: '🍗', gi: 'rendah' },
    { n: 'Ayam goreng',     unit: 'potong',  g: 110, kcal: 246, c: 8,  p: 24, f: 13,  sugar: 0.5, fiber: 0,   emoji: '🍗', gi: 'rendah' },
    { n: 'Ikan bakar',      unit: 'ekor',    g: 130, kcal: 165, c: 1,  p: 28, f: 5.2, sugar: 0,   fiber: 0,   emoji: '🐟', gi: 'rendah' },
    { n: 'Telur dadar',     unit: 'butir',   g: 60,  kcal: 93,  c: 1,  p: 7,  f: 7.0, sugar: 0.4, fiber: 0,   emoji: '🍳', gi: 'rendah' },
    { n: 'Tempe goreng',    unit: 'potong',  g: 50,  kcal: 118, c: 6,  p: 9,  f: 7.0, sugar: 0.3, fiber: 1.4, emoji: '🟫', gi: 'rendah' },
    { n: 'Tahu goreng',     unit: 'potong',  g: 50,  kcal: 78,  c: 2,  p: 6,  f: 5.4, sugar: 0.2, fiber: 0.6, emoji: '⬜', gi: 'rendah' },
    { n: 'Tumis buncis',    unit: 'mangkuk kecil', g: 90, kcal: 62, c: 9, p: 2, f: 2.4, sugar: 2.1, fiber: 3.2, emoji: '🥬', gi: 'rendah' },
    { n: 'Sayur bayam',     unit: 'mangkuk', g: 100, kcal: 41,  c: 6,  p: 3,  f: 0.8, sugar: 1.1, fiber: 2.6, emoji: '🥬', gi: 'rendah' },
    { n: 'Sambal',          unit: 'sendok',  g: 15,  kcal: 22,  c: 2,  p: 0.4, f: 1.4, sugar: 1.2, fiber: 0.5, emoji: '🌶️', gi: 'rendah' },
    { n: 'Mie goreng',      unit: 'porsi',   g: 180, kcal: 380, c: 54, p: 9,  f: 14,  sugar: 4.2, fiber: 2.0, emoji: '🍜', gi: 'tinggi' },
    { n: 'Roti tawar',      unit: 'lembar',  g: 30,  kcal: 79,  c: 15, p: 2.6, f: 1.0, sugar: 1.5, fiber: 0.8, emoji: '🍞', gi: 'tinggi' },
    { n: 'Pisang',          unit: 'buah',    g: 110, kcal: 98,  c: 25, p: 1.1, f: 0.3, sugar: 14,  fiber: 2.6, emoji: '🍌', gi: 'sedang' },
    { n: 'Apel',            unit: 'buah',    g: 150, kcal: 78,  c: 21, p: 0.4, f: 0.3, sugar: 15,  fiber: 3.3, emoji: '🍎', gi: 'rendah' },
    { n: 'Teh manis',       unit: 'gelas',   g: 200, kcal: 84,  c: 21, p: 0,  f: 0,   sugar: 21,  fiber: 0,   emoji: '🥤', gi: 'tinggi' },
    { n: 'Kopi hitam',      unit: 'cangkir', g: 200, kcal: 4,   c: 0.7, p: 0.3, f: 0, sugar: 0,   fiber: 0,   emoji: '☕', gi: 'rendah' },
    { n: 'Air putih',       unit: 'gelas',   g: 250, kcal: 0,   c: 0,  p: 0,  f: 0,   sugar: 0,   fiber: 0,   emoji: '💧', gi: 'rendah' },
    { n: 'Gado-gado',       unit: 'porsi',   g: 250, kcal: 295, c: 24, p: 12, f: 17,  sugar: 8,   fiber: 5.4, emoji: '🥗', gi: 'sedang' },
    { n: 'Soto ayam',       unit: 'mangkuk', g: 300, kcal: 232, c: 18, p: 18, f: 10,  sugar: 3.2, fiber: 1.6, emoji: '🍲', gi: 'sedang' },
    { n: 'Bakso',           unit: 'mangkuk', g: 280, kcal: 268, c: 26, p: 16, f: 11,  sugar: 3.8, fiber: 1.2, emoji: '🍲', gi: 'sedang' },
    { n: 'Salad buah',      unit: 'mangkuk', g: 200, kcal: 168, c: 32, p: 2.4, f: 4.2, sugar: 26, fiber: 4.1, emoji: '🍓', gi: 'sedang' }
  ];

  // kombinasi yang masuk akal untuk mensimulasikan "hasil deteksi"
  const FOOD_COMBOS = [
    ['Nasi merah', 'Ayam panggang', 'Tumis buncis'],
    ['Nasi putih', 'Ikan bakar', 'Sayur bayam', 'Sambal'],
    ['Nasi putih', 'Ayam goreng', 'Tempe goreng', 'Sambal'],
    ['Soto ayam', 'Nasi putih'],
    ['Gado-gado', 'Teh manis'],
    ['Mie goreng', 'Telur dadar'],
    ['Roti tawar', 'Telur dadar', 'Kopi hitam'],
    ['Bakso', 'Teh manis'],
    ['Salad buah', 'Apel'],
    ['Nasi merah', 'Tahu goreng', 'Tempe goreng', 'Sayur bayam']
  ];

  const MEAL_KINDS = [
    { id: 'sarapan', name: 'Sarapan', from: 4,  to: 10 },
    { id: 'siang',   name: 'Makan Siang', from: 10, to: 15 },
    { id: 'sore',    name: 'Camilan Sore', from: 15, to: 18 },
    { id: 'malam',   name: 'Makan Malam', from: 18, to: 23 },
    { id: 'larut',   name: 'Makan Larut', from: 23, to: 4 }
  ];

  /* ---------------- TUJUAN KESEHATAN ---------------- */
  const GOALS = [
    { id: 'jaga-berat',  name: 'Menjaga berat badan', desc: 'Asupan seimbang untuk mempertahankan berat saat ini.',
      targets: { kcal: 2000, carb: 250, protein: 60, fat: 65 } },
    { id: 'turun-berat', name: 'Menurunkan berat badan', desc: 'Defisit energi wajar dengan protein tetap cukup.',
      targets: { kcal: 1700, carb: 190, protein: 75, fat: 55 } },
    { id: 'gula-stabil', name: 'Menjaga kestabilan gula darah', desc: 'Karbohidrat lebih rendah dan serat lebih tinggi.',
      targets: { kcal: 1900, carb: 180, protein: 80, fat: 70 } },
    { id: 'naik-massa',  name: 'Menambah massa otot', desc: 'Surplus energi ringan dengan protein tinggi.',
      targets: { kcal: 2400, carb: 300, protein: 110, fat: 70 } }
  ];

  /* ---------------- ARTIKEL EDUKASI ---------------- */
  const ARTICLES = [
    { id: 'a1', title: 'Membaca HRV: kenapa angkanya naik-turun setiap hari',
      cat: 'Stres', read: 4, emoji: '🧠',
      body: 'Variabilitas denyut jantung menggambarkan seberapa lentur sistem saraf otonom Anda menanggapi beban harian. Nilai yang turun beberapa hari berturut-turut lebih bermakna daripada satu angka rendah pada satu pagi.' },
    { id: 'a2', title: 'Tekanan darah dari pergelangan tangan: apa yang bisa dan tidak bisa',
      cat: 'Jantung', read: 5, emoji: '❤️',
      body: 'Sensor optik memperkirakan tekanan darah lewat waktu tempuh gelombang nadi. Ia berguna untuk melihat kecenderungan, tetapi tetap memerlukan kalibrasi dengan tensimeter dan tidak dapat menegakkan diagnosis hipertensi.' },
    { id: 'a3', title: 'Urutan makan yang menurunkan lonjakan gula darah',
      cat: 'Gizi', read: 3, emoji: '🥗',
      body: 'Mendahulukan serat dan protein sebelum karbohidrat cenderung melandaikan kurva respons setelah makan. Uji sendiri lewat dua sesi dengan menu sama namun urutan berbeda.' },
    { id: 'a4', title: 'Tidur dan pemulihan: membaca data TeleRing semalam',
      cat: 'Tidur', read: 4, emoji: '🌙',
      body: 'Detak jantung istirahat terendah biasanya muncul pada sepertiga awal tidur. Bila titik terendah itu bergeser makin larut, umumnya ada beban yang belum reda — kafein sore, olahraga larut, atau stres.' }
  ];

  /* ---------------- BALASAN KONSULTASI (simulasi) ---------------- */
  // Kumpulan pola jawaban agar percakapan demo terasa masuk akal.
  const REPLY_RULES = [
    { k: ['dada', 'nyeri dada', 'sesak'], spec: '*', r:
      'Terima kasih sudah menyampaikan. Nyeri dada perlu saya perjelas dulu: apakah terasa seperti ditekan benda berat, menjalar ke lengan atau rahang, dan memburuk saat beraktivitas? Bila ya, dan terutama bila disertai keringat dingin, mohon segera ke IGD terdekat tanpa menunggu jawaban saya.' },
    { k: ['pusing', 'sakit kepala', 'kepala'], spec: '*', r:
      'Baik. Sakit kepalanya lebih terasa di satu sisi atau menyeluruh? Saya juga melihat tekanan darah Anda dari perangkat — mari kita bandingkan dengan pola beberapa hari terakhir sebelum menyimpulkan.' },
    { k: ['tidur', 'insomnia', 'begadang', 'ngantuk'], spec: '*', r:
      'Pola tidur yang terganggu sering berjalan bersama stres. Dari data TeleRing, detak jantung istirahat Anda cenderung belum turun di awal tidur. Sudah berapa lama keluhan ini berlangsung, dan jam berapa biasanya Anda mulai berbaring?' },
    { k: ['stres', 'cemas', 'panik', 'tertekan'], spec: '*', r:
      'Saya memahami kondisinya. Mari kita pilah dulu: apakah kecemasan muncul pada situasi tertentu, atau terasa hampir sepanjang hari? Indeks stres Anda memang naik pada rentang sore, dan itu petunjuk yang berguna.' },
    { k: ['gula', 'diabetes', 'glukosa', 'manis'], spec: '*', r:
      'Dari catatan sesi makan Anda, kenaikan setelah makan masih dalam rentang yang wajar untuk data non-laboratorium. Namun untuk memastikan, pemeriksaan gula darah puasa dan HbA1c di laboratorium tetap diperlukan. Apakah ada riwayat diabetes di keluarga?' },
    { k: ['tekanan darah', 'hipertensi', 'tensi'], spec: '*', r:
      'Angka dari jam tangan berguna untuk melihat tren, tetapi keputusan pengobatan memerlukan tensimeter lengan. Sudahkah Anda melakukan kalibrasi TeleBand dengan tensimeter? Bila sudah, mari kita lihat rata-rata pagi dan malam Anda.' },
    { k: ['obat', 'dosis', 'resep'], spec: '*', r:
      'Untuk penyesuaian obat, saya perlu memastikan riwayat lengkap Anda terlebih dahulu. Mohon jangan menambah atau menghentikan obat sendiri berdasarkan angka di aplikasi. Boleh sebutkan obat apa saja yang sedang Anda konsumsi beserta dosisnya?' },
    { k: ['demam', 'panas', 'suhu'], spec: '*', r:
      'Suhu dari sensor kulit cenderung sedikit lebih rendah daripada termometer. Berapa suhu terakhir yang Anda ukur dengan termometer, dan apakah disertai batuk, pilek, atau nyeri tenggorokan?' },
    { k: ['jantung', 'berdebar', 'aritmia', 'ekg'], spec: '*', r:
      'Saya sudah melihat rekaman EKG lead-I yang Anda kirimkan. Iramanya tampak sinus dengan interval yang teratur pada segmen ini. Berdebarnya muncul saat istirahat atau setelah aktivitas, dan berapa lama biasanya berlangsung?' },
    { k: ['makan', 'diet', 'gizi', 'berat badan'], spec: '*', r:
      'Mari kita mulai dari catatan tiga hari terakhir. Dari ringkasan Anda, porsi karbohidrat tampak mendominasi dibanding protein. Apakah Anda terbiasa sarapan, atau sering melewatkannya?' }
  ];

  const REPLY_FALLBACK = [
    'Baik, saya catat keluhannya. Boleh dijelaskan sejak kapan keluhan ini muncul dan apakah ada yang memperberat atau meringankannya?',
    'Terima kasih atas penjelasannya. Supaya penilaian saya lebih tepat, apakah ada riwayat penyakit sebelumnya atau obat rutin yang sedang Anda konsumsi?',
    'Saya memahami. Dari data perangkat Anda, belum ada tanda yang mengkhawatirkan pada periode ini. Adakah keluhan lain yang menyertai?',
    'Noted. Mari kita amati pola ini beberapa hari lagi lewat perangkat Anda, lalu kita evaluasi kembali. Apakah ada pertanyaan lain yang ingin disampaikan?'
  ];

  const QUICK_REPLIES_DOC = [
    'Sejak kapan keluhan ini muncul?',
    'Apakah ada obat rutin yang dikonsumsi?',
    'Mohon rekam EKG saat keluhan muncul',
    'Silakan ukur ulang dengan tensimeter',
    'Saya sarankan periksa langsung ke faskes terdekat'
  ];

  const QUICK_REPLIES = [
    'Saya sering pusing belakangan ini',
    'Bagaimana hasil tekanan darah saya?',
    'Susah tidur sejak seminggu terakhir',
    'Apakah hasil EKG saya normal?',
    'Saya merasa mudah lelah dan cemas'
  ];


  /* ---------------- PERAN PENGGUNA ---------------- */
  const ROLES = [
    {
      id: 'pasien', name: 'Pasien', short: 'Pasien', icon: 'user', color: '#049A5B',
      desc: 'Memantau kesehatan sendiri lewat perangkat dan berkonsultasi ke dokter.',
      home: '/home'
    },
    {
      id: 'dokter', name: 'Dokter / Psikolog', short: 'Dokter', icon: 'stetho', color: '#0E7FB8',
      desc: 'Menerima antrean konsultasi, membaca data vital pasien, dan menjawab keluhan.',
      home: '/klinik'
    },
    {
      id: 'admin-faskes', name: 'Admin Faskes', short: 'Faskes', icon: 'building', color: '#6C5CE7',
      desc: 'Mengelola satu unit — anggota binaan, inventaris perangkat, dan eskalasi.',
      home: '/faskes'
    },
    {
      id: 'admin', name: 'Admin Platform', short: 'Admin', icon: 'shield', color: '#E09B12',
      desc: 'Mengelola pengguna, verifikasi dokter, dan faskes di seluruh platform.',
      home: '/sistem'
    }
  ];

  /* ---------------- FASKES / UNIT BINAAN ---------------- */
  const FACILITIES = [
    { id: 'f1', name: 'PT Nusantara Manufaktur', kind: 'Perusahaan', icon: 'building',
      city: 'Karawang', members: 128, devices: 126, staff: 3, critical: 2, warn: 9, plan: 'Institusi' },
    { id: 'f2', name: 'Pesantren Al-Hikmah', kind: 'Pesantren', icon: 'mosque',
      city: 'Surakarta', members: 342, devices: 330, staff: 5, critical: 1, warn: 18, plan: 'Institusi' },
    { id: 'f3', name: 'SMA Boarding Cendekia', kind: 'Sekolah Berasrama', icon: 'school',
      city: 'Bogor', members: 214, devices: 208, staff: 4, critical: 0, warn: 11, plan: 'Institusi' },
    { id: 'f4', name: 'Panti Wredha Sejahtera', kind: 'Panti Jompo', icon: 'elder',
      city: 'Yogyakarta', members: 76, devices: 76, staff: 6, critical: 3, warn: 14, plan: 'Institusi+' }
  ];

  /* ---------------- ANGGOTA BINAAN (contoh) ---------------- */
  // Dipakai pada layar dokter dan admin faskes.
  const PATIENTS = [
    { id: 'p1', name: 'Nurhaliza Putri', age: 34, sex: 'P', unit: 'Unit A · Produksi', fac: 'f1',
      hr: 112, spo2: 96, temp: 37.1, sys: 148, dia: 94, stress: 78, status: 'crit',
      note: 'Takikardia saat istirahat, tekanan darah naik tiga hari berturut-turut.', device: 'TeleBand' },
    { id: 'p2', name: 'Ahmad Fauzi', age: 17, sex: 'L', unit: 'Kamar 12 · Santri', fac: 'f2',
      hr: 72, spo2: 98, temp: 36.6, sys: 114, dia: 74, stress: 24, status: 'ok',
      note: 'Seluruh parameter dalam rentang normal.', device: 'TeleRing' },
    { id: 'p3', name: 'Siti Rahmawati', age: 41, sex: 'P', unit: 'Unit A · Administrasi', fac: 'f1',
      hr: 94, spo2: 97, temp: 36.9, sys: 132, dia: 86, stress: 61, status: 'warn',
      note: 'Indeks stres tinggi pada rentang sore selama lima hari.', device: 'TeleBand' },
    { id: 'p4', name: 'Bagas Pratama', age: 16, sex: 'L', unit: 'Kelas XI · Asrama Barat', fac: 'f3',
      hr: 68, spo2: 99, temp: 36.4, sys: 110, dia: 70, stress: 19, status: 'ok',
      note: 'Pola tidur membaik sejak pekan lalu.', device: 'TeleRing' },
    { id: 'p5', name: 'Ibu Kartini', age: 79, sex: 'P', unit: 'Wisma Melati · Kamar 3', fac: 'f4',
      hr: 58, spo2: 93, temp: 36.2, sys: 152, dia: 88, stress: 44, status: 'crit',
      note: 'Saturasi oksigen turun pada malam hari, bradikardia ringan.', device: 'TeleBand' },
    { id: 'p6', name: 'Rizky Aditya', age: 18, sex: 'L', unit: 'Kamar 7 · Santri', fac: 'f2',
      hr: 78, spo2: 98, temp: 36.7, sys: 118, dia: 76, stress: 31, status: 'ok',
      note: 'Normal. Sinkronisasi terakhir 2 jam lalu.', device: 'TeleRing' },
    { id: 'p7', name: 'Pak Slamet', age: 71, sex: 'L', unit: 'Wisma Anggrek · Kamar 1', fac: 'f4',
      hr: 88, spo2: 95, temp: 36.8, sys: 141, dia: 85, stress: 52, status: 'warn',
      note: 'Tekanan darah pagi konsisten di atas 140.', device: 'TeleCuff' },
    { id: 'p8', name: 'Dewi Anggraini', age: 29, sex: 'P', unit: 'Unit B · Logistik', fac: 'f1',
      hr: 82, spo2: 98, temp: 36.5, sys: 121, dia: 79, stress: 38, status: 'ok',
      note: 'Stabil, tidak ada eskalasi.', device: 'TeleBand' }
  ];

  const STATUS_META = {
    ok:   { t: 'Normal',   c: 'g', color: '#049A5B' },
    warn: { t: 'Waspada',  c: 'a', color: '#E09B12' },
    crit: { t: 'Kritis',   c: 'r', color: '#E2543F' }
  };

  TC.DATA = {
    DEVICE_TYPES, CAP_LABEL, SPECIALTIES, DOCTORS, FOODS, FOOD_COMBOS,
    MEAL_KINDS, GOALS, ARTICLES, REPLY_RULES, REPLY_FALLBACK, QUICK_REPLIES,
    QUICK_REPLIES_DOC,
    ROLES, FACILITIES, PATIENTS, STATUS_META,
    role: (id) => ROLES.find((r) => r.id === id) || ROLES[0],
    facility: (id) => FACILITIES.find((f) => f.id === id) || FACILITIES[0],
    patient: (id) => PATIENTS.find((p) => p.id === id) || null,
    doctor: (id) => DOCTORS.find((d) => d.id === id) || null,
    spec: (id) => SPECIALTIES.find((s) => s.id === id) || { name: id, emoji: '🩺', color: '#EDF9F2', fg: '#03804C' },
    food: (n) => FOODS.find((f) => f.n === n) || null,
    goal: (id) => GOALS.find((g) => g.id === id) || GOALS[0],
    deviceType: (t) => DEVICE_TYPES.find((d) => d.type === t) || DEVICE_TYPES[0]
  };
})(window.TC);
