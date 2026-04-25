@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Whiteboard Downloader GUI Launcher
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Install Node.js 20.x or 22.x LTS from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not available.
    echo Reinstall Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [INFO] Running GUI bootstrap...
call npm run bootstrap:gui
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Bootstrap failed. Please follow the on-screen next step.
    pause
    exit /b 1
)

echo [INFO] Checking configuration...
node dist\cli.js doctor --config-only >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Setup is missing or invalid. Launching setup wizard...
    node dist\cli.js setup
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Setup failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting GUI...
call npm run gui
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The GUI encountered an error.
    pause
    exit /b 1
)

endlocal
