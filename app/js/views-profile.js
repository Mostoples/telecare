/* ============================================================
   TeleCare App — views-profile.js
   Profil pengguna, informasi pribadi, tujuan kesehatan,
   hub perangkat AIoT, pemindaian, dan kalibrasi tekanan darah.
   ============================================================ */
(function (TC) {
  'use strict';

  const { $, $$, esc, icon, clamp, Store, Router, setView, setTopbar, toast,
          relTime, initials, sheet, closeSheet, confirmSheet } = TC;
  const D = TC.DATA;

  /* ---------------- 1. PROFIL ---------------- */
  function viewProfile() {
    const u = Store.user();
    const p = Store.profile();
    const devs = Store.state.devices;
    const conn = devs.filter((d) => d.connected).length;

    TC.topbar('Profil Pengguna', { back: false });
    setView(`
      <div class="prof-head">
        <span class="avatar avatar--lg" style="background:${D.role(u.role || 'pasien').color}">
          ${esc(initials(u.name))}</span>
        <div style="min-width:0">
          <b>${esc(p.nickname || u.name)}</b>
          <small>${esc(u.email)}</small>
          <small>${esc(u.phone || (u.provider === 'google' ? 'Masuk lewat Google' : ''))}</small>
        </div>
        <span class="chip" style="margin-left:auto;background:${D.role(u.role || 'pasien').color}1a;
          color:${D.role(u.role || 'pasien').color};border-color:transparent">
          ${icon(D.role(u.role || 'pasien').icon)} ${esc(D.role(u.role || 'pasien').short)}</span>
      </div>

      <div class="stat-row mt">
        <div><b>${Store.state.meals.length}</b><span>Sesi tercatat</span></div>
        <div><b>${devs.length}</b><span>Perangkat</span></div>
        <div><b>${Store.state.consults.length}</b><span>Konsultasi</span></div>
      </div>

      <div class="section-title">${icon('user')} ${(u.role && u.role !== 'pasien') ? 'Akun' : 'Akun &amp; kesehatan'}</div>
      <div class="list">
        <a class="row" href="#/profil/pribadi"><span class="row__ico">${icon('user')}</span>
          <div><b>Informasi Pribadi</b><small>Nama, usia, tinggi, dan berat badan</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/profil/tujuan"><span class="row__ico">${icon('target')}</span>
          <div><b>Tujuan Kesehatan</b><small>${esc(D.goal(p.goal).name)} · ${p.targets.kcal} kkal/hari</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/perangkat"><span class="row__ico">${icon('watch')}</span>
          <div><b>Status Perangkat</b><small>${conn} dari ${devs.length} perangkat tersambung</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/profil/kalibrasi"><span class="row__ico">${icon('bp')}</span>
          <div><b>Kalibrasi Tekanan Darah</b>
            <small>${p.bpCal ? 'Terakhir ' + esc(relTime(p.bpCal.at)) : 'Belum pernah dikalibrasi'}</small></div>
          ${icon('chev', 'chev')}</a>
      </div>

      <div class="section-title">${icon('cal')} Layanan</div>
      <div class="list">
        <a class="row" href="#/jadwal"><span class="row__ico">${icon('cal')}</span>
          <div><b>Janji Temu</b><small>${Store.state.appointments.length} jadwal tersimpan</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/riwayat"><span class="row__ico">${icon('doc')}</span>
          <div><b>Riwayat Lengkap</b><small>Sesi makan, konsultasi, dan sinkronisasi</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/notifikasi"><span class="row__ico">${icon('bell')}</span>
          <div><b>Notifikasi</b><small>${Store.unread()} belum dibaca</small></div>
          ${icon('chev', 'chev')}</a>
      </div>

      <div class="section-title">${icon('shield')} Aplikasi</div>
      <div class="list">
        <a class="row" href="#/profil/pengaturan"><span class="row__ico">${icon('sync')}</span>
          <div><b>Pengaturan</b><small>Mode demo, notifikasi, dan data lokal</small></div>
          ${icon('chev', 'chev')}</a>
        <a class="row" href="#/tentang"><span class="row__ico">${icon('info')}</span>
          <div><b>Tentang TeleCare</b><small>Batasan penggunaan dan sumber data</small></div>
          ${icon('chev', 'chev')}</a>
        <button class="row" data-switch><span class="row__ico">${icon('swap')}</span>
          <div><b>Ganti peran</b><small>Mode purwarupa · lihat aplikasi dari sudut pandang lain</small></div>
          ${icon('chev', 'chev')}</button>
        <button class="row row--danger" data-logout><span class="row__ico">${icon('out')}</span>
          <div><b>Keluar</b><small>Riwayat tetap tersimpan di perangkat ini</small></div></button>
      </div>

      <div class="note note--w mt2">${icon('alert')}
        <div><b>Data kesehatan adalah data pribadi</b>Hindari membagikan tangkapan layar Beranda
        atau Analisis di ruang publik — layar itu memuat nama, tanggal, dan kebiasaan harian Anda.</div></div>
    `);

    $('[data-logout]').onclick = async () => {
      const ok = await confirmSheet({
        title: 'Keluar dari akun?',
        body: 'Keluar hanya memutus sesi di perangkat ini. Seluruh riwayat tetap tersimpan dan muncul kembali saat Anda masuk lagi.',
        ok: 'Keluar', danger: true
      });
      if (!ok) return;
      if (TC.FB) TC.FB.signOut();
      Store.update((s) => { s.session = null; });
      Router.navigate('/masuk', true);
      toast('Anda telah keluar.');
    };

    $('[data-switch]').onclick = () => TC.views.roleSheet(u.id);
  }

  /* ---------------- 2. INFORMASI PRIBADI ---------------- */
  function viewPersonal() {
    const u = Store.user();
    const p = Store.profile();
    TC.topbar('Informasi Pribadi', { sub: 'Dipakai untuk menghitung target' });

    setView(`
      <form id="fInfo">
        <label class="field"><span>Nama lengkap</span>
          <span class="wrap"><input name="name" value="${esc(u.name)}"></span></label>
        <label class="field"><span>Nama panggilan</span>
          <span class="wrap"><input name="nickname" value="${esc(p.nickname || '')}"></span>
          <span class="hint">Muncul pada sapaan di halaman Beranda.</span></label>
        <label class="field"><span>Jenis kelamin</span>
          <span class="wrap"><select name="gender">
            <option value="">Belum diisi</option>
            <option value="perempuan"${p.gender === 'perempuan' ? ' selected' : ''}>Perempuan</option>
            <option value="laki-laki"${p.gender === 'laki-laki' ? ' selected' : ''}>Laki-laki</option>
          </select></span>
          <span class="hint">Memengaruhi perhitungan kebutuhan energi harian.</span></label>
        <div class="grid2">
          <label class="field"><span>Usia (tahun)</span>
            <span class="wrap"><input name="age" type="number" min="5" max="110" value="${p.age || ''}"></span></label>
          <label class="field"><span>Tinggi badan (cm)</span>
            <span class="wrap"><input name="height" type="number" min="80" max="230" value="${p.height || ''}"></span></label>
        </div>
        <label class="field"><span>Berat badan (kg)</span>
          <span class="wrap"><input name="weight" type="number" min="20" max="250" step="0.1" value="${p.weight || ''}"></span>
          <span class="hint">Perbarui sebulan sekali agar target harian tetap masuk akal.</span></label>

        <div class="section-title">${icon('mail')} Kontak pemulihan</div>
        <label class="field"><span>Email</span>
          <span class="wrap"><input name="email" type="email" value="${esc(u.email)}"></span></label>
        <label class="field"><span>Nomor HP</span>
          <span class="wrap"><input name="phone" type="tel" value="${esc(u.phone)}"></span>
          <span class="hint">Pastikan keduanya aktif — pemulihan akun hanya lewat jalur terdaftar.</span></label>

        ${bmiCard(p)}
        <button class="btn btn--primary btn--lg btn--block mt2" type="submit">Simpan perubahan</button>
      </form>`);

    $('#fInfo').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.name.value.trim().length < 3) { toast('Nama terlalu pendek.', 'err'); return; }
      Store.update((s) => {
        const user = s.users[s.session.userId];
        user.name = f.name.value.trim();
        user.email = f.email.value.trim();
        user.phone = f.phone.value.trim();
        Object.assign(s.profile, {
          nickname: f.nickname.value.trim(),
          gender: f.gender.value,
          age: +f.age.value || null,
          height: +f.height.value || null,
          weight: +f.weight.value || null
        });
      });
      toast('Perubahan tersimpan. Target di Beranda ikut menyesuaikan.');
      Router.render();
    };
  }

  function bmiCard(p) {
    if (!p.height || !p.weight) {
      return `<div class="note note--i mt">${icon('info')}
        <div><b>Lengkapi tinggi dan berat</b>Selama belum diisi, aplikasi memakai nilai bawaan
        sehingga target gizi kurang sesuai dengan kebutuhan Anda.</div></div>`;
    }
    const h = p.height / 100;
    const bmi = p.weight / (h * h);
    const cat = bmi < 18.5 ? ['Berat kurang', 'a'] : bmi < 25 ? ['Berat ideal', 'g']
      : bmi < 30 ? ['Berat berlebih', 'a'] : ['Obesitas', 'r'];
    return `<div class="card mt">
      <div class="card__head">${icon('target')}<h3>Indeks Massa Tubuh</h3>
        <span class="push"></span><span class="chip chip--${cat[1]}">${cat[0]}</span></div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <b style="font-size:1.9rem;letter-spacing:-.04em">${bmi.toFixed(1)}</b>
        <span class="tiny muted">kg/m²</span></div>
      <p class="tiny muted mt">IMT hanya gambaran kasar dan tidak membedakan massa otot dari lemak.</p>
    </div>`;
  }

  /* ---------------- 3. TUJUAN KESEHATAN ---------------- */
  function viewGoals() {
    const p = Store.profile();
    TC.topbar('Tujuan Kesehatan', { sub: 'Menentukan target pada Beranda' });

    setView(`
      <div class="stack--sm stack" id="goalList">
        ${D.GOALS.map((g) => `
          <button class="card" data-goal="${g.id}" style="text-align:left;width:100%;
            border-color:${g.id === p.goal ? 'var(--green-400)' : 'var(--line)'};
            background:${g.id === p.goal ? 'var(--green-50)' : 'var(--surface)'}">
            <div style="display:flex;align-items:center;gap:10px">
              <b style="font-size:.95rem">${esc(g.name)}</b>
              ${g.id === p.goal ? `<span class="chip chip--g" style="margin-left:auto">${icon('check')} Dipilih</span>` : ''}
            </div>
            <p class="small muted mt" style="margin-top:6px">${esc(g.desc)}</p>
            <div class="metric3 mt" style="grid-template-columns:repeat(4,1fr)">
              <div><span>Kalori</span><b style="font-size:1rem">${g.targets.kcal}</b></div>
              <div><span>Karbo</span><b style="font-size:1rem">${g.targets.carb}</b></div>
              <div><span>Protein</span><b style="font-size:1rem">${g.targets.protein}</b></div>
              <div><span>Lemak</span><b style="font-size:1rem">${g.targets.fat}</b></div>
            </div>
          </button>`).join('')}
      </div>

      <div class="section-title">${icon('edit')} Sesuaikan target sendiri</div>
      <form id="fTarget" class="card">
        <div class="grid2">
          <label class="field"><span>Kalori (kkal)</span>
            <span class="wrap"><input name="kcal" type="number" min="800" max="5000" value="${p.targets.kcal}"></span></label>
          <label class="field"><span>Karbohidrat (g)</span>
            <span class="wrap"><input name="carb" type="number" min="20" max="700" value="${p.targets.carb}"></span></label>
          <label class="field"><span>Protein (g)</span>
            <span class="wrap"><input name="protein" type="number" min="20" max="300" value="${p.targets.protein}"></span></label>
          <label class="field"><span>Lemak (g)</span>
            <span class="wrap"><input name="fat" type="number" min="10" max="250" value="${p.targets.fat}"></span></label>
        </div>
        <button class="btn btn--primary btn--block" type="submit">Simpan target</button>
      </form>

      <div class="note note--d mt2">${icon('alert')}
        <div><b>Hindari target yang ekstrem</b>Menurunkan kalori jauh di bawah kebutuhan tubuh
        tidak mempercepat hasil dan dapat membahayakan. Bila Anda memiliki kondisi kesehatan tertentu,
        sedang hamil atau menyusui, tetapkan target bersama tenaga kesehatan.</div></div>
    `);

    $$('[data-goal]').forEach((b) => {
      b.onclick = () => {
        const g = D.goal(b.dataset.goal);
        Store.update((s) => {
          s.profile.goal = g.id;
          s.profile.targets = Object.assign({}, g.targets);
        });
        toast('Tujuan diperbarui: ' + g.name);
        Router.render();
      };
    });

    $('#fTarget').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      Store.update((s) => {
        s.profile.targets = {
          kcal: clamp(+f.kcal.value || 2000, 800, 5000),
          carb: clamp(+f.carb.value || 250, 20, 700),
          protein: clamp(+f.protein.value || 60, 20, 300),
          fat: clamp(+f.fat.value || 65, 10, 250)
        };
      });
      toast('Target tersimpan. Batang kemajuan di Beranda menyesuaikan.');
      Router.render();
    };
  }

  /* ---------------- 4. HUB PERANGKAT ---------------- */
  function viewDevices() {
    const devs = Store.state.devices;
    const active = Store.activeDevice();
    const pending = Store.state.pendingSamples;

    TC.topbar('Status Perangkat', { sub: 'Hub AIoT TeleCare', back: false,
      actions: `<button class="icon-btn" data-scan aria-label="Pindai">${icon('plus')}</button>` });

    setView(`
      ${active ? `
        <div class="card">
          <div class="dev-head">
            <span class="dev-card__ico" style="${active.connected
              ? 'background:var(--green-100);color:var(--green-600)' : ''}">
              ${icon(active.connected ? D.deviceType(active.type).icon : 'bt')}</span>
            <div class="dev-head__txt">
              <b style="font-size:.98rem">${active.connected ? 'Perangkat Tersambung' : 'Perangkat Terputus'}</b>
              <small class="muted" style="font-size:.8rem">${esc(active.name)} · ${esc(active.code)}</small>
              <small class="tiny muted">${active.lastSync ? 'Sinkron terakhir ' + esc(relTime(active.lastSync)) : 'Belum pernah sinkron'}</small>
            </div>
          </div>
          ${active.connected ? `<button class="btn btn--primary btn--block mt" data-sync>
            ${icon('sync')} Sinkronkan sekarang</button>` : ''}

          <div class="duo mt">
            <div class="card card--flat" style="background:var(--canvas);border:0">
              <span class="tiny muted" style="font-weight:700">Baterai</span>
              <b style="display:block;font-size:1.4rem;letter-spacing:-.03em">${active.battery}%</b>
              <div class="bar" style="margin-top:6px"><i style="width:${active.battery}%;
                background:${active.battery < 20 ? 'var(--coral-500)' : 'var(--green-500)'}"></i></div>
            </div>
            <div class="card card--flat" style="background:var(--canvas);border:0">
              <span class="tiny muted" style="font-weight:700">Sampel tertunda</span>
              <b style="display:block;font-size:1.4rem;letter-spacing:-.03em">${pending}</b>
              <span class="tiny muted">${pending ? 'menunggu dipindahkan' : 'buffer jam kosong'}</span>
            </div>
          </div>

          ${active.connected ? `
            <div class="duo mt">
              <a class="btn btn--ghost btn--sm btn--block" href="#/perangkat/pindai">Ganti Perangkat</a>
              <button class="btn btn--ghost btn--sm btn--block" data-disc>Putuskan</button>
            </div>` : `
            <button class="btn btn--primary btn--block mt" data-recon>${icon('bt')} Sambungkan Ulang</button>`}
        </div>` : ''}

      <div class="steps3 mt">
        <div class="s"><i>${icon('bt')}</i>1. Aktifkan Bluetooth</div>
        <div class="ar">${icon('arrow')}</div>
        <div class="s"><i>${icon('watch')}</i>2. Nyalakan Perangkat</div>
        <div class="ar">${icon('arrow')}</div>
        <div class="s"><i>${icon('link')}</i>3. Hubungkan di Aplikasi</div>
      </div>

      <div class="section-title">${icon('watch')} Perangkat terpasang
        <span class="push"></span><span class="chip">${devs.length}</span></div>
      ${devs.length ? `<div class="stack--sm stack">
        ${devs.map((d) => {
          const t = D.deviceType(d.type);
          return `<button class="dev-card${d.connected ? ' is-on' : ''}" data-dev="${d.id}">
            <span class="dev-card__ico">${icon(t.icon)}</span>
            <span style="min-width:0;flex:1">
              <b>${esc(d.name)}</b><small>${esc(d.code)}</small>
              <span class="meta">
                <span class="chip ${d.connected ? 'chip--g' : ''}" style="font-size:.66rem">
                  ${d.connected ? 'tersambung' : 'terputus'}</span>
                <span class="chip" style="font-size:.66rem">${icon('battery')} ${d.battery}%</span>
              </span>
            </span>
            <span class="signal" data-l="${d.connected ? (d.rssi || 3) : 0}"><i></i><i></i><i></i><i></i></span>
          </button>`;
        }).join('')}
      </div>` : `
        <div class="empty">${icon('bt')}<b>Belum ada perangkat</b>
        <p>Pindai untuk menemukan TeleBand, TeleRing, dan perangkat TeleCare lain di sekitar Anda.</p>
        <a class="btn btn--primary btn--sm mt" href="#/perangkat/pindai">Pindai &amp; Sambungkan</a></div>`}

      <div class="section-title">${icon('sparkle')} Perangkat yang didukung</div>
      <div class="stack--sm stack">
        ${D.DEVICE_TYPES.map((t) => `
          <div class="row" style="border:1px solid var(--line);border-radius:16px;background:var(--surface);align-items:flex-start">
            <span class="row__ico">${icon(t.icon)}</span>
            <div style="min-width:0"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">
                ${t.caps.map((c) => `<span class="chip" style="font-size:.64rem">${esc(D.CAP_LABEL[c] || c)}</span>`).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div class="note note--i mt2">${icon('info')}
        <div><b>Satu perangkat, satu ponsel</b>Perangkat TeleCare hanya dapat terhubung ke satu ponsel
        dalam satu waktu. Bila masih tersambung ke ponsel lain, ia tidak akan muncul saat dipindai.</div></div>
    `);

    $('[data-scan]').onclick = () => Router.navigate('/perangkat/pindai');

    const syncBtn = $('[data-sync]');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        syncBtn.classList.add('is-disabled');
        syncBtn.innerHTML = icon('sync') + ' Menyinkronkan…';
        try {
          const n = await TC.Devices.sync();
          toast(n ? n + ' sampel dipindahkan ke aplikasi.' : 'Buffer jam sudah kosong.');
        } catch (e) { toast(e.message, 'err'); }
        Router.render();
      };
    }

    const discBtn = $('[data-disc]');
    if (discBtn) {
      discBtn.onclick = async () => {
        const ok = await confirmSheet({
          title: 'Putuskan sambungan?',
          body: 'Perangkat tetap mengukur dan menyimpan hasilnya di buffer. Anda dapat menyambungkan ulang kapan saja.',
          ok: 'Putuskan', danger: true
        });
        if (!ok) return;
        TC.Devices.disconnect(active.id);
        toast('Sambungan diputus.');
        Router.render();
      };
    }

    const reconBtn = $('[data-recon]');
    if (reconBtn) {
      reconBtn.onclick = () => {
        reconBtn.classList.add('is-disabled');
        reconBtn.innerHTML = icon('sync') + ' Menyambungkan…';
        setTimeout(() => { TC.Devices.reconnect(active.id); Router.render(); }, 1100);
      };
    }

    $$('[data-dev]').forEach((b) => {
      b.onclick = () => Router.navigate('/perangkat/' + b.dataset.dev);
    });
  }

  /* ---------------- 5. PINDAI PERANGKAT ---------------- */
  function viewScan() {
    TC.topbar('Pindai Perangkat', { sub: 'Mencari perangkat di sekitar' });
    let found = [];
    let scanning = true;

    function draw() {
      setView(`
        ${scanning ? `
          <div class="scan-pulse"><i></i><i></i><i></i><b>${icon('bt')}</b></div>
          <p class="tc small muted">Memindai perangkat TeleCare di sekitar…</p>` : `
          <div class="chip chip--g" style="display:flex;width:max-content;margin:0 auto 14px">
            ${icon('bt')} ${found.filter((f) => f.supported).length} perangkat ditemukan</div>`}

        <div class="stack--sm stack mt" id="foundList">
          ${found.map((f) => {
            const t = f.supported ? D.deviceType(f.type) : null;
            return `<button class="dev-card" data-pair="${f.id}" ${f.supported ? '' : 'disabled style="opacity:.55"'}>
              <span class="dev-card__ico">${icon(t ? t.icon : 'bt')}</span>
              <span style="min-width:0;flex:1">
                <b>${esc(f.name)}</b>
                <small>${f.supported ? esc(f.code) : 'Tidak didukung aplikasi ini'}</small>
              </span>
              <span class="signal" data-l="${f.rssi}"><i></i><i></i><i></i><i></i></span>
              ${f.supported ? icon('chev', 'chev') : ''}
            </button>`;
          }).join('')}
        </div>

        <button class="btn btn--ghost btn--block mt" data-rescan>${icon('refresh')} Pindai Ulang</button>
        <p class="tiny muted tc mt">Nyalakan perangkat dan pastikan berada dalam jangkauan.
          Perangkat yang sedang tersambung ke ponsel lain tidak akan muncul.</p>

        ${TC.Devices.hasWebBluetooth() ? `
          <div class="note note--b mt2">${icon('bt')}
            <div><b>Peramban ini mendukung Web Bluetooth</b>Anda dapat mencoba memindai perangkat
            BLE sungguhan di sekitar.</div></div>
          <button class="btn btn--soft btn--block mt" data-real>${icon('bt')} Pindai perangkat BLE nyata</button>` : `
          <div class="note note--i mt2">${icon('info')}
            <div><b>Pemindaian simulasi</b>Peramban ini tidak menyediakan Web Bluetooth,
            sehingga daftar di atas dibangkitkan untuk keperluan purwarupa.</div></div>`}
      `);

      $$('[data-pair]').forEach((b) => {
        b.onclick = () => {
          const f = found.find((x) => x.id === b.dataset.pair);
          if (!f || !f.supported) return;
          b.classList.add('is-on');
          b.querySelector('small').textContent = 'Menyambungkan…';
          setTimeout(() => {
            TC.Devices.pair(f);
            toast('Tersambung ke ' + f.name + '.');
            Router.navigate('/perangkat', true);
          }, 1000);
        };
      });

      $('[data-rescan]').onclick = start;

      const real = $('[data-real]');
      if (real) {
        real.onclick = async () => {
          try {
            const dev = await TC.Devices.realScan();
            TC.Devices.pair(dev);
            toast('Perangkat nyata tersambung: ' + dev.name);
            Router.navigate('/perangkat', true);
          } catch (e) {
            if (e && e.name === 'NotFoundError') toast('Tidak ada perangkat dipilih.', 'err');
            else toast('Pemindaian BLE dibatalkan atau tidak didukung.', 'err');
          }
        };
      }
    }

    function start() {
      scanning = true; found = []; draw();
      const t = setTimeout(() => {
        found = TC.Devices.simulateScan();
        scanning = false;
        draw();
      }, 1800);
      Router.onLeave(() => clearTimeout(t));
    }
    start();
  }

  /* ---------------- 6. DETAIL PERANGKAT ---------------- */
  function viewDeviceDetail(params) {
    const d = Store.state.devices.find((x) => x.id === params.id);
    if (!d) { Router.navigate('/perangkat', true); return; }
    const t = D.deviceType(d.type);

    TC.topbar(d.name, { sub: d.code });
    setView(`
      <div class="card tc" style="padding:24px">
        <span class="dev-card__ico" style="width:66px;height:66px;border-radius:22px;margin:0 auto 12px;
          ${d.connected ? 'background:var(--green-100);color:var(--green-600)' : ''}">
          ${icon(t.icon)}</span>
        <h2 style="font-size:1.1rem">${esc(d.name)}</h2>
        <p class="tiny muted mono mt">${esc(d.code)}</p>
        <div class="mt"><span class="chip chip--${d.connected ? 'g' : ''}">
          ${d.connected ? '<i class="dotlive"></i> tersambung' : 'terputus'}</span></div>
      </div>

      <div class="stat-row mt">
        <div><b>${d.battery}%</b><span>Baterai</span></div>
        <div><b>${t.rateHz || '—'}</b><span>Hz sampling</span></div>
        <div><b>${d.rssi || 0}/4</b><span>Sinyal</span></div>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('heart')}<h3>Parameter yang diukur</h3></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${t.caps.map((c) => `<span class="chip chip--g">${esc(D.CAP_LABEL[c] || c)}</span>`).join('')}
        </div>
        <p class="small muted mt">${esc(t.desc)}</p>
      </div>

      <div class="list mt">
        <div class="row"><span class="row__ico">${icon('link')}</span>
          <div><b>Dipasangkan</b><small>${esc(relTime(d.pairedAt))}</small></div></div>
        <div class="row"><span class="row__ico">${icon('sync')}</span>
          <div><b>Sinkron terakhir</b><small>${d.lastSync ? esc(relTime(d.lastSync)) : 'Belum pernah'}</small></div></div>
      </div>

      <div class="stack--sm stack mt2">
        ${d.connected
          ? `<button class="btn btn--ghost btn--block" data-disc>${icon('bt')} Putuskan sambungan</button>`
          : `<button class="btn btn--primary btn--block" data-recon>${icon('bt')} Sambungkan ulang</button>`}
        <button class="btn btn--dangerSoft btn--block" data-forget>${icon('trash')} Lupakan perangkat</button>
      </div>
    `);

    const dc = $('[data-disc]');
    if (dc) dc.onclick = () => { TC.Devices.disconnect(d.id); toast('Sambungan diputus.'); Router.render(); };
    const rc = $('[data-recon]');
    if (rc) rc.onclick = () => { TC.Devices.reconnect(d.id); Router.render(); };

    $('[data-forget]').onclick = async () => {
      const ok = await confirmSheet({
        title: 'Lupakan perangkat ini?',
        body: 'Perangkat dihapus dari daftar. Anda perlu memindai ulang untuk memakainya kembali.',
        ok: 'Lupakan', danger: true
      });
      if (!ok) return;
      TC.Devices.forget(d.id);
      toast('Perangkat dilupakan.');
      Router.navigate('/perangkat', true);
    };
  }

  /* ---------------- 7. KALIBRASI TEKANAN DARAH ---------------- */
  function viewCalibration() {
    const p = Store.profile();
    TC.topbar('Kalibrasi Tekanan Darah', { sub: 'Menyelaraskan sensor dengan tensimeter' });

    setView(`
      ${p.bpCal ? `
        <div class="card">
          <div class="card__head">${icon('check')}<h3>Kalibrasi tersimpan</h3>
            <span class="push"></span><span class="chip chip--g">${esc(relTime(p.bpCal.at))}</span></div>
          <div class="metric3">
            <div><span>Sistolik</span><b>${p.bpCal.sys}</b><small>mmHg</small></div>
            <div><span>Diastolik</span><b>${p.bpCal.dia}</b><small>mmHg</small></div>
            <div><span>Selisih jam</span><b>${p.bpCal.diff != null ? (p.bpCal.diff > 0 ? '+' : '') + p.bpCal.diff : '—'}</b><small>mmHg</small></div>
          </div>
        </div>` : `
        <div class="note note--w">${icon('alert')}
          <div><b>Belum pernah dikalibrasi</b>Selama belum dikalibrasi, estimasi tekanan darah dari
          perangkat hanya berguna untuk melihat kecenderungan kasar.</div></div>`}

      <div class="section-title">${icon('doc')} Langkah kalibrasi</div>
      <div class="list">
        ${[
          ['Siapkan tensimeter lengan', 'Gunakan alat yang sudah teruji — hasilnya menjadi acuan.'],
          ['Duduk tenang lima menit', 'Punggung bersandar, kaki menapak lantai, lengan setinggi jantung.'],
          ['Ukur dan catat hasilnya', 'Catat angka sistolik dan diastolik dari tensimeter.'],
          ['Pastikan perangkat terpasang', 'Jam melekat cukup rapat, sekitar satu jari di atas tulang pergelangan.'],
          ['Masukkan hasilnya di bawah', 'Aplikasi akan menyesuaikan pembacaan sensor terhadap angka ini.']
        ].map((s, i) => `<div class="row" style="align-items:flex-start">
          <span class="row__ico" style="font-weight:800">${i + 1}</span>
          <div><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div></div>`).join('')}
      </div>

      <form id="fCal" class="card mt">
        <div class="grid2">
          <label class="field"><span>Sistolik (mmHg)</span>
            <span class="wrap"><input name="sys" type="number" min="70" max="250" placeholder="mis. 118" required></span></label>
          <label class="field"><span>Diastolik (mmHg)</span>
            <span class="wrap"><input name="dia" type="number" min="40" max="150" placeholder="mis. 76" required></span></label>
        </div>
        <button class="btn btn--primary btn--block" type="submit">${icon('check')} Simpan kalibrasi</button>
      </form>

      <div class="section-title">${icon('refresh')} Kapan perlu diulang</div>
      <div class="card">
        <ul style="display:grid;gap:9px">
          ${['Setiap kali hasil jam berselisih jauh dengan tensimeter.',
             'Setelah berat badan berubah cukup banyak.',
             'Bila Anda berpindah tangan saat memakai perangkat.',
             'Setelah perangkat diatur ulang ke pengaturan pabrik.',
             'Secara berkala, kira-kira sebulan sekali.'].map((s) =>
            `<li style="display:flex;gap:9px;font-size:.87rem;color:var(--ink-2)">
              <span style="color:var(--green-500);flex:none">${icon('check')}</span>${esc(s)}</li>`).join('')}
        </ul>
      </div>

      <div class="note note--d mt2">${icon('alert')}
        <div><b>Batas kemampuan pengukuran di pergelangan tangan</b>
        Sensor optik tidak menggantikan tensimeter, apalagi pemeriksaan tenaga kesehatan.
        Bila Anda merasakan nyeri dada, sesak napas, atau sakit kepala hebat, segera cari pertolongan
        medis tanpa menunggu pembacaan perangkat.</div></div>
    `);

    $('#fCal').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const sys = +f.sys.value, dia = +f.dia.value;
      if (!(sys > dia)) { toast('Sistolik harus lebih besar dari diastolik.', 'err'); return; }
      if (sys < 70 || sys > 250 || dia < 40 || dia > 150) { toast('Nilai di luar rentang wajar.', 'err'); return; }
      const diff = Math.round(TC.Vitals.state.sys - sys);
      Store.update((s) => { s.profile.bpCal = { sys, dia, diff, at: Date.now() }; });
      Store.notify('Kalibrasi tersimpan', `Acuan ${sys}/${dia} mmHg dari tensimeter.`, 'ok');
      toast('Kalibrasi tersimpan.');
      Router.render();
    };
  }

  /* ---------------- 8. PENGATURAN ---------------- */
  function viewSettings() {
    const s = Store.state.settings;
    TC.topbar('Pengaturan');
    setView(`
      <div class="section-title">${icon('clock')} Mode purwarupa</div>
      <div class="list">
        <label class="row">
          <span class="row__ico">${icon('clock')}</span>
          <div style="min-width:0"><b>Percepat waktu sesi</b>
            <small>Rentang 2 jam dipadatkan menjadi ± 2 menit agar alur dapat dicoba utuh.</small></div>
          <input type="checkbox" id="tFast" ${s.fastDemo ? 'checked' : ''}
                 style="margin-left:auto;width:20px;height:20px;accent-color:var(--green-500)">
        </label>
        <label class="row">
          <span class="row__ico">${icon('bell')}</span>
          <div style="min-width:0"><b>Notifikasi dalam aplikasi</b>
            <small>Peringatan perangkat dan pengingat konsultasi.</small></div>
          <input type="checkbox" id="tNotif" ${s.notif ? 'checked' : ''}
                 style="margin-left:auto;width:20px;height:20px;accent-color:var(--green-500)">
        </label>
      </div>

      <div class="section-title">${icon('shield')} Data di perangkat ini</div>
      <div class="card">
        <p class="small" style="color:var(--ink-2)">Seluruh data aplikasi — akun, riwayat sesi,
        percakapan, dan daftar perangkat — disimpan di penyimpanan lokal peramban ini.
        Tidak ada data yang dikirim ke server.</p>
        <div class="stat-row mt">
          <div><b>${Store.state.meals.length}</b><span>Sesi</span></div>
          <div><b>${Store.state.consults.length}</b><span>Konsultasi</span></div>
          <div><b>${Store.state.vitalsHistory.length}</b><span>Rekaman vital</span></div>
        </div>
        <button class="btn btn--ghost btn--block mt" data-export>${icon('doc')} Unduh data saya (JSON)</button>
        <button class="btn btn--dangerSoft btn--block mt" data-wipe>${icon('trash')} Hapus semua data lokal</button>
      </div>
    `);

    $('#tFast').onchange = (e) => {
      Store.update((st) => { st.settings.fastDemo = e.target.checked; });
      toast(e.target.checked ? 'Waktu sesi dipercepat.' : 'Sesi memakai waktu sesungguhnya.');
    };
    $('#tNotif').onchange = (e) => {
      Store.update((st) => { st.settings.notif = e.target.checked; });
    };

    $('[data-export]').onclick = () => {
      const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'telecare-data.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Berkas data diunduh.');
    };

    $('[data-wipe]').onclick = async () => {
      const ok = await confirmSheet({
        title: 'Hapus semua data lokal?',
        body: 'Akun, riwayat sesi, percakapan, dan daftar perangkat pada peramban ini akan hilang permanen.',
        ok: 'Hapus semuanya', danger: true
      });
      if (!ok) return;
      Store.reset();
      location.hash = '/mulai';
      location.reload();
    };
  }

  /* ---------------- 9. TENTANG ---------------- */
  function viewAbout() {
    TC.topbar('Tentang TeleCare');
    setView(`
      <div class="card tc" style="padding:26px">
        <div style="width:66px;margin:0 auto 12px">${TC.views.logoSvg(66)}</div>
        <h2 style="font-size:1.2rem">TeleCare</h2>
        <p class="small muted mt">Platform Telemedisin AIoT Terpadu<br>berbasis Health 5.0</p>
        <span class="chip mt" style="margin-top:12px">Purwarupa · Iterasi 1</span>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('sparkle')}<h3>Apa yang dikerjakan aplikasi ini</h3></div>
        <p class="small" style="color:var(--ink-2);line-height:1.65">
          TeleCare menyatukan dua hal yang biasanya terpisah: pemantauan berkelanjutan dari perangkat
          wearable, dan akses ke tenaga kesehatan. Perangkat mengukur dan menyimpan; aplikasi menarik,
          menyusun, serta menjelaskan; dokter menerima konteksnya tanpa perlu Anda ketik ulang.</p>
      </div>

      <div class="card mt">
        <div class="card__head">${icon('watch')}<h3>Perangkat yang didukung</h3></div>
        <div class="stack--sm stack">
          ${D.DEVICE_TYPES.map((t) => `<div style="display:flex;gap:10px;align-items:center">
            <span class="row__ico" style="width:32px;height:32px;border-radius:10px">${icon(t.icon)}</span>
            <div><b style="font-size:.87rem">${esc(t.name)}</b>
              <small class="tiny muted" style="display:block">${esc(t.tagline)}</small></div></div>`).join('')}
        </div>
      </div>

      <div class="note note--d mt">${icon('alert')}
        <div><b>Bukan alat diagnosis medis</b>
        TeleCare adalah alat bantu pemantauan gaya hidup. Angka yang ditampilkan tidak boleh dijadikan
        dasar untuk mendiagnosis penyakit, mengubah dosis obat, atau menunda pemeriksaan ke tenaga kesehatan.</div></div>

      <div class="card mt">
        <div class="card__head">${icon('link')}<h3>Teknologi yang dipakai</h3></div>
        <div class="stack--sm stack">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <span class="row__ico" style="width:32px;height:32px;border-radius:10px">${icon('chat')}</span>
            <div><b style="font-size:.87rem">Firebase Realtime Database</b>
              <small class="tiny muted" style="display:block">Percakapan konsultasi tersinkron antarperangkat secara langsung.</small></div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start">
            <span class="row__ico" style="width:32px;height:32px;border-radius:10px">${icon('video')}</span>
            <div><b style="font-size:.87rem">WebRTC peer-to-peer</b>
              <small class="tiny muted" style="display:block">Panggilan suara dan video berjalan langsung antarperangkat, dengan pertukaran sinyal lewat Firebase dan STUN publik.</small></div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start">
            <span class="row__ico" style="width:32px;height:32px;border-radius:10px">${icon('bt')}</span>
            <div><b style="font-size:.87rem">Web Bluetooth</b>
              <small class="tiny muted" style="display:block">Pemindaian perangkat BLE nyata bila peramban mendukungnya; selain itu memakai daftar simulasi.</small></div>
          </div>
        </div>
      </div>

      <div class="note note--w mt">${icon('info')}
        <div><b>Status purwarupa</b>
        Nilai fisiologis pada iterasi ini dibangkitkan secara simulatif, dan balasan dokter dihasilkan
        otomatis dari pola kata kunci — tidak ada tenaga kesehatan sungguhan di balik layar, dan tidak
        ada transaksi yang ditagih. Percakapan serta panggilan, sebaliknya, berjalan sungguhan.</div></div>

      <div class="list mt2">
        <a class="row" href="../index.html"><span class="row__ico">${icon('link')}</span>
          <div><b>Situs penelitian TeleCare</b><small>Latar belakang, arsitektur, dan tim peneliti</small></div>
          ${icon('chev', 'chev')}</a>
      </div>

      <p class="tiny muted tc mt2">Program Studi Fisika · FMIPA<br>Edisi 2026</p>
    `);
  }

  TC.views = TC.views || {};
  Object.assign(TC.views, {
    profile: viewProfile, personal: viewPersonal, goals: viewGoals,
    devices: viewDevices, scan: viewScan, deviceDetail: viewDeviceDetail,
    calibration: viewCalibration, settings: viewSettings, about: viewAbout
  });
})(window.TC);
