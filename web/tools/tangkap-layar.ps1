<#
  Menangkap satu tangkapan layar untuk SETIAP halaman TeleCare, dipakai sebagai
  bahan baku dua video showcase (promo & tutorial).

  Keluaran: build/shots/desktop/NN-nama.png (1920x1080)
            build/shots/ponsel/NN-nama.png  (dipakai untuk sisipan)

  Menjalankan:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\tangkap-layar.ps1 -Basis http://127.0.0.1:8950

  Prasyarat: server lokal hidup (python tools/serve.py 8950).
#>
param(
  [string]$Basis = 'http://127.0.0.1:8950',
  [ValidateSet('desktop', 'ponsel', 'semua')][string]$Ragam = 'semua',
  [int]$DurasiMs = 7000,
  [string]$Hanya = ''
)

. (Join-Path $PSScriptRoot 'uji-browser.ps1')

# Halaman: peran demo, rute hash, nama berkas, judul untuk caption video.
$HALAMAN = @(
  @{ peran = ''; rute = ''; nama = 'landing'; judul = 'Situs TeleCare'; situs = $true }
  @{ peran = 'pasien'; rute = '#/home'; nama = 'pasien-home'; judul = 'Beranda Pasien' }
  @{ peran = 'pasien'; rute = '#/vital/hr'; nama = 'pasien-vital-hr'; judul = 'Detak Jantung' }
  @{ peran = 'pasien'; rute = '#/vital/spo2'; nama = 'pasien-vital-spo2'; judul = 'Saturasi Oksigen' }
  @{ peran = 'pasien'; rute = '#/vital/temp'; nama = 'pasien-vital-temp'; judul = 'Suhu Tubuh' }
  @{ peran = 'pasien'; rute = '#/vital/bp'; nama = 'pasien-vital-bp'; judul = 'Tekanan Darah' }
  @{ peran = 'pasien'; rute = '#/analisis'; nama = 'pasien-analisis'; judul = 'Analisis Kesehatan' }
  @{ peran = 'pasien'; rute = '#/riwayat'; nama = 'pasien-riwayat'; judul = 'Riwayat' }
  @{ peran = 'pasien'; rute = '#/notifikasi'; nama = 'pasien-notifikasi'; judul = 'Notifikasi' }
  @{ peran = 'pasien'; rute = '#/artikel/a1'; nama = 'pasien-artikel'; judul = 'Artikel Edukasi' }
  @{ peran = 'pasien'; rute = '#/konsultasi'; nama = 'pasien-konsultasi'; judul = 'Cari Dokter' }
  @{ peran = 'pasien'; rute = '#/konsultasi/spesialis/jantung'; nama = 'pasien-spesialis'; judul = 'Spesialis Jantung' }
  @{ peran = 'pasien'; rute = '#/dokter/d1'; nama = 'pasien-dokter'; judul = 'Profil Dokter' }
  @{ peran = 'pasien'; rute = '#/chat/cs-demo'; nama = 'pasien-chat'; judul = 'Konsultasi Chat' }
  @{ peran = 'pasien'; rute = '#/call/cs-demo'; nama = 'pasien-call'; judul = 'Panggilan Video' }
  @{ peran = 'pasien'; rute = '#/jadwal'; nama = 'pasien-jadwal'; judul = 'Jadwal' }
  @{ peran = 'pasien'; rute = '#/perangkat'; nama = 'pasien-perangkat'; judul = 'Perangkat Terhubung' }
  @{ peran = 'pasien'; rute = '#/perangkat/pindai'; nama = 'pasien-pindai'; judul = 'Pindai Perangkat' }
  @{ peran = 'pasien'; rute = '#/sesi/kamera'; nama = 'pasien-kamera'; judul = 'Catat Makan' }
  @{ peran = 'pasien'; rute = '#/profil'; nama = 'pasien-profil'; judul = 'Profil' }
  @{ peran = 'pasien'; rute = '#/profil/pribadi'; nama = 'pasien-pribadi'; judul = 'Data Pribadi' }
  @{ peran = 'pasien'; rute = '#/profil/tujuan'; nama = 'pasien-tujuan'; judul = 'Tujuan Kesehatan' }
  @{ peran = 'pasien'; rute = '#/profil/kalibrasi'; nama = 'pasien-kalibrasi'; judul = 'Kalibrasi Tensi' }
  @{ peran = 'pasien'; rute = '#/profil/pengaturan'; nama = 'pasien-pengaturan'; judul = 'Pengaturan' }
  @{ peran = 'pasien'; rute = '#/tentang'; nama = 'pasien-tentang'; judul = 'Tentang' }
  @{ peran = 'dokter'; rute = '#/klinik'; nama = 'dokter-klinik'; judul = 'Papan Jaga Dokter' }
  @{ peran = 'dokter'; rute = '#/klinik/antrean'; nama = 'dokter-antrean'; judul = 'Antrean Konsultasi' }
  @{ peran = 'dokter'; rute = '#/klinik/pasien'; nama = 'dokter-pasien'; judul = 'Daftar Pasien' }
  @{ peran = 'dokter'; rute = '#/klinik/pasien/p1'; nama = 'dokter-pasien-detail'; judul = 'Detail Pasien' }
  @{ peran = 'admin-faskes'; rute = '#/faskes'; nama = 'faskes-home'; judul = 'Dasbor Faskes' }
  @{ peran = 'admin-faskes'; rute = '#/faskes/anggota'; nama = 'faskes-anggota'; judul = 'Anggota Terpantau' }
  @{ peran = 'admin-faskes'; rute = '#/faskes/anggota/p5'; nama = 'faskes-anggota-detail'; judul = 'Detail Anggota' }
  @{ peran = 'admin-faskes'; rute = '#/faskes/perangkat'; nama = 'faskes-perangkat'; judul = 'Inventaris Perangkat' }
  @{ peran = 'admin-faskes'; rute = '#/faskes/nakes'; nama = 'faskes-nakes'; judul = 'Tenaga Kesehatan' }
  @{ peran = 'admin'; rute = '#/sistem'; nama = 'admin-sistem'; judul = 'Dasbor Platform' }
  @{ peran = 'admin'; rute = '#/sistem/pengguna'; nama = 'admin-pengguna'; judul = 'Kelola Pengguna' }
  @{ peran = 'admin'; rute = '#/sistem/dokter'; nama = 'admin-dokter'; judul = 'Verifikasi Dokter' }
  @{ peran = 'admin'; rute = '#/sistem/faskes'; nama = 'admin-faskes-kelola'; judul = 'Kelola Faskes' }
  @{ peran = 'admin'; rute = '#/sistem/kalibrasi'; nama = 'admin-kalibrasi'; judul = 'Kalibrasi Sensor' }
)

