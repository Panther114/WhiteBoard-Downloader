# Whiteboard Downloader - PowerShell Launcher
# Right-click and select "Run with PowerShell" to start the downloader

Write-Host "========================================"
Write-Host "  Whiteboard Downloader Launcher"
Write-Host "========================================"
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[INFO] Detected Node.js version: $nodeVersion"

    # Extract major version number
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')

    # Check if version is too new (v24+)
    if ($nodeMajor -ge 24) {
        Write-Host "[WARNING] Node.js v$nodeMajor detected - this version may cause compatibility issues!" -ForegroundColor Yellow
        Write-Host "[WARNING] Recommended: Node.js v20.x or v22.x LTS" -ForegroundColor Yellow
        Write-Host "[WARNING] If you encounter errors, please downgrade to an LTS version." -ForegroundColor Yellow
        Write-Host ""
    }

    # Check if version is too old (<v18)
    if ($nodeMajor -lt 18) {
        Write-Host "[ERROR] Node.js v$nodeMajor detected - this project requires Node.js v18 or higher" -ForegroundColor Red
        Write-Host "Please upgrade Node.js from https://nodejs.org/"
        Write-Host "Recommended: Node.js v20.x or v22.x LTS"
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "[WARNING] node_modules not found - dependencies may not be installed" -ForegroundColor Yellow
    Write-Host "[INFO] Please run 'npm install' first, then try again."
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

# Check if .env exists and has credentials; if not, run setup
if (-Not (Test-Path ".env")) {
    Write-Host "[INFO] No .env file found - launching setup wizard..." -ForegroundColor Yellow
    Write-Host ""
    node dist\cli.js setup
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Setup failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
} else {
    $envContent = Get-Content ".env" -Raw
    if (-Not ($envContent -match "BB_USERNAME=(?!your_g_number|`$).+")) {
        Write-Host "[INFO] Credentials not configured - launching setup wizard..." -ForegroundColor Yellow
        Write-Host ""
        node dist\cli.js setup
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Setup failed." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host ""
    }
}

node dist\cli.js download

# Keep window open if there's an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] The application encountered an error." -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
