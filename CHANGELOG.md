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
