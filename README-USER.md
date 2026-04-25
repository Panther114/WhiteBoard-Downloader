# WhiteBoard Downloader (Student Quick Guide)

## First run

Before starting, install Node.js **20.x or 22.x LTS** manually (`24.x` is not supported).

1. Download the project ZIP from GitHub Releases.
2. Unzip it.
3. Double-click:
    - **Windows:** `start.bat` (or `start.ps1`)
    - **macOS/Linux:** `start.sh`
   - **Optional GUI launchers:** `start-gui.bat` / `start-gui.ps1` / `start-gui.sh`
4. Follow setup prompts:
   - Blackboard username / G-number
   - Blackboard password
   - Download folder
5. Select courses and files in the checkbox screens (TUI) or GUI screens.

> First run may take extra time while dependencies, build output, and Playwright Chromium are prepared.

## Where files go

By default: `./downloads` inside the unzipped folder.
You can change this in setup.

## Run again later

Use the same launcher file again. Setup is reused automatically.

During downloads, percentage is byte-based when sizes are known; file count remains visible as secondary progress.

## Reset setup

Run:

```bash
node dist/cli.js setup --reset
```

## Run health checks

```bash
node dist/cli.js doctor
node dist/cli.js doctor --login
```

## If something fails

Open `TROUBLESHOOTING.md` and share `logs/whiteboard.log` + `logs/latest-summary.txt` when asking for help.
