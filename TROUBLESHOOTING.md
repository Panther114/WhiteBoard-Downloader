# Troubleshooting

## Node not installed

**Symptom:** launcher says Node.js is missing.

**Fix:** install Node.js LTS from https://nodejs.org/ (20.x or 22.x), then run launcher again.

## Node too old

**Symptom:** version <18 error.

**Fix:** upgrade to Node.js 20.x or 22.x LTS.

## Node too new (v24 unsupported)

**Symptom:** unsupported/too-new Node message.

**Fix:** switch to Node.js 20.x or 22.x LTS and rerun launcher.

## npm install failed

**Symptom:** bootstrap fails during dependency install.

**Fix:** run:

```bash
npm install
```

Then run launcher again.

If a previous install failed part-way, just rerun the launcher. Bootstrap now detects incomplete `node_modules` and reinstalls automatically.

## GUI/Electron install failed (ECONNRESET / network reset)

**Symptom:** `start-gui` fails during Electron postinstall with errors like `RequestError: read ECONNRESET`.

**Why:** Electron binary download is network/CDN-sensitive.

**Fix:**
1. Enable VPN or switch to a more stable network.
2. Delete `node_modules` (if present) and rerun `start-gui`.
3. Optionally set `ELECTRON_MIRROR` if your environment documents a reachable mirror.
4. Use TUI launcher (`start.bat` / `start.ps1` / `start.sh`) as a lighter fallback path.

## First run feels slow

**Symptom:** first launch takes noticeably longer.

**Why:** dependencies, TypeScript build output, and Playwright Chromium may need to install.

**Fix:** wait for first run to finish; later runs are faster.

TUI mode is lighter because GUI/Electron dependencies are skipped unless you use `start-gui`.

## Playwright install failed

**Symptom:** bootstrap fails at browser install.

**Fix:** run:

```bash
npx playwright install chromium
```

Then rerun launcher.

## Login failed

**Symptom:** setup test login or download login fails.

**Fix:**
1. Run `node dist/cli.js setup --reset`
2. Re-enter Blackboard credentials
3. Try visible mode (`HEADLESS=false`) for debugging

## Blackboard unreachable

**Symptom:** network/timeout errors, doctor reachability warnings.

**Fix:** verify internet, VPN/firewall/proxy, and Blackboard site availability. Retry later if Blackboard is down.

## No courses found

**Symptom:** downloader shows no courses.

**Fix:**
1. Check Blackboard account access in browser.
2. Re-run setup and confirm credentials.
3. Use `node dist/cli.js doctor --login`.

## No files found

**Symptom:** courses load but no downloadable files.

**Fix:** selected sections may not contain allowed document types (pdf/ppt/pptx/doc/docx/xls/xlsx).

## Progress percentage looks different from file count

**Symptom:** percent does not match completed-files ratio exactly.

**Why:** when file sizes are known, progress percentage is byte-based; file count is shown separately.

**Fallback:** if sizes are unknown, progress switches to labeled file-count mode.

## Permission denied for download folder

**Symptom:** EACCES/permission denied on download/log/db paths.

**Fix:** choose a writable folder in setup and rerun.

## How to find logs

- Main log: `logs/whiteboard.log`
- Latest run summary: `logs/latest-summary.txt`
- JSON run report: `<DOWNLOAD_DIR>/whiteboard-run-report.json`
