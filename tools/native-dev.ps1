param(
  [switch]$SkipMigrations,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root ".runtime"
$envFile = Join-Path $root ".env"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Create $envFile from .env.example before starting PoP."
}

Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}

if (-not (Get-Command pg_isready -ErrorAction SilentlyContinue)) {
  throw "Native PostgreSQL is required. Install PostgreSQL 17 and add its bin directory to PATH."
}

& pg_isready -d $env:DATABASE_URL | Out-Null
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL is not accepting connections for DATABASE_URL." }

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
if (-not $SkipMigrations) { & npm run db:deploy; if ($LASTEXITCODE -ne 0) { throw "Database migration failed." } }
if (-not $SkipSeed) { & npm run db:seed; if ($LASTEXITCODE -ne 0) { throw "Database seed failed." } }
$webPort = if ($env:POP_WEB_PORT) { $env:POP_WEB_PORT } else { "4300" }

$services = @(
  @{ Name = "api"; Arguments = @("--workspace", "@pop/api", "run", "dev") },
  @{ Name = "worker"; Arguments = @("--workspace", "@pop/worker", "run", "dev") },
  @{ Name = "web"; Arguments = @("--workspace", "@pop/web", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", $webPort) }
)

foreach ($service in $services) {
  $pidFile = Join-Path $runtime "$($service.Name).pid"
  if (Test-Path -LiteralPath $pidFile) {
    $oldPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) { continue }
  }
  $log = Join-Path $runtime "$($service.Name).log"
  $errorLog = Join-Path $runtime "$($service.Name).error.log"
  $process = Start-Process -FilePath "npm.cmd" -ArgumentList $service.Arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii
}

Write-Host "PoP is starting at http://127.0.0.1:$webPort"
Write-Host "Run npm run local:status for process and health details."
