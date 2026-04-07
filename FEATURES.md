# Whiteboard Downloader Features

This document outlines all features implemented in the Whiteboard Downloader v2.0.

## ✅ Completed Features

### Core Functionality
- [x] **Automatic Authentication** - Handles Blackboard China login with credentials
- [x] **Course Discovery** - Automatically detects and lists all available courses
- [x] **Recursive Navigation** - Traverses course structure including nested folders
- [x] **File Downloads** - Downloads all course materials (documents, PDFs, videos, etc.)
- [x] **Smart File Naming** - Extracts proper filenames from Content-Disposition headers
- [x] **Folder Structure Preservation** - Maintains Blackboard's original folder hierarchy

### Download Management
- [x] **Concurrent Downloads** - Download multiple files simultaneously (configurable limit)
- [x] **Automatic Retry** - Retries failed downloads with exponential backoff
- [x] **Resume Capability** - SQLite database tracks completed downloads to enable resuming
- [x] **Duplicate Prevention** - Skips already-downloaded files automatically
- [x] **Download Statistics** - Real-time progress tracking with file counts and status

### Configuration & Flexibility
- [x] **Environment-Based Configuration** - `.env` file support for credentials and settings
- [x] **CLI Arguments** - Override configuration via command-line parameters
- [x] **Course Filtering** - Filter courses by regex pattern (e.g., current semester only)
- [x] **Interactive Mode** - Prompts for credentials if not configured
- [x] **Configurable Concurrency** - Adjust number of simultaneous downloads
- [x] **Customizable Timeouts** - Configure browser and download timeouts

### User Experience
- [x] **Beautiful CLI Interface** - Colored output with Inquirer and Chalk
- [x] **Progress Indicators** - Visual feedback with Ora spinners
- [x] **Download Progress GUI** - Multi-bar per-file progress display with file names, sizes, and percentages (cli-progress)
- [x] **Comprehensive Logging** - Winston-based logging with file and console output
- [x] **Debug Mode** - Detailed logging for troubleshooting (set `LOG_LEVEL=debug`)
- [x] **One-Click Launchers** - Double-click scripts for Windows, macOS, and Linux
- [x] **Node.js Version Validation** - Launcher scripts check for compatible Node.js versions
- [x] **First-Time Setup Wizard** - `setup` command (and `npm run setup`) guides through credential configuration and Playwright browser installation
- [x] **Single Credential Entry** - Credentials entered once in `setup` or saved on first interactive run; stored in `.env` for reuse
- [x] **npm Package** - Installable via `npm install` with `whiteboard-dl` binary; `npm run setup` for quick first-time configuration

### Technical Implementation
- [x] **TypeScript** - Full type safety throughout the codebase
- [x] **Modern Browser Automation** - Playwright (replaces legacy Selenium)
- [x] **Async/Await** - Modern async patterns for better performance
- [x] **SQLite Database** - Persistent download tracking
- [x] **Input Validation** - Zod schema validation for configuration
- [x] **File Path Sanitization** - Prevents directory traversal and invalid filenames
- [x] **Error Handling** - Comprehensive try/catch blocks with meaningful error messages

### Platform Support
- [x] **Cross-Platform** - Windows, macOS, and Linux support
- [x] **Docker Support** - Containerized deployment option
- [x] **Docker Compose** - Easy multi-container setup
- [x] **Multiple Browsers** - Supports Chromium, Firefox, and WebKit

### Security & Best Practices
- [x] **Credentials in .env** - No hardcoded passwords in source code
- [x] **Sanitized File Paths** - Prevents directory traversal attacks
- [x] **Input Validation** - Validates all configuration inputs with Zod
- [x] **Secure Cookie Handling** - Proper session management

### Bug Fixes (Recent)
- [x] **Node.js Compatibility Check** - Warns about incompatible versions (v24+)
- [x] **Better-sqlite3 Troubleshooting** - Comprehensive README section for native module issues
- [x] **URL Construction Fix** - Fixed invalid URL errors caused by leading spaces and relative URLs
- [x] **Enhanced Debug Logging** - Added detailed logging throughout scraper, auth, and downloader

## 🚧 In Progress / Planned Features

### Potential Future Enhancements
- [ ] **Full Desktop GUI** - Electron-based desktop application
- [ ] **Multi-Account Support** - Download from multiple accounts
- [ ] **Selective Downloads** - Choose specific files/folders to download
- [ ] **Incremental Backups** - Only download new/modified files
- [ ] **Cloud Storage Integration** - Upload downloads to Google Drive, Dropbox, etc.
- [ ] **Email Notifications** - Notify when downloads complete
- [ ] **Scheduled Downloads** - Cron job support for automatic downloads
- [ ] **Download Verification** - Checksum verification for downloaded files
- [ ] **Parallel Course Processing** - Download from multiple courses simultaneously

### Community Requests
- [ ] **Custom Download Filters** - Filter by file type, size, date, etc.
- [ ] **Download Queue Management** - Pause/resume individual downloads
- [ ] **Progress Bar in CLI** - Visual progress bars for large downloads
- [ ] **Bandwidth Throttling** - Limit download speed
- [ ] **Proxy Support** - HTTP/SOCKS proxy configuration

## 📊 Feature Comparison: v0.x vs v2.0

| Feature | v0.x (Python/Selenium) | v2.0 (TypeScript/Playwright) |
|---------|------------------------|------------------------------|
| Language | Python | TypeScript |
| Browser Automation | Selenium | Playwright |
| Downloads | Sequential | Concurrent |
| Resume Support | ❌ No | ✅ Yes |
| Retry Logic | ❌ No | ✅ Yes |
| Configuration | Hardcoded | .env + CLI args |
| Interface | tkinter GUI | Beautiful CLI |
| Logging | print() | Winston |
| Type Safety | ❌ No | ✅ Yes |
| Docker Support | ❌ No | ✅ Yes |
| Database Tracking | ❌ No | ✅ SQLite |
| One-Click Launch | ❌ No | ✅ Yes |
| Node.js Validation | ❌ No | ✅ Yes |
| Debug Logging | ❌ Limited | ✅ Comprehensive |

## 🎯 Feature Philosophy

The Whiteboard Downloader follows these design principles:

1. **User-Friendly**: One-click launchers, clear error messages, helpful documentation
2. **Robust**: Automatic retry, resume capability, comprehensive error handling
3. **Performant**: Concurrent downloads, efficient database queries
4. **Maintainable**: TypeScript types, modular architecture, clean code
5. **Secure**: No hardcoded credentials, input validation, sanitized file paths
6. **Debuggable**: Comprehensive logging at multiple levels for easy troubleshooting

## 📝 Notes

- For feature requests, please open an issue on GitHub
- See CHANGELOG.md for detailed version history
- See README.md for usage instructions and setup guide
