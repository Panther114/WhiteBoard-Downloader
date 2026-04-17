import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import mime from 'mime-types';
import { Config, DiscoveredFile, DownloadableFile, FileTree } from '../types';
import { log } from '../utils/logger';
import {
  sanitizeFilename,
  getUniqueFilePath,
  releaseReservedPath,
  getTmpFilePath,
  ensureDirectory,
  extractFilenameFromUrl,
  parseContentDisposition,
  formatBytes,
} from '../utils/helpers';
import { DownloadDatabase } from '../database';
import { addFileToTree, saveFileTree } from '../fileTree';

/** Milliseconds without data before a download stream is considered stalled. */
const INACTIVITY_TIMEOUT_MS = 30_000;

/** Timeout for HEAD requests used to fetch file metadata. */
const HEAD_REQUEST_TIMEOUT_MS = 5_000;

/** The generic-binary MIME extension returned by mime-types for unrecognised content. */
const GENERIC_BINARY_EXTENSION = 'bin';

/** MIME type prefixes that indicate audio/video content (blocked). */
const BLOCKED_MEDIA_MIME_PREFIXES = ['video/', 'audio/'];

export class FileDownloader extends EventEmitter {
  private axios: AxiosInstance;
  private config: Config;
  private limiter: ReturnType<typeof pLimit>;
  private db: DownloadDatabase;
  private fileTree: FileTree;

