import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawnSync } from 'child_process';
import { getConfig } from '../config';
import { BlackboardAuth } from '../auth';
import { readEnvFile, writeEnvFile, hasValidCredentials } from '../utils/envFile';
import {
  checkPlaywrightChromiumInstalled,
  checkUrlReachable,
  checkWritableDir,
  evaluateConfigEnv,
  type DoctorCheck,
  isSupportedNodeVersion,
} from '../utils/doctor';
import { RunSummaryReport, writeRunSummary } from '../utils/runSummary';
import { DownloadWorkflow } from '../workflow/downloadWorkflow';
import { Course, DiscoveredFile } from '../types';

const APP_VERSION = '0.8.2';

let mainWindow: BrowserWindow | null = null;
let workflow: DownloadWorkflow | null = null;
let runState = {
  coursesDiscovered: 0,
  coursesSelected: 0,
  filesDiscovered: 0,
  filesSelected: 0,
  filesDownloaded: 0,
  filesSkipped: 0,
  filesFailed: 0,
  skippedOnDisk: 0,
  failedFiles: [] as Array<{ name: string; reason: string }>,
};
let runSummaryContext = {
  startedAt: new Date().toISOString(),
  logFilePath: './logs/whiteboard.log',
  downloadDir: './downloads',
};

function isDevGui(): boolean {
  return process.argv.includes('--dev');
}

function sendWorkflowEvent(type: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('workflow:event', { type, payload });
  }
}

function resetRunState(): void {
  runState = {
    coursesDiscovered: 0,
    coursesSelected: 0,
    filesDiscovered: 0,
    filesSelected: 0,
    filesDownloaded: 0,
    filesSkipped: 0,
    filesFailed: 0,
    skippedOnDisk: 0,
    failedFiles: [],
  };
}

function buildRunSummaryReport(runError?: string): RunSummaryReport {
  return {
    startedAt: runSummaryContext.startedAt,
    endedAt: new Date().toISOString(),
    coursesDiscovered: runState.coursesDiscovered,
    coursesSelected: runState.coursesSelected,
    filesDiscovered: runState.filesDiscovered,
    filesSelected: runState.filesSelected,
    filesDownloaded: runState.filesDownloaded,
    filesSkipped: runState.filesSkipped + runState.skippedOnDisk,
    filesFailed: runState.filesFailed,
    failedFiles: runState.failedFiles,
    logFilePath: runSummaryContext.logFilePath,
    downloadDir: runSummaryContext.downloadDir,
    runError,
  };
}

