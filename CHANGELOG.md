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

## PR #1 — Node.js Compatibility and URL Construction Bug Fixes

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