  constructor(config: Config, cookies: any[], db: DownloadDatabase, fileTree: FileTree) {
    super();
    this.config = config;
    this.db = db;
    this.fileTree = fileTree;
    this.limiter = pLimit(config.maxConcurrentDownloads);

    // Build cookie string from the authenticated Playwright session.
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    this.axios = axios.create({
      timeout: config.downloadTimeout,
      maxRedirects: 5,
      // Keep-alive reuses TCP connections across the many small file downloads.
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      headers: {
        Cookie: cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // NOTE: do NOT include `auth` here — Blackboard uses cookie-based session
      // auth, not HTTP Basic Auth. Sending Basic credentials would add a
      // spurious Authorization header that can disrupt CSRF protections.
    });
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  /**
   * Send HEAD requests for every file to populate size, mimeType, and the
   * real filename (from Content-Disposition) without downloading the file body.
   * Runs concurrently up to maxConcurrentDownloads.
   *
   * Media files (audio/video MIME types) are filtered out automatically.
   * Files where the server does not support HEAD are returned unchanged.
   */
  async fetchMetadata(files: DiscoveredFile[]): Promise<DiscoveredFile[]> {
    const headLimit = pLimit(this.config.maxConcurrentDownloads);

    const results = await Promise.all(
      files.map(file =>
        headLimit(async (): Promise<DiscoveredFile | null> => {
          try {
            const response = await this.axios.head(file.url, { timeout: HEAD_REQUEST_TIMEOUT_MS });
            const rawLength = response.headers['content-length'];
            const size = rawLength ? parseInt(rawLength, 10) : undefined;
            const rawType = response.headers['content-type'] || '';
            const mimeType = rawType.split(';')[0].trim() || undefined;

            // Block media files by MIME type
            if (mimeType && BLOCKED_MEDIA_MIME_PREFIXES.some(p => mimeType.startsWith(p))) {
              log.debug(`Filtering media file (MIME: ${mimeType}): ${file.name} -> ${file.url}`);
              return null;
            }

            const extFromMime = mimeType ? mime.extension(mimeType) : false;
            const extFromName = path.extname(file.name).slice(1);
            const fileType = (
              (extFromMime && extFromMime !== GENERIC_BINARY_EXTENSION ? extFromMime : extFromName) || undefined
            )?.toUpperCase();

            // Parse Content-Disposition to get the real server-side filename
            let resolvedName = file.name;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
              const parsed = parseContentDisposition(contentDisposition);
              if (parsed) resolvedName = parsed;
            }

            // If the resolved name still has no extension, append from MIME
            if (!path.extname(resolvedName) && extFromMime && extFromMime !== GENERIC_BINARY_EXTENSION) {
              resolvedName += `.${extFromMime}`;
            }

            log.debug(
              `Metadata for "${file.name}": size=${size ?? '?'}, mime=${mimeType ?? '?'}, ` +
              `resolvedName="${resolvedName}", fileType=${fileType ?? '?'}`
            );

            return { ...file, name: resolvedName, size: size || undefined, mimeType, fileType };
          } catch {
            // HEAD not supported or network error — return file as-is.
            return file;
          }
        })
      )
    );

    // Filter out null entries (blocked media files)
    return results.filter((f): f is DiscoveredFile => f !== null);
  }

  // ---------------------------------------------------------------------------
  // Single-file download
  // ---------------------------------------------------------------------------

  /**
   * Download a single file with retry logic.
   * Writes to a uniquely-named .tmp file first, then atomically renames to
   * the final path.  On any failure the .tmp file is deleted so partial
   * downloads never accumulate on disk.
   */
  private async downloadFile(file: DownloadableFile): Promise<void> {
    // Skip files that were already downloaded in a previous run.
    if (this.db.isDownloaded(file.url)) {
      log.debug(`Skipping already downloaded file: ${file.name}`);
      this.emit('download:skip', { url: file.url, filename: file.name });
      return;
    }

    const downloadFn = async () => {
      log.info(`Downloading: ${file.name}`);
      this.emit('download:start', file);

      let finalPath: string | null = null;
      let tmpPath: string | null = null;

      try {
        const response = await this.axios.get(file.url, { responseType: 'stream' });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Determine the final filename (prefer Content-Disposition, then URL).
        let filename = file.name;
        const contentDisposition = response.headers['content-disposition'];
        const contentType = response.headers['content-type'];

        // Log all relevant headers at debug level for troubleshooting
        log.debug(
          `Download headers for "${file.name}": ` +
          `Content-Disposition="${contentDisposition ?? '(none)'}",  ` +
          `Content-Type="${contentType ?? '(none)'}",  ` +
          `Content-Length="${response.headers['content-length'] ?? '(none)'}"`
        );

        if (contentDisposition) {
          const parsed = parseContentDisposition(contentDisposition);
          if (parsed) filename = parsed;
        }
        if (!filename) {
          filename = extractFilenameFromUrl(file.url);
        }

        // Extension resolution: ensure the filename has a valid extension.
        // 1. If the filename already has an extension, validate it against Content-Type.
        // 2. If no extension or the extension is a generic placeholder, append from MIME.
        const existingExt = path.extname(filename).slice(1).toLowerCase();
        if (contentType) {
          const mimeExt = mime.extension(contentType.split(';')[0].trim());
          if (!existingExt) {
            // No extension at all → append from MIME
            if (mimeExt && mimeExt !== GENERIC_BINARY_EXTENSION) {
              filename += `.${mimeExt}`;
              log.debug(`Appended MIME extension: "${filename}" (from ${contentType})`);
            }
          } else if (
            mimeExt &&
            mimeExt !== GENERIC_BINARY_EXTENSION &&
            existingExt !== mimeExt &&
            // Don't "fix" close variants like doc/docx, xls/xlsx, ppt/pptx
            !existingExt.startsWith(mimeExt) &&
            !mimeExt.startsWith(existingExt)
          ) {
            // Extension disagrees with MIME — prefer MIME-derived extension
            const base = path.basename(filename, path.extname(filename));
            filename = `${base}.${mimeExt}`;
            log.debug(`Corrected extension: "${filename}" (MIME ${contentType} → .${mimeExt})`);
          }
        }

        filename = sanitizeFilename(filename);

        // Ensure the target directory exists.
        ensureDirectory(file.path);

        // Atomically reserve a unique final path (fixes TOCTOU race).
        finalPath = getUniqueFilePath(file.path, filename);

        // Write to a randomly-named .tmp file; rename on success.
        tmpPath = getTmpFilePath(finalPath);

        // Track download progress with an inactivity watchdog.
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

        const resetInactivityTimer = () => {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => {
            response.data.destroy(
              new Error(`Download stalled: no data received for ${INACTIVITY_TIMEOUT_MS / 1000}s`)
            );
          }, INACTIVITY_TIMEOUT_MS);
        };

        resetInactivityTimer();

        response.data.on('data', (chunk: Buffer) => {
          resetInactivityTimer();
          downloadedSize += chunk.length;
          this.emit('download:progress', {
            url: file.url,
            filename,
            downloaded: downloadedSize,
            total: totalSize,
          });
        });

        const writer = fs.createWriteStream(tmpPath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            resolve();
          });
          writer.on('error', (err: Error) => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            // Abort the HTTP stream so the connection is released immediately.
            response.data.destroy();
            reject(err);
          });
          response.data.on('error', (err: Error) => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            writer.destroy();
            reject(err);
          });
        });

        // Rename the finished .tmp file to the final path.
        fs.renameSync(tmpPath, finalPath);
        tmpPath = null; // no cleanup needed

        const fileSize = fs.statSync(finalPath).size;

        this.db.upsertDownload({
          url: file.url,
          path: finalPath,
          filename,
          status: 'completed',
          size: fileSize,
          downloadedAt: new Date(),
        });

        // Update the file tree cache.  We derive course/section/folder from the
        // DownloadableFile path (which follows the <course>/<section>/... layout).
        this.updateFileTree(file, finalPath, filename, fileSize);

        this.emit('download:complete', { url: file.url, filename, size: fileSize });
        log.info(`✓ Saved: ${filename} (${formatBytes(fileSize)})`);
      } catch (error: any) {
        // Clean up any partial .tmp file.
        if (tmpPath) {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            /* ignore */
          }
        }
        // Release the path reservation so future retries can reclaim it.
        if (finalPath) {
          releaseReservedPath(finalPath);
          finalPath = null;
        }

        log.error(`Failed to download ${file.name}: ${error.message}`);
        this.emit('download:error', { url: file.url, filename: file.name, error: error.message });

        this.db.upsertDownload({
          url: file.url,
          path: file.path,
          filename: file.name,
          status: 'failed',
          error: error.message,
        });

        throw error;
      }
    };

    try {
      await pRetry(downloadFn, {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelay,
        onFailedAttempt: error => {
          log.warn(
            `Download attempt ${error.attemptNumber} failed for ${file.name}. ` +
              `${error.retriesLeft} retries left.`
          );
        },
      });
    } catch {
      log.error(`Failed to download ${file.name} after ${this.config.maxRetries} retries`);
    }
  }

  // ---------------------------------------------------------------------------
  // File tree cache
  // ---------------------------------------------------------------------------

  /**
   * Derive course/section/folder from the file path layout and update the
   * in-memory file tree.  Saves to disk immediately so progress is preserved
   * even if the process is interrupted.
   */
  private updateFileTree(
    file: DownloadableFile,
    finalPath: string,
    filename: string,
    fileSize: number,
  ): void {
    try {
      // The file.path should follow <downloadDir>/<course>/<section>/[subfolder/]
      const relPath = path.relative(this.config.downloadDir, file.path);
      const parts = relPath.split(path.sep).filter(Boolean);

      const courseName = parts[0] || 'Unknown Course';
      const sectionName = parts[1] || 'Unknown Section';
      const folderPath = file.path;

      addFileToTree(this.fileTree, courseName, sectionName, folderPath, filename, {
        url: file.url,
        localPath: finalPath,
        size: fileSize,
        downloadedAt: new Date().toISOString(),
        mimeType: file.mimeType,
      });

      saveFileTree(this.fileTree, this.config.fileTreePath);
    } catch (err: any) {
      log.debug(`Failed to update file tree: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Batch download
  // ---------------------------------------------------------------------------

  /**
   * Download multiple files concurrently, honouring the global p-limit queue.
   * All files are submitted at once so the limiter can schedule them optimally
   * instead of being constrained to a single folder's batch.
   */
  async downloadFiles(files: DownloadableFile[]): Promise<void> {
    if (files.length === 0) {
      log.debug('No files to download');
      return;
    }

    log.info(`Starting download of ${files.length} files...`);

    await Promise.all(files.map(file => this.limiter(() => this.downloadFile(file))));

    log.info('Batch download completed');
  }

  /**
   * Download a list of DiscoveredFile objects (from the selection GUI).
   * Converts them to DownloadableFile and delegates to downloadFiles().
   */
  async downloadSelected(files: DiscoveredFile[]): Promise<void> {
    const downloadable: DownloadableFile[] = files.map(f => ({
      name: f.name,
      url: f.url,
      path: f.savePath,
      size: f.size,
      mimeType: f.mimeType,
      status: 'pending' as const,
    }));
    await this.downloadFiles(downloadable);
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats() {
    return this.db.getStats();
  }
}