function writeGuiRunSummarySafely(report: RunSummaryReport): void {
  try {
    writeRunSummary(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendWorkflowEvent('summary:warning', {
      message: `Run summary could not be written: ${message}`,
    });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: `WhiteBoard Downloader v${APP_VERSION}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDevGui()) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.resolve(__dirname, 'renderer/index.html'));
  }
}

async function cleanupWorkflow(): Promise<void> {
  if (workflow) {
    await workflow.cleanup();
    workflow = null;
  }
}

async function runDoctor(loginTest: boolean): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const add = (status: DoctorCheck['status'], message: string, required = true) =>
    checks.push({ status, message, required });

  if (isSupportedNodeVersion(process.version)) {
    add('pass', `Node.js version supported (${process.version})`);
  } else {
    add('fail', `Node.js version unsupported (${process.version}); required >=18 and <24`);
  }

  const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf-8' });
  if (npmVersion.status === 0) {
    add('pass', `npm available (${npmVersion.stdout.trim()})`);
  } else {
    add('fail', 'npm is not available in PATH');
  }

  const nodeModulesPath = path.resolve('node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);
  add(hasNodeModules ? 'pass' : 'fail', hasNodeModules ? 'Dependencies installed' : 'Dependencies missing (node_modules not found)');

  const hasBuildOutput = fs.existsSync(path.resolve('dist/cli.js'));
  add(
    hasBuildOutput ? 'pass' : 'fail',
    hasBuildOutput ? 'Build output exists (dist/cli.js)' : 'Build output missing (dist/cli.js not found)',
  );

  if (checkPlaywrightChromiumInstalled()) {
    add('pass', 'Playwright Chromium installed');
  } else {
    add('warn', 'Playwright Chromium not installed; run setup/start again', false);
  }

  const envPath = path.resolve('.env');
  const envStatus = evaluateConfigEnv(envPath);
  add(envStatus.exists ? 'pass' : 'fail', envStatus.exists ? '.env file exists' : '.env file missing');
  add(
    envStatus.validCredentials ? 'pass' : 'fail',
    envStatus.validCredentials
      ? 'Blackboard credentials configured'
      : 'Blackboard credentials missing or placeholder values',
  );

  const env = envStatus.env;
  const downloadDir = path.resolve(env.DOWNLOAD_DIR || './downloads');
  const logDir = path.resolve(path.dirname(env.LOG_FILE || './logs/whiteboard.log'));
  const dbDir = path.resolve(path.dirname(env.DATABASE_PATH || './whiteboard.db'));

  const downloadDirWritable = checkWritableDir(downloadDir);
  const logDirWritable = checkWritableDir(logDir);
  const dbDirWritable = checkWritableDir(dbDir);
  add(
    downloadDirWritable ? 'pass' : 'fail',
    `Download directory ${downloadDirWritable ? 'writable' : 'not writable'} (${downloadDir})`,
  );
  add(logDirWritable ? 'pass' : 'fail', `Log directory ${logDirWritable ? 'writable' : 'not writable'} (${logDir})`);
  add(dbDirWritable ? 'pass' : 'fail', `Database directory ${dbDirWritable ? 'writable' : 'not writable'} (${dbDir})`);

  const baseUrl = env.BB_BASE_URL || 'https://shs.blackboardchina.cn';
  const loginUrl = env.BB_LOGIN_URL || 'https://shs.blackboardchina.cn/webapps/login/';
  const baseReachable = await checkUrlReachable(baseUrl);
  const loginReachable = await checkUrlReachable(loginUrl);
  add(baseReachable ? 'pass' : 'warn', `Blackboard base URL ${baseReachable ? 'reachable' : 'unreachable right now'}`, false);
  add(loginReachable ? 'pass' : 'warn', `Blackboard login URL ${loginReachable ? 'reachable' : 'unreachable right now'}`, false);

  if (loginTest) {
    if (!envStatus.validCredentials) {
      add('fail', 'Cannot run login test: credentials are missing');
    } else {
      let auth: BlackboardAuth | null = null;
      try {
        const cfg = getConfig({ headless: true });
        auth = new BlackboardAuth(cfg);
        await auth.launchBrowser();
        await auth.login();
        add('pass', 'Blackboard login test passed');
      } catch {
        add('fail', 'Blackboard login test failed');
      } finally {
        if (auth) await auth.close();
      }
    }
  }

  return checks;
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('app:get-version', () => APP_VERSION);

  ipcMain.handle('config:load', () => {
    const env = readEnvFile(path.resolve('.env'));
    return {
      hasCredentials: hasValidCredentials(env),
      username: env.BB_USERNAME || '',
      downloadDir: env.DOWNLOAD_DIR || './downloads',
      headless: env.HEADLESS !== 'false',
      includeNonSubjectCourses: env.INCLUDE_NON_SUBJECT_COURSES === 'true',
      courseFilter: env.COURSE_FILTER || '',
    };
  });

  ipcMain.handle('setup:save', async (_event, payload) => {
    const envPath = path.resolve('.env');
    const existing = readEnvFile(envPath);
    const values: Record<string, string> = {
      BB_USERNAME: String(payload.username || '').trim(),
      BB_PASSWORD: String(payload.password || ''),
      DOWNLOAD_DIR: String(payload.downloadDir || './downloads').trim(),
      HEADLESS: String(Boolean(payload.headless)),
      INCLUDE_NON_SUBJECT_COURSES: String(Boolean(payload.includeNonSubjectCourses)),
      COURSE_FILTER: existing.COURSE_FILTER || '',
    };

    writeEnvFile(envPath, values, { preserveEmptyPassword: true });

    if (payload.testLogin) {
      const cfg = getConfig({ headless: Boolean(payload.headless) });
      let auth: BlackboardAuth | null = null;
      try {
        auth = new BlackboardAuth(cfg);
        await auth.launchBrowser();
        await auth.login();
      } finally {
        if (auth) await auth.close();
      }
    }

    return { ok: true };
  });

  ipcMain.handle('setup:reset', () => {
    const envPath = path.resolve('.env');
    writeEnvFile(
      envPath,
      {
        BB_USERNAME: '',
        BB_PASSWORD: '',
        DOWNLOAD_DIR: './downloads',
        HEADLESS: 'true',
        INCLUDE_NON_SUBJECT_COURSES: 'true',
        COURSE_FILTER: '',
      },
      { reset: true, preserveEmptyPassword: true },
    );
    return { ok: true };
  });

  ipcMain.handle('doctor:run', async (_event, payload) => {
    const checks = await runDoctor(Boolean(payload?.loginTest));
    return checks;
  });

  ipcMain.handle('workflow:start', async (_event, payload) => {
    await cleanupWorkflow();
    resetRunState();

    const config = getConfig({
      username: payload?.username,
      password: payload?.password,
      downloadDir: payload?.downloadDir,
      headless: payload?.headless ?? true,
      courseFilter: undefined,
      includeNonSubjectCourses: true,
    });
    runSummaryContext = {
      startedAt: new Date().toISOString(),
      logFilePath: config.logFile,
      downloadDir: config.downloadDir,
    };

    workflow = new DownloadWorkflow(config);
    const eventNames = [
      'login:start',
      'login:success',
      'login:failure',
      'courses:discovered',
      'files:discovery:start',
      'files:discovery:complete',
      'files:ready',
      'download:start',
      'download:progress',
      'download:complete',
      'download:error',
      'download:skip',
      'summary:ready',
    ];

    for (const eventName of eventNames) {
      workflow.on(eventName, payloadValue => {
        sendWorkflowEvent(eventName, payloadValue);
      });
    }

    workflow.on('download:complete', () => {
      runState.filesDownloaded += 1;
    });
    workflow.on('download:error', (data: { filename: string; error: string }) => {
      runState.filesFailed += 1;
      runState.failedFiles.push({ name: data.filename, reason: data.error || 'Unknown error' });
    });
    workflow.on('download:skip', () => {
      runState.filesSkipped += 1;
    });

    await workflow.initialize();
    return { ok: true, downloadDir: config.downloadDir, logFile: config.logFile };
  });

  ipcMain.handle('workflow:discover-courses', async (_event, payload) => {
    if (!workflow) throw new Error('Workflow not started');
    const courses = await workflow.discoverCourses({ filterPattern: payload?.filterPattern });
    runState.coursesDiscovered = courses.length;
    return courses;
  });

  ipcMain.handle('workflow:discover-files', async (_event, payload: { courses: Course[] }) => {
    if (!workflow) throw new Error('Workflow not started');
    runState.coursesSelected = payload.courses.length;
    const result = await workflow.discoverFiles(payload.courses);
    runState.filesDiscovered = result.discovered.length;
    runState.skippedOnDisk = result.skippedOnDisk;
    return result;
  });

  ipcMain.handle('workflow:download', async (_event, payload: { files: DiscoveredFile[] }) => {
    if (!workflow) throw new Error('Workflow not started');
    runState.filesSelected = payload.files.length;
    try {
      await workflow.downloadSelected(payload.files);
    } catch (error) {
      const runError = error instanceof Error ? error.message : String(error);
      writeGuiRunSummarySafely(buildRunSummaryReport(runError));
      throw error;
    }

    const summary = {
      coursesDiscovered: runState.coursesDiscovered,
      coursesSelected: runState.coursesSelected,
      filesDiscovered: runState.filesDiscovered,
      filesSelected: runState.filesSelected,
      filesDownloaded: runState.filesDownloaded,
      filesSkipped: runState.filesSkipped + runState.skippedOnDisk,
      filesFailed: runState.filesFailed,
      failedFiles: runState.failedFiles,
    };
    writeGuiRunSummarySafely(buildRunSummaryReport());
    workflow.emitSummary(summary);
    return summary;
  });

  ipcMain.handle('workflow:cleanup', async () => {
    await cleanupWorkflow();
    return { ok: true };
  });

  ipcMain.handle('paths:get', () => {
    const config = getConfig();
    return {
      downloads: path.resolve(config.downloadDir),
      logs: path.resolve(path.dirname(config.logFile)),
      summary: path.resolve('logs/latest-summary.txt'),
    };
  });

  ipcMain.handle('path:open-downloads', async () => {
    const config = getConfig();
    return shell.openPath(path.resolve(config.downloadDir));
  });

  ipcMain.handle('path:open-logs', async () => {
    const config = getConfig();
    return shell.openPath(path.resolve(path.dirname(config.logFile)));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await cleanupWorkflow();
  if (process.platform !== 'darwin') app.quit();
});
