# Whiteboard Downloader - PowerShell Launcher
# Right-click and select "Run with PowerShell" to start the downloader

Write-Host "========================================"
Write-Host "  Whiteboard Downloader Launcher"
Write-Host "========================================"
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js version: $nodeVersion"
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dist folder exists (project is built)
if (-Not (Test-Path "dist\cli.js")) {
    Write-Host "[INFO] Project not built yet. Building..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed. Please run 'npm install' first." -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Run the downloader
Write-Host "[INFO] Starting Whiteboard Downloader..." -ForegroundColor Green
Write-Host ""
node dist\cli.js download

# Keep window open if there's an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] The application encountered an error." -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
