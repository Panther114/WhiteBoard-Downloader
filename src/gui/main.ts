import path from 'path';
import fs from 'fs';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { compactConfigOverrides, getConfig } from '../config';
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
import {
  WorkerCommandMap,
  WorkerCommandType,
  WorkerResponseMap,
  WorkerOutgoingMessage,
} from './workerProtocol';

const APP_VERSION = '0.8.2';
const WORKER_NATIVE_MODULE_ERROR =
  'GUI worker failed to start because a native dependency could not load. Try deleting node_modules and rerunning start-gui.bat.';

let mainWindow: BrowserWindow | null = null;
let worker: ChildProcessWithoutNullStreams | null = null;
let workerStdoutBuffer = '';
let workerReadyPromise: Promise<void> | null = null;
let workerReadyResolve: (() => void) | null = null;
let workerReadyReject: ((error: Error) => void) | null = null;
let workerBootstrapError = '';
let requestCounter = 0;

const pendingWorkerRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

function isDevGui(): boolean {
  return process.argv.includes('--dev');
}

function sendWorkflowEvent(type: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('workflow:event', { type, payload });
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

function runCommandForStatus(
  command: string,
  args: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function isNativeModuleAbiError(message: string): boolean {
  return (
    message.includes('NODE_MODULE_VERSION') ||
    message.includes('ERR_DLOPEN_FAILED') ||
    message.includes('better_sqlite3') ||
    message.includes('better-sqlite3')
  );
}

function normalizeWorkerError(message: string): string {
  const trimmed = message.trim();
  if (isNativeModuleAbiError(trimmed)) {
    return `${WORKER_NATIVE_MODULE_ERROR}\nOriginal error: ${trimmed}`;
  }
  return trimmed;
}

function failPendingWorkerRequests(error: Error): void {
  for (const request of pendingWorkerRequests.values()) {
    request.reject(error);
  }
  pendingWorkerRequests.clear();
}

function resolveNodePathFromSystemPath(): string {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = runCommandForStatus(lookupCommand, ['node']);
  if (result.status === 0) {
    const firstPath = result.stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);
    if (firstPath) return firstPath;
  }
  return 'node';
}

function getWorkerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...readEnvFile(path.resolve('.env')),
  };
}

function handleWorkerMessage(message: WorkerOutgoingMessage): void {
  if (message.kind === 'ready') {
    workerReadyResolve?.();
    workerReadyResolve = null;
    workerReadyReject = null;
    workerBootstrapError = '';
    return;
  }

  if (message.kind === 'response') {
    const pending = pendingWorkerRequests.get(message.id);
    if (!pending) return;
    pendingWorkerRequests.delete(message.id);
    if (message.ok) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(normalizeWorkerError(message.error || 'Worker command failed')));
    }
    return;
  }

  if (message.kind === 'event') {
    sendWorkflowEvent(message.type, message.payload);
    return;
  }

  if (message.kind === 'log') {
    sendWorkflowEvent('worker:log', { level: message.level, message: message.message });
  }
}

function parseWorkerStdout(chunk: string): void {
  workerStdoutBuffer += chunk;
  const lines = workerStdoutBuffer.split('\n');
  workerStdoutBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      handleWorkerMessage(JSON.parse(line) as WorkerOutgoingMessage);
    } catch {
      sendWorkflowEvent('worker:log', {
        level: 'warn',
        message: `Worker emitted non-JSON output: ${line}`,
      });
    }
  }
}

