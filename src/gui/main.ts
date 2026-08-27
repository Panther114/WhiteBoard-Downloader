import path from 'path';
import fs from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app, BrowserWindow, ipcMain, shell, IpcMainInvokeEvent } from 'electron';
import { compactConfigOverrides, getConfig } from '../config';
import { BlackboardAuth } from '../auth';
import {
  checkAutomationBrowserAvailable,
  checkUrlReachable,
  checkWritableDir,
  type DoctorCheck,
} from '../utils/doctor';
import {
  WorkerCommandMap,
  WorkerCommandType,
  WorkerResponseMap,
  WorkerOutgoingMessage,
} from './workerProtocol';
import { ensureAppPaths, getAppPaths } from '../appPaths';
import { SecureDesktopStore } from './secureStore';
import { checkForUpdates, downloadUpdate, getUpdateState, initializeUpdater, installUpdate } from './updater';
import { AgentService } from '../agent/service';

const WORKER_NATIVE_MODULE_ERROR =
  'GUI worker failed to start because a packaged native dependency could not load. Reinstall the application and run Diagnostics.';

let mainWindow: BrowserWindow | null = null;
let worker: ChildProcessWithoutNullStreams | null = null;
let workerStdoutBuffer = '';
let workerReadyPromise: Promise<void> | null = null;
let workerReadyResolve: (() => void) | null = null;
let workerReadyReject: ((error: Error) => void) | null = null;
let workerBootstrapError = '';
let requestCounter = 0;
let desktopStore: SecureDesktopStore;
const agentService = new AgentService();

