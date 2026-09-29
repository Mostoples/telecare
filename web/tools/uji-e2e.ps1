<#
  Menjalankan uji ujung-ke-ujung (tests/e2e.html) dan mencetak hasilnya.

  PRASYARAT: server lokal hidup —  python tools\serve.py 8950

  Kenapa tidak memakai Ambil-Dom (--dump-dom)?
  Ambil-Dom memakai --virtual-time-budget, yang mempercepat timer tetapi
  TIDAK mempercepat jaringan. Suite ini menunggu Firebase sungguhan, jadi di
  sana hasilnya bisa menipu. Di sini peramban berjalan dalam waktu nyata dan
  halaman uji melapor lewat POST ke /__hasil-uji (lihat tools/serve.py).

  Keluaran: kode keluar 0 bila semua lulus, 1 bila ada yang gagal/macet.
#>
param(
  [string]$Basis = 'http://127.0.0.1:8950',
  [int]$BatasDetik = 600
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. .\tools\uji-browser.ps1 | Out-Null

$berkas = Join-Path (Get-Location) 'build\e2e-hasil.json'
Remove-Item $berkas -Force -ErrorAction SilentlyContinue

$flag = @(
  '--window-size=1400,1000',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required'
)
$inst = Jalankan-Latar -Url "$Basis/tests/e2e.html" -Label 'e2e' -FlagTambahan $flag
Write-Output "e2e berjalan (PID $($inst.Id)), batas $BatasDetik detik…"

function Baca-Hasil {
  if (-not (Test-Path $berkas)) { return $null }
  try { return (Get-Content $berkas -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

$t0 = Get-Date
$hasil = $null
try {
  while ($true) {
    $hasil = Baca-Hasil
    if ($hasil -and $hasil.selesai) { break }
    if (((Get-Date) - $t0).TotalSeconds -gt $BatasDetik) {
      Write-Output 'MACET: suite tidak selesai sebelum batas waktu. Laporan terakhir:'
      if ($hasil) { foreach ($c in $hasil.catatan) { Write-Output $c.pesan } }
      else { Write-Output '(halaman uji tidak pernah melapor — server mati atau halaman gagal dimuat?)' }
      exit 1
    }
    Start-Sleep -Seconds 2
  }
} finally {
  Hentikan-Latar $inst
}
$detik = [int]((Get-Date) - $t0).TotalSeconds
foreach ($c in $hasil.catatan) { Write-Output $c.pesan }
Write-Output "(selesai dalam $detik detik)"
if ($hasil.macet -or $hasil.gagal -gt 0) { exit 1 }
exit 0
