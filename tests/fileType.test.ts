import {
  getSupportedExtensionFromMime,
  normalizeSupportedFilename,
  hasSupportedExtension,
} from '../src/utils/fileType';

describe('file type normalization', () => {
  it('keeps existing supported extension', () => {
    const result = normalizeSupportedFilename('Lecture Notes.pdf', 'application/pdf');
    expect(result.accepted).toBe(true);
    expect(result.normalizedName).toBe('Lecture Notes.pdf');
    expect(result.extension).toBe('pdf');
  });

  it('appends extension from MIME when missing', () => {
    const result = normalizeSupportedFilename('download', 'application/pdf');
    expect(result.accepted).toBe(true);
    expect(result.normalizedName).toBe('download.pdf');
    expect(result.extension).toBe('pdf');
  });

  it('maps pptx MIME correctly', () => {
    expect(
      getSupportedExtensionFromMime(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe('pptx');
  });

  it('rejects unsupported extension even if MIME is known', () => {
    const result = normalizeSupportedFilename('archive.zip', 'application/pdf');
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('unsupported_extension');
  });

  it('checks supported extension helper', () => {
    expect(hasSupportedExtension('x.docx')).toBe(true);
    expect(hasSupportedExtension('x.txt')).toBe(false);
  });
});
