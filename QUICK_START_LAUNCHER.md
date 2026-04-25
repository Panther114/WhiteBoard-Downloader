# Quick Start: One-Click Launcher

You now use one launcher file for both first-time setup and later runs.

## Steps

1. Install Node.js LTS (20.x or 22.x).
2. Double-click:
   - `start.bat` (Windows)
   - `start.ps1` (Windows PowerShell)
   - `start.sh` (macOS/Linux)
3. The launcher automatically performs bootstrap, setup (if needed), and download start.

## What the launcher does

1. Checks Node/npm
2. Runs `npm run bootstrap`
3. Validates config (`doctor --config-only`)
4. Runs setup wizard if config is missing/invalid
5. Starts interactive download flow

## Need help?

See `README-USER.md` and `TROUBLESHOOTING.md`.
