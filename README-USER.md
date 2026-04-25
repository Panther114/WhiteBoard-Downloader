# WhiteBoard Downloader (Student Quick Guide)

## First run

1. Download the project ZIP from GitHub Releases.
2. Unzip it.
3. Double-click:
   - **Windows:** `start.bat` (or `start.ps1`)
   - **macOS/Linux:** `start.sh`
4. Follow setup prompts:
   - Blackboard username / G-number
   - Blackboard password
   - Download folder
5. Select courses and files in the checkbox screens.

## Where files go

By default: `./downloads` inside the unzipped folder.
You can change this in setup.

## Run again later

Use the same launcher file again. Setup is reused automatically.

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