function startPackagedMcpServer(): void {
  const serverPath = path.resolve(__dirname, '..', 'mcp', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  child.once('error', error => {
    console.error('Failed to start the MCP server:', error);
    app.exit(1);
  });
  child.once('exit', code => app.exit(code || 0));
}

const pendingWorkerRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

function isDevGui(): boolean {
  return process.argv.includes('--dev');
}

function appVersion(): string { return app.getVersion(); }

function appIconPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../assets/app-icon.ico'),
    path.resolve(__dirname, '../../build/icon.ico'),
    path.resolve(__dirname, 'renderer/app-icon.ico'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url || '';
  const allowed = isDevGui() ? url.startsWith('http://127.0.0.1:5173') : url.startsWith('file:');
  if (!allowed) throw new Error('Blocked IPC request from an untrusted renderer.');
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
    title: `BlackboardChina Downloader v${appVersion()}`,
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (isDevGui()) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.resolve(__dirname, 'renderer/index.html'));
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
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

function getWorkerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
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

  worker = spawn(process.execPath, [workerPath], {
    cwd: getAppPaths().root,
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

  add('pass', `Packaged Electron runtime available (${process.versions.electron || process.version})`);

  const hasGuiBuildOutput =
    fs.existsSync(path.join(__dirname, 'main.js')) &&
    fs.existsSync(path.join(__dirname, 'preload.js')) &&
    fs.existsSync(path.join(__dirname, 'worker.js')) &&
    fs.existsSync(path.join(__dirname, 'renderer', 'index.html'));
  add(
    hasGuiBuildOutput ? 'pass' : 'fail',
    hasGuiBuildOutput
      ? 'GUI build output exists (main/preload/worker/renderer)'
      : 'GUI build output missing (main.js, preload.js, worker.js, renderer/index.html required)',
  );

  if (checkAutomationBrowserAvailable()) {
    add('pass', 'Automation browser available (Microsoft Edge or Playwright Chromium)');
  } else {
    add('warn', 'No automation browser found; install Microsoft Edge or Playwright Chromium', false);
  }

  const config = getConfig();
  const envStatus = { validCredentials: Boolean(config.username && config.password), env: process.env };
  add('pass', 'Per-user application settings available');
  add(
    envStatus.validCredentials ? 'pass' : 'fail',
    envStatus.validCredentials
      ? 'Blackboard credentials configured'
      : 'Blackboard credentials missing or placeholder values',
  );

  const downloadDir = path.resolve(config.downloadDir);
  const logDir = path.resolve(path.dirname(config.logFile));
  const dbDir = path.resolve(path.dirname(config.databasePath));

  const downloadDirWritable = checkWritableDir(downloadDir);
  const logDirWritable = checkWritableDir(logDir);
  const dbDirWritable = checkWritableDir(dbDir);
  add(
    downloadDirWritable ? 'pass' : 'fail',
    `Download directory ${downloadDirWritable ? 'writable' : 'not writable'} (${downloadDir})`,
  );
  add(logDirWritable ? 'pass' : 'fail', `Log directory ${logDirWritable ? 'writable' : 'not writable'} (${logDir})`);
  add(dbDirWritable ? 'pass' : 'fail', `Database directory ${dbDirWritable ? 'writable' : 'not writable'} (${dbDir})`);

  const baseUrl = config.baseUrl;
  const loginUrl = config.loginUrl;
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

app.whenReady().then(async () => {
  app.setAppUserModelId('com.panther114.blackboardchina.downloader');
  const appPaths = ensureAppPaths();
  desktopStore = new SecureDesktopStore(appPaths);
  await desktopStore.migrateLegacySettings();
  await desktopStore.applyToEnvironment();
  if (process.argv.includes('--mcp')) {
    startPackagedMcpServer();
    return;
  }
  createWindow();
  initializeUpdater(state => sendWorkflowEvent('update:state', state));
  const settings = desktopStore.loadSettings();
  if (settings.autoCheckUpdates) {
    setTimeout(() => void checkForUpdates().catch(() => undefined), 10_000);
    setInterval(() => void checkForUpdates().catch(() => undefined), 6 * 60 * 60 * 1000);
  }

  ipcMain.handle('app:get-version', event => { assertTrustedSender(event); return appVersion(); });

  ipcMain.handle('config:load', async event => {
    assertTrustedSender(event);
    const settings = desktopStore.loadSettings();
    return {
      hasCredentials: Boolean(settings.username && await desktopStore.getPassword()),
      username: settings.username,
      downloadDir: settings.downloadDir,
      headless: settings.headless,
      courseFilter: settings.courseFilter,
      autoCheckUpdates: settings.autoCheckUpdates,
    };
  });

  ipcMain.handle('setup:save', async (event, payload) => {
    assertTrustedSender(event);
    const current = desktopStore.loadSettings();
    desktopStore.saveSettings({
      username: String(payload.username || '').trim(),
      downloadDir: String(payload.downloadDir || current.downloadDir).trim(),
      headless: Boolean(payload.headless),
      courseFilter: String(payload.courseFilter || current.courseFilter || ''),
      autoCheckUpdates: payload.autoCheckUpdates === undefined ? current.autoCheckUpdates : Boolean(payload.autoCheckUpdates),
    });
    const password = String(payload.password || '');
    if (password) await desktopStore.setPassword(password);
    await desktopStore.applyToEnvironment();

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

  ipcMain.handle('setup:reset', async event => {
    assertTrustedSender(event);
    desktopStore.saveSettings({ username: '', headless: true, courseFilter: '' });
    desktopStore.clearPassword();
    await desktopStore.applyToEnvironment();
    return { ok: true };
  });

  ipcMain.handle('doctor:run', async (event, payload) => {
    assertTrustedSender(event);
    const checks = await runDoctor(Boolean(payload?.loginTest));
    return checks;
  });

  ipcMain.handle('workflow:start', async (event, payload) => {
    assertTrustedSender(event);
    return invokeWorkerCommand('startWorkflow', {
      username: payload?.username,
      password: payload?.password,
      downloadDir: payload?.downloadDir,
      headless: payload?.headless,
    });
  });

  ipcMain.handle('workflow:discover-courses', async (event, payload) => {
    assertTrustedSender(event);
    return invokeWorkerCommand('discoverCourses', {
      filterPattern: payload?.filterPattern,
    });
  });

  ipcMain.handle('workflow:discover-files', async (event, payload) => {
    assertTrustedSender(event);
    return invokeWorkerCommand('discoverFiles', {
      courses: payload?.courses || [],
    });
  });

  ipcMain.handle('workflow:download', async (event, payload) => {
    assertTrustedSender(event);
    return invokeWorkerCommand('download', {
      files: payload?.files || [],
    });
  });

  ipcMain.handle('workflow:cleanup', async event => {
    assertTrustedSender(event);
    if (!worker) return { ok: true };
    return invokeWorkerCommand('cleanup', {});
  });

  ipcMain.handle('paths:get', event => {
    assertTrustedSender(event);
    const config = getConfig();
    return {
      downloads: path.resolve(config.downloadDir),
      logs: path.resolve(path.dirname(config.logFile)),
      summary: path.join(getAppPaths().logsDir, 'latest-summary.txt'),
    };
  });

  ipcMain.handle('path:open-downloads', async event => {
    assertTrustedSender(event);
    const config = getConfig();
    return shell.openPath(path.resolve(config.downloadDir));
  });

  ipcMain.handle('path:open-logs', async event => {
    assertTrustedSender(event);
    const config = getConfig();
    return shell.openPath(path.resolve(path.dirname(config.logFile)));
  });

  ipcMain.handle('agent:status', async event => {
    assertTrustedSender(event);
    return agentService.status();
  });
  ipcMain.handle('agent:sync', async (event, payload) => {
    assertTrustedSender(event);
    return agentService.sync({
      courseIds: Array.isArray(payload?.courseIds) ? payload.courseIds.map(String) : undefined,
      includeFiles: Boolean(payload?.includeFiles),
      includeInstructions: payload?.includeInstructions !== false,
      outputDir: typeof payload?.outputDir === 'string' ? payload.outputDir : undefined,
    });
  });
  ipcMain.handle('update:get-state', event => { assertTrustedSender(event); return getUpdateState(); });
  ipcMain.handle('update:check', async event => { assertTrustedSender(event); return checkForUpdates(); });
  ipcMain.handle('update:download', async event => { assertTrustedSender(event); await downloadUpdate(); return getUpdateState(); });
  ipcMain.handle('update:install', event => { assertTrustedSender(event); installUpdate(); return { ok: true }; });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await stopGuiWorker();
  if (process.platform !== 'darwin') app.quit();
});
