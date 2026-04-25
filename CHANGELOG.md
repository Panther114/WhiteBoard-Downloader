# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.2] - 2026-04-25

### Added
- Added desktop GUI workflow (Electron + React) covering setup, diagnostics, course selection, file selection, download progress, and summary.
- Added GUI launchers: `start-gui.bat`, `start-gui.ps1`, `start-gui.sh`.
- Added shared workflow controller/events layer reused by CLI/TUI and GUI.

### Changed
- Normal interactive mode now discovers and displays all courses before user selection.
- Course filtering is no longer silently applied to normal interactive course selection.
- Version corrected to `0.8.2` in package metadata, CLI, and user-facing docs.

### Preserved
- Existing TUI workflow remains available.
- Strict document allowlist behavior remains unchanged.

## [2.3.0] - 2026-04-17

### Added
- **Dynamic file extension detection** — `downloadFile()` now validates the filename extension against the `Content-Type` MIME header. If they disagree (e.g. a file named `Slides` served as `application/pdf`), the MIME-derived extension is appended or corrected. Full HTTP header details are logged at `debug` level.
- **Debug HTML dump** — new `dumpPageStructure()` helper writes the full `#content_listContainer` HTML and an anchor-tag summary to `logs/debug-<timestamp>-<label>.html` when `LOG_LEVEL=debug`, making it easy to diagnose missing files and incorrect link classification.
- **Media file exclusion** — audio/video files (`mp4`, `mp3`, `mov`, `avi`, `mkv`, `wmv`, `webm`, `flv`, `wav`, `aac`, `ogg`, `m4a`, `m4v`) are blocked at both discovery time (by URL extension) and metadata time (by MIME type). They never appear in the download list.
- **JSON file-tree cache** (`file_tree.json`) — mirrors Blackboard's course / section / folder hierarchy. Replaces the per-run `fs.existsSync` scan with O(1) in-memory lookups. The tree is updated after each successful download and saved atomically. On first run, the existing download directory is scanned to build the initial tree (migration path for existing users). Configurable via `FILE_TREE_PATH` in `.env`.
- **`markAllPendingAsFailed()` in `DownloadDatabase`** — on startup, records stuck in `pending` status from a previous interrupted run are reset to `failed` so they appear in the retry queue.
- **Log rotation** — the Winston file transport now rotates at 5 MB and keeps 3 rotated log files, preventing `whiteboard.log` from growing indefinitely.

### Changed
- **Scraping speed** — replaced `waitUntil: 'networkidle'` with `'domcontentloaded'` in `navigateTo()`, `goBack()`, and `returnToHome()`. Blackboard pages with analytics widgets can add 5–30 seconds of idle-wait; `domcontentloaded` eliminates this overhead.
- **HEAD request timeout** reduced from 10 s to 5 s (`HEAD_REQUEST_TIMEOUT_MS`) — most servers respond in < 1 s.
- **Default `MAX_CONCURRENT_DOWNLOADS`** increased from 5 to 8 in `.env.example`.
- **`fetchMetadata()` now parses `Content-Disposition`** — the real server-side filename is resolved during the metadata phase (before the TUI) so the file-selection list shows actual filenames rather than Blackboard display text.
- **`downloadAll()` backward-compat method** now calls `fetchFileMetadata()` before the download loop so files downloaded via this code path also get proper MIME/size info.

### Fixed
- **Non-file link filtering** — expanded `NAV_HREF_PATTERNS` with 13 additional Blackboard tool/page URL fragments (`execute/courseMain`, `execute/announcement`, `execute/blti`, etc.). Added a safe-list for `execute/` URLs: ambiguous links that pass existing heuristics but sit under `execute/` are now rejected unless they also match `/bbcswebdav/` or a known file extension.
- **`parseContentDisposition()` regex** — tightened the unquoted `filename=` match from `/filename=([^;]+)/i` to `/filename=([^;\r\n"]+)/i` to avoid capturing trailing semicolons.
- **`discoverFolder()` depth guard message** — changed "stack overflow" to "infinite loops on circular course structures" which accurately describes the guard's purpose.
- **Missing `#content_listContainer` debug log** — now includes the page URL and `<title>` to identify unexpected pages.
- **`sanitizeFilename()` trailing-dot behaviour** — added documentation comment explaining the intentional `.replace(/[.\s]+$/, '')` behaviour.
- **`filterAlreadyDownloaded()` scope** — added documentation comment clarifying that the check is scoped to `file.savePath` (full directory path) so same-name files in different courses are handled correctly.

## [2.2.0] - 2026-04-07

