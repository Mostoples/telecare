$ProgressPreference = 'SilentlyContinue'
$daftar = @(
  'app/js/app.js', 'app/js/core.js', 'app/js/data.js', 'app/js/engine.js',
  'app/js/views-auth.js', 'app/js/views-home.js', 'app/js/views-roles.js',
  'app/index.html', 'app/sw.js'
)
$baris = foreach ($x in $daftar) {
  $lokal = (Get-FileHash -Algorithm SHA256 (Join-Path (Split-Path $PSScriptRoot -Parent) $x)).Hash
  $tmp = Join-Path $env:TEMP 'cek-deploy.tmp'
  Invoke-WebRequest -Uri "https://telecare-id.web.app/$x" -OutFile $tmp -UseBasicParsing
  $jauh = (Get-FileHash -Algorithm SHA256 $tmp).Hash
  '{0,-22} {1}' -f (Split-Path $x -Leaf), $(if ($lokal -eq $jauh) { 'SAMA' } else { 'BEDA' })
}
$keluaran = Join-Path $env:TEMP 'cek-deploy.txt'
$baris | Set-Content -Encoding utf8 $keluaran
Write-Host "selesai -> $keluaran"
