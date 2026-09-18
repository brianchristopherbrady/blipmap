#!/usr/bin/env pwsh
# Install blipmap agent tooling prerequisites:
#   - verifies Python 3 (required for PreToolUse / PostToolUse hooks)
#   - installs npm dependencies
#   - installs Playwright Chromium (required for browser QA smoke test)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root

try {
    Write-Host "`n=== blipmap agent setup ===" -ForegroundColor Cyan

    # Python 3 — required by hook scripts
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host ""
        Write-Host "ERROR: Python 3 is required for agent lifecycle hooks." -ForegroundColor Red
        Write-Host "Install:  winget install Python.Python.3" -ForegroundColor Yellow
        exit 1
    }
    $pyVer = & python --version
    Write-Host "✓ $pyVer" -ForegroundColor Green

    # Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host ""
        Write-Host "ERROR: Node.js is required. Install: https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Node $(node --version)" -ForegroundColor Green

    # npm install
    if (Test-Path "package.json") {
        Write-Host "`nInstalling npm dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }

    # Playwright Chromium — required by browser-qa smoke test
    Write-Host "`nInstalling Playwright Chromium..." -ForegroundColor Yellow
    npx playwright install chromium --with-deps
    if ($LASTEXITCODE -ne 0) { throw "Playwright install failed" }

    Write-Host "`n=== Setup complete. Agent tooling is ready. ===" -ForegroundColor Green
} finally {
    Pop-Location
}