### Added
- **Filesystem duplicate filter** — after fetching file metadata and before displaying the file-selection TUI, the downloads folder is scanned automatically. Files whose name (or sanitized name) already exist on disk are excluded from the list entirely. The count of skipped-on-disk files is shown in the post-run summary as "On disk".
- **File list sorted by size** — within each course/section group in the interactive file-selection TUI, files are now ranked largest-to-smallest so the biggest downloads are immediately visible.

### Changed
- **Single aggregate progress bar** — the per-file `MultiBar` display has been replaced by a single `SingleBar` that shows: overall percentage, completed/total file count, cumulative bytes downloaded vs. expected total, live download speed (updated every second), and built-in ETA. Failed and skipped files are counted but do not block the overall progress.
- **Simplified setup wizard** — the `setup` command no longer asks "Install Playwright browsers? (y/n)". Playwright Chromium is always installed automatically after saving credentials, removing one interactive prompt from the first-time flow.

### Fixed
- Single failed download correctly does not abort the overall batch. `pRetry` exhausts retries, the error is caught and logged, and `Promise.all` continues with the remaining files. (Pre-existing behaviour; confirmed correct — no code change required.)

## [2.1.0] - 2026-04-07

### Added
- **Course Selection GUI** — after logging in, all discovered course links are shown in an interactive Inquirer checkbox list (all pre-selected). The user unchecks unwanted courses before any scraping begins. The `--all` flag skips this GUI along with the file-selection GUI.
- `WhiteboardDownloader.getCourses()` public method — exposes the course list so the CLI can present it before starting the full discovery pass.
- `WhiteboardDownloader.discoverAllFiles(courses?)` now accepts an optional pre-filtered `Course[]` array; when omitted the method falls back to fetching all courses (backward-compatible).

### Changed
- `discoverAllFiles()` now accepts an optional `courses` parameter to skip re-fetching the course list when the caller already has it.

### Performance
- `BlackboardScraper.getCourses()`: replaced per-element `getAttribute()` loop with a single `page.$$eval()` call — O(N) Playwright RPC round-trips reduced to O(1).
- `BlackboardScraper.getSidebarLinks()`: same batch-eval optimisation; also avoids a nested `.locator('span').first()` call per element.
- `BlackboardScraper.getDownloadableFiles()`: seven separate locator passes consolidated into one `$$eval` that extracts `href`, `target`, `textContent`, `.attachments` membership, and `.details` membership for every anchor in `#content_listContainer` simultaneously.
- `BlackboardScraper.getSubfolders()`: per-element loop replaced with a single `$$eval`.

### Fixed
- `tsconfig.json`: changed `moduleResolution` from `"node10"` to `"node"` (and kept `ignoreDeprecations: "5.0"`) to resolve TypeScript 5.9 build error (`TS5107`).

## [2.0.0] - 2026-04-06

### Added
- Complete rewrite in TypeScript with modern architecture
- Playwright browser automation (replacing Selenium)
- Concurrent downloads with configurable limits
- SQLite database for download tracking and resume capability
- Automatic retry with exponential backoff
- Beautiful CLI with Inquirer and Chalk
- Comprehensive logging with Winston
- Docker and Docker Compose support
- Environment-based configuration with Zod validation
- Course filtering with regex patterns
- Progress indicators and statistics
- Type-safe codebase with full TypeScript coverage

### Changed
- Migrated from Python to Node.js/TypeScript
- Replaced Selenium + ChromeDriver with Playwright
- Changed from sequential to concurrent downloads
- Replaced tkinter GUI with CLI interface
- Improved error handling and logging
- Enhanced file naming and sanitization
- Better configuration management

### Removed
- Python implementation (moved to legacy/ folder)
- tkinter GUI
- Manual ChromeDriver management
- Hardcoded configuration values

### Fixed
- SSL/TLS compatibility issues (handled by modern libraries)
- File naming edge cases
- Session timeout issues
- Duplicate download prevention

### Security
- Credentials now stored in .env file (not in code)
- Better input validation with Zod
- Sanitized file paths to prevent directory traversal

## [0.3.6] - 2024-XX-XX (Legacy)

### Added
- Initial Python implementation
- Selenium-based browser automation
- Basic download functionality
- tkinter GUI for credentials

### Known Issues
- Requires specific old versions of requests and urllib3
- Sequential downloads only
- No resume capability
- Hardcoded configuration

---

## PR #2 — Download Progress GUI, Setup Wizard, and Single-Credential Storage

### What changed

