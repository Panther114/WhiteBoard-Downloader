@echo off
REM Whiteboard Downloader - Windows Launcher
REM Double-click this file to start the downloader

echo ========================================
echo   Whiteboard Downloader Launcher
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Detected Node.js version: %NODE_VERSION%

REM Extract major version number (remove 'v' prefix and get first number)
set NODE_VERSION_NUM=%NODE_VERSION:~1%
for /f "delims=." %%a in ("%NODE_VERSION_NUM%") do set NODE_MAJOR=%%a

REM Check if version is too new (v24+) or too old (<v18)
if %NODE_MAJOR% GEQ 24 (
    echo [WARNING] Node.js v%NODE_MAJOR% detected - this version may cause compatibility issues!
    echo [WARNING] Recommended: Node.js v20.x or v22.x LTS
    echo [WARNING] If you encounter errors, please downgrade to an LTS version.
    echo.
)

if %NODE_MAJOR% LSS 18 (
    echo [ERROR] Node.js v%NODE_MAJOR% detected - this project requires Node.js v18 or higher
    echo Please upgrade Node.js from https://nodejs.org/
    echo Recommended: Node.js v20.x or v22.x LTS
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [WARNING] node_modules not found - dependencies may not be installed
    echo [INFO] Please run 'npm install' first, then try again.
    echo.
    pause
    exit /b 1
)

REM Check if dist folder exists (project is built)
if not exist "dist\cli.js" (
    echo [INFO] Project not built yet. Building...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed. Please run 'npm install' first.
        echo.
        pause
        exit /b 1
    )
)

REM Run the downloader
echo [INFO] Starting Whiteboard Downloader...
echo.

REM Check if .env exists and has credentials; if not, run setup
if not exist ".env" (
    echo [INFO] No .env file found - launching setup wizard...
    echo.
    node dist\cli.js setup
    if %errorlevel% neq 0 (
        echo [ERROR] Setup failed.
        pause
        exit /b 1
    )
    echo.
) else (
    findstr /C:"BB_USERNAME=" .env | findstr /V /C:"BB_USERNAME=your_g_number" | findstr /V /C:"BB_USERNAME=$" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [INFO] Credentials not configured - launching setup wizard...
        echo.
        node dist\cli.js setup
        if %errorlevel% neq 0 (
            echo [ERROR] Setup failed.
            pause
            exit /b 1
        )
        echo.
    )
)

node dist\cli.js download

REM Keep window open if there's an error
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The application encountered an error.
    pause
)
