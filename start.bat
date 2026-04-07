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
node dist\cli.js download

REM Keep window open if there's an error
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The application encountered an error.
    pause
)
