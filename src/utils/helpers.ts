import sanitize from 'sanitize-filename';
import path from 'path';
import fs from 'fs';

/**
 * Sanitize filename for safe filesystem operations
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
 * Get unique file path by appending number if file exists
 */
export function getUniqueFilePath(dir: string, filename: string): string {
  let filePath = path.join(dir, filename);

  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  let counter = 1;
  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }

  return filePath;
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

  // Try filename= without quotes
  const filenameMatch = header.match(/filename=([^;]+)/i);
  if (filenameMatch) {
    return filenameMatch[1].trim();
  }

  return null;
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
