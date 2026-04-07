# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
