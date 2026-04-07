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
echo "[INFO] Detected Node.js version: $NODE_VERSION"

# Extract major version number
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')

# Check if version is too new (v24+)
if [ "$NODE_MAJOR" -ge 24 ]; then
    echo "[WARNING] Node.js v$NODE_MAJOR detected - this version may cause compatibility issues!"
    echo "[WARNING] Recommended: Node.js v20.x or v22.x LTS"
    echo "[WARNING] If you encounter errors, please downgrade to an LTS version."
    echo ""
fi

# Check if version is too old (<v18)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "[ERROR] Node.js v$NODE_MAJOR detected - this project requires Node.js v18 or higher"
    echo "Please upgrade Node.js from https://nodejs.org/"
    echo "Recommended: Node.js v20.x or v22.x LTS"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[WARNING] node_modules not found - dependencies may not be installed"
    echo "[INFO] Please run 'npm install' first, then try again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

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

# Check if .env exists and has real credentials; if not, run setup
if [ ! -f ".env" ]; then
    echo "[INFO] No .env file found - launching setup wizard..."
    echo ""
    node dist/cli.js setup
    if [ $? -ne 0 ]; then
        echo "[ERROR] Setup failed."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo ""
else
    # Check if BB_USERNAME is set to something other than the placeholder
    if ! grep -qP "^BB_USERNAME=(?!your_g_number|\$).+" .env 2>/dev/null && \
       ! grep -qE "^BB_USERNAME=[^$].+" .env 2>/dev/null; then
        echo "[INFO] Credentials not configured - launching setup wizard..."
        echo ""
        node dist/cli.js setup
        if [ $? -ne 0 ]; then
            echo "[ERROR] Setup failed."
            read -p "Press Enter to exit..."
            exit 1
        fi
        echo ""
    fi
fi

node dist/cli.js download

# Keep terminal open if there's an error
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] The application encountered an error."
    read -p "Press Enter to exit..."
fi
