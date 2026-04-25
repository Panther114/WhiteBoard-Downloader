import {
  getAllowedExtFromName,
  isAllowedDocumentCandidate,
  isAllowedMimeType,
} from '../src/utils/fileValidation';
import { parseContentDisposition } from '../src/utils/helpers';

describe('file allowlist validation', () => {
  test.each(['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'])(
    'accepts allowed extension .%s',
    ext => {
      expect(isAllowedDocumentCandidate({ name: `lesson.${ext}` })).toBe(true);
      expect(getAllowedExtFromName(`lesson.${ext}`)).toBe(ext);
    }
  );

  test.each(['zip', 'rar', '7z', 'png', 'jpg', 'mp4', 'mp3', 'txt', 'csv', 'json', 'xml'])(
    'rejects blocked extension .%s',
    ext => {
      expect(isAllowedDocumentCandidate({ name: `blocked.${ext}` })).toBe(false);
    }
  );

  it('uses MIME allowlist', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
    expect(
      isAllowedDocumentCandidate({
        url: 'https://example.com/webapps/blackboard/execute/content/file?cmd=view',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    ).toBe(true);
  });

  it('requires filename or MIME proof for execute/content links', () => {
    expect(
      isAllowedDocumentCandidate({
        url: 'https://example.com/webapps/blackboard/execute/content/file?cmd=view&content_id=_1_1',
      })
    ).toBe(false);
    expect(
      isAllowedDocumentCandidate({
        url: 'https://example.com/webapps/blackboard/execute/content/file?cmd=view&content_id=_1_1',
        name: 'Week2.docx',
      })
    ).toBe(true);
  });

  it('rejects blocked MIME types', () => {
    expect(isAllowedDocumentCandidate({ mimeType: 'video/mp4' })).toBe(false);
    expect(isAllowedDocumentCandidate({ mimeType: 'application/zip' })).toBe(false);
    expect(isAllowedDocumentCandidate({ mimeType: 'image/png' })).toBe(false);
    expect(isAllowedDocumentCandidate({ mimeType: 'text/csv' })).toBe(false);
    expect(isAllowedDocumentCandidate({ mimeType: 'application/json' })).toBe(false);
  });

  it('preserves filename from Content-Disposition', () => {
    expect(parseContentDisposition(`attachment; filename="Lecture Notes.pdf"`)).toBe(
      'Lecture Notes.pdf'
    );
  });
});
