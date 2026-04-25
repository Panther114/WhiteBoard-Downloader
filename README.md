# WhiteBoard Downloader

A Blackboard downloader for students that keeps the interactive checkbox selection flow and adds a one-click setup/start path.

## Normal user path (GitHub Releases ZIP)

1. Download the ZIP from **GitHub Releases**.
2. Unzip it.
3. Double-click one launcher in the project folder:
   - `start.bat` (Windows)
   - `start.ps1` (Windows PowerShell)
   - `start.sh` (macOS/Linux)
4. The launcher now automatically:
   - checks Node/npm compatibility,
   - installs dependencies,
   - builds if needed,
   - installs Playwright Chromium,
   - runs setup if config is missing/invalid,
   - launches download.
5. Enter Blackboard credentials once in setup.
6. Select courses/files in the existing interactive checkbox prompts.
7. On future runs, click the same launcher again.

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

- `npm run bootstrap` – local bootstrap/install/build/browser setup helper
- `npm run setup` or `node dist/cli.js setup` – setup wizard
- `node dist/cli.js setup --reset` – recreate config from scratch
- `node dist/cli.js setup --test-login` – save config then test Blackboard login
- `node dist/cli.js download` – interactive download flow
- `node dist/cli.js doctor` – environment and config checks
- `node dist/cli.js doctor --login` – includes a real login test
- `node dist/cli.js config` – print current effective config

## Strict document allowlist

Only these file types are accepted:
- `pdf`, `ppt`, `pptx`, `doc`, `docx`, `xls`, `xlsx`

Extension normalization behavior:
- Keeps valid supported extension if already present.
- Appends extension from MIME when name has no supported extension (example: `download` + `application/pdf` -> `download.pdf`).
- Rejects unsupported extensions.

## Reports and logs

After each run:
- Text summary: `logs/latest-summary.txt`
- JSON summary: `<DOWNLOAD_DIR>/whiteboard-run-report.json`
- Main logs: `logs/whiteboard.log`

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
