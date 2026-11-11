$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root ".runtime"
$envFile = Join-Path $root ".env"

if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process") }
  }
}

foreach ($name in @("api", "worker", "web")) {
  $pidFile = Join-Path $runtime "$name.pid"
  $processId = if (Test-Path -LiteralPath $pidFile) { [int](Get-Content -LiteralPath $pidFile -Raw) } else { 0 }
  $running = $processId -gt 0 -and $null -ne (Get-Process -Id $processId -ErrorAction SilentlyContinue)
  [pscustomobject]@{ Service = $name; ProcessId = $processId; Running = $running }
}

$apiPort = if ($env:PORT) { $env:PORT } else { "4301" }
$webPort = if ($env:POP_WEB_PORT) { $env:POP_WEB_PORT } else { "4300" }
foreach ($target in @("http://127.0.0.1:$apiPort/api/v1/health", "http://127.0.0.1:$webPort")) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $target -TimeoutSec 3
    Write-Host "$target -> $($response.StatusCode)"
  } catch {
    Write-Host "$target -> unavailable"
  }
}
