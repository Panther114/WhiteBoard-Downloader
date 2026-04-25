#!/bin/bash

set +e

echo "========================================"
echo "  Whiteboard Downloader Launcher"
echo "========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed."
  echo "Install Node.js 20.x or 22.x LTS from https://nodejs.org/"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not available."
  echo "Reinstall Node.js from https://nodejs.org/"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "[INFO] Running bootstrap..."
npm run bootstrap
if [ $? -ne 0 ]; then
  echo ""
  echo "[ERROR] Bootstrap failed. Please follow the on-screen next step."
  read -p "Press Enter to exit..."
  exit 1
fi

echo "[INFO] Checking configuration..."
node dist/cli.js doctor --config-only >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "[INFO] Setup is missing or invalid. Launching setup wizard..."
  node dist/cli.js setup
  if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Setup failed."
    read -p "Press Enter to exit..."
    exit 1
  fi
fi

echo "[INFO] Starting downloader..."
node dist/cli.js download
if [ $? -ne 0 ]; then
  echo ""
  echo "[ERROR] The application encountered an error."
  read -p "Press Enter to exit..."
  exit 1
fi
