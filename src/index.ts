import path from 'path';
import { Config, DownloadableFile } from './types';
import { BlackboardAuth } from './auth';
import { BlackboardScraper } from './scraper';
import { FileDownloader } from './downloader';
import { DownloadDatabase } from './database';
import { initLogger, log } from './utils/logger';
import { ensureDirectory } from './utils/helpers';

export class WhiteboardDownloader {
  private config: Config;
  private auth: BlackboardAuth;
  private scraper: BlackboardScraper | null = null;
  private downloader: FileDownloader | null = null;
  private db: DownloadDatabase;

  constructor(config: Config) {
    this.config = config;

    // Initialize logger first (required by other components)
    initLogger(config.logLevel, config.logFile);

    this.auth = new BlackboardAuth(config);
    this.db = new DownloadDatabase(config.databasePath);
  }

  /**
   * Initialize and authenticate
   */
  async initialize(): Promise<void> {
    log.info('Initializing Whiteboard Downloader...');

    await this.auth.launchBrowser();
    await this.auth.login();

    const page = this.auth.getPage();
    const cookies = await this.auth.getCookies();

    this.scraper = new BlackboardScraper(page, this.config);
    this.downloader = new FileDownloader(this.config, cookies, this.db);

    log.info('Initialization complete');
  }

  /**
   * Download all course materials
   */
  async downloadAll(): Promise<void> {
    if (!this.scraper || !this.downloader) {
      throw new Error('Not initialized. Call initialize() first.');
    }

    ensureDirectory(this.config.downloadDir);

    // Get courses
    const courses = await this.scraper.getCourses();

    if (courses.length === 0) {
      log.warn('No courses found');
      return;
    }

    log.info(`Processing ${courses.length} courses...`);

    // Process each course
    for (const course of courses) {
      log.info(`\n${'='.repeat(60)}`);
      log.info(`Processing course: ${course.name}`);
      log.info('='.repeat(60));

      const coursePath = path.join(this.config.downloadDir, course.path);
      ensureDirectory(coursePath);

      try {
        // Get sidebar links
        const sidebarLinks = await this.scraper.getSidebarLinks(course.url);

        // Process each sidebar section
        for (const link of sidebarLinks) {
          log.info(`  Processing section: ${link.title}`);

          const sectionPath = path.join(coursePath, link.path);
          ensureDirectory(sectionPath);

          // Navigate to section
          const page = this.auth.getPage();
          await page.goto(link.url, { waitUntil: 'networkidle' });

          // Download files and process subfolders recursively
          await this.processFolder(sectionPath);
        }

        // Return to home
        await this.scraper.returnToHome();

        log.info(`✓ Completed course: ${course.name}`);
      } catch (error: any) {
        log.error(`Failed to process course ${course.name}: ${error.message}`);
      }
    }

    // Print final statistics
    this.printStats();
  }

  /**
   * Recursively process a folder and its subfolders
   */
  private async processFolder(currentPath: string): Promise<void> {
    if (!this.scraper || !this.downloader) return;

    // Get files in current folder
    const files = await this.scraper.getDownloadableFiles(currentPath);

    if (files.length > 0) {
      log.info(`    Found ${files.length} files`);
      await this.downloader.downloadFiles(files);
    }

    // Get subfolders
    const subfolders = await this.scraper.getSubfolders(currentPath);

    // Process each subfolder recursively
    for (const subfolder of subfolders) {
      log.info(`    Entering subfolder: ${subfolder.name}`);

      const subfolderPath = path.join(currentPath, subfolder.path);
      ensureDirectory(subfolderPath);

      // Navigate to subfolder
      const page = this.auth.getPage();
      await page.goto(subfolder.url, { waitUntil: 'networkidle' });

      // Recursively process
      await this.processFolder(subfolderPath);

      // Go back
      await this.scraper.goBack();
    }
  }

  /**
   * Print download statistics
   */
  private printStats(): void {
    if (!this.downloader) return;

    const stats = this.downloader.getStats();

    log.info('\n' + '='.repeat(60));
    log.info('DOWNLOAD SUMMARY');
    log.info('='.repeat(60));
    log.info(`Total files:     ${stats.total}`);
    log.info(`Completed:       ${stats.completed}`);
    log.info(`Failed:          ${stats.failed}`);
    log.info(`Pending:         ${stats.pending}`);
    log.info('='.repeat(60));
  }

  /**
   * Cleanup and close connections
   */
  async cleanup(): Promise<void> {
    await this.auth.close();
    this.db.close();
    log.info('Cleanup complete');
  }
}
