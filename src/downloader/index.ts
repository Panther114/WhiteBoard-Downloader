import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import mime from 'mime-types';
import { Config, DownloadableFile } from '../types';
import { log } from '../utils/logger';
import {
  sanitizeFilename,
  getUniqueFilePath,
  ensureDirectory,
  extractFilenameFromUrl,
  parseContentDisposition,
  formatBytes,
} from '../utils/helpers';
import { DownloadDatabase } from '../database';

export class FileDownloader extends EventEmitter {
  private axios: AxiosInstance;
  private config: Config;
  private limiter: ReturnType<typeof pLimit>;
  private db: DownloadDatabase;

  constructor(config: Config, cookies: any[], db: DownloadDatabase) {
    super();
    this.config = config;
    this.db = db;
    this.limiter = pLimit(config.maxConcurrentDownloads);

    // Create axios instance with cookies
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    this.axios = axios.create({
      timeout: config.downloadTimeout,
      maxRedirects: 5,
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      auth: {
        username: config.username,
        password: config.password,
      },
    });
  }

  /**
   * Download a single file with retry logic
   */
  private async downloadFile(file: DownloadableFile): Promise<void> {
    // Check if already downloaded
    if (this.db.isDownloaded(file.url)) {
      log.debug(`Skipping already downloaded file: ${file.name}`);
      this.emit('download:skip', { url: file.url, filename: file.name });
      return;
    }

    const downloadFn = async () => {
      log.info(`Downloading: ${file.name}`);
      this.emit('download:start', file);

      try {
        // Make request
        const response = await this.axios.get(file.url, {
          responseType: 'stream',
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Determine filename
        let filename = file.name;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const parsed = parseContentDisposition(contentDisposition);
          if (parsed) {
            filename = parsed;
          }
        }

        if (!filename) {
          filename = extractFilenameFromUrl(file.url);
        }

        // Add extension if missing
        if (!path.extname(filename)) {
          const contentType = response.headers['content-type'];
          if (contentType) {
            const ext = mime.extension(contentType.split(';')[0].trim());
            if (ext) {
              filename += `.${ext}`;
            }
          }
        }

        filename = sanitizeFilename(filename);

        // Ensure directory exists
        ensureDirectory(file.path);

        // Get unique file path
        const filePath = getUniqueFilePath(file.path, filename);

        // Track download progress
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        response.data.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          this.emit('download:progress', {
            url: file.url,
            filename,
            downloaded: downloadedSize,
            total: totalSize,
          });
        });

        // Download file
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const fileSize = fs.statSync(filePath).size;

        // Update database
        this.db.upsertDownload({
          url: file.url,
          path: filePath,
          filename,
          status: 'completed',
          size: fileSize,
          downloadedAt: new Date(),
        });

        this.emit('download:complete', { url: file.url, filename, size: fileSize });
        log.info(`✓ Saved: ${filename} (${formatBytes(fileSize)})`);
      } catch (error: any) {
        log.error(`Failed to download ${file.name}: ${error.message}`);
        this.emit('download:error', { url: file.url, filename: file.name, error: error.message });

        // Update database with error
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

    // Retry with exponential backoff
    try {
      await pRetry(downloadFn, {
        retries: this.config.maxRetries,
        minTimeout: this.config.retryDelay,
        onFailedAttempt: (error) => {
          log.warn(
            `Download attempt ${error.attemptNumber} failed for ${file.name}. ${error.retriesLeft} retries left.`
          );
        },
      });
    } catch (error) {
      log.error(`Failed to download ${file.name} after ${this.config.maxRetries} retries`);
    }
  }

  /**
   * Download multiple files concurrently
   */
  async downloadFiles(files: DownloadableFile[]): Promise<void> {
    if (files.length === 0) {
      log.debug('No files to download');
      return;
    }

    log.info(`Starting download of ${files.length} files...`);

    const downloadPromises = files.map(file =>
      this.limiter(() => this.downloadFile(file))
    );

    await Promise.all(downloadPromises);

    log.info('Batch download completed');
  }

  /**
   * Get download statistics
   */
  getStats() {
    return this.db.getStats();
  }
}
