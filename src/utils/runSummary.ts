import fs from 'fs';
import path from 'path';

export interface RunSummaryReport {
  startedAt: string;
  endedAt: string;
  coursesDiscovered: number;
  coursesSelected: number;
  filesDiscovered: number;
  filesSelected: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesFailed: number;
  failedFiles: Array<{ name: string; reason: string }>;
  logFilePath: string;
  downloadDir: string;
  runError?: string;
}

export function writeRunSummary(report: RunSummaryReport): void {
  const logsDir = path.resolve('logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const latestSummaryPath = path.join(logsDir, 'latest-summary.txt');
  const lines = [
    `startedAt: ${report.startedAt}`,
    `endedAt: ${report.endedAt}`,
    `courses discovered: ${report.coursesDiscovered}`,
    `courses selected: ${report.coursesSelected}`,
    `files discovered: ${report.filesDiscovered}`,
    `files selected: ${report.filesSelected}`,
    `files downloaded: ${report.filesDownloaded}`,
    `files skipped: ${report.filesSkipped}`,
    `files failed: ${report.filesFailed}`,
    `log file: ${path.resolve(report.logFilePath)}`,
  ];

  if (report.runError) {
    lines.push(`run error: ${report.runError}`);
  }

  if (report.failedFiles.length > 0) {
    lines.push('failed files:');
    for (const failed of report.failedFiles) {
      lines.push(`- ${failed.name}: ${failed.reason}`);
    }
  }

  fs.writeFileSync(latestSummaryPath, lines.join('\n') + '\n', 'utf-8');

  const reportJsonPath = path.resolve(report.downloadDir, 'whiteboard-run-report.json');
  fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify(
      {
        startedAt: report.startedAt,
        endedAt: report.endedAt,
        coursesDiscovered: report.coursesDiscovered,
        coursesSelected: report.coursesSelected,
        filesDiscovered: report.filesDiscovered,
        filesSelected: report.filesSelected,
        filesDownloaded: report.filesDownloaded,
        filesSkipped: report.filesSkipped,
        filesFailed: report.filesFailed,
        failedFiles: report.failedFiles,
        logFilePath: path.resolve(report.logFilePath),
        runError: report.runError,
      },
      null,
      2,
    ),
    'utf-8',
  );
}
