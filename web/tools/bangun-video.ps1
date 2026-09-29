<#
  Membangun dua video showcase TeleCare dari tangkapan layar di build/shots.

    assets/video/telecare-promo.mp4     ~65 detik, tempo cepat, untuk promosi
    assets/video/telecare-tutorial.mp4  ~2.5 menit, alur per peran, untuk tutorial

  Bahan baku dibuat lebih dulu oleh tools\tangkap-layar.ps1.

  Menjalankan:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\bangun-video.ps1

  Alur kerja:
    1. Satu latar terang neumorfik (gradients + drawgrid halus) dibuat sekali.
    2. Tiap halaman jadi satu klip pendek: panel tangkapan layar di atas latar,
       diberi tepi aksen, pantulan kabur, judul, keterangan, lalu didorong
       perlahan dengan zoompan.
    3. Klip-klip disambung memakai xfade secara bertahap (dipotong per rumpun
       agar rangkaian filter tidak membengkak).
    4. Bantalan suara ambien disintesis oleh ffmpeg sendiri, karena proyek ini
       tidak punya aset musik berlisensi. Volumenya sengaja rendah supaya mudah
       diganti musik sungguhan di CapCut.
#>
param(
  [string]$FFmpeg = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe",
  [ValidateSet('promo', 'tutorial', 'semua')][string]$Video = 'semua',
  [switch]$LewatiKlip   # pakai klip yang sudah ada di build/clips
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $FFmpeg)) { throw "ffmpeg tidak ditemukan di $FFmpeg" }