function spawnGuiWorker(): Promise<void> {
  if (workerReadyPromise) return workerReadyPromise;

  const workerPath = path.join(__dirname, 'worker.js');
  if (!fs.existsSync(workerPath)) {
    throw new Error(`GUI worker build output missing (${workerPath})`);
  }

  const nodePath = resolveNodePathFromSystemPath();
  worker = spawn(nodePath, [workerPath], {
    cwd: process.cwd(),
    env: getWorkerEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  worker.stdout.setEncoding('utf-8');
  worker.stderr.setEncoding('utf-8');

  workerReadyPromise = new Promise<void>((resolve, reject) => {
    workerReadyResolve = resolve;
    workerReadyReject = reject;
  });

  worker.stdout.on('data', chunk => parseWorkerStdout(chunk));
  worker.stderr.on('data', chunk => {
    const text = String(chunk);
    workerBootstrapError += text;
    sendWorkflowEvent('worker:log', { level: 'error', message: text.trim() });
  });
  worker.on('error', err => {
    const wrapped = new Error(normalizeWorkerError(err.message));
    workerReadyReject?.(wrapped);
    workerReadyResolve = null;
    workerReadyReject = null;
    workerReadyPromise = null;
    failPendingWorkerRequests(wrapped);
    worker = null;
  });
  worker.on('exit', (code, signal) => {
    const bootstrapMessage = normalizeWorkerError(workerBootstrapError.trim());
    const baseError =
      code === 0
        ? new Error('GUI worker exited')
        : new Error(
            bootstrapMessage ||
              `GUI worker exited unexpectedly (code ${code ?? 'unknown'}${
                signal ? `, signal ${signal}` : ''
              })`,
          );

    workerReadyReject?.(baseError);
    workerReadyResolve = null;
    workerReadyReject = null;
    workerReadyPromise = null;
    workerBootstrapError = '';
    failPendingWorkerRequests(baseError);
    worker = null;
  });

  return workerReadyPromise;
}

function sendWorkerCommand<T extends WorkerCommandType>(
  command: T,
  payload?: WorkerCommandMap[T],
): Promise<WorkerResponseMap[T]> {
  if (!worker || !worker.stdin.writable) {
    return Promise.reject(new Error('GUI worker is not available'));
  }

  const id = String(++requestCounter);
  const message = JSON.stringify({
    kind: 'command',
    id,
    command,
    payload: payload || {},
  });

  return new Promise<WorkerResponseMap[T]>((resolve, reject) => {
    const activeWorker = worker;
    if (!activeWorker || !activeWorker.stdin.writable) {
      reject(new Error('GUI worker is not available'));
      return;
    }

    pendingWorkerRequests.set(id, {
      resolve: value => resolve(value as WorkerResponseMap[T]),
      reject,
    });

    activeWorker.stdin.write(message + '\n', writeError => {
      if (!writeError) return;
      pendingWorkerRequests.delete(id);
      reject(new Error(normalizeWorkerError(writeError.message)));
    });
  });
}

async function invokeWorkerCommand<T extends WorkerCommandType>(
  command: T,
  payload?: WorkerCommandMap[T],
): Promise<WorkerResponseMap[T]> {
  await spawnGuiWorker();
  return sendWorkerCommand(command, payload);
}

async function stopGuiWorker(): Promise<void> {
  if (!worker) return;
  try {
    await sendWorkerCommand('shutdown', {});
  } catch {
    // no-op
  }

  if (worker && !worker.killed) {
    worker.kill();
  }
  worker = null;
  workerReadyPromise = null;
}

async function runDoctor(loginTest: boolean): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const add = (status: DoctorCheck['status'], message: string, required = true) =>
    checks.push({ status, message, required });

  const nodeVersionResult = runCommandForStatus('node', ['--version']);
  const nodeVersion = nodeVersionResult.stdout.trim();
  if (nodeVersionResult.status === 0 && isSupportedNodeVersion(nodeVersion)) {
    add('pass', `System Node.js version supported (${nodeVersion})`);
  } else if (nodeVersionResult.status === 0) {
    add('fail', `System Node.js version unsupported (${nodeVersion}); required >=18 and <24`);
  } else {
    add('fail', 'System Node.js is not available in PATH');
  }

  const npmVersion = runCommandForStatus('npm', ['--version']);
  if (npmVersion.status === 0) {
    add('pass', `npm available (${npmVersion.stdout.trim()})`);
  } else {
    add('fail', 'npm is not available in PATH');
  }

  add('pass', `Electron runtime Node ${process.version} (informational only)`, false);

  const nodeModulesPath = path.resolve('node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);
  add(
    hasNodeModules ? 'pass' : 'fail',
    hasNodeModules ? 'Dependencies installed' : 'Dependencies missing (node_modules not found)',
  );

  const hasGuiBuildOutput =
    fs.existsSync(path.resolve('dist/gui/main.js')) &&
    fs.existsSync(path.resolve('dist/gui/preload.js')) &&
    fs.existsSync(path.resolve('dist/gui/worker.js')) &&
    fs.existsSync(path.resolve('dist/gui/renderer/index.html'));
  add(
    hasGuiBuildOutput ? 'pass' : 'fail',
    hasGuiBuildOutput
      ? 'GUI build output exists (main/preload/worker/renderer)'
      : 'GUI build output missing (dist/gui/main.js, preload.js, worker.js, renderer/index.html required)',
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
  add(
    baseReachable ? 'pass' : 'warn',
    `Blackboard base URL ${baseReachable ? 'reachable' : 'unreachable right now'}`,
    false,
  );
  add(
    loginReachable ? 'pass' : 'warn',
    `Blackboard login URL ${loginReachable ? 'reachable' : 'unreachable right now'}`,
    false,
  );

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
    const effectiveEnv = readEnvFile(envPath);
    Object.assign(process.env, effectiveEnv);

    if (payload.testLogin) {
      const cfg = getConfig(compactConfigOverrides({ headless: payload.headless }));
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
    return invokeWorkerCommand('startWorkflow', {
      username: payload?.username,
      password: payload?.password,
      downloadDir: payload?.downloadDir,
      headless: payload?.headless,
    });
  });

  ipcMain.handle('workflow:discover-courses', async (_event, payload) => {
    return invokeWorkerCommand('discoverCourses', {
      filterPattern: payload?.filterPattern,
    });
  });

  ipcMain.handle('workflow:discover-files', async (_event, payload) => {
    return invokeWorkerCommand('discoverFiles', {
      courses: payload?.courses || [],
    });
  });

  ipcMain.handle('workflow:download', async (_event, payload) => {
    return invokeWorkerCommand('download', {
      files: payload?.files || [],
    });
  });

  ipcMain.handle('workflow:cleanup', async () => {
    if (!worker) return { ok: true };
    return invokeWorkerCommand('cleanup', {});
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
  await stopGuiWorker();
  if (process.platform !== 'darwin') app.quit();
});
