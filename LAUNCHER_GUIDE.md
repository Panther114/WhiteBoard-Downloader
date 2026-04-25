# Launcher Guide

Use one launcher as your normal entrypoint:

- `start.bat` (Windows)
- `start.ps1` (Windows PowerShell)
- `start.sh` (macOS/Linux)
- `start-gui.bat` / `start-gui.ps1` / `start-gui.sh` (desktop GUI)

Each launcher now automatically runs bootstrap + setup checks before starting download.

## Desktop shortcut tips

### Windows
- Right-click `start.bat` -> Send to -> Desktop (create shortcut)

### macOS/Linux
- Make executable once:
  ```bash
  chmod +x start.sh
  ```
- Then run `./start.sh` or create your own desktop/app shortcut to it.

## Troubleshooting launcher execution

- Windows PowerShell execution policy issue:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- macOS unidentified developer warning: right-click -> Open.
- Linux double-click behavior: set file manager to execute scripts.
