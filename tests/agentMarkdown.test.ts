import fs from 'fs';
import os from 'os';
import path from 'path';
import { contentHash, htmlToMarkdown, stableId } from '../src/agent/markdown';
import { writeAgentExport } from '../src/agent/exporter';

describe('agent content export', () => {
  test('preserves headings, links and code without unsafe markup', () => {
    const markdown = htmlToMarkdown('<h2>Task</h2><p>Read <a href="https://example.com/a">this</a>.</p><pre><code>const x = 1;</code></pre><script>alert(1)</script>');
    expect(markdown).toContain('## Task');
    expect(markdown).toContain('[this](https://example.com/a)');
    expect(markdown).toContain('```\nconst x = 1;\n```');
    expect(markdown).not.toContain('alert');
  });

  test('writes a versioned manifest and markdown item atomically', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blackboard-agent-'));
    const item = {
      id: stableId('item', 'one'), kind: 'assignment' as const, courseId: 'c1', courseName: 'Course One', sectionName: 'Assignments', folderPath: [], title: 'Build it', instructionsMarkdown: '```ts\nconsole.log(1)\n```', sourceUrl: 'https://example.com/item', attachmentIds: [], contentHash: contentHash('x'),
    };
    const written = writeAgentExport({ outputDir: root, baseUrl: 'https://example.com', courses: [{ id: 'c1', name: 'Course One', url: 'https://example.com/course', path: 'course-one' }], items: [item], attachments: [], warnings: [] });
    expect(fs.existsSync(written.manifestPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(written.manifestPath, 'utf8')).schemaVersion).toBe(1);
    expect(fs.readFileSync(path.join(root, 'agent-export', 'courses', 'Course One', 'Assignments', `${item.id}.md`), 'utf8')).toContain('console.log(1)');
    fs.rmSync(root, { force: true, recursive: true });
  });
});
