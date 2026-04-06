# Whiteboard Downloader - Detailed Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Documentation](#module-documentation)
3. [API Reference](#api-reference)
4. [Extending the Downloader](#extending-the-downloader)
5. [CSS Selectors Reference](#css-selectors-reference)
6. [Database Schema](#database-schema)
7. [Error Handling](#error-handling)

---

## Architecture Overview

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐
│   CLI (cli.ts)  │  ← Entry point with Commander
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  WhiteboardDownloader (index.ts) │  ← Main orchestrator
└─────┬───────────────────────┬───┘
      │                       │
      ▼                       ▼
┌─────────────┐        ┌──────────────┐
│ BlackboardAuth│       │ DownloadDB   │
└──────┬──────┘        └──────────────┘
       │
       ▼
┌────────────────┐
│ BlackboardScraper│
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ FileDownloader │
└────────────────┘
```

### Flow

1. **CLI** → Parses arguments, prompts for credentials
2. **Config** → Loads and validates configuration
3. **Auth** → Launches browser, logs into Blackboard
4. **Scraper** → Navigates pages, extracts course/file information
5. **Downloader** → Downloads files concurrently with retry logic
6. **Database** → Tracks download status for resume capability

---

## Module Documentation

### `src/auth/index.ts` - BlackboardAuth

Handles browser automation and authentication.

**Key Methods:**
- `launchBrowser()` - Initializes Playwright browser
- `login()` - Performs Blackboard login
- `getCookies()` - Extracts session cookies
- `close()` - Closes browser

**CSS Selectors Used:**
- Login form: `#user_id`, `#password`, `#entry-login`
- Cookie consent: `#agree_button`
- Course list: `ul.portletList-img.courseListing.coursefakeclass li a`

### `src/scraper/index.ts` - BlackboardScraper

Extracts course structure and file URLs from Blackboard pages.

**Key Methods:**
- `getCourses()` - Gets list of enrolled courses
- `getSidebarLinks()` - Gets sidebar sections for a course
- `getDownloadableFiles()` - Finds downloadable files on current page
- `getSubfolders()` - Finds subfolders on current page
- `goBack()` - Navigate back in browser
- `returnToHome()` - Return to My Institution page

**CSS Selectors Used:**
- Courses: `ul.portletList-img.courseListing.coursefakeclass li a`
- Sidebar: `#courseMenuPalette_contents li a`
- Files: `#content_listContainer a[target="_blank"]`
- Folders: `div.item.clearfix a`
- Home: `td[id="MyInstitution.label"] a`

### `src/downloader/index.ts` - FileDownloader

Downloads files with concurrency control and retry logic.

**Key Methods:**
- `downloadFiles()` - Downloads multiple files concurrently
- `downloadFile()` - Downloads single file with retry
- `getStats()` - Returns download statistics

**Features:**
- Concurrent downloads with p-limit
- Automatic retry with p-retry
- Progress tracking
- Database integration

### `src/database/index.ts` - DownloadDatabase

SQLite database for tracking download status.

**Key Methods:**
- `isDownloaded()` - Check if URL already downloaded
- `upsertDownload()` - Add or update download record
- `getDownload()` - Get record by URL
- `getDownloadsByStatus()` - Get records by status
- `getStats()` - Get download statistics
- `clear()` - Clear all records
- `close()` - Close database connection

---

## API Reference

### Configuration Options

```typescript
interface Config {
  username: string;              // Blackboard username
  password: string;              // Blackboard password
  baseUrl: string;               // Blackboard base URL
  loginUrl: string;              // Login page URL
  downloadDir: string;           // Download directory
  maxConcurrentDownloads: number; // Concurrent download limit
  downloadTimeout: number;        // Download timeout (ms)
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;             // Run browser headlessly
  browserTimeout: number;        // Browser timeout (ms)
  databasePath: string;          // SQLite database path
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile: string;               // Log file path
  courseFilter?: string;         // Course filter regex
  maxRetries: number;            // Max retry attempts
  retryDelay: number;            // Retry delay (ms)
}
```

### Type Definitions

```typescript
interface Course {
  id: string;
  name: string;
  url: string;
  path: string;
}

interface DownloadableFile {
  name: string;
  url: string;
  path: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  size?: number;
  mimeType?: string;
  error?: string;
}

interface DatabaseRecord {
  id?: number;
  url: string;
  path: string;
  filename: string;
  status: string;
  size?: number;
  downloadedAt?: Date;
  error?: string;
}
```

---

## Extending the Downloader

### Adding a New Feature

Example: Add email notifications on completion

1. **Install dependencies:**
   ```bash
   npm install nodemailer
   npm install -D @types/nodemailer
   ```

2. **Create notification module:**
   ```typescript
   // src/utils/notifier.ts
   import nodemailer from 'nodemailer';

   export async function sendNotification(stats: any) {
     const transporter = nodemailer.createTransport({
       // Configure your email service
     });

     await transporter.sendMail({
       subject: 'Download Complete',
       text: `Downloaded ${stats.completed} files`,
     });
   }
   ```

3. **Integrate in main flow:**
   ```typescript
   // src/index.ts
   import { sendNotification } from './utils/notifier';

   // In downloadAll() method, after downloads complete:
   const stats = this.downloader.getStats();
   await sendNotification(stats);
   ```

### Custom Scrapers

To add support for a different Blackboard version:

1. Create new scraper class extending base functionality
2. Override selector methods with version-specific selectors
3. Add configuration option to select scraper version

---

## CSS Selectors Reference

### Login Page
```typescript
COOKIE_BUTTON = '#agree_button'
USERNAME_INPUT = '#user_id'
PASSWORD_INPUT = '#password'
LOGIN_BUTTON = '#entry-login'
```

### Course List
```typescript
COURSE_LIST = 'ul.portletList-img.courseListing.coursefakeclass li a'
```

### Course Page
```typescript
SIDEBAR_LINKS = '#courseMenuPalette_contents li a'
SIDEBAR_TITLE = 'span[title]'
HOME_BUTTON = 'td[id="MyInstitution.label"] a'
```

### Content Page
```typescript
DOWNLOAD_LINKS = '#content_listContainer a[target="_blank"]'
SUBFOLDERS = 'div.item.clearfix a'
```

### Identifying Links
```typescript
// Subfolder link contains:
href.includes('listContent.jsp')

// Skip navigation links:
href.includes('listContent.jsp') && !displayText
```

---

## Database Schema

### `downloads` Table

```sql
CREATE TABLE downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL,
  size INTEGER,
  downloaded_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_url ON downloads(url);
CREATE INDEX idx_status ON downloads(status);
```

**Statuses:**
- `pending` - Not yet downloaded
- `downloading` - Currently downloading
- `completed` - Successfully downloaded
- `failed` - Download failed after retries

---

## Error Handling

### Error Types

1. **Authentication Errors**
   - Invalid credentials
   - Session timeout
   - Network issues during login

2. **Scraping Errors**
   - Selector not found (UI changed)
   - Timeout waiting for element
   - Navigation failures

3. **Download Errors**
   - Network timeout
   - Disk space issues
   - Permission errors
   - Invalid response

### Retry Strategy

Downloads use exponential backoff:
- Attempt 1: Immediate
- Attempt 2: Wait 2s
- Attempt 3: Wait 4s
- Attempt 4: Wait 8s

### Logging

All errors are logged with context:
```typescript
log.error('Failed to download file', {
  url: file.url,
  error: error.message,
  attempt: attemptNumber,
});
```

---

## Performance Optimization

### Recommended Settings

**Fast network:**
```env
MAX_CONCURRENT_DOWNLOADS=10
DOWNLOAD_TIMEOUT=30000
```

**Slow network:**
```env
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT=120000
MAX_RETRIES=5
```

**Large files:**
```env
DOWNLOAD_TIMEOUT=300000
MAX_RETRIES=5
```

### Memory Considerations

- Axios streams files to disk (low memory usage)
- Database uses SQLite (minimal overhead)
- Browser automation is memory-intensive:
  - Headless mode uses ~100-200MB
  - Visible mode uses ~300-500MB

---

## Testing

### Manual Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail gracefully)
- [ ] Download from course with files
- [ ] Download from course with subfolders
- [ ] Download from nested subfolders
- [ ] Resume interrupted download
- [ ] Filter courses by pattern
- [ ] Download with concurrent limit = 1
- [ ] Download with concurrent limit = 10
- [ ] Test with headless = true
- [ ] Test with headless = false
- [ ] Check log file creation
- [ ] Check database creation
- [ ] Verify file integrity after download

---

## Future Enhancements

1. **API Mode**: Expose as REST API
2. **Web UI**: Browser-based interface
3. **Incremental Sync**: Only download new files
4. **File Hashing**: Verify integrity with checksums
5. **Bandwidth Limiting**: Throttle downloads
6. **Selective Download**: Choose specific courses/folders
7. **Cloud Storage**: Upload to S3/Drive after download
8. **Scheduling**: Cron-like scheduled downloads
9. **Multi-account**: Support multiple Blackboard accounts
10. **Compression**: Zip downloaded courses automatically

---

For more information, see the main [README.md](../README.md).
