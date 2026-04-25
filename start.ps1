Write-Host "========================================"
Write-Host "  Whiteboard Downloader Launcher"
Write-Host "========================================"
Write-Host ""
Set-Location -Path $PSScriptRoot

try {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js detected: $nodeVersion"
} catch {
    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    Write-Host "Install Node.js 20.x or 22.x LTS from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "[INFO] npm detected: $npmVersion"
} catch {
    Write-Host "[ERROR] npm is not available." -ForegroundColor Red
    Write-Host "Reinstall Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] Running bootstrap..."
npm run bootstrap
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Bootstrap failed. Please follow the on-screen next step." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] Checking configuration..."
node dist\cli.js config-check --quiet *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[INFO] Setup is missing or invalid. Launching setup wizard..." -ForegroundColor Yellow
    node dist\cli.js setup
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Setup failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[INFO] Starting downloader..." -ForegroundColor Green
node dist\cli.js download
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] The application encountered an error." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
