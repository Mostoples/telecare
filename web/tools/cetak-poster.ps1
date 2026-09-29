<#
  Mencetak poster TeleCare (promosi/poster.html, A2 potret) menjadi:
    promosi/telecare-poster.pdf   vektor, siap cetak
    promosi/telecare-poster.png   3174 x 4490 px (2x), untuk media sosial/pratinjau
    promosi/telecare-poster.webp  1587 x 2245 px, untuk web
    promosi/telecare-deck.pdf     deck 13 slide 16:9 (promosi/deck/)

  Prasyarat: server lokal hidup (python tools/serve.py 8950).
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\cetak-poster.ps1
#>
param([string]$Basis = 'http://127.0.0.1:8950')

. (Join-Path $PSScriptRoot 'uji-browser.ps1')
$akar = Split-Path $PSScriptRoot -Parent
$url = "$Basis/promosi/poster.html"
$pdf = Join-Path $akar 'promosi\telecare-poster.pdf'
$png = Join-Path $akar 'promosi\telecare-poster.png'

function Jalankan-Sekali([string[]]$FlagKhusus, [string]$Label, [int]$BatasDetik = 90) {
  $prof = New-ProfilSementara -Label $Label
  try {
    $flag = ((Get-FlagDasar $prof) | Where-Object { $_ -ne '--disable-sync' }) + $FlagKhusus
    $bo = Join-Path $env:TEMP ('tc-cetak-o-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $be = Join-Path $env:TEMP ('tc-cetak-e-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $p = Start-Process -FilePath $script:PeramabanUji -ArgumentList ($flag + @($url)) `
                       -RedirectStandardOutput $bo -RedirectStandardError $be -PassThru
    if (-not $p.WaitForExit($BatasDetik * 1000)) { taskkill /PID $p.Id /T /F 2>$null | Out-Null; Start-Sleep -Milliseconds 600 }
    Remove-Item $bo, $be -Force -ErrorAction SilentlyContinue
  } finally {
    Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Remove-Item $pdf, $png -Force -ErrorAction SilentlyContinue
# waktu virtual memberi kesempatan font & gambar selesai dimuat
Jalankan-Sekali @('--no-pdf-header-footer', '--virtual-time-budget=8000', "--print-to-pdf=$pdf") 'poster-pdf'
Jalankan-Sekali @('--window-size=1587,2245', '--hide-scrollbars', '--force-device-scale-factor=2',
                  '--virtual-time-budget=8000', "--screenshot=$png") 'poster-png'

# deck: aturan @media print di deck.html menjadikan tiap slide satu halaman 1920x1080
$url = "$Basis/promosi/deck/"
$deckPdf = Join-Path $akar 'promosi\telecare-deck.pdf'
Remove-Item $deckPdf -Force -ErrorAction SilentlyContinue
Jalankan-Sekali @('--no-pdf-header-footer', '--virtual-time-budget=8000', "--print-to-pdf=$deckPdf") 'deck-pdf'

foreach ($f in @($pdf, $png, $deckPdf)) {
  $n = if (Test-Path $f) { (Get-Item $f).Length } else { 0 }
  Write-Host ('{0,-24} {1,10:N0} bytes' -f (Split-Path $f -Leaf), $n)
}
