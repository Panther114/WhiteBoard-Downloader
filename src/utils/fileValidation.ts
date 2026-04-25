import path from 'path';

export const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf',
  'ppt',
  'pptx',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

export const ALLOWED_DOC_EXT_RE = /\.(pdf|pptx?|docx?|xlsx?)$/i;

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const BLOCKED_EXTENSIONS = new Set([
  'zip',
  'rar',
  '7z',
  'gz',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'svg',
  'webp',
  'heic',
  'mp4',
  'mp3',
  'mov',
  'avi',
  'mkv',
  'wmv',
  'webm',
  'flv',
  'wav',
  'aac',
  'ogg',
  'm4a',
  'm4v',
  'txt',
  'csv',
  'json',
  'xml',
]);

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

  const trailingMatch = normalized.match(/\.(pdf|pptx?|docx?|xlsx?)\b/i);
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
  if (!mimeType) return false;
  return ALLOWED_MIME_TYPES.has(mimeType.trim().toLowerCase());
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
  if (ext && BLOCKED_EXTENSIONS.has(ext)) return true;

  const fromName = safelyDecode(nameOrUrl).match(/\.(zip|rar|7z|gz|png|jpg|jpeg|gif|bmp|svg|webp|heic|mp4|mp3|mov|avi|mkv|wmv|webm|flv|wav|aac|ogg|m4a|m4v|txt|csv|json|xml)\b/i)?.[1]?.toLowerCase();
  return Boolean(fromName && BLOCKED_EXTENSIONS.has(fromName));
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
