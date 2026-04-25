import { Page } from 'playwright';
import { Config, Course, ContentFolder, DownloadableFile, SidebarLink } from '../types';
import { log } from '../utils/logger';
import { sanitizeFilename, extractFilenameFromUrl, dumpPageStructure } from '../utils/helpers';
import {
  ALLOWED_DOC_EXT_RE,
  getAllowedExtFromName,
  hasBlockedExtension,
  isAllowedDocumentCandidate,
  safelyDecode,
} from '../utils/fileValidation';

/** Milliseconds to wait for #content_listContainer before giving up on a page. */
const CONTENT_CONTAINER_TIMEOUT_MS = 12_000;

/** URL patterns that indicate page navigation, not downloadable content. */
const NAV_HREF_PATTERNS = [
  'listContent.jsp',
  'displayContent.jsp',
  'courseMenuPalette',
  'javascript:',
  // Blackboard application/tool pages — never downloadable files
  'execute/courseMain',
  'execute/announcement',
  'execute/blti',
  'execute/modulepage',
  'execute/viewSurvey',
  'execute/take_test_student',
  'execute/overview',
  'execute/gradebook',
  'execute/discussionboard',
  'execute/calendar',
  'webapps/calendar',
  'webapps/discussionboard',
  'webapps/blackboard/execute/announcement',
];

/** Known-safe execute/ URL fragments that are actual file downloads. */
const SAFE_EXECUTE_PATTERNS = ['execute/content'];

/** Subject signals used only for logging / ranking confidence. */
const LIKELY_SUBJECT_PATTERNS = [
  /chemistry/i,
  /biology/i,
  /physics/i,
  /history/i,
  /english/i,
  /chinese|中文|语文/i,
  /math|mathematics|数学/i,
  /geometry/i,
  /algebra/i,
  /calculus/i,
  /computer/i,
  /programming/i,
  /economics/i,
  /literature/i,
  /psychology/i,
  /statistics/i,
  /\bap\b/i,
  /honors/i,
];

export interface RawContentLink {
  href: string;
  text: string;
  inAttachments: boolean;
  inDetails: boolean;
  nearAttachedFiles: boolean;
  itemText: string;
}

function normalizeAbsoluteUrl(href: string, baseUrl: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function isNavigationHref(href: string): boolean {
  return NAV_HREF_PATTERNS.some(p => href.includes(p));
}

function isExternalUrl(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    return parsed.origin !== base.origin;
  } catch {
    return true;
  }
}

