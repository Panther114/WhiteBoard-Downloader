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
2. Re-run setup and adjust course filtering.
3. Use `node dist/cli.js doctor --login`.

## No files found

**Symptom:** courses load but no downloadable files.

**Fix:** selected sections may not contain allowed document types (pdf/ppt/pptx/doc/docx/xls/xlsx).

## Permission denied for download folder

**Symptom:** EACCES/permission denied on download/log/db paths.

**Fix:** choose a writable folder in setup and rerun.

## How to find logs

- Main log: `logs/whiteboard.log`
- Latest run summary: `logs/latest-summary.txt`
- JSON run report: `<DOWNLOAD_DIR>/whiteboard-run-report.json`