# Mesin ini berlokal Indonesia, jadi 3.6 akan tercetak "3,6" dan ffmpeg
# menolaknya. Seluruh skrip dipaksa memakai pemisah desimal titik.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$akar = Split-Path $PSScriptRoot -Parent
$shot = Join-Path $akar 'build\shots\desktop'
$kerja = Join-Path $akar 'build\video'
$klipDir = Join-Path $kerja 'klip'
foreach ($d in @($kerja, $klipDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }

$FONT_B = '/Windows/Fonts/segoeuib.ttf'
$FONT_R = '/Windows/Fonts/segoeui.ttf'
$FONT_M = '/Windows/Fonts/consola.ttf'
$AKSEN = '0x049A5B'
$AKSEN2 = '0x0E7FB8'
$FPS = 30

# ---------------------------------------------------------------- pembantu

function Aman-Teks {
  <# drawtext memakai ':' sebagai pemisah opsi dan '%' untuk ekspansi teks.
     Menggantinya lebih sederhana dan lebih tahan banting daripada meloloskan. #>
  param([string]$t)
  $t = $t -replace '·', '-' -replace '—', '-' -replace '–', '-'
  $t = $t -replace ':', ' -' -replace '%', ' persen' -replace "'", '' -replace '\\', '/'
  return $t
}

function Jalankan-FFmpeg {
  param([string[]]$Argumen, [string]$Nama = 'ffmpeg')
  $bo = Join-Path $env:TEMP ('ff-o-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  $be = Join-Path $env:TEMP ('ff-e-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  $p = Start-Process -FilePath $FFmpeg -ArgumentList $Argumen -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $bo -RedirectStandardError $be
  if ($p.ExitCode -ne 0) {
    $galat = (Get-Content $be -Raw -ErrorAction SilentlyContinue)
    Write-Host "GAGAL $Nama (exit $($p.ExitCode))"
    Write-Host (($galat -split "`n" | Select-Object -Last 25) -join "`n")
    Remove-Item $bo, $be -Force -ErrorAction SilentlyContinue
    throw "ffmpeg gagal pada $Nama"
  }
  Remove-Item $bo, $be -Force -ErrorAction SilentlyContinue
}

function Tulis-Graf {
  param([string]$Isi)
  $f = Join-Path $env:TEMP ('graf-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
  # ffmpeg membaca berkas ini apa adanya; ASCII tanpa BOM paling aman.
  [System.IO.File]::WriteAllText($f, $Isi, (New-Object System.Text.UTF8Encoding($false)))
  return $f
}

# ---------------------------------------------------------------- latar

$latar = Join-Path $kerja 'latar.png'
if (-not (Test-Path $latar)) {
  $gl = "gradients=s=1920x1080:c0=0xF8FBFA:c1=0xEEF3F1:c2=0xE4EBE8:nb_colors=3:type=radial:d=1," +
  "drawgrid=w=64:h=64:t=1:color=$AKSEN2@0.05," +
  "drawbox=x=0:y=0:w=1920:h=6:color=$AKSEN@0.45:t=fill," +
  "format=rgb24"
  Jalankan-FFmpeg @('-hide_banner', '-y', '-f', 'lavfi', '-i', $gl, '-frames:v', '1', $latar) 'latar'
  Write-Host "latar dibuat -> $latar"
}

# ---------------------------------------------------------------- klip

function Rantai-Hias {
  <# Bagian filter yang menempelkan judul, keterangan, dan tanda air. #>
  param([string]$Judul, [string]$Sub, [string]$Nomor)
  $j = Aman-Teks $Judul
  $s = Aman-Teks $Sub
  $bag = @(
    "drawbox=x=196:y=74:w=6:h=60:color=$AKSEN@1:t=fill"
    "drawtext=fontfile='$FONT_B':text='$j':fontsize=52:fontcolor=0x0C1F1A:x=222:y=68"
    "drawtext=fontfile='$FONT_R':text='$s':fontsize=27:fontcolor=0x6C847E:x=224:y=136"
    "drawtext=fontfile='$FONT_M':text='telecare-id.web.app':fontsize=23:fontcolor=0x049A5B:x=1920-tw-248:y=1028"
  )
  if ($Nomor) {
    $n = Aman-Teks $Nomor
    $bag += "drawtext=fontfile='$FONT_M':text='$n':fontsize=23:fontcolor=$AKSEN@0.85:x=248:y=1028"
  }
  return ($bag -join ',')
}

function Buat-Klip {
  <# Satu halaman menjadi satu klip. #>
  param(
    [Parameter(Mandatory)][string]$Gambar,
    [Parameter(Mandatory)][string]$Judul,
    [string]$Sub = '',
    [string]$Nomor = '',
    [double]$Durasi = 3.0,
    [Parameter(Mandatory)][string]$Keluaran
  )
  $bingkai = [int]([Math]::Round($Durasi * $FPS))
  $hias = Rantai-Hias -Judul $Judul -Sub $Sub -Nomor $Nomor
  $graf = @"
[0:v]scale=1920:1080,setsar=1[bg];
[1:v]scale=1424:801:flags=lanczos,setsar=1,pad=1432:809:4:4:color=0xF8FBFA[panel];
color=c=0x96AAA2:s=1432x809:d=$($Durasi):r=$($FPS),format=rgba,
pad=1672:1049:120:120:color=0x00000000,gblur=sigma=48,colorchannelmixer=aa=0.5[glow];
[bg][glow]overlay=x=124:y=76:shortest=1[b1];
[b1][panel]overlay=x=244:y=196:shortest=1[b2];
[b2]$hias,
zoompan=z='min(1.055\,1+0.055*on/$bingkai)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=$FPS,
format=yuv420p[v]
"@
  $gf = Tulis-Graf $graf
  Jalankan-FFmpeg @(
    '-hide_banner', '-y',
    '-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $latar,
    '-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $Gambar,
    '-/filter_complex', $gf, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', "$FPS", '-an', $Keluaran
  ) ("klip " + (Split-Path $Keluaran -Leaf))
  Remove-Item $gf -Force -ErrorAction SilentlyContinue
}

function Buat-KlipVideo {
  <# Klip dari rekaman produk (turntable), dibingkai sama seperti halaman. #>
  param(
    [Parameter(Mandatory)][string]$Sumber,
    [Parameter(Mandatory)][string]$Judul,
    [string]$Sub = '',
    [double]$Durasi = 4.0,
    [Parameter(Mandatory)][string]$Keluaran
  )
  $hias = Rantai-Hias -Judul $Judul -Sub $Sub
  $graf = @"
[0:v]scale=1920:1080,setsar=1[bg];
[1:v]scale=1424:801:flags=lanczos,setsar=1,fps=$FPS,pad=1432:809:4:4:color=0xF8FBFA[panel];
color=c=0x96AAA2:s=1432x809:d=$($Durasi):r=$($FPS),format=rgba,
pad=1672:1049:120:120:color=0x00000000,gblur=sigma=48,colorchannelmixer=aa=0.5[glow];
[bg][glow]overlay=x=124:y=76:shortest=1[b1];
[b1][panel]overlay=x=244:y=196:shortest=1[b2];
[b2]$hias,format=yuv420p[v]
"@
  $gf = Tulis-Graf $graf
  Jalankan-FFmpeg @(
    '-hide_banner', '-y',
    '-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $latar,
    '-stream_loop', '-1', '-t', "$Durasi", '-i', $Sumber,
    '-/filter_complex', $gf, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', "$FPS", '-t', "$Durasi", '-an', $Keluaran
  ) ("klip-video " + (Split-Path $Keluaran -Leaf))
  Remove-Item $gf -Force -ErrorAction SilentlyContinue
}

function Buat-Kartu {
  <# Kartu judul / pembatas bagian. Gambar produk opsional di sisi kanan. #>
  param(
    [Parameter(Mandatory)][string]$Baris1,
    [string]$Baris2 = '',
    [string]$Baris3 = '',
    [string]$Gambar = '',
    [double]$Durasi = 3.0,
    [Parameter(Mandatory)][string]$Keluaran
  )
  $b1 = Aman-Teks $Baris1
  $b2 = Aman-Teks $Baris2
  $b3 = Aman-Teks $Baris3
  $bingkai = [int]([Math]::Round($Durasi * $FPS))
  $xTeks = if ($Gambar) { '180' } else { '(w-tw)/2' }
  $tulis = @(
    "drawtext=fontfile='$FONT_B':text='$b1':fontsize=104:fontcolor=0x0C1F1A:x=$xTeks`:y=392"
    "drawtext=fontfile='$FONT_R':text='$b2':fontsize=40:fontcolor=$AKSEN2@0.95:x=$xTeks`:y=524"
    "drawtext=fontfile='$FONT_M':text='$b3':fontsize=27:fontcolor=0x6C847E:x=$xTeks`:y=596"
    "drawbox=x=$(if ($Gambar) { '180' } else { '(w-520)/2' }):y=356:w=520:h=5:color=$AKSEN@0.9:t=fill"
  ) -join ','
  if ($Gambar) {
    $graf = @"
[0:v]scale=1920:1080,setsar=1[bg];
[1:v]scale=-1:660:flags=lanczos,setsar=1,split=2[ga][gb];
[gb]gblur=sigma=40,colorchannelmixer=aa=0.5[glow];
[bg][glow]overlay=x=W-w-140:y=(H-h)/2:shortest=1[b1];
[b1][ga]overlay=x=W-w-150:y=(H-h)/2:shortest=1[b2];
[b2]$tulis,
zoompan=z='min(1.06\,1+0.06*on/$bingkai)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=$FPS,
format=yuv420p[v]
"@
    $masuk = @('-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $latar,
      '-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $Gambar)
  } else {
    $graf = @"
[0:v]scale=1920:1080,setsar=1,$tulis,
zoompan=z='min(1.06\,1+0.06*on/$bingkai)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=$FPS,
format=yuv420p[v]
"@
    $masuk = @('-loop', '1', '-framerate', "$FPS", '-t', "$Durasi", '-i', $latar)
  }
  $gf = Tulis-Graf $graf
  Jalankan-FFmpeg (@('-hide_banner', '-y') + $masuk + @(
      '-/filter_complex', $gf, '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', "$FPS", '-an', $Keluaran
    )) ("kartu " + (Split-Path $Keluaran -Leaf))
  Remove-Item $gf -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- perangkaian

# Nama sengaja tidak mirip parameter $Transisi: PowerShell tidak peduli besar
# kecil huruf, jadi $TRANSISI dan $Transisi adalah variabel yang sama.
$POLA = @('fade', 'slideleft', 'wipeup', 'circleopen', 'smoothleft', 'fade',
  'pixelize', 'slideup', 'diagtl', 'fade', 'wiperight', 'hlslice',
  'fade', 'radial', 'slideright', 'fade', 'circlecrop', 'smoothup')

function Gabung-Rumpun {
  <#
    Menyambung sederet klip dengan xfade. Dipanggil untuk rumpun kecil (<= 8)
    supaya rangkaian filter tetap pendek; hasil rumpun disambung lagi dengan
    fungsi yang sama. Mengembalikan durasi hasil.
  #>
  param(
    [Parameter(Mandatory)][object[]]$Klip,     # @( @{ berkas; durasi } )
    [Parameter(Mandatory)][string]$Keluaran,
    [double]$Transisi = 0.55,
    [int]$AwalTransisi = 0
  )
  if ($Klip.Count -eq 1) {
    Copy-Item $Klip[0].berkas $Keluaran -Force
    return [double]$Klip[0].durasi
  }
  $baris = New-Object System.Collections.Generic.List[string]
  $masuk = New-Object System.Collections.Generic.List[string]
  foreach ($k in $Klip) { $masuk.Add('-i'); $masuk.Add($k.berkas) }

  $offset = [double]$Klip[0].durasi - $Transisi
  $label = '0:v'
  for ($i = 1; $i -lt $Klip.Count; $i++) {
    $tr = $POLA[($AwalTransisi + $i - 1) % $POLA.Count]
    $keluar = if ($i -eq $Klip.Count - 1) { 'vout' } else { "x$i" }
    $baris.Add(("[{0}][{1}:v]xfade=transition={2}:duration={3}:offset={4}[{5}]" -f
        $label, $i, $tr, $Transisi, [Math]::Round($offset, 3), $keluar))
    $label = $keluar
    if ($i -lt $Klip.Count - 1) { $offset += [double]$Klip[$i].durasi - $Transisi }
  }
  $total = 0.0
  foreach ($k in $Klip) { $total += [double]$k.durasi }
  $total -= ($Klip.Count - 1) * $Transisi

  $gf = Tulis-Graf (($baris -join ";`n") + ";[vout]format=yuv420p[v]")
  Jalankan-FFmpeg (@('-hide_banner', '-y') + $masuk + @(
      '-/filter_complex', $gf, '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', "$FPS", '-an', $Keluaran
    )) ("gabung " + (Split-Path $Keluaran -Leaf))
  Remove-Item $gf -Force -ErrorAction SilentlyContinue
  return $total
}

function Gabung-Semua {
  param(
    [Parameter(Mandatory)][object[]]$Klip,
    [Parameter(Mandatory)][string]$Keluaran,
    [double]$Transisi = 0.55,
    [int]$Rumpun = 7
  )
  if ($Klip.Count -le $Rumpun) {
    return (Gabung-Rumpun -Klip $Klip -Keluaran $Keluaran -Transisi $Transisi)
  }
  $tmpDir = Join-Path $kerja 'rumpun'
  if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null }
  Get-ChildItem $tmpDir -Filter '*.mp4' | Remove-Item -Force -ErrorAction SilentlyContinue

  $hasil = New-Object System.Collections.Generic.List[object]
  $n = 0
  for ($i = 0; $i -lt $Klip.Count; $i += $Rumpun) {
    $n++
    $bagian = $Klip[$i..([Math]::Min($i + $Rumpun - 1, $Klip.Count - 1))]
    $out = Join-Path $tmpDir ('r{0:d2}.mp4' -f $n)
    $d = Gabung-Rumpun -Klip $bagian -Keluaran $out -Transisi $Transisi -AwalTransisi $i
    Write-Host ("  rumpun {0}: {1} klip, {2}s" -f $n, $bagian.Count, [Math]::Round($d, 2))
    $hasil.Add(@{ berkas = $out; durasi = $d })
  }
  return (Gabung-Semua -Klip $hasil.ToArray() -Keluaran $Keluaran -Transisi $Transisi -Rumpun $Rumpun)
}

# ---------------------------------------------------------------- suara

function Buat-Bantalan {
  <#
    Bantalan ambien sintetis. Proyek ini tidak punya aset musik berlisensi,
    jadi nadanya dibangkitkan ffmpeg: tiga nada dasar A2/E3/A3 yang saling
    berdenyut lambat, ditambah desir pink samar sebagai udara. Sengaja pelan
    supaya mudah ditimpa musik sungguhan di CapCut.
  #>
  param([Parameter(Mandatory)][double]$Durasi, [Parameter(Mandatory)][string]$Keluaran)
  $d = [Math]::Round($Durasi, 2)
  $keluar = [Math]::Max(0.1, $d - 2.5)
  $graf = @"
sine=frequency=110:duration=$($d):sample_rate=48000[n1];
sine=frequency=164.81:duration=$($d):sample_rate=48000[n2];
sine=frequency=220:duration=$($d):sample_rate=48000[n3];
sine=frequency=329.63:duration=$($d):sample_rate=48000[n4];
anoisesrc=color=pink:duration=$($d):sample_rate=48000:amplitude=0.35[ds];
[n1]volume=0.30,tremolo=f=0.11:d=0.35[p1];
[n2]volume=0.16,tremolo=f=0.13:d=0.45[p2];
[n3]volume=0.12,tremolo=f=0.16:d=0.40[p3];
[n4]volume=0.05,tremolo=f=0.10:d=0.60[p4];
[ds]highpass=f=900,lowpass=f=7000,volume=0.05[air];
[p1][p2][p3][p4][air]amix=inputs=5:normalize=0,
lowpass=f=1600,
loudnorm=I=-24:TP=-3:LRA=11,
afade=t=in:st=0:d=2.5,afade=t=out:st=$keluar`:d=2.5,
aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000[a]
"@
  $gf = Tulis-Graf $graf
  Jalankan-FFmpeg @('-hide_banner', '-y', '-/filter_complex', $gf, '-map', '[a]',
    '-t', "$d", '-c:a', 'pcm_s16le', $Keluaran) 'bantalan'
  Remove-Item $gf -Force -ErrorAction SilentlyContinue
}

function Selesaikan {
  <# Sentuhan akhir: garis pemindai halus, lalu suara ditempelkan. #>
  param(
    [Parameter(Mandatory)][string]$Video,
    [Parameter(Mandatory)][string]$Suara,
    [Parameter(Mandatory)][string]$Keluaran
  )
  Jalankan-FFmpeg @(
    '-hide_banner', '-y', '-i', $Video, '-i', $Suara,
    '-map', '0:v', '-map', '1:a',
    # tune=stillimage cocok untuk rekaman antarmuka yang sebagian besar diam;
    # tanpa itu berkas jadi dua kali lebih besar tanpa terlihat lebih baik.
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-r', "$FPS",
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest', $Keluaran
  ) ('akhir ' + (Split-Path $Keluaran -Leaf))
}

# ---------------------------------------------------------------- daftar isi

function Cari-Shot {
  param([Parameter(Mandatory)][string]$Nama)
  $f = Get-ChildItem $shot -Filter "*-$Nama.png" | Select-Object -First 1
  if (-not $f) { throw "tangkapan layar '$Nama' tidak ada di $shot" }
  return $f.FullName
}

# Promo: sorotan cepat, keterangan bergaya pemasaran.
$PROMO = @(
  @{ nama = 'landing'; judul = 'TeleCare'; sub = 'Telemedisin dan pemantauan vital dalam satu sistem' }
  @{ nama = 'pasien-home'; judul = 'Vital Setiap Saat'; sub = 'Detak, SpO2, suhu, tekanan darah, dan EKG langsung dari perangkat' }
  @{ nama = 'pasien-vital-hr'; judul = 'Detak Jantung'; sub = 'Tren, rentang normal, dan pembacaan terbaru' }
  @{ nama = 'pasien-vital-bp'; judul = 'Tekanan Darah'; sub = 'Sistolik dan diastolik direkam terpisah' }
  @{ nama = 'pasien-analisis'; judul = 'Analisis'; sub = 'Agregat harian sungguhan, bukan angka acak' }
  @{ nama = 'pasien-riwayat'; judul = 'Riwayat'; sub = 'Setiap sesi tersimpan dan bisa ditinjau ulang' }
  @{ nama = 'pasien-artikel'; judul = 'Edukasi'; sub = 'Bacaan singkat untuk memahami angka sendiri' }
  @{ nama = 'pasien-konsultasi'; judul = 'Cari Dokter'; sub = 'Telusuri nama, spesialisasi, dan status praktik' }
  @{ nama = 'pasien-dokter'; judul = 'Profil Dokter'; sub = 'Verifikasi, jadwal, dan tarif terbuka' }
  @{ nama = 'pasien-chat'; judul = 'Konsultasi Chat'; sub = 'Vital pasien terlampir otomatis di percakapan' }
  @{ nama = 'pasien-call'; judul = 'Panggilan Video'; sub = 'WebRTC dengan dukungan TURN dan diagnostik ICE' }
  @{ nama = 'pasien-jadwal'; judul = 'Janji Temu'; sub = 'Atur jadwal kontrol berikutnya' }
  @{ nama = 'pasien-perangkat'; judul = 'Perangkat AIoT'; sub = 'TeleBand dan TeleRing lewat Bluetooth GATT' }
  @{ nama = 'pasien-kamera'; judul = 'Catat Sesi Makan'; sub = 'Perkiraan respons gula darah setelah makan' }
  @{ nama = 'dokter-klinik'; judul = 'Papan Jaga Dokter'; sub = 'Panggilan masuk berdering dan tampil seketika' }
  @{ nama = 'dokter-antrean'; judul = 'Antrean Konsultasi'; sub = 'Prioritas mengikuti tingkat kegentingan' }
  @{ nama = 'dokter-pasien-detail'; judul = 'Rekam Pasien'; sub = 'Riwayat konsultasi dan catatan klinis' }
  @{ nama = 'faskes-home'; judul = 'Dasbor Faskes'; sub = 'Pemantauan massal untuk perusahaan hingga panti' }
  @{ nama = 'faskes-anggota'; judul = 'Anggota Terpantau'; sub = 'Status kritis, waspada, dan normal per unit' }
  @{ nama = 'faskes-perangkat'; judul = 'Inventaris Perangkat'; sub = 'Baterai dan sinkronisasi seluruh unit' }
  @{ nama = 'admin-sistem'; judul = 'Dasbor Platform'; sub = 'Kesehatan sistem dan pertumbuhan pemakaian' }
  @{ nama = 'admin-pengguna'; judul = 'Kelola Pengguna'; sub = 'Empat peran dengan penjaga rute terpisah' }
  @{ nama = 'admin-dokter'; judul = 'Verifikasi Dokter'; sub = 'Status verifikasi tersimpan, bukan hiasan' }
  @{ nama = 'admin-kalibrasi'; judul = 'Kalibrasi Sensor'; sub = 'Gain dan offset per jenis perangkat untuk pengembang' }
)

# Tutorial: setiap halaman, keterangan berisi langkah yang harus dilakukan.
$TUTORIAL = @(
  @{ bagian = 'Mulai'; b1 = 'Cara Memakai'; b2 = 'TeleCare dari nol sampai konsultasi'; b3 = 'Buka telecare-id.web.app lalu pilih peran' }
  @{ nama = 'landing'; judul = 'Halaman Depan'; sub = 'Tekan Buka Aplikasi untuk masuk ke purwarupa' }

  @{ bagian = 'Peran Pasien'; b1 = 'Pasien'; b2 = 'Memantau tubuh dan berkonsultasi'; b3 = 'Masuk dengan peran Pasien' }
  @{ nama = 'pasien-home'; judul = 'Beranda'; sub = 'Kartu vital di atas, ringkasan hari ini di bawah' }
  @{ nama = 'pasien-vital-hr'; judul = 'Detail Detak Jantung'; sub = 'Ketuk kartu vital untuk melihat tren dan rentang normal' }
  @{ nama = 'pasien-vital-spo2'; judul = 'Detail SpO2'; sub = 'Perhatikan sumber data pada subjudul, simulasi atau sensor' }
  @{ nama = 'pasien-vital-temp'; judul = 'Detail Suhu'; sub = 'Angka merah menandai keluar dari rentang normal' }
  @{ nama = 'pasien-vital-bp'; judul = 'Detail Tekanan Darah'; sub = 'Sistolik dan diastolik punya garis sendiri' }
  @{ nama = 'pasien-analisis'; judul = 'Analisis'; sub = 'Pindah tab untuk melihat tren mingguan dan bulanan' }
  @{ nama = 'pasien-riwayat'; judul = 'Riwayat'; sub = 'Ketuk satu baris untuk membuka ringkasan sesi' }
  @{ nama = 'pasien-notifikasi'; judul = 'Notifikasi'; sub = 'Peringatan vital dan balasan dokter berkumpul di sini' }
  @{ nama = 'pasien-artikel'; judul = 'Artikel'; sub = 'Bacaan pendukung untuk membaca angka sendiri' }
  @{ nama = 'pasien-konsultasi'; judul = 'Cari Dokter'; sub = 'Ketik nama atau pilih spesialisasi pada baris atas' }
  @{ nama = 'pasien-spesialis'; judul = 'Daftar Spesialis'; sub = 'Saring menurut spesialisasi yang dibutuhkan' }
  @{ nama = 'pasien-dokter'; judul = 'Profil Dokter'; sub = 'Pilih Chat atau Panggilan untuk memulai konsultasi' }
  @{ nama = 'pasien-chat'; judul = 'Konsultasi Chat'; sub = 'Lampirkan vital terkini lewat tombol di kolom kiri' }
  @{ nama = 'pasien-call'; judul = 'Panggilan Video'; sub = 'Izinkan kamera dan mikrofon saat diminta peramban' }
  @{ nama = 'pasien-jadwal'; judul = 'Janji Temu'; sub = 'Atur jadwal kontrol berikutnya di sini' }
  @{ nama = 'pasien-perangkat'; judul = 'Perangkat'; sub = 'Lihat baterai, sinyal, dan waktu sinkronisasi terakhir' }
  @{ nama = 'pasien-pindai'; judul = 'Pindai Perangkat'; sub = 'Butuh peramban dengan Web Bluetooth untuk sensor nyata' }
  @{ nama = 'pasien-kamera'; judul = 'Catat Sesi Makan'; sub = 'Ambil foto makanan lalu periksa hasil pengenalannya' }
  @{ nama = 'pasien-profil'; judul = 'Profil'; sub = 'Pusat pengaturan pribadi dan perangkat' }
  @{ nama = 'pasien-pribadi'; judul = 'Data Pribadi'; sub = 'Isi usia, tinggi, dan berat agar target lebih tepat' }
  @{ nama = 'pasien-tujuan'; judul = 'Tujuan Kesehatan'; sub = 'Pilihan tujuan mengubah target gizi harian' }
  @{ nama = 'pasien-kalibrasi'; judul = 'Kalibrasi Tensi'; sub = 'Bandingkan dengan tensimeter lengan lalu simpan koreksinya' }
  @{ nama = 'pasien-pengaturan'; judul = 'Pengaturan'; sub = 'Notifikasi, mode cepat, dan server TURN pilihan sendiri' }
  @{ nama = 'pasien-tentang'; judul = 'Tentang'; sub = 'Batasan purwarupa dan sumber angka acuan dijelaskan' }

  @{ bagian = 'Peran Dokter'; b1 = 'Dokter'; b2 = 'Menerima dan menangani konsultasi'; b3 = 'Masuk dengan peran Dokter' }
  @{ nama = 'dokter-klinik'; judul = 'Papan Jaga'; sub = 'Nyalakan status jaga agar panggilan masuk berdering' }
  @{ nama = 'dokter-antrean'; judul = 'Antrean'; sub = 'Ambil pasien paling genting lebih dulu' }
  @{ nama = 'dokter-pasien'; judul = 'Daftar Pasien'; sub = 'Telusuri pasien yang pernah ditangani' }
  @{ nama = 'dokter-pasien-detail'; judul = 'Detail Pasien'; sub = 'Tulis catatan klinis dan tandai eskalasi bila perlu' }

  @{ bagian = 'Peran Admin Faskes'; b1 = 'Admin Faskes'; b2 = 'Memantau banyak orang sekaligus'; b3 = 'Masuk dengan peran Admin Faskes' }
  @{ nama = 'faskes-home'; judul = 'Dasbor Faskes'; sub = 'Ringkasan status seluruh anggota yang dipantau' }
  @{ nama = 'faskes-anggota'; judul = 'Anggota'; sub = 'Saring menurut unit atau tingkat status' }
  @{ nama = 'faskes-anggota-detail'; judul = 'Detail Anggota'; sub = 'Kirim eskalasi ke dokter langsung dari sini' }
  @{ nama = 'faskes-perangkat'; judul = 'Inventaris'; sub = 'Pantau baterai dan perangkat yang gagal sinkron' }
  @{ nama = 'faskes-nakes'; judul = 'Tenaga Kesehatan'; sub = 'Daftar nakes yang bertugas di faskes ini' }
  @{ nama = 'faskes-laporan'; judul = 'Unduh Laporan'; sub = 'Tombol Laporan menghasilkan CSV sungguhan' ; opsional = $true }

  @{ bagian = 'Peran Admin Platform'; b1 = 'Admin Platform'; b2 = 'Mengelola sistem dan sensor'; b3 = 'Masuk dengan peran Admin Platform' }
  @{ nama = 'admin-sistem'; judul = 'Dasbor Platform'; sub = 'Kesehatan layanan dan pemakaian menyeluruh' }
  @{ nama = 'admin-pengguna'; judul = 'Kelola Pengguna'; sub = 'Ubah peran dan tinjau akun yang terdaftar' }
  @{ nama = 'admin-dokter'; judul = 'Verifikasi Dokter'; sub = 'Tekan Verifikasi lalu status tersimpan permanen' }
  @{ nama = 'admin-faskes-kelola'; judul = 'Kelola Faskes'; sub = 'Tinjau faskes beserta jumlah anggotanya' }
  @{ nama = 'admin-kalibrasi'; judul = 'Kalibrasi Sensor'; sub = 'Setel gain dan offset tiap parameter per jenis perangkat' }
  @{ nama = 'admin-kalibrasi'; judul = 'Kalibrasi Dua Titik'; sub = 'Masukkan dua pasang nilai acuan lalu biarkan sistem menghitung' }

  @{ bagian = 'Selesai'; b1 = 'Selesai'; b2 = 'Purwarupa terbuka untuk dicoba'; b3 = 'telecare-id.web.app' }
)

# ---------------------------------------------------------------- promo

function Bangun-Promo {
  Write-Host '=== membangun video promo ==='
  $klip = New-Object System.Collections.Generic.List[object]

  $intro = Join-Path $klipDir 'promo-00-intro.mp4'
  if (-not $LewatiKlip -or -not (Test-Path $intro)) {
    Buat-Kartu -Baris1 'TeleCare' -Baris2 'Telemedisin dan pemantauan vital' `
      -Baris3 'Purwarupa terbuka - telecare-id.web.app' `
      -Gambar (Join-Path $akar 'assets\img\render-hero-duo.png') -Durasi 3.6 -Keluaran $intro
  }
  $klip.Add(@{ berkas = $intro; durasi = 3.6 })

  $produk = Join-Path $klipDir 'promo-01-produk.mp4'
  if (-not $LewatiKlip -or -not (Test-Path $produk)) {
    Buat-KlipVideo -Sumber (Join-Path $akar 'assets\video\telecare-product.mp4') `
      -Judul 'TeleBand dan TeleRing' -Sub 'Sensor multiparameter yang mengirim data ke aplikasi' `
      -Durasi 4.0 -Keluaran $produk
  }
  $klip.Add(@{ berkas = $produk; durasi = 4.0 })

  $n = 1
  foreach ($h in $PROMO) {
    $n++
    $out = Join-Path $klipDir ('promo-{0:d2}-{1}.mp4' -f $n, $h.nama)
    if (-not $LewatiKlip -or -not (Test-Path $out)) {
      Buat-Klip -Gambar (Cari-Shot $h.nama) -Judul $h.judul -Sub $h.sub -Durasi 3.0 -Keluaran $out
    }
    $klip.Add(@{ berkas = $out; durasi = 3.0 })
    Write-Host ("  klip promo {0,-24}" -f $h.nama)
  }

  $outro = Join-Path $klipDir 'promo-99-outro.mp4'
  if (-not $LewatiKlip -or -not (Test-Path $outro)) {
    Buat-Kartu -Baris1 'Coba Sekarang' -Baris2 'telecare-id.web.app' `
      -Baris3 'Empat peran - satu tautan - tanpa pemasangan' -Durasi 3.6 -Keluaran $outro
  }
  $klip.Add(@{ berkas = $outro; durasi = 3.6 })

  $kasar = Join-Path $kerja 'promo-kasar.mp4'
  $durasi = Gabung-Semua -Klip $klip.ToArray() -Keluaran $kasar -Transisi 0.55
  Write-Host ("  durasi promo -> {0}s" -f [Math]::Round($durasi, 2))

  $suara = Join-Path $kerja 'promo-bed.wav'
  Buat-Bantalan -Durasi $durasi -Keluaran $suara
  $akhir = Join-Path $akar 'assets\video\telecare-promo.mp4'
  Selesaikan -Video $kasar -Suara $suara -Keluaran $akhir
  Write-Host "promo selesai -> $akhir"
}

# ---------------------------------------------------------------- tutorial

function Bangun-Tutorial {
  Write-Host '=== membangun video tutorial ==='
  $klip = New-Object System.Collections.Generic.List[object]
  $n = 0
  $langkah = 0
  foreach ($h in $TUTORIAL) {
    if ($h.opsional -and -not (Get-ChildItem $shot -Filter "*-$($h.nama).png" -ErrorAction SilentlyContinue)) { continue }
    $n++
    if ($h.bagian) {
      $out = Join-Path $klipDir ('tut-{0:d2}-bagian.mp4' -f $n)
      if (-not $LewatiKlip -or -not (Test-Path $out)) {
        Buat-Kartu -Baris1 $h.b1 -Baris2 $h.b2 -Baris3 $h.b3 -Durasi 3.2 -Keluaran $out
      }
      $klip.Add(@{ berkas = $out; durasi = 3.2 })
      Write-Host ("  kartu tutorial {0}" -f $h.b1)
    } else {
      $langkah++
      $out = Join-Path $klipDir ('tut-{0:d2}-{1}.mp4' -f $n, $h.nama)
      if (-not $LewatiKlip -or -not (Test-Path $out)) {
        Buat-Klip -Gambar (Cari-Shot $h.nama) -Judul $h.judul -Sub $h.sub `
          -Nomor ('LANGKAH {0:d2}' -f $langkah) -Durasi 4.0 -Keluaran $out
      }
      $klip.Add(@{ berkas = $out; durasi = 4.0 })
      Write-Host ("  klip tutorial {0,-24}" -f $h.nama)
    }
  }
  $kasar = Join-Path $kerja 'tutorial-kasar.mp4'
  $durasi = Gabung-Semua -Klip $klip.ToArray() -Keluaran $kasar -Transisi 0.4
  Write-Host ("  durasi tutorial -> {0}s" -f [Math]::Round($durasi, 2))

  $suara = Join-Path $kerja 'tutorial-bed.wav'
  Buat-Bantalan -Durasi $durasi -Keluaran $suara
  $akhir = Join-Path $akar 'assets\video\telecare-tutorial.mp4'
  Selesaikan -Video $kasar -Suara $suara -Keluaran $akhir
  Write-Host "tutorial selesai -> $akhir"
}

if ($Video -eq 'promo' -or $Video -eq 'semua') { Bangun-Promo }
if ($Video -eq 'tutorial' -or $Video -eq 'semua') { Bangun-Tutorial }
Write-Host 'beres'
