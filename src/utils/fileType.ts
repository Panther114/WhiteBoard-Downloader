import path from 'path';

export const SUPPORTED_FILE_TYPES = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'] as const;
export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

export const SUPPORTED_FILE_TYPE_SET = new Set<string>(SUPPORTED_FILE_TYPES);

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

  if (currentExt) {
    if (SUPPORTED_FILE_TYPE_SET.has(currentExt)) {
      return {
        accepted: true,
        normalizedName: safeName,
        extension: currentExt as SupportedFileType,
      };
    }

    return {
      accepted: false,
      normalizedName: safeName,
      reason: 'unsupported_extension',
    };
  }

  const extFromMime = getSupportedExtensionFromMime(mimeType);
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
