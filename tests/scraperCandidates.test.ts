import { collectDownloadCandidates, RawContentLink } from '../src/scraper';

const BASE_URL = 'https://shs.blackboardchina.cn';
const SAVE_PATH = '/tmp/downloads';

function link(overrides: Partial<RawContentLink>): RawContentLink {
  return {
    href: '',
    text: '',
    inAttachments: false,
    inDetails: false,
    nearAttachedFiles: false,
    itemText: '',
    ...overrides,
  };
}

describe('scraper candidate collection', () => {
  it('deduplicates URLs and keeps valid document candidates', () => {
    const results = collectDownloadCandidates(
      [
        link({
          href: '/webapps/blackboard/execute/content/file?cmd=view&content_id=_1_1',
          text: 'Week 1 Slides.pptx',
          inAttachments: true,
        }),
        link({
          href: '/webapps/blackboard/execute/content/file?cmd=view&content_id=_1_1',
          text: 'Week 1 Slides.pptx',
          inAttachments: true,
        }),
      ],
      BASE_URL,
      SAVE_PATH,
    );

    expect(results).toHaveLength(1);
    expect(results[0].name).toContain('.pptx');
  });

  it('uses visible text extension when URL has no extension', () => {
    const results = collectDownloadCandidates(
      [
        link({
          href: '/webapps/blackboard/content/listContentEditable.jsp?content_id=_2_1',
          text: 'Syllabus.pdf',
          inDetails: true,
        }),
      ],
      BASE_URL,
      SAVE_PATH,
    );
    expect(results).toHaveLength(1);
  });

  it('rejects Blackboard nav/tool links and external links', () => {
    const results = collectDownloadCandidates(
      [
        link({ href: '/webapps/blackboard/content/listContent.jsp?course_id=_1_1', text: 'Folder' }),
        link({ href: '/webapps/discussionboard/do/forum?action=list_threads', text: 'Discussion' }),
        link({ href: '/webapps/blackboard/execute/take_test_student?course_id=_1_1', text: 'Quiz' }),
        link({ href: 'https://example.com/file.pdf', text: 'External PDF' }),
      ],
      BASE_URL,
      SAVE_PATH,
    );
    expect(results).toHaveLength(0);
  });

  it('rejects unsupported attachment extensions', () => {
    const results = collectDownloadCandidates(
      [
        link({ href: '/bbcswebdav/xid-1_1', text: 'archive.zip', inAttachments: true }),
        link({ href: '/bbcswebdav/xid-2_1', text: 'photo.png', inAttachments: true }),
      ],
      BASE_URL,
      SAVE_PATH,
    );
    expect(results).toHaveLength(0);
  });
});
