import fs from 'fs';
import path from 'path';
import { AgentAttachment, AgentExportManifest, ContentItem, Course } from '../types';
import { sanitizeFilename } from '../utils/helpers';

export interface WriteAgentExportInput {
  outputDir: string;
  baseUrl: string;
  courses: Course[];
  items: ContentItem[];
  attachments: AgentAttachment[];
  warnings: string[];
}

export function writeAgentExport(input: WriteAgentExportInput): { manifestPath: string; manifest: AgentExportManifest } {
  const root = path.resolve(input.outputDir, 'agent-export');
  const temp = `${root}.tmp-${process.pid}-${Date.now()}`;
  fs.rmSync(temp, { force: true, recursive: true });
  fs.mkdirSync(temp, { recursive: true });

  for (const item of input.items) {
    const relative = path.join(
      'courses',
      sanitizeFilename(item.courseName),
      sanitizeFilename(item.sectionName || 'Course content'),
      `${sanitizeFilename(item.id)}.md`,
    );
    const target = path.join(temp, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const frontmatter = [
      '---',
      `id: ${item.id}`,
      `kind: ${item.kind}`,
      `course: ${JSON.stringify(item.courseName)}`,
      `source: ${item.sourceUrl}`,
      item.dueAt ? `due_at: ${item.dueAt}` : '',
      item.points ? `points: ${JSON.stringify(item.points)}` : '',
      '---',
      '',
      `# ${item.title}`,
      '',
      item.instructionsMarkdown || '_No instructional text was found on this item._',
      '',
    ].filter(Boolean).join('\n');
    fs.writeFileSync(target, frontmatter, 'utf8');
  }

  const manifest: AgentExportManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: { baseUrl: input.baseUrl, mode: 'read-only' },
    courses: input.courses.map(({ id, name, url }) => ({ id, name, url })),
    items: input.items,
    attachments: input.attachments,
    warnings: input.warnings,
    summary: {
      courses: input.courses.length,
      items: input.items.length,
      attachments: input.attachments.length,
      downloadedFiles: input.attachments.filter(file => file.status === 'downloaded').length,
    },
  };
  fs.writeFileSync(path.join(temp, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  fs.rmSync(root, { force: true, recursive: true });
  fs.renameSync(temp, root);
  return { manifestPath: path.join(root, 'manifest.json'), manifest };
}
