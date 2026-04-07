import { Page } from 'playwright';
import { Config, Course, ContentFolder, DownloadableFile, SidebarLink } from '../types';
import { log } from '../utils/logger';
import { sanitizeFilename, extractFilenameFromUrl } from '../utils/helpers';

/** Milliseconds to wait for #content_listContainer before giving up on a page. */
const CONTENT_CONTAINER_TIMEOUT_MS = 12_000;

/** URL patterns that indicate page navigation, not downloadable content. */
const NAV_HREF_PATTERNS = [
  'listContent.jsp',
  'displayContent.jsp',
  'courseMenuPalette',
  'javascript:',
];

/**
 * File extensions that are always treated as downloadable regardless of
 * other heuristics.
 */
const FILE_EXT_RE =
  /\.(pdf|pptx?|docx?|xlsx?|zip|rar|7z|gz|mp4|mov|avi|mkv|wmv|mp3|wav|png|jpg|jpeg|gif|bmp|svg|txt|csv|json|xml)$/i;

export class BlackboardScraper {
  private page: Page;
  private config: Config;

  constructor(page: Page, config: Config) {
    this.page = page;
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL with up to `retries` attempts on failure.
   * Returns true on success, false if all attempts fail.
   */
  async navigateTo(url: string, retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.config.browserTimeout,
        });
        log.debug(`Navigated to ${url}`);
        return true;
      } catch (err: any) {
        log.warn(`Navigation attempt ${attempt}/${retries} failed for ${url}: ${err.message}`);
        if (attempt < retries) {
          await this.page.waitForTimeout(2000);
        }
      }
    }
    log.error(`All navigation attempts failed for ${url}`);
    return false;
  }

  // ---------------------------------------------------------------------------
  // Course list
  // ---------------------------------------------------------------------------

  /**
   * Get list of courses from the main page.
   * If `courseFilter` is set, only matching courses are returned.
   * With no filter, ALL courses are returned (with a warning).
   */
  async getCourses(): Promise<Course[]> {
    log.info('Fetching course list...');
    log.debug(`Current page URL: ${this.page.url()}`);

    // Primary selector; try a broader fallback if it times out.
    const PRIMARY_SELECTOR = 'ul.portletList-img.courseListing.coursefakeclass li a';
    const FALLBACK_SELECTOR = 'ul.courseListing li a';

    type RawCourse = { href: string; text: string };
    let rawCourses: RawCourse[] = [];

    try {
      await this.page.waitForSelector(PRIMARY_SELECTOR, { timeout: 10000 });
      rawCourses = await this.page.$$eval(PRIMARY_SELECTOR, els =>
        els.map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent ?? '' }))
      );
      log.debug(`Found ${rawCourses.length} course elements (primary selector)`);
    } catch {
      log.warn('Primary course selector timed out — trying fallback selector');
      try {
        await this.page.waitForSelector(FALLBACK_SELECTOR, { timeout: 5000 });
        rawCourses = await this.page.$$eval(FALLBACK_SELECTOR, els =>
          els.map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent ?? '' }))
        );
        log.debug(`Found ${rawCourses.length} course elements (fallback selector)`);
      } catch {
        log.error('Could not find any course listing on the page');
        return [];
      }
    }

    if (!this.config.courseFilter) {
      log.warn(
        'No COURSE_FILTER set — all courses will be processed. ' +
          'Set COURSE_FILTER (regex) in .env to limit which courses are downloaded.'
      );
    }

    const courses: Course[] = [];

    for (const { href, text } of rawCourses) {
      if (!href || !text) continue;

      const courseName = text.trim().replace(/[\/\\]/g, '_');
      log.debug(`Processing course: "${courseName}" href="${href}"`);

      // Apply course filter if configured; otherwise accept everything.
      if (this.config.courseFilter) {
        const regex = new RegExp(this.config.courseFilter);
        if (!regex.test(text.trim())) {
          log.debug(`Skipping course: ${courseName} (does not match filter)`);
          continue;
        }
      }

      const cleanHref = href.trim();
      const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

      log.debug(`Adding course: "${courseName}" -> ${fullUrl}`);
      courses.push({
        id: href.split('id=')[1] || '',
        name: courseName,
        url: fullUrl,
        path: sanitizeFilename(courseName),
      });
    }

    log.info(`Found ${courses.length} courses matching filters`);
    return courses;
  }

  // ---------------------------------------------------------------------------
  // Sidebar links
  // ---------------------------------------------------------------------------

  /**
   * Get sidebar links for a course.
   */
  async getSidebarLinks(courseUrl: string): Promise<SidebarLink[]> {
    log.debug(`Navigating to course: ${courseUrl}`);
    const ok = await this.navigateTo(courseUrl);
    if (!ok) {
      log.error(`Could not navigate to course ${courseUrl}`);
      return [];
    }
    log.debug(`Successfully navigated to course, current URL: ${this.page.url()}`);

    await this.page.waitForSelector('#courseMenuPalette_contents li a', { timeout: 10000 });

    const rawLinks = await this.page.$$eval('#courseMenuPalette_contents li a', els =>
      els.map(el => ({
        href: el.getAttribute('href') ?? '',
        title: el.querySelector('span')?.getAttribute('title') ?? '',
      }))
    );
    log.debug(`Found ${rawLinks.length} sidebar link elements`);

    const links: SidebarLink[] = [];

    for (const { href, title } of rawLinks) {
      if (!href || !title) continue;

      log.debug(`Processing sidebar link: "${title}" href="${href}"`);
      const normalizedTitle = title.trim().toLowerCase();

      // Skip non-content pages
      if (['home page', 'discussions', 'groups', 'tools', 'help'].includes(normalizedTitle)) {
        log.debug(`Skipping non-content page: ${title}`);
        continue;
      }

      const cleanHref = href.trim();
      const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

      log.debug(`Adding sidebar link: "${title}" -> ${fullUrl}`);
      links.push({
        title: title.trim().replace(/[\/\\]/g, '_'),
        url: fullUrl,
        path: sanitizeFilename(title.trim().replace(/[\/\\]/g, '_')),
      });
    }

    log.debug(`Found ${links.length} sidebar links (after filtering)`);
    return links;
  }

  // ---------------------------------------------------------------------------
  // Downloadable files
  // ---------------------------------------------------------------------------

  /**
   * Get downloadable files from the current page.
   *
   * A single `$$eval` call gathers every `<a href>` inside
   * `#content_listContainer` — capturing `href`, display text, `target`,
   * and whether the element sits inside `.attachments` or `.details`.
   * All filtering and deduplication then happen in TypeScript, cutting the
   * number of Playwright RPC round-trips from O(N) to O(1).
   *
   * Recognised patterns (unchanged from previous implementation):
   *   1. target="_blank" links
   *   2. /bbcswebdav/ direct storage links
   *   3. content/file endpoint links
   *   4. execute/content endpoint links
   *   5. .attachments sub-list links
   *   6. .details sub-element links
   *   7. Extension-based heuristic catch-all
   *
   * Results are deduplicated by absolute URL.
   */
  async getDownloadableFiles(basePath: string): Promise<DownloadableFile[]> {
    const seenUrls = new Set<string>();
    const files: DownloadableFile[] = [];
    log.debug(`Scanning for downloadable files on page: ${this.page.url()}`);

    try {
      await this.page.waitForSelector('#content_listContainer', { timeout: CONTENT_CONTAINER_TIMEOUT_MS });
    } catch {
      log.debug('No #content_listContainer found on current page — skipping file scan');
      return files;
    }

    // Gather all anchor data in a single JS evaluation.
    const rawLinks = await this.page.$$eval('#content_listContainer a[href]', els =>
      els.map(el => ({
        href: el.getAttribute('href') ?? '',
        text: el.textContent ?? '',
        target: el.getAttribute('target') ?? '',
        inAttachments: el.closest('.attachments') !== null,
        inDetails: el.closest('.details') !== null,
      }))
    );

    const isNavHref = (href: string): boolean =>
      NAV_HREF_PATTERNS.some(p => href.includes(p));

    for (const { href, text, target, inAttachments, inDetails } of rawLinks) {
      if (!href || isNavHref(href)) continue;

      // Check whether this link matches any of the 7 download patterns.
      const isBlank = target === '_blank';
      const isBbcs = href.includes('/bbcswebdav/');
      const isContentFile = href.includes('content/file');
      const isExecuteContent = href.includes('execute/content');
      const isExtHeuristic = FILE_EXT_RE.test(href);

      if (!isBlank && !isBbcs && !isContentFile && !isExecuteContent && !inAttachments && !inDetails && !isExtHeuristic) {
        continue;
      }

      const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const displayName = text.trim() || extractFilenameFromUrl(fullUrl);
      log.debug(`Found downloadable file: "${displayName}" -> ${fullUrl}`);
      files.push({ name: displayName, url: fullUrl, path: basePath, status: 'pending' });
    }

    log.info(`Found ${files.length} downloadable files in current folder`);
    return files;
  }

  // ---------------------------------------------------------------------------
  // Subfolders
  // ---------------------------------------------------------------------------

  /**
   * Get subfolders from the current page, deduplicated by URL.
   * Uses a single `$$eval` call to fetch all candidate links in one round-trip.
   */
  async getSubfolders(parentPath: string): Promise<ContentFolder[]> {
    const folders: ContentFolder[] = [];
    const seenUrls = new Set<string>();
    log.debug(`Scanning for subfolders on page: ${this.page.url()}`);

    try {
      const rawLinks = await this.page.$$eval('div.item.clearfix a', els =>
        els.map(el => ({ href: el.getAttribute('href') ?? '', text: el.textContent ?? '' }))
      );
      log.debug(`Found ${rawLinks.length} potential folder elements`);

      for (const { href, text } of rawLinks) {
        if (!href || !text || !href.includes('listContent.jsp')) continue;

        const cleanHref = href.trim();
        const fullUrl = cleanHref.startsWith('http')
          ? cleanHref
          : `${this.config.baseUrl}${cleanHref}`;

        if (seenUrls.has(fullUrl)) {
          log.debug(`Skipping duplicate subfolder URL: ${fullUrl}`);
          continue;
        }
        seenUrls.add(fullUrl);

        const folderName = text.trim().replace(/[\/\\]/g, '_');
        log.debug(`Found subfolder: "${folderName}" -> ${fullUrl}`);

        folders.push({
          name: folderName,
          url: fullUrl,
          path: sanitizeFilename(folderName),
          parentPath,
        });
      }

      if (folders.length > 0) {
        log.info(`Found ${folders.length} subfolders`);
      }
    } catch (error) {
      log.debug('No subfolders found on current page');
    }

    return folders;
  }

  // ---------------------------------------------------------------------------
  // Navigation utilities
  // ---------------------------------------------------------------------------

  /**
   * Navigate back in browser history.
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle' });
  }

  /**
   * Return to My Institution page.
   */
  async returnToHome(): Promise<void> {
    try {
      await this.page.click('td[id="MyInstitution.label"] a', { timeout: 5000 });
      await this.page.waitForLoadState('networkidle');
      log.debug('Returned to My Institution page');
    } catch {
      log.warn('Could not return to My Institution page');
    }
  }
}
