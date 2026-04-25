import path from 'path';

export const SUPPORTED_FILE_TYPES = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'] as const;
export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

export const SUPPORTED_FILE_TYPE_SET = new Set<string>(SUPPORTED_FILE_TYPES);

export const BLOCKED_FILE_EXTENSIONS = new Set<string>([
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

export const MIME_TO_EXTENSION: Record<string, SupportedFileType> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

function normalizeMime(mimeType?: string): string | undefined {
  if (!mimeType) return undefined;
  return mimeType.split(';')[0].trim().toLowerCase() || undefined;
}

export function getSupportedExtensionFromMime(mimeType?: string): SupportedFileType | undefined {
  const normalized = normalizeMime(mimeType);
  if (!normalized) return undefined;
  return MIME_TO_EXTENSION[normalized];
}

export function getExtensionFromName(filename?: string): string | undefined {
  if (!filename) return undefined;
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext || undefined;
}

export function hasSupportedExtension(filename?: string): boolean {
  const ext = getExtensionFromName(filename);
  return Boolean(ext && SUPPORTED_FILE_TYPE_SET.has(ext));
}

export function normalizeSupportedFilename(
  filename: string,
  mimeType?: string,
): {
  accepted: boolean;
  normalizedName: string;
  extension?: SupportedFileType;
  reason?: 'unsupported_extension' | 'unknown_type';
} {
  const safeName = filename?.trim() || 'file';
  const currentExt = getExtensionFromName(safeName);
  const extFromMime = getSupportedExtensionFromMime(mimeType);

  if (currentExt) {
    if (SUPPORTED_FILE_TYPE_SET.has(currentExt)) {
      return {
        accepted: true,
        normalizedName: safeName,
        extension: currentExt as SupportedFileType,
      };
    }

    if (BLOCKED_FILE_EXTENSIONS.has(currentExt)) {
      return {
        accepted: false,
        normalizedName: safeName,
        reason: 'unsupported_extension',
      };
    }

    if (extFromMime) {
      const extWithDot = path.extname(safeName);
      const baseName = path.basename(safeName, extWithDot);
      const normalizedBase = baseName || 'file';
      return {
        accepted: true,
        normalizedName: `${normalizedBase}.${extFromMime}`,
        extension: extFromMime,
      };
    }

    return {
      accepted: false,
      normalizedName: safeName,
      reason: 'unknown_type',
    };
  }

  if (!extFromMime) {
    return {
      accepted: false,
      normalizedName: safeName,
      reason: 'unknown_type',
    };
  }

  return {
    accepted: true,
    normalizedName: `${safeName}.${extFromMime}`,
    extension: extFromMime,
  };
}
