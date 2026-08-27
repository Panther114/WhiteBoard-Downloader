import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright-core';
import { Config } from '../types';
import { log } from '../utils/logger';

function isTransientNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ERR_ABORTED|frame was detached|target page, context or browser has been closed/i.test(message);
}

export class BlackboardAuth {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async navigateToLogin(): Promise<void> {
    if (!this.page) throw new Error('Browser page is unavailable.');

    let navigationError: unknown;
    try {
      // Commit is enough to establish the document. Waiting for the login form
      // below avoids failing when Blackboard replaces the document during a
      // redirect, which can surface as net::ERR_ABORTED in Playwright.
      await this.page.goto(this.config.loginUrl, {
        waitUntil: 'commit',
        timeout: this.config.browserTimeout,
      });
    } catch (error) {
      if (!isTransientNavigationError(error)) throw error;
      navigationError = error;
      log.warn('Blackboard replaced the login document during navigation; waiting for the resulting page.');
    }

    try {
      await this.page.waitForSelector('#user_id', {
        state: 'visible',
        timeout: Math.min(this.config.browserTimeout, 10000),
      });
    } catch (error) {
      if (navigationError) throw navigationError;
      throw error;
    }
  }

  /**
   * Launch browser and create context
   */
  async launchBrowser(): Promise<void> {
    log.info(`Launching ${this.config.browserType} browser...`);
    log.debug(`Browser options: headless=${this.config.headless}, timeout=${this.config.browserTimeout}ms`);

    const browserType = {
      chromium,
      firefox,
      webkit,
    }[this.config.browserType];

    const launchOptions = {
      headless: this.config.headless,
      timeout: this.config.browserTimeout,
      ...(this.config.browserType === 'chromium' && this.config.useSystemEdge ? { channel: 'msedge' } : {}),
    };
    const contextOptions = {
      viewport: { width: 1920, height: 1080 } as const,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    try {
      if (this.config.browserType === 'chromium' && this.config.browserProfileDir) {
        this.context = await chromium.launchPersistentContext(this.config.browserProfileDir, {
          ...launchOptions,
          ...contextOptions,
        });
        this.page = this.context.pages()[0] || await this.context.newPage();
      } else {
        this.browser = await browserType.launch(launchOptions);
        this.context = await this.browser.newContext(contextOptions);
        this.page = await this.context.newPage();
      }
    } catch (error) {
      if (this.config.browserType !== 'chromium' || !this.config.useSystemEdge) throw error;
      log.warn('Microsoft Edge could not be launched; falling back to the managed Playwright Chromium.');
      if (this.config.browserProfileDir) {
        this.context = await chromium.launchPersistentContext(this.config.browserProfileDir, { ...contextOptions, headless: this.config.headless });
        this.page = this.context.pages()[0] || await this.context.newPage();
      } else {
        this.browser = await chromium.launch({ headless: this.config.headless, timeout: this.config.browserTimeout });
        this.context = await this.browser.newContext(contextOptions);
        this.page = await this.context.newPage();
      }
    }
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
    log.debug(`Login URL: ${this.config.loginUrl}`);
    await this.navigateToLogin();
    log.debug(`Current URL after navigation: ${this.page.url()}`);

    // Handle cookie consent if present
    try {
      const cookieButton = await this.page.locator('#agree_button').first();
      if (await cookieButton.isVisible({ timeout: 2000 })) {
        await cookieButton.click();
        log.debug('Cookie consent accepted');
      }
    } catch {
      log.debug('No cookie consent button found');
    }

    // Fill in credentials
    log.info('Entering credentials...');
    log.debug(`Username: ${this.config.username.substring(0, 3)}***`);
    await this.page.fill('#user_id', this.config.username);
    await this.page.fill('#password', this.config.password);

    // Click login button
    log.debug('Clicking login button');
    await this.page.click('#entry-login');

    // Blackboard keeps background requests alive, so network idle is not a
    // useful completion signal. The course selector below is the success
    // signal; wait briefly for the document to settle when it does navigate.
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: this.config.browserTimeout });
    } catch (error) {
      if (isTransientNavigationError(error)) {
        log.debug('Login document was replaced while waiting for the next page.');
      } else {
        // A slow Blackboard response is not a failed login. The course
        // selector check below is the authoritative success signal.
        log.debug('Login document did not finish loading before the timeout; validating the course selector.');
      }
    }
    log.debug(`URL after login: ${this.page.url()}`);

    // Verify login success by checking for course list
    try {
      await this.page.waitForSelector('ul.portletList-img.courseListing.coursefakeclass li a', {
        timeout: 5000,
      });
      log.info('Login successful');
    } catch {
      log.error('Login verification failed - course list not found');
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
    const cookies = await this.context.cookies();
    log.debug(`Retrieved ${cookies.length} cookies from session`);
    return cookies;
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
    } else if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}
