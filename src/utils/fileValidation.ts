import path from 'path';
import {
  BLOCKED_FILE_EXTENSIONS,
  MIME_TO_EXTENSION,
  SUPPORTED_FILE_TYPE_SET,
  getSupportedExtensionFromMime,
} from './fileType';

export const ALLOWED_FILE_EXTENSIONS = SUPPORTED_FILE_TYPE_SET;

export const ALLOWED_DOC_EXT_RE = /\.(pdf|pptx?|docx?|xlsx?)$/i;
const ALLOWED_EXT_PATTERN = Array.from(ALLOWED_FILE_EXTENSIONS).join('|');
const ALLOWED_EXT_TOKEN_RE = new RegExp(`\\.(${ALLOWED_EXT_PATTERN})\\b`, 'i');

export const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXTENSION));

const BLOCKED_EXT_PATTERN = Array.from(BLOCKED_FILE_EXTENSIONS).join('|');
const BLOCKED_EXT_RE = new RegExp(`\\.(${BLOCKED_EXT_PATTERN})\\b`, 'i');

const BLOCKED_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/json',
  'application/xml',
  'text/xml',
]);

const BLOCKED_MIME_PREFIXES = ['audio/', 'video/', 'image/'];

export function safelyDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function getExtensionFromPathLike(input: string): string | undefined {
  const decoded = safelyDecode(input.trim().toLowerCase());
  const ext = path.extname(decoded).slice(1).toLowerCase();
  return ext || undefined;
}

export function getAllowedExtFromName(nameOrUrl: string): string | undefined {
  if (!nameOrUrl) return undefined;

  const normalized = safelyDecode(nameOrUrl.trim());
  if (!normalized) return undefined;

  try {
    const parsed = new URL(normalized);
    const pathnameExt = getExtensionFromPathLike(parsed.pathname);
    if (pathnameExt && ALLOWED_FILE_EXTENSIONS.has(pathnameExt)) return pathnameExt;
  } catch {
    // not a URL, continue
  }

  const directExt = getExtensionFromPathLike(normalized);
  if (directExt && ALLOWED_FILE_EXTENSIONS.has(directExt)) return directExt;

  const trailingMatch = normalized.match(ALLOWED_EXT_TOKEN_RE);
  const trailingExt = trailingMatch?.[1]?.toLowerCase();
  return trailingExt && ALLOWED_FILE_EXTENSIONS.has(trailingExt) ? trailingExt : undefined;
}

export function getExtensionFromUrlPath(url: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return getExtensionFromPathLike(parsed.pathname);
  } catch {
    return getExtensionFromPathLike(url);
  }
}

export function isAllowedMimeType(mimeType?: string): boolean {
  return Boolean(getSupportedExtensionFromMime(mimeType));
}

export function isBlockedMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.trim().toLowerCase();
  if (BLOCKED_MIME_TYPES.has(normalized)) return true;
  return BLOCKED_MIME_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function hasBlockedExtension(nameOrUrl?: string): boolean {
  if (!nameOrUrl) return false;

  const ext = getExtensionFromUrlPath(nameOrUrl) ?? getExtensionFromPathLike(nameOrUrl);
  if (ext && BLOCKED_FILE_EXTENSIONS.has(ext)) return true;

  const fromName = safelyDecode(nameOrUrl).match(BLOCKED_EXT_RE)?.[1]?.toLowerCase();
  return Boolean(fromName && BLOCKED_FILE_EXTENSIONS.has(fromName));
}

export function isAllowedDocumentCandidate(input: {
  name?: string;
  url?: string;
  mimeType?: string;
}): boolean {
  if (isBlockedMimeType(input.mimeType)) return false;
  if (hasBlockedExtension(input.name) || hasBlockedExtension(input.url)) return false;

  if (isAllowedMimeType(input.mimeType)) return true;
  if (input.name && getAllowedExtFromName(input.name)) return true;
  if (input.url && getAllowedExtFromName(input.url)) return true;

  return false;
}
