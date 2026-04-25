#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "========================================"
echo "  BlackboardChina Downloader Launcher"
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
if ! npm run bootstrap; then
  echo ""
  echo "[ERROR] Bootstrap failed. Please follow the on-screen next step."
  read -p "Press Enter to exit..."
  exit 1
fi

echo "[INFO] Checking configuration..."
if ! node dist/cli.js config-check --quiet >/dev/null 2>&1; then
  echo "[INFO] Setup is missing or invalid. Launching setup wizard..."
  if ! node dist/cli.js setup; then
    echo ""
    echo "[ERROR] Setup failed."
    read -p "Press Enter to exit..."
    exit 1
  fi
fi

echo "[INFO] Starting downloader..."
if ! node dist/cli.js download; then
  echo ""
  echo "[ERROR] The application encountered an error."
  read -p "Press Enter to exit..."
  exit 1
fi
