# Technical Documentation

## Entry points

- `scripts/bootstrap.js`: shared bootstrap logic used by launchers (`npm run bootstrap`)
- `src/cli.ts`: commands (`setup`, `download`, `doctor`, `config`)

## Setup and launch flow

1. Launcher checks Node/npm availability.
2. Launcher runs `npm run bootstrap`.
3. Launcher runs `node dist/cli.js doctor --config-only`.
4. If config check fails, launcher runs `node dist/cli.js setup`.
5. Launcher runs `node dist/cli.js download`.

## Setup wizard options

- Credentials: `BB_USERNAME`, `BB_PASSWORD`
- Download directory: `DOWNLOAD_DIR`
- Course filtering mode:
  - normal subject courses
  - phrase match
  - regex
- Include non-subject courses: `INCLUDE_NON_SUBJECT_COURSES`
- Browser mode: `HEADLESS`
- Supports `--reset` and optional login test (`--test-login`)

## Doctor checks

- Node version range (`>=18`, `<24`)
- npm availability
- dependencies/build presence
- Playwright Chromium presence
- `.env` and credential validity
- writable download/log/database directories
- Blackboard URL reachability (non-config-only mode)
- optional real login test (`doctor --login`)

## File type and extension handling

- Canonical supported types live in `src/utils/fileType.ts`
- MIME-to-extension mapping normalizes names lacking valid suffixes
- Unsupported extensions are rejected
- Validation remains strict via `src/utils/fileValidation.ts`

## User-facing errors and reports

- Friendly error mapping: `src/utils/userErrors.ts`
- Run summary files:
  - `logs/latest-summary.txt`
  - `<DOWNLOAD_DIR>/whiteboard-run-report.json`
