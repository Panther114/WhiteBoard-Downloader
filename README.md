# BlackboardChina Downloader v0.8.3

This application is provided solely for educational, personal, and technical purposes. By using this application, you acknowledge and agree that you are solely responsible for ensuring that your use complies with all applicable SHSID policies, platform terms, laws, and regulations.

The developer does not endorse, encourage, or authorize any misuse of this application, including any use that violates school policies, platform rules, or legal requirements. To the maximum extent permitted by applicable law, the developer disclaims all responsibility and liability for any misuse of the application, any violation committed by users, and any direct or indirect consequences resulting from such use.

## Normal user path (GitHub Releases ZIP)

Requires Node.js **20.x or 22.x LTS** installed manually (`24.x` is not supported).

1. Download the ZIP from **GitHub Releases**.
2. Unzip it.
3. Double-click one launcher in the project folder:
   - `start-gui.bat` (Windows)
   - `start-guui.sh` (macOS/Linux)
   - Optional TUI launchers: `start.bat` / `start.sh`
4. The launcher now automatically:
   - checks Node/npm compatibility,
   - installs dependencies (TUI launchers use lightweight bootstrap without GUI/Electron packages),
   - builds if needed,
   - installs Playwright Chromium,
   - runs setup if config is missing/invalid,
   - launches download.
   - (first run may take longer while dependencies/build/Playwright install complete)
   - if install is interrupted, rerunning launcher repairs incomplete `node_modules`
5. Enter Blackboard credentials once in setup.
6. Select courses/files in TUI/GUI checkboxes.
7. On future runs, double-click the same launcher again.

See [README-USER.md](README-USER.md) for short student instructions.

## Developer path

```bash
git clone https://github.com/Panther114/WhiteBoard-Downloader.git
cd WhiteBoard-Downloader
npm install
npm run build
npm start download
```

## Commands

- `npm run bootstrap` – TUI bootstrap (installs required non-GUI dependencies, builds CLI, installs Playwright Chromium)
- `npm run bootstrap:gui` – GUI bootstrap (installs full GUI stack including Electron, builds CLI+GUI, installs Playwright Chromium)
- `npm run setup` or `node dist/cli.js setup` – setup wizard
- `node dist/cli.js setup --reset` – recreate config from scratch
- `node dist/cli.js setup --test-login` – save config then test Blackboard login (blank password keeps existing saved password)
- `node dist/cli.js config-check` – launcher-focused setup validity check
- `node dist/cli.js download` – interactive download flow
- `node dist/cli.js doctor` – environment and config checks
- `node dist/cli.js doctor --login` – includes a real login test
- `node dist/cli.js config` – print current effective config
- `npm run gui` – launch desktop GUI (no rebuild)
- `npm run gui:dev` – GUI development mode
- `npm run build:gui` – build CLI + GUI bundles

## Strict document allowlist

Only these file types are accepted:
- `pdf`, `ppt`, `pptx`, `doc`, `docx`, `xls`, `xlsx`

Extension normalization behavior:
- Keeps valid supported extension if already present.
- Appends extension from MIME when name has no supported extension (example: `download` + `application/pdf` -> `download.pdf`).
- Rejects blocked extensions (archive/image/media/text/data) even when MIME claims a supported document.
- Replaces Blackboard-ish unknown extensions with MIME-derived supported extensions when MIME is supported (example: `download.aspx` + PDF MIME -> `download.pdf`).

## Progress display

- Download progress percentage is byte-based when file sizes are known.
- File count remains visible as secondary progress.
- If no known sizes are available, progress falls back to clearly labeled file-count mode.

## Reports and logs

After each run:
- Text summary: `logs/latest-summary.txt`
- JSON summary: `<DOWNLOAD_DIR>/whiteboard-run-report.json`
- Main logs: `logs/whiteboard.log`

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