export function collectDownloadCandidates(
  rawLinks: RawContentLink[],
  baseUrl: string,
  savePath: string,
): DownloadableFile[] {
  const files: DownloadableFile[] = [];
  const seenUrls = new Set<string>();

  for (const raw of rawLinks) {
    const href = raw.href.trim();
    const text = safelyDecode(raw.text.trim());

    if (!href || isNavigationHref(href)) continue;

    const fullUrl = normalizeAbsoluteUrl(href, baseUrl);
    if (!fullUrl || isExternalUrl(fullUrl, baseUrl)) continue;
    if (seenUrls.has(fullUrl)) continue;

    const isBbcs = href.includes('/bbcswebdav/');
    const isContentFile = href.includes('content/file');
    const isExecuteContent = href.includes('execute/content');
    const textHasAllowedExt = Boolean(getAllowedExtFromName(text));
    let urlHasAllowedExt = false;
    try {
      urlHasAllowedExt = ALLOWED_DOC_EXT_RE.test(new URL(fullUrl).pathname);
    } catch {
      continue;
    }
    const candidatePositive =
      isBbcs ||
      isContentFile ||
      isExecuteContent ||
      raw.inAttachments ||
      raw.nearAttachedFiles ||
      raw.inDetails ||
      textHasAllowedExt ||
      urlHasAllowedExt;

    if (!candidatePositive) continue;

    if (href.includes('execute/') && !SAFE_EXECUTE_PATTERNS.some(p => href.includes(p))) continue;
    if (hasBlockedExtension(text) || hasBlockedExtension(fullUrl)) continue;

    const allowedCandidate = isAllowedDocumentCandidate({ name: text, url: fullUrl });
    if (!allowedCandidate && !isBbcs && !isContentFile && !isExecuteContent) continue;

    seenUrls.add(fullUrl);
    const displayName = text || extractFilenameFromUrl(fullUrl) || 'file';
    files.push({ name: displayName, url: fullUrl, path: savePath, status: 'pending' });
  }

  return files;
}

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
   * Uses `domcontentloaded` instead of `networkidle` for speed — Blackboard
   * pages with analytics widgets often never reach networkidle.
   * Returns true on success, false if all attempts fail.
   */
  async navigateTo(url: string, retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
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
   * Always returns the full discovered list for user-facing selection flows.
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

    const courses: Course[] = [];
    for (const { href, text } of rawCourses) {
      if (!href || !text) continue;

      const courseName = text.trim().replace(/[\/\\]/g, '_');
      log.debug(`Processing course: "${courseName}" href="${href}"`);

      const normalizedName = text.trim();

      const cleanHref = href.trim();
      const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;
      const matchedSubjectSignal = LIKELY_SUBJECT_PATTERNS.some(pattern => pattern.test(normalizedName));

      log.debug(
        `Adding course: "${courseName}" -> ${fullUrl} ` +
          `(subjectSignal=${matchedSubjectSignal ? 'yes' : 'no'})`
      );
      courses.push({
        id: href.split('id=')[1] || '',
        name: courseName,
        url: fullUrl,
        path: sanitizeFilename(courseName),
      });
    }

    log.info(`Course discovery: found ${rawCourses.length}, included ${courses.length}`);

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

    try {
      await this.page.waitForSelector('#courseMenuPalette_contents li a', { timeout: 10000 });
    } catch {
      log.warn(
        `Sidebar menu not found for course URL ${courseUrl} — ` +
          'the course may use a non-standard layout. Returning empty sidebar.'
      );
      return [];
    }

    const rawLinks = await this.page.$$eval('#courseMenuPalette_contents li a', els =>
      els.map(el => ({
        href: el.getAttribute('href') ?? '',
        title: el.querySelector('span')?.getAttribute('title') ?? '',
        text: el.textContent ?? '',
      }))
    );
    log.debug(`Found ${rawLinks.length} sidebar link elements`);

    const candidates: SidebarLink[] = [];
    const isExcludedTitle = (title: string): boolean => {
      const normalized = title.toLowerCase();
      return ['home page', 'discussions', 'groups', 'tools', 'help'].includes(normalized);
    };

    const isToolLike = (title: string): boolean =>
      /discussion|group|tool|help|announcement|calendar|grade/i.test(title);

    const isContentLike = (title: string): boolean =>
      /\bcontent\b|课程内容|教学内容|內容/i.test(title);

    for (const { href, title, text } of rawLinks) {
      const rawTitle = (title || text).trim();
      if (!href || !rawTitle) continue;

      log.debug(`Sidebar link found: "${rawTitle}" href="${href}"`);
      if (isExcludedTitle(rawTitle) || isToolLike(rawTitle)) {
        log.debug(`Skipping sidebar link: "${rawTitle}" (tool/non-content)`);
        continue;
      }

      const cleanHref = href.trim();
      const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

      candidates.push({
        title: rawTitle.replace(/[\/\\]/g, '_'),
        url: fullUrl,
        path: sanitizeFilename(rawTitle.replace(/[\/\\]/g, '_')),
      });
    }

    const contentLike = candidates.filter(link => isContentLike(link.title));
    const links = contentLike.length > 0 ? contentLike : candidates;

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
   * Media files (mp4, mp3, etc.) are excluded unconditionally.
   * Ambiguous `execute/` links that aren't in the safe-list are flagged.
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
      // Enhanced debug: include page URL and title so we know what page was hit
      const pageTitle = await this.page.title().catch(() => '(unknown)');
      log.debug(
        `No #content_listContainer found on current page — skipping file scan. ` +
        `URL: ${this.page.url()}, title: "${pageTitle}"`
      );
      return files;
    }

    // Dump full page structure to logs when running in debug mode
    if (this.config.logLevel === 'debug') {
      await dumpPageStructure(this.page, 'getDownloadableFiles');
    }

    // Gather all anchor data in a single JS evaluation.
    const rawLinks = await this.page.$$eval('#content_listContainer a[href]', els =>
      els.map(el => ({
        href: el.getAttribute('href') ?? '',
        text: el.textContent ?? '',
        inAttachments: el.closest('.attachments') !== null,
        inDetails: el.closest('.details') !== null,
        nearAttachedFiles: /attached files?/i.test(
          `${el.parentElement?.textContent ?? ''} ${el.closest('.item')?.textContent ?? ''}`
        ),
        itemText: (el.closest('li.liItem,div.item,li')?.textContent ?? '').trim().substring(0, 240),
      }))
    );
    const candidates = collectDownloadCandidates(rawLinks, this.config.baseUrl, basePath);

    for (const file of candidates) {
      if (seenUrls.has(file.url)) continue;
      seenUrls.add(file.url);
      log.debug(`Found downloadable candidate: "${file.name}" -> ${file.url}`);
      files.push(file);
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
    await this.page.goBack({ waitUntil: 'domcontentloaded' });
  }

  /**
   * Return to My Institution page.
   */
  async returnToHome(): Promise<void> {
    try {
      await this.page.click('td[id="MyInstitution.label"] a', { timeout: 5000 });
      await this.page.waitForLoadState('domcontentloaded');
      log.debug('Returned to My Institution page');
    } catch {
      log.warn('Could not return to My Institution page');
    }
  }
}
