#!/bin/bash
# Whiteboard Downloader - macOS/Linux Launcher
# Make this file executable: chmod +x start.sh
# Then double-click or run: ./start.sh

echo "========================================"
echo "  Whiteboard Downloader Launcher"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "[INFO] Node.js version: $NODE_VERSION"

# Check if dist folder exists (project is built)
if [ ! -f "dist/cli.js" ]; then
    echo "[INFO] Project not built yet. Building..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "[ERROR] Build failed. Please run 'npm install' first."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Run the downloader
echo "[INFO] Starting Whiteboard Downloader..."
echo ""
node dist/cli.js download

# Keep terminal open if there's an error
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] The application encountered an error."
    read -p "Press Enter to exit..."
fi
