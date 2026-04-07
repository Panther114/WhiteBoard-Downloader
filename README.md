**Es lebe der Arbeiterklasse! 工人阶级万岁! Long Live the Working Class!**

# Whiteboard Downloader v2.0

Modern, async-first automation tool to download course materials from **SHSID Blackboard China**. Built with TypeScript, Playwright, and modern best practices.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

---

## 🚀 What's New in v2.0

- **🔄 Modern Stack**: Completely rewritten in TypeScript with Playwright
- **⚡ Concurrent Downloads**: Download multiple files simultaneously with configurable concurrency
- **💾 Smart Caching**: SQLite database tracks downloaded files to enable resume capability
- **🔁 Auto-Retry**: Automatic retry with exponential backoff for failed downloads
- **🎨 Beautiful CLI**: Enhanced terminal UI with progress indicators and colored output
- **🐳 Docker Support**: Run in containerized environment with zero setup
- **📝 Comprehensive Logging**: Structured logging with Winston
- **🔒 Type Safety**: Full TypeScript type safety throughout the codebase
- **⚙️ Flexible Configuration**: Environment variables, config files, and CLI arguments
- **🎯 Course Filtering**: Regex-based course filtering to download only what you need
- **🖱️ One-Click Launcher**: Simple double-click scripts for Windows, macOS, and Linux

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Prerequisites](#-prerequisites)
3. [Installation](#-installation)
4. [Quick Start](#-quick-start)
5. [Configuration](#-configuration)
6. [Usage](#-usage)
7. [Docker](#-docker)
8. [Architecture](#-architecture)
9. [Development](#-development)
10. [Troubleshooting](#-troubleshooting)
11. [Migration from v0.x](#-migration-from-v0x)
12. [Known Issues](#-known-issues)
13. [Contributing](#-contributing)
14. [License](#-license)

---

## ✨ Features

- ✅ **Automatic Authentication**: Handles login and session management
- ✅ **Recursive Navigation**: Automatically traverses course structure and subfolders
- ✅ **Smart File Naming**: Extracts proper filenames from Content-Disposition headers
- ✅ **Duplicate Prevention**: Tracks downloads in database to skip already-downloaded files
- ✅ **Concurrent Downloads**: Download multiple files in parallel (configurable)
- ✅ **Automatic Retry**: Retries failed downloads with exponential backoff
- ✅ **Progress Tracking**: Real-time progress indicators and statistics
- ✅ **Course Filtering**: Filter courses by regex pattern
- ✅ **Organized Structure**: Maintains Blackboard's folder hierarchy
- ✅ **Resume Capability**: Resume interrupted downloads from where you left off
- ✅ **Cross-Platform**: Works on Windows, macOS, and Linux
- ✅ **Docker Support**: Run in isolated container environment
- ✅ **One-Click Launch**: Double-click launcher scripts with desktop shortcut support

---

## 🔧 Prerequisites

### Node.js Installation

**Required**: Node.js **v18.0.0 or higher**
**Recommended**: Node.js **v20.x or v22.x LTS**
**⚠️ Not Compatible**: Node.js **v24+** (too new, causes native module compilation issues)

Check your Node.js version:
```bash
node --version
```

**Why LTS versions?**
- This project uses `better-sqlite3`, a native module that requires compilation
- Node.js v24+ introduces breaking changes (requires C++20) that aren't yet fully supported
- LTS versions (Long Term Support) are stable, well-tested, and recommended for production use

If you need to install or upgrade Node.js:
- **Download**: [https://nodejs.org/](https://nodejs.org/) (Choose the **LTS version**)
- **Or use nvm**: [Node Version Manager](https://github.com/nvm-sh/nvm)
  ```bash
  # Install Node.js v20 LTS
  nvm install 20
  nvm use 20

  # Or v22 LTS
  nvm install 22
  nvm use 22
  ```

### System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux
- **RAM**: 2GB minimum (4GB recommended)
- **Disk Space**: Sufficient space for downloaded course materials (typically 1-5GB)
- **Internet**: Stable connection (avoid mobile hotspots for large downloads)

---

## 📥 Installation

### Option 1: npm Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/Panther114/WhiteBoard-Downloader.git
cd WhiteBoard-Downloader

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the project
npm run build
```

### Option 2: Docker (Zero Setup)

```bash
# Clone the repository
git clone https://github.com/Panther114/WhiteBoard-Downloader.git
cd WhiteBoard-Downloader

# Build Docker image
docker build -t whiteboard-downloader .

# Run (see Docker section for details)
docker run -it --rm whiteboard-downloader
```

---

## 🏁 Quick Start

### 1. Configure Credentials

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
BB_USERNAME=your_g_number
BB_PASSWORD=your_password
```

### 2. Run the Downloader

#### Option A: One-Click Launch (Easiest!) 🚀

**Windows:**
- Double-click `start.bat` or `start.ps1` in the project folder

**macOS/Linux:**
- Double-click `start.sh` (make it executable first: `chmod +x start.sh`)

**Want a desktop shortcut?** See [LAUNCHER_GUIDE.md](LAUNCHER_GUIDE.md) for detailed instructions.

#### Option B: Command Line

```bash
# Using npm
npm start download

# Or run directly
node dist/cli.js download
```

### 3. Interactive Mode (No .env Required)

If you don't configure a `.env` file, the CLI will prompt you for credentials:

```bash
npm start
```

You'll see:
```
🎓 Whiteboard Downloader v2.0

Please enter your Blackboard credentials:

? G-Number: G12345
? Password: ******
```

---

## ⚙️ Configuration

### Environment Variables

All configuration can be set via `.env` file or environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `BB_USERNAME` | Your G-Number | *Required* |
| `BB_PASSWORD` | Your password | *Required* |
| `BB_BASE_URL` | Blackboard base URL | `https://shs.blackboardchina.cn` |
| `BB_LOGIN_URL` | Login page URL | `https://shs.blackboardchina.cn/webapps/login/` |
| `DOWNLOAD_DIR` | Download directory | `./downloads` |
| `MAX_CONCURRENT_DOWNLOADS` | Concurrent download limit | `5` |
| `DOWNLOAD_TIMEOUT` | Download timeout (ms) | `60000` |
| `BROWSER_TYPE` | Browser engine | `chromium` |
| `HEADLESS` | Run browser headlessly | `true` |
| `BROWSER_TIMEOUT` | Browser operation timeout | `30000` |
| `DATABASE_PATH` | SQLite database path | `./whiteboard.db` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `./logs/whiteboard.log` |
| `COURSE_FILTER` | Course regex filter | *(none)* |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `RETRY_DELAY` | Retry delay (ms) | `2000` |

### CLI Arguments

Override configuration with CLI arguments:

```bash
node dist/cli.js download \
  --username G12345 \
  --password mypassword \
  --dir ./my-downloads \
  --headless false \
  --filter "^2025I.*"
```

### View Current Configuration

```bash
node dist/cli.js config
```

---

## 📖 Usage

### Basic Usage

```bash
# Download all courses
npm start

# Or
node dist/cli.js download
```

### With Options

```bash
# Download to specific directory
node dist/cli.js download --dir ./my-courses

# Run with visible browser (for debugging)
node dist/cli.js download --headless false

# Filter courses by pattern (e.g., only 2025 spring semester)
node dist/cli.js download --filter "^2025I.*"

# Combine options
node dist/cli.js download \
  --dir ./downloads \
  --filter "^2025I" \
  --headless true
```

### Resume Downloads

The downloader automatically tracks completed downloads in an SQLite database. If interrupted:

1. Simply run the command again
2. Already downloaded files will be skipped
3. Only new or failed files will be downloaded

To start fresh:
```bash
rm whiteboard.db
npm start
```

---

## 🐳 Docker

### Build Image

```bash
docker build -t whiteboard-downloader .
```

### Run with Interactive Credentials

```bash
docker run -it --rm \
  -v $(pwd)/downloads:/app/downloads \
  whiteboard-downloader
```

### Run with Environment Variables

```bash
docker run -it --rm \
  -e BB_USERNAME=G12345 \
  -e BB_PASSWORD=mypassword \
  -v $(pwd)/downloads:/app/downloads \
  whiteboard-downloader
```

### Run with .env File

```bash
docker run -it --rm \
  --env-file .env \
  -v $(pwd)/downloads:/app/downloads \
  whiteboard-downloader
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  whiteboard-downloader:
    build: .
    environment:
      - BB_USERNAME=your_g_number
      - BB_PASSWORD=your_password
    volumes:
      - ./downloads:/app/downloads
      - ./logs:/app/logs
      - ./whiteboard.db:/app/whiteboard.db
```

Run:
```bash
docker-compose up
```

---

## 🏗️ Architecture

### Project Structure

```
whiteboard-downloader/
├── src/
│   ├── auth/              # Authentication & browser management
│   ├── scraper/           # Web scraping logic
│   ├── downloader/        # File download with retry logic
│   ├── database/          # SQLite database for tracking
│   ├── config/            # Configuration management
│   ├── utils/             # Helper utilities
│   │   ├── logger.ts      # Winston logging
│   │   └── helpers.ts     # File operations
│   ├── types/             # TypeScript type definitions
│   ├── index.ts           # Main application class
│   └── cli.ts             # CLI interface
├── legacy/                # Original Python implementation
├── docs/                  # Documentation
├── tests/                 # Test suite
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── Dockerfile             # Docker configuration
├── .env.example           # Environment template
└── README.md              # This file
```

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Browser Automation**: Playwright
- **HTTP Client**: Axios
- **Database**: better-sqlite3
- **CLI**: Commander.js + Inquirer
- **Logging**: Winston
- **Validation**: Zod
- **Concurrency**: p-limit, p-retry

### Key Design Decisions

1. **TypeScript**: Type safety prevents runtime errors
2. **Playwright over Selenium**: Modern API, better performance, no driver management
3. **Axios for Downloads**: Playwright for auth, Axios for efficient file streaming
4. **SQLite Database**: Persistent download tracking for resume capability
5. **Concurrent Downloads**: p-limit for controlled parallelism
6. **Zod Validation**: Runtime config validation with type inference

---

## 🛠️ Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

### Project Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run with ts-node (development)
- `npm start` - Run compiled application
- `npm test` - Run Jest tests
- `npm run lint` - Lint with ESLint
- `npm run format` - Format with Prettier

### Adding Features

The codebase is modular. To extend functionality:

1. **Add new scraper methods**: Edit `src/scraper/index.ts`
2. **Modify download logic**: Edit `src/downloader/index.ts`
3. **Change authentication**: Edit `src/auth/index.ts`
4. **Add configuration options**: Edit `src/config/index.ts` and update types

---

## 🔍 Troubleshooting

### Issue: Node.js Module Version Mismatch (better-sqlite3)

**Error message:**
```
Error: The module '...\better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 137.
```

**Cause:** The `better-sqlite3` native module was compiled for a different Node.js version than you're currently running.

**Solution 1: Rebuild the module (Quick Fix)**
```bash
npm rebuild better-sqlite3
```

**Solution 2: Clean reinstall (Recommended)**
```bash
# Windows PowerShell (as Administrator)
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Windows Command Prompt (as Administrator)
rmdir /s /q node_modules
del package-lock.json
npm install

# macOS/Linux
rm -rf node_modules package-lock.json
npm install
```

**Solution 3: Use Node.js LTS version (Most Reliable)**

The project requires **Node.js v18-v22**. If you're using Node.js v24+, please downgrade to an LTS version:

1. **Check your Node.js version:**
   ```bash
   node --version
   ```

2. **Install Node.js LTS (v20.x or v22.x recommended):**
   - Download from [https://nodejs.org/](https://nodejs.org/)
   - Or use [nvm](https://github.com/nvm-sh/nvm) to switch versions:
     ```bash
     nvm install 20
     nvm use 20
     ```

3. **After switching Node.js versions, reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

**Note:** Node.js v24+ introduces breaking changes that may cause native modules like `better-sqlite3` to fail compilation. Always use LTS versions for stability.

### Issue: npm install fails with C++ compilation errors

**Error message:**
```
error C1189: #error: "C++20 or later required."
gyp ERR! build error
```

**Cause:** You're using Node.js v24+ which requires C++20, but your build tools don't support it yet.

**Solution:** Downgrade to Node.js LTS (v20.x or v22.x) as described above.

### Issue: "Module not found"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Playwright browser not installed"

```bash
# Install Playwright browsers
npx playwright install chromium
```

### Issue: "Login failed"

- Verify credentials in `.env` file
- Check if Blackboard site is accessible
- Run with `--headless false` to see browser:
  ```bash
  node dist/cli.js download --headless false
  ```

### Issue: "ECONNREFUSED" or network errors

- Check internet connection
- Verify Blackboard URL is correct
- Check if behind firewall/proxy

### Issue: Downloads are slow

- Increase concurrent downloads:
  ```env
  MAX_CONCURRENT_DOWNLOADS=10
  ```
- Check network speed

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

Then check `logs/whiteboard.log` for detailed information.

---

## 🔄 Migration from v0.x

The legacy Python implementation is preserved in the `legacy/` folder.

### Key Differences

| Feature | v0.x (Python) | v2.0 (TypeScript) |
|---------|---------------|-------------------|
| Language | Python | TypeScript/Node.js |
| Browser | Selenium + ChromeDriver | Playwright |
| Downloads | Sequential | Concurrent |
| Resume | No | Yes (SQLite) |
| Retry | No | Yes (automatic) |
| Config | Hardcoded | .env + CLI args |
| GUI | tkinter | CLI (inquirer) |
| Logging | print() | Winston |

### Migration Steps

1. Install Node.js 18+
2. Clone and install v2.0
3. Create `.env` with your credentials
4. Run `npm start`

Your old downloads won't be tracked in the new database, but the folder structure remains compatible.

---

## ⚠️ Known Issues & Unresolved Questions

### Known Issues

1. **Large File Downloads**: Files >500MB may timeout with default settings
   - **Solution**: Increase `DOWNLOAD_TIMEOUT` in `.env`

2. **Rate Limiting**: Blackboard may throttle too many concurrent requests
   - **Solution**: Reduce `MAX_CONCURRENT_DOWNLOADS` to 3-5

3. **Session Expiry**: Long-running downloads may experience session timeout
   - **Solution**: Re-run the downloader (uses database to resume)

### Unresolved Webpage Structure Questions

Based on the legacy Python code analysis, the following questions remain about Blackboard's structure:

1. **Dynamic Course IDs**:
   - **Question**: Do course IDs change between semesters?
   - **Current Assumption**: Course URLs remain stable within a semester
   - **Impact**: May need to implement course ID tracking

2. **Content Type Detection**:
   - **Question**: Does Blackboard always provide accurate MIME types in Content-Type headers?
   - **Current Approach**: Falls back to URL extension and magic bytes if needed
   - **Needs Verification**: Test with various file types (videos, archives, etc.)

3. **Subfolder Depth Limit**:
   - **Question**: Is there a maximum nesting depth for folders?
   - **Current Implementation**: Recursive with no depth limit
   - **Potential Issue**: Stack overflow on deeply nested structures (unlikely)

4. **Special Characters in Filenames**:
   - **Question**: What's the full set of problematic characters in Blackboard filenames?
   - **Current Approach**: Sanitization based on common issues
   - **May Need**: More comprehensive character mapping

5. **Cookie/Session Persistence**:
   - **Question**: How long do Blackboard sessions remain valid?
   - **Current Approach**: Single session for entire download process
   - **May Need**: Session refresh logic for multi-hour downloads

6. **Course Filter Patterns**:
   - **Question**: Do all schools use the same course naming convention (e.g., "2025I...")?
   - **Current Default**: Filters for "2025I" or "2026I" prefixes
   - **Needs**: User-configurable pattern

7. **Blackboard Updates**:
   - **Question**: How often does Blackboard China update its UI/selectors?
   - **Risk**: CSS selectors may break on updates
   - **Mitigation**: Multiple selector strategies needed

### CSS Selectors Used (May Need Updates)

The following selectors are extracted from the legacy code and may need verification:

```typescript
// Courses list
'ul.portletList-img.courseListing.coursefakeclass li a'

// Sidebar menu items
'#courseMenuPalette_contents li a'

// Content links (downloadable files)
'#content_listContainer a[target="_blank"]'

// Subfolders
'div.item.clearfix a'

// My Institution navigation
'td[id="MyInstitution.label"] a'

// Cookie consent
'#agree_button'

// Login form
'#user_id', '#password', '#entry-login'
```

**If Blackboard updates its interface, these selectors must be updated in:**
- `src/auth/index.ts`
- `src/scraper/index.ts`

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Areas Needing Help

- Testing on different systems
- Verifying CSS selectors after Blackboard updates
- Performance optimizations
- Additional browser support (Firefox, WebKit)
- Internationalization (i18n)
- More comprehensive error handling

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Special thanks to:
- **@AquaVision** and **@MaxShuang** for testing and feedback on v0.x
- The Playwright team for excellent browser automation tools
- The SHSID community

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Panther114/WhiteBoard-Downloader/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Panther114/WhiteBoard-Downloader/discussions)

---

**⚠️ Disclaimer**: This tool is for educational purposes and personal use only. Always respect your institution's terms of service and acceptable use policies. The authors are not responsible for any misuse of this tool.

---

**Es lebe der Arbeiterklasse! 工人阶级万岁! Long Live the Working Class!**
