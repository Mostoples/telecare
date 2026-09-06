/* ============================================================
   TeleCare — firebase-init.js
   Menghubungkan dashboard ke Realtime Database "telecare-id".
   Struktur data yang dibaca (semua opsional):

     /telecare/live/{hr, spo2, temp, sys, dia, stress}

   Jika node kosong atau tidak dapat diakses, app.js otomatis
   memakai simulasi fisiologis lokal — halaman tetap berfungsi.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getDatabase, ref, onValue }
  from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyBhMi3nXhZFDKFXaZi6Ptm2yPTh1FDIf-Y",
  authDomain: "telecare-id.firebaseapp.com",
  databaseURL: "https://telecare-id-default-rtdb.firebaseio.com",
  projectId: "telecare-id",
  storageBucket: "telecare-id.firebasestorage.app",
  messagingSenderId: "110142041439",
  appId: "1:110142041439:web:9fe1c6449b51c5d2431aea"
};

const emit = (name, detail) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

try {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  // status koneksi
  onValue(ref(db, '.info/connected'), (snap) => {
    emit('telecare:dbstate', snap.val() ? 'connected' : 'offline');
  }, () => emit('telecare:dbstate', 'error'));

  // telemetri langsung
  onValue(ref(db, 'telecare/live'), (snap) => {
    const v = snap.val();
    if (v && typeof v === 'object') emit('telecare:vitals', v);
  }, (err) => {
    console.warn('[TeleCare] Realtime DB tidak terbaca, memakai simulasi lokal.', err.message);
    emit('telecare:dbstate', 'error');
  });
} catch (err) {
  console.warn('[TeleCare] Firebase dilewati:', err);
  emit('telecare:dbstate', 'error');
}
