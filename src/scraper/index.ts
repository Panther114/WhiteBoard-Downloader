import { Page } from 'playwright';
import { Config, Course, ContentFolder, DownloadableFile, SidebarLink } from '../types';
import { log } from '../utils/logger';
import { sanitizeFilename } from '../utils/helpers';

export class BlackboardScraper {
  private page: Page;
  private config: Config;

  constructor(page: Page, config: Config) {
    this.page = page;
    this.config = config;
  }

  /**
   * Get list of courses from the main page
   */
  async getCourses(): Promise<Course[]> {
    log.info('Fetching course list...');

    await this.page.waitForSelector('ul.portletList-img.courseListing.coursefakeclass li a', {
      timeout: 10000,
    });

    const courseElements = await this.page.locator('ul.portletList-img.courseListing.coursefakeclass li a').all();
    const courses: Course[] = [];

    for (const element of courseElements) {
      const href = await element.getAttribute('href');
      const text = await element.textContent();

      if (href && text) {
        const courseName = text.trim().replace(/[\/\\]/g, '_');

        // Apply course filter if configured
        if (this.config.courseFilter) {
          const regex = new RegExp(this.config.courseFilter);
          if (!regex.test(text.trim())) {
            log.debug(`Skipping course: ${text.trim()} (does not match filter)`);
            continue;
          }
        }

        // Default filter: only courses starting with current semester (e.g., "2025I")
        if (text.trim().startsWith('2025I') || text.trim().startsWith('2026I')) {
          // Clean and construct full URL
          const cleanHref = href.trim();
          const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

          courses.push({
            id: href.split('id=')[1] || '',
            name: courseName,
            url: fullUrl,
            path: sanitizeFilename(courseName),
          });
        }
      }
    }

    log.info(`Found ${courses.length} courses`);
    return courses;
  }

  /**
   * Get sidebar links for a course
   */
  async getSidebarLinks(courseUrl: string): Promise<SidebarLink[]> {
    log.debug(`Navigating to course: ${courseUrl}`);
    await this.page.goto(courseUrl, { waitUntil: 'networkidle' });

    await this.page.waitForSelector('#courseMenuPalette_contents li a', { timeout: 10000 });

    const linkElements = await this.page.locator('#courseMenuPalette_contents li a').all();
    const links: SidebarLink[] = [];

    for (const element of linkElements) {
      const href = await element.getAttribute('href');
      const titleElement = await element.locator('span').first();
      const title = await titleElement.getAttribute('title');

      if (href && title) {
        const normalizedTitle = title.trim().toLowerCase();

        // Skip non-content pages
        if (!['home page', 'discussions', 'groups', 'tools', 'help'].includes(normalizedTitle)) {
          // Clean and construct full URL
          const cleanHref = href.trim();
          const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

          links.push({
            title: title.trim().replace(/[\/\\]/g, '_'),
            url: fullUrl,
            path: sanitizeFilename(title.trim().replace(/[\/\\]/g, '_')),
          });
        }
      }
    }

    log.debug(`Found ${links.length} sidebar links`);
    return links;
  }

  /**
   * Get downloadable files from current page
   */
  async getDownloadableFiles(basePath: string): Promise<DownloadableFile[]> {
    const files: DownloadableFile[] = [];

    try {
      await this.page.waitForSelector('#content_listContainer a[target="_blank"]', { timeout: 2000 });
      const fileElements = await this.page.locator('#content_listContainer a[target="_blank"]').all();

      for (const element of fileElements) {
        const href = await element.getAttribute('href');
        const text = await element.textContent();

        if (!href) continue;

        // Skip Blackboard navigation links
        if (href.includes('listContent.jsp')) {
          log.debug(`Skipped navigation link: ${href}`);
          continue;
        }

        const displayName = text?.trim() || '';
        const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;

        files.push({
          name: displayName,
          url: fullUrl,
          path: basePath,
          status: 'pending',
        });
      }
    } catch (error) {
      log.debug(`No downloadable files found on current page`);
    }

    return files;
  }

  /**
   * Get subfolders from current page
   */
  async getSubfolders(parentPath: string): Promise<ContentFolder[]> {
    const folders: ContentFolder[] = [];

    try {
      const folderElements = await this.page.locator('div.item.clearfix a').all();

      for (const element of folderElements) {
        const href = await element.getAttribute('href');
        const text = await element.textContent();

        if (href && text && href.includes('listContent.jsp')) {
          const folderName = text.trim().replace(/[\/\\]/g, '_');

          // Clean and construct full URL
          const cleanHref = href.trim();
          const fullUrl = cleanHref.startsWith('http') ? cleanHref : `${this.config.baseUrl}${cleanHref}`;

          folders.push({
            name: folderName,
            url: fullUrl,
            path: sanitizeFilename(folderName),
            parentPath,
          });
        }
      }
    } catch (error) {
      log.debug('No subfolders found on current page');
    }

    return folders;
  }

  /**
   * Navigate back in browser history
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle' });
  }

  /**
   * Return to My Institution page
   */
  async returnToHome(): Promise<void> {
    try {
      await this.page.click('td[id="MyInstitution.label"] a', { timeout: 5000 });
      await this.page.waitForLoadState('networkidle');
      log.debug('Returned to My Institution page');
    } catch (error) {
      log.warn('Could not return to My Institution page');
    }
  }
}
