$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root ".runtime"

if (-not (Test-Path -LiteralPath $runtime)) { exit 0 }
Get-ChildItem -LiteralPath $runtime -Filter "*.pid" | ForEach-Object {
  $processId = [int](Get-Content -LiteralPath $_.FullName -Raw)
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) { Stop-Process -Id $processId }
  Remove-Item -LiteralPath $_.FullName -Force
}
Write-Host "Stopped PoP processes recorded in $runtime"
