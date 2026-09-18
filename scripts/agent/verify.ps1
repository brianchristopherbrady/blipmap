#!/usr/bin/env pwsh
# blipmap full verification: type-check -> tests -> production build
# Used by QA agent and CI. Stops on first failure.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root

try {
    Write-Host "`n=== blipmap verification ===" -ForegroundColor Cyan

    Write-Host "`n[1/3] Type check..." -ForegroundColor Yellow
    npx tsc --noEmit --skipLibCheck
    if ($LASTEXITCODE -ne 0) { throw "Type check failed" }

    Write-Host "`n[2/3] Unit tests..." -ForegroundColor Yellow
    npm test -- --run
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed" }

    Write-Host "`n[3/3] Production build..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    Write-Host "`n=== All checks passed ===" -ForegroundColor Green
} finally {
    Pop-Location
}