$MEDIA = @('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required')

$akar = Split-Path $PSScriptRoot -Parent

function Potong-Gambar([string]$Path, [int]$W, [int]$H) {
  Add-Type -AssemblyName System.Drawing
  $src = [System.Drawing.Image]::FromFile($Path)
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), (New-Object System.Drawing.Rectangle 0, 0, $W, $H), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $src.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
$ragamDipakai = if ($Ragam -eq 'semua') { @('desktop', 'ponsel') } else { @($Ragam) }

$catatan = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($h in $HALAMAN) {
  $i++
  if ($Hanya -and -not (($Hanya -split ',') -contains $h.nama)) { continue }
  $no = '{0:d2}' -f $i
  $url = if ($h.situs) { "$Basis/" } else { "$Basis/app/?demo=$($h.peran)$($h.rute)" }
  foreach ($r in $ragamDipakai) {
    # Ponsel: jendela Edge tanpa kepala minimal ~492px, jadi aplikasi dirender
    # di iframe 430x932 (tests/bingkai.html) lalu gambar dipotong ke 430 lebar.
    $lebar = if ($r -eq 'ponsel') { 520 } else { 1920 }
    $tinggi = if ($r -eq 'ponsel') { 932 } else { 1080 }
    $urlR = if ($r -eq 'ponsel') { "$Basis/tests/bingkai.html?u=" + [uri]::EscapeDataString($url) } else { $url }
    $dir = Join-Path $akar "build\shots\$r"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $berkas = Join-Path $dir "$no-$($h.nama).png"
    $ok = $false
    try {
      $ok = Ambil-Layar -Url $urlR -Keluaran $berkas -Lebar $lebar -Tinggi $tinggi `
        -DurasiMs $DurasiMs -Label "shot-$($h.nama)-$r" -FlagTambahan $MEDIA -BatasDetik 40
    } catch {
      Write-Host ("  galat: " + $_.Exception.Message)
    }
    if ($r -eq 'ponsel' -and (Test-Path $berkas)) { Potong-Gambar $berkas 430 932 }
    $ukuran = if (Test-Path $berkas) { (Get-Item $berkas).Length } else { 0 }
    Write-Host ('{0} {1,-9} {2,-26} {3} bytes' -f $no, $r, $h.nama, $ukuran)
    if ($r -eq 'desktop') {
      $catatan.Add([pscustomobject]@{ no = $no; nama = $h.nama; judul = $h.judul; peran = $h.peran; rute = $h.rute; bytes = $ukuran })
    }
  }
}

$manifes = Join-Path $akar 'build\shots\daftar.json'
$catatan | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $manifes
Write-Host "manifes -> $manifes"
$gagal = $catatan | Where-Object { $_.bytes -lt 5000 }
if ($gagal) { Write-Host ('GAGAL/CURIGA: ' + (($gagal | ForEach-Object { $_.nama }) -join ', ')) }
