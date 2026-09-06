<#
  Membuat dua draft CapCut yang bisa disunting lebih lanjut, memakai klip
  per-halaman yang sama dengan yang dipakai ffmpeg.

    TeleCare Promo      27 klip
    TeleCare Tutorial   46 klip

  Kenapa dipisah dari ffmpeg: capcut-cli TIDAK merender video final. Ia hanya
  membuat dan menyunting draft CapCut. Jadi MP4 siap pakai dibuat ffmpeg, dan
  draft ini disediakan supaya musik, sulih suara, atau transisi bisa dipoles
  lewat CapCut GUI.

  Sengaja TIDAK memakai `capcut bundle`: sampai versi 0.17.2 perintah itu
  menuliskan device_id, mac_address, dan hard_disk_id ke dalam draft.

  Menjalankan:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\bangun-capcut.ps1
#>
param(
  [switch]$Bersihkan   # hapus draft lama bernama sama sebelum membuat ulang
)

$ErrorActionPreference = 'Stop'
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$akar = Split-Path $PSScriptRoot -Parent
$klipDir = Join-Path $akar 'build\video\klip'
$draftRoot = Join-Path $env:LOCALAPPDATA 'CapCut\User Data\Projects\com.lveditor.draft'
if (-not (Test-Path $draftRoot)) { throw "direktori draft CapCut tidak ada: $draftRoot" }

# capcut dipanggil lewat berkas index.js-nya, bukan lewat nama perintah:
# PowerShell tidak peduli besar kecil huruf, jadi fungsi bernama Capcut yang
# memanggil `capcut` akan memanggil dirinya sendiri sampai tumpukan penuh.
$script:CapcutJs = "$env:ProgramFiles\nodejs\node_modules\capcut-cli\dist\index.js"
if (-not (Test-Path $script:CapcutJs)) { throw "capcut-cli tidak ditemukan di $script:CapcutJs" }

function Panggil-Capcut {
  param([Parameter(ValueFromRemainingArguments)][string[]]$Argumen)
  # capcut menulis petunjuk ke stderr meski berhasil. Dengan
  # ErrorActionPreference = Stop, baris stderr itu menjadi galat yang
  # menghentikan skrip, jadi dilonggarkan hanya selama pemanggilan.
  $lama = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $keluaran = & node $script:CapcutJs @Argumen 2>&1
  $kode = $LASTEXITCODE
  $ErrorActionPreference = $lama
  if ($kode -ne 0) {
    throw ("capcut " + ($Argumen -join ' ') + " gagal: " + ($keluaran -join ' '))
  }
  return ($keluaran -join "`n")
}

function Bangun-Draft {
  param(
    [Parameter(Mandatory)][string]$Nama,
    [Parameter(Mandatory)][string]$Pola,
    [Parameter(Mandatory)][double]$DurasiBawaan,
    [hashtable]$DurasiKhusus = @{}
  )
  $dir = Join-Path $draftRoot $Nama
  if ($Bersihkan -and (Test-Path $dir)) {
    Write-Host "menghapus draft lama $Nama"
    Remove-Item $dir -Recurse -Force
  }
  if (Test-Path $dir) { throw "draft '$Nama' sudah ada. Jalankan ulang dengan -Bersihkan." }

  Panggil-Capcut init $Nama | Out-Null
  Write-Host "draft dibuat: $dir"

  $klip = Get-ChildItem $klipDir -Filter $Pola | Sort-Object Name
  if ($klip.Count -eq 0) { throw "tidak ada klip yang cocok '$Pola' di $klipDir" }

  $mulai = 0.0
  foreach ($k in $klip) {
    $d = $DurasiBawaan
    foreach ($kunci in $DurasiKhusus.Keys) { if ($k.Name -like $kunci) { $d = [double]$DurasiKhusus[$kunci] } }
    # Tanpa "-q": PowerShell menyangka itu nama parameter fungsi lalu menunggu
    # masukan, dan skrip menggantung tanpa pesan apa pun.
    Panggil-Capcut add-video $dir $k.FullName ("{0}s" -f [Math]::Round($mulai, 3)) ("{0}s" -f $d) | Out-Null
    $mulai += $d
  }
  Write-Host ("  {0} klip ditambahkan, panjang kasar {1}s" -f $klip.Count, [Math]::Round($mulai, 1))

  $lint = Panggil-Capcut lint $dir --fix
  Write-Host "  lint: $lint"
  return $dir
}

$promo = Bangun-Draft -Nama 'TeleCare Promo' -Pola 'promo-*.mp4' -DurasiBawaan 3.0 `
  -DurasiKhusus @{ 'promo-00-*' = 3.6; 'promo-01-*' = 4.0; 'promo-99-*' = 3.6 }

$tutorial = Bangun-Draft -Nama 'TeleCare Tutorial' -Pola 'tut-*.mp4' -DurasiBawaan 4.0 `
  -DurasiKhusus @{ '*-bagian.mp4' = 3.2 }

Write-Host ''
Write-Host 'Dua draft siap dibuka di CapCut:'
Write-Host "  $promo"
Write-Host "  $tutorial"
Write-Host 'Langkah lanjut di CapCut GUI: tambahkan musik, atur transisi, lalu Export.'
