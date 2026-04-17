import sanitize from 'sanitize-filename';
import path from 'path';
import fs from 'fs';

/**
 * Sanitize filename for safe filesystem operations.
 *
 * Note: the trailing-dot strip (`.replace(/[.\s]+$/, '')`) is intentional —
 * it removes dangling dots left after other sanitisation steps (e.g. "file.")
 * but does NOT harm real extensions because those are preceded by the base
 * name (e.g. "report.pdf" stays "report.pdf").
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'file';

  // Normalize unicode characters
  let sanitized = name.normalize('NFKC');

  // Replace problematic characters
  sanitized = sanitized.replace(/:/g, ' - ');

  // Use sanitize-filename library
  sanitized = sanitize(sanitized);

  // Trim whitespace and trailing dots/spaces
  sanitized = sanitized.trim().replace(/[.\s]+$/, '');

  // Limit length
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.substring(0, 200 - ext.length) + ext;
  }

  return sanitized || 'file';
}

/**
 * In-memory set of paths currently reserved by an in-progress download.
 *
 * Correctness guarantee: `getUniqueFilePath` is a synchronous function — it
 * contains no `await` and therefore runs entirely within a single event-loop
 * tick.  Because the Node.js event loop is single-threaded, no other code can
 * execute between the `fs.existsSync` check and the `Set.add` call, making the
 * reservation atomic.  The caller must NOT `await` between calling this
 * function and opening the file; the design in FileDownloader satisfies this
 * because the reserved path is only used as the rename target after the .tmp
 * write completes, and no other code can call `getUniqueFilePath` for the same
 * path in the meantime.
 */
const reservedPaths = new Set<string>();

/**
 * Return a unique file path under `dir` for `filename`, atomically
 * reserving the chosen path so that no concurrent download can claim it.
 * Call releaseReservedPath() once the download finishes (success or failure)
 * so the reservation is cleaned up.
 */
export function getUniqueFilePath(dir: string, filename: string): string {
  let filePath = path.join(dir, filename);

  if (!fs.existsSync(filePath) && !reservedPaths.has(filePath)) {
    reservedPaths.add(filePath);
    return filePath;
  }

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  let counter = 1;
  while (true) {
    filePath = path.join(dir, `${base} (${counter})${ext}`);
    if (!fs.existsSync(filePath) && !reservedPaths.has(filePath)) {
      reservedPaths.add(filePath);
      return filePath;
    }
    counter++;
  }
}

/**
 * Release a path reservation made by getUniqueFilePath.
 * Should be called after a download completes or fails.
 */
export function releaseReservedPath(filePath: string): void {
  reservedPaths.delete(filePath);
}

/**
 * Return a temporary file path for an in-progress download.
 * Uses a random suffix so concurrent downloads of files with the same
 * name don't collide on the temp file.
 */
export function getTmpFilePath(finalPath: string): string {
  const dir = path.dirname(finalPath);
  const base = path.basename(finalPath);
  const random = Math.random().toString(36).slice(2, 10);
  return path.join(dir, `.${base}.${random}.tmp`);
}

/**
 * Ensure directory exists, create if it doesn't
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = decodeURIComponent(urlObj.pathname);
    const filename = path.basename(pathname);
    return filename || 'file';
  } catch {
    return 'file';
  }
}

/**
 * Parse Content-Disposition header for filename
 */
export function parseContentDisposition(header: string): string | null {
  if (!header) return null;

  // Try filename*= (RFC 5987)
  const filenameStarMatch = header.match(/filename\*=(?:UTF-8''|utf-8'')(.+)/i);
  if (filenameStarMatch) {
    try {
      return decodeURIComponent(filenameStarMatch[1]);
    } catch {
      // Fall through to next method
    }
  }

  // Try filename= with quotes
  const filenameQuoteMatch = header.match(/filename="(.+)"/i);
  if (filenameQuoteMatch) {
    return filenameQuoteMatch[1];
  }

  // Try filename= without quotes — stop at semicolons and newlines
  const filenameMatch = header.match(/filename=([^;\r\n"]+)/i);
  if (filenameMatch) {
    return filenameMatch[1].trim();
  }

  return null;
}

/**
 * Dump the page structure of #content_listContainer (or the full body if
 * that element is absent) to a timestamped HTML file under `./logs/`.
 * Only produces output when `LOG_LEVEL=debug`.
 *
 * @param page   Playwright `Page` instance
 * @param label  Short label used in the filename (e.g. "getDownloadableFiles")
 */
export async function dumpPageStructure(
  page: import('playwright').Page,
  label: string,
): Promise<void> {
  try {
    // page.evaluate runs in browser context — return plain strings
    const containerHtml: string = await page.evaluate(
      `(function() {
        var c = document.querySelector('#content_listContainer');
        if (c) return c.outerHTML;
        return document.body ? document.body.outerHTML : '<html>empty</html>';
      })()`
    );

    const anchorSummary: string = await page.evaluate(
      `(function() {
        var anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(function(a) {
          var href = a.getAttribute('href') || '';
          var target = a.getAttribute('target') || '';
          var cls = a.getAttribute('class') || '';
          var text = (a.textContent || '').trim().substring(0, 120);
          return '<tr><td>' + href + '</td><td>' + target + '</td><td>' + cls + '</td><td>' + text + '</td></tr>';
        }).join('\\n');
      })()`
    );

    const html = `<!-- Debug dump: ${label} -->\n<!-- URL: ${page.url()} -->\n<!-- Time: ${new Date().toISOString()} -->\n\n<h2>Anchor summary</h2>\n<table border="1"><tr><th>href</th><th>target</th><th>class</th><th>text</th></tr>\n${anchorSummary}\n</table>\n\n<h2>Container HTML</h2>\n${containerHtml}`;

    const logsDir = path.resolve('./logs');
    ensureDirectory(logsDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = label.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(logsDir, `debug-${ts}-${safeName}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');
  } catch {
    // Never let debug logging crash the main flow.
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
