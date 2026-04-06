import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { Config } from '../types';
import { log } from '../utils/logger';

export class BlackboardAuth {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Launch browser and create context
   */
  async launchBrowser(): Promise<void> {
    log.info(`Launching ${this.config.browserType} browser...`);

    const browserType = {
      chromium,
      firefox,
      webkit,
    }[this.config.browserType];

    this.browser = await browserType.launch({
      headless: this.config.headless,
      timeout: this.config.browserTimeout,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();
    log.info('Browser launched successfully');
  }

  /**
   * Login to Blackboard
   */
  async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launchBrowser() first.');
    }

    log.info('Navigating to login page...');
    await this.page.goto(this.config.loginUrl, { waitUntil: 'networkidle' });

    // Handle cookie consent if present
    try {
      const cookieButton = await this.page.locator('#agree_button').first();
      if (await cookieButton.isVisible({ timeout: 2000 })) {
        await cookieButton.click();
        log.debug('Cookie consent accepted');
      }
    } catch {
      // Cookie button not found, continue
    }

    // Fill in credentials
    log.info('Entering credentials...');
    await this.page.fill('#user_id', this.config.username);
    await this.page.fill('#password', this.config.password);

    // Click login button
    await this.page.click('#entry-login');

    // Wait for navigation to complete
    await this.page.waitForURL(/.*/, { timeout: this.config.browserTimeout, waitUntil: 'networkidle' });

    // Verify login success by checking for course list
    try {
      await this.page.waitForSelector('ul.portletList-img.courseListing.coursefakeclass li a', {
        timeout: 5000,
      });
      log.info('Login successful');
    } catch {
      throw new Error('Login failed - could not find course list');
    }
  }

  /**
   * Get cookies for authenticated session
   */
  async getCookies(): Promise<any[]> {
    if (!this.context) {
      throw new Error('Browser context not available');
    }
    return await this.context.cookies();
  }

  /**
   * Get page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched');
    }
    return this.page;
  }

  /**
   * Get browser context
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser context not available');
    }
    return this.context;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      log.info('Browser closed');
    }
  }
}
