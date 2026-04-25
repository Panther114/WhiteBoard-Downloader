import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeRunSummary } from '../src/utils/runSummary';

describe('run summary writer', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-summary-test-'));
  const originalCwd = process.cwd();

  beforeAll(() => {
    process.chdir(tmpRoot);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes latest text summary and download json report', () => {
    const downloadDir = path.join(tmpRoot, 'downloads');
    const report = {
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:01:00.000Z',
      coursesDiscovered: 5,
      coursesSelected: 3,
      filesDiscovered: 100,
      filesSelected: 80,
      filesDownloaded: 75,
      filesSkipped: 3,
      filesFailed: 2,
      failedFiles: [{ name: 'bad.pdf', reason: 'network' }],
      logFilePath: './logs/whiteboard.log',
      downloadDir,
      runError: 'partial failure',
    };

    writeRunSummary(report);

    const summaryPath = path.join(tmpRoot, 'logs/latest-summary.txt');
    const jsonPath = path.join(downloadDir, 'whiteboard-run-report.json');

    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const summaryText = fs.readFileSync(summaryPath, 'utf-8');
    expect(summaryText).toContain('startedAt: 2026-01-01T00:00:00.000Z');
    expect(summaryText).toContain(`log file: ${path.resolve(tmpRoot, 'logs/whiteboard.log')}`);
    expect(summaryText).toContain('run error: partial failure');
    expect(summaryText).toContain('- bad.pdf: network');

    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, unknown>;
    expect(json.startedAt).toBe(report.startedAt);
    expect(json.endedAt).toBe(report.endedAt);
    expect(json.filesFailed).toBe(2);
    expect(json.failedFiles).toEqual([{ name: 'bad.pdf', reason: 'network' }]);
    expect(json.runError).toBe('partial failure');
    expect(json.logFilePath).toBe(path.resolve(tmpRoot, 'logs/whiteboard.log'));
  });
});