#### GUI — Per-file download progress display
- Added `cli-progress` dependency for multi-bar terminal progress display
- `FileDownloader` now extends `EventEmitter` and emits five events during each download:
  - `download:start` — file added to active queue
  - `download:progress` — bytes received / total bytes (from `Content-Length` header)
  - `download:complete` — file written, final size known
  - `download:error` — download failed
  - `download:skip` — file already in database, skipped
- `WhiteboardDownloader` extends `EventEmitter` and re-emits all `FileDownloader` events, giving the CLI a single observable entry point
- The `download` command now renders a live multi-bar display showing:
  - Per-file progress bar, percentage, downloaded bytes, and total size
  - A summary table (completed / failed / skipped) on completion
- The `ora` spinner is still used for the initialization phase (browser launch + login)

#### Setup wizard (`whiteboard-dl setup` / `npm run setup`)
- New `setup` CLI command guides users through first-time configuration interactively
- Prompts for G-Number, password, download directory, and optional Playwright browser installation
- Writes (or updates) a `.env` file — the single source of truth for credentials
- `npm run setup` convenience script added to `package.json`
- Launcher scripts (`start.bat`, `start.ps1`, `start.sh`) now detect missing or unconfigured `.env` and automatically launch the setup wizard before starting downloads

#### Single credential entry
- Users previously had to edit `.env.example` → `.env` **and** re-enter credentials at the CLI prompt
- Now: the `setup` wizard writes credentials to `.env` once; all subsequent runs read from `.env` without prompting
- If a user still runs `download` without a `.env`, they are prompted for credentials **once** and offered the option to save them to `.env` for future runs

### What was NOT changed
- Core download logic (retry, concurrency, file writing) — unchanged
- Auth module — unchanged
- Database schema and tracking — unchanged
- File naming and sanitization — unchanged
- Configuration schema (Zod validation) — unchanged
- Docker configuration — unchanged

### Notes / Risks
- `FileDownloader` now extends `EventEmitter`; this is additive and fully backward-compatible
- Progress percentages are exact when the server returns a `Content-Length` header; otherwise the bar shows `?` for total size
- The `setup` command calls `execSync('npx playwright install chromium')` — this requires internet access; failure is handled gracefully with a warning
- Credentials written to `.env` are protected by the existing `.gitignore` entry

---


### What changed
- **Fixed invalid course URL construction**: Course URLs with leading/trailing whitespace and relative paths are now properly trimmed and constructed with the full base domain
- **Added Node.js version validation**: All launcher scripts (start.bat, start.ps1, start.sh) now check Node.js version and warn if v24+ is detected (incompatible) or error if <v18
- **Added node_modules existence check**: Launchers verify dependencies are installed before running
- **Enhanced debug logging throughout codebase**:
  - Added URL extraction logging in scraper (getCourses, getSidebarLinks, getSubfolders)
  - Added navigation logging in auth module with URL tracking at each step
  - Added file discovery logging in getDownloadableFiles
  - Added cookie retrieval logging
  - All logs include current page URL for troubleshooting
- **Updated package.json engines**: Explicitly excludes Node.js v24+ (`>=18.0.0 <24.0.0`) and requires npm >=8.0.0
- **Comprehensive README updates**:
  - Added dedicated troubleshooting section for better-sqlite3 module version mismatch
  - Added troubleshooting for C++ compilation errors
  - Enhanced Prerequisites section with explicit Node.js compatibility warnings
  - Added step-by-step solutions for common installation issues
- **Created FEATURES.md**: Comprehensive feature documentation with completed/planned features and v0.x vs v2.0 comparison

### What was NOT changed
- Core download logic and retry mechanisms remain unchanged
- Database schema and tracking logic unchanged
- CLI interface and user interaction flows unchanged
- Docker configuration unchanged
- Configuration schema (Zod validation) unchanged
- File naming and sanitization logic unchanged
- Existing logging levels and Winston configuration unchanged (only added more log calls)

### Notes / Risks
- **Assumptions**:
  - The URL construction bug affected all courses because HTML `href` attributes contained leading/trailing whitespace from the Blackboard HTML
  - Node.js v24+ incompatibility is due to better-sqlite3 requiring C++20 which isn't widely supported yet
  - Debug logging overhead is negligible for normal use; users can set `LOG_LEVEL=info` to reduce verbosity
- **Limitations**:
  - Node.js version check only warns for v24+ but doesn't prevent running (user can proceed at own risk)
  - Debug logs may contain sensitive URLs but not credentials (username is masked to first 3 chars)
- **Follow-ups**:
  - Monitor for Blackboard HTML structure changes that might affect selectors
  - Consider adding automatic HTML snapshot capture on errors for easier debugging
  - May need to update better-sqlite3 or find alternatives when Node.js v24+ becomes LTS
