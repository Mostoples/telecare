<#
  Pembantu pengujian peramban headless.

  ALASAN BERKAS INI ADA
  Cara yang naif — `Get-Process chrome | Stop-Process -Force` — mematikan
  SELURUH proses peramban, termasuk tab yang sedang dipakai pemilik komputer.
  Itu pernah terjadi dan tidak boleh terulang. Berkas ini memaksa tiga hal:

    1. Memakai Edge secara bawaan, bukan Chrome yang biasa dipakai sehari-hari.
    2. Selalu memakai profil sementara terpisah, jadi profil asli tak tersentuh.
    3. Hanya menghentikan proses yang dijalankan sendiri, lewat PID-nya —
       tidak pernah berdasarkan nama proses.

  PEMAKAIAN
    . tools\uji-browser.ps1

    # Ambil DOM setelah halaman selesai memuat (proses keluar sendiri)
    $dom = Ambil-Dom -Url 'http://127.0.0.1:8920/app/#/home'

    # Tangkap layar
    Ambil-Layar -Url '...' -Keluaran "$env:TEMP\a.png" -Lebar 1280 -Tinggi 860

    # Instance yang harus tetap hidup (mis. dua sisi panggilan)
    $p = Jalankan-Latar -Url '...' -Label 'dokter'
    ...
    Hentikan-Latar $p
#>

$script:PeramabanUji = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $script:PeramabanUji) {
  throw 'Edge tidak ditemukan. Setel $script:PeramabanUji ke peramban berbasis Chromium lain.'
}

function Get-FlagDasar {
  param([string]$Profil)
  @(
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    "--user-data-dir=$Profil"
  )
}

function New-ProfilSementara {
  param([string]$Label = 'uji')
  $p = Join-Path $env:TEMP ("tc-$Label-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
  return $p
}

<#
  Memuat halaman lalu mengembalikan DOM-nya.

  Memakai batas waktu dinding yang keras, bukan hanya --virtual-time-budget.
  Alasannya nyata: halaman dengan timer yang terus berjalan (denyut vital,
  animasi EKG, denyut papan jaga) membuat instance headless kadang tidak
  pernah keluar sendiri, dan pemanggilan berulang menumpuk sampai puluhan
  proses. Di sini keluarannya dialihkan ke berkas, prosesnya ditunggu dengan
  batas waktu, lalu dihentikan lewat PID-nya sendiri apa pun yang terjadi.
#>
function Ambil-Dom {
  param(
    [Parameter(Mandatory)][string]$Url,
    [int]$DurasiMs = 9000,
    [string]$Label = 'dom',
    [string[]]$FlagTambahan = @(),
    [int]$BatasDetik = 0
  )
  if ($BatasDetik -le 0) { $BatasDetik = [int]($DurasiMs / 1000) + 12 }

  $prof = New-ProfilSementara -Label $Label
  $keluaran = Join-Path $env:TEMP ("tc-dom-" + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.html')
  try {
    $flag = (Get-FlagDasar $prof) + @("--virtual-time-budget=$DurasiMs", '--dump-dom') + $FlagTambahan
    $p = Start-Process -FilePath $script:PeramabanUji -ArgumentList ($flag + @($Url)) `
                       -RedirectStandardOutput $keluaran -RedirectStandardError 'NUL' -PassThru
    if (-not $p.WaitForExit($BatasDetik * 1000)) {
      taskkill /PID $p.Id /T /F 2>$null | Out-Null
      Start-Sleep -Milliseconds 500
    }
    if (Test-Path $keluaran) { return (Get-Content $keluaran -Raw -ErrorAction SilentlyContinue) }
    return ''
  } finally {
    Remove-Item $keluaran -Force -ErrorAction SilentlyContinue
    Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
  }
}

<#
  Menangkap layar halaman ke berkas PNG.

  Sama seperti Ambil-Dom: prosesnya dijalankan sendiri lalu dihentikan lewat
  PID-nya bila melewati batas waktu. Halaman TeleCare punya timer yang tak
  pernah berhenti (EKG, denyut vital), jadi menunggu prosesnya keluar sendiri
  tidak bisa diandalkan.
#>
function Ambil-Layar {
  param(
    [Parameter(Mandatory)][string]$Url,
    [Parameter(Mandatory)][string]$Keluaran,
    [int]$Lebar = 1280,
    [int]$Tinggi = 860,
    [int]$DurasiMs = 6000,
    [string]$Label = 'shot',
    [string[]]$FlagTambahan = @(),
    [int]$BatasDetik = 0
  )
  if ($BatasDetik -le 0) { $BatasDetik = [int]($DurasiMs / 1000) + 12 }
  $prof = New-ProfilSementara -Label $Label
  Remove-Item $Keluaran -Force -ErrorAction SilentlyContinue
  try {
    # --disable-sync membuat Edge di mesin ini keluar tanpa pernah menulis
    # berkas PNG (terbukti lewat bisect flag), jadi khusus tangkapan layar
    # flag itu dibuang. Untuk --dump-dom flag tersebut tetap aman.
    $flag = ((Get-FlagDasar $prof) | Where-Object { $_ -ne '--disable-sync' }) + @(
      "--window-size=$Lebar,$Tinggi",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--virtual-time-budget=$DurasiMs",
      "--screenshot=$Keluaran"
    ) + $FlagTambahan
    # RedirectStandardOutput dan RedirectStandardError tidak boleh menunjuk
    # berkas yang sama, jadi dua berkas buangan terpisah.
    $bo = Join-Path $env:TEMP ('tc-shot-o-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $be = Join-Path $env:TEMP ('tc-shot-e-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $p = Start-Process -FilePath $script:PeramabanUji -ArgumentList ($flag + @($Url)) `
                       -RedirectStandardOutput $bo -RedirectStandardError $be -PassThru
    if (-not $p.WaitForExit($BatasDetik * 1000)) {
      taskkill /PID $p.Id /T /F 2>$null | Out-Null
      Start-Sleep -Milliseconds 600
    }
    Remove-Item $bo, $be -Force -ErrorAction SilentlyContinue
    return (Test-Path $Keluaran)
  } finally {
    Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
  }
}

<#
  Menjalankan instance yang harus tetap hidup. Mengembalikan objek berisi
  PID dan lokasi profilnya, untuk diserahkan ke Hentikan-Latar.
#>
function Jalankan-Latar {
  param(
    [Parameter(Mandatory)][string]$Url,
    [string]$Label = 'latar',
    [string[]]$FlagTambahan = @()
  )
  $prof = New-ProfilSementara -Label $Label
  $flag = (Get-FlagDasar $prof) + $FlagTambahan
  $p = Start-Process -FilePath $script:PeramabanUji -ArgumentList ($flag + @($Url)) -PassThru
  return [pscustomobject]@{ Proses = $p; Id = $p.Id; Profil = $prof; Label = $Label }
}

<#
  Menghentikan HANYA proses yang dijalankan Jalankan-Latar, beserta anak-anaknya.
  taskkill /T menutup seluruh pohon proses peramban tanpa menyentuh instance lain.
#>
function Hentikan-Latar {
  param([Parameter(Mandatory)]$Instance)
  if ($null -eq $Instance) { return }
  taskkill /PID $Instance.Id /T /F 2>$null | Out-Null
  Start-Sleep -Milliseconds 600
  Remove-Item $Instance.Profil -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output "peramban uji: $script:PeramabanUji"
