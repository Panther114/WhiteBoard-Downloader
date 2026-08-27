import { autoUpdater } from 'electron-updater';
import { app } from 'electron';

export type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  notes?: string;
  percent?: number;
  message?: string;
};

let updateState: UpdateState = { status: 'idle' };
let notifier: ((state: UpdateState) => void) | null = null;
let initialized = false;

function updateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/latest\.yml|404|not found/i.test(message)) {
    return 'GitHub update metadata is unavailable. Publish a release containing the installer and latest.yml artifacts.';
  }
  return `Update check failed: ${message}`;
}

function setState(next: UpdateState): void {
  updateState = next;
  notifier?.(next);
}

export function initializeUpdater(onChange: (state: UpdateState) => void): void {
  notifier = onChange;
  if (initialized || !app.isPackaged) return;
  initialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => setState({ status: 'checking' }));
  autoUpdater.on('update-available', info => setState({ status: 'available', version: info.version, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined }));
  autoUpdater.on('update-not-available', () => setState({ status: 'idle', message: 'You are up to date.' }));
  autoUpdater.on('download-progress', progress => setState({ status: 'downloading', percent: progress.percent }));
  autoUpdater.on('update-downloaded', info => setState({ status: 'ready', version: info.version, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined }));
  autoUpdater.on('error', error => setState({ status: 'error', message: updateErrorMessage(error) }));
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    const state = { status: 'idle' as const, message: 'Updates are available in installed release builds.' };
    setState(state);
    return state;
  }
  setState({ status: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const state = { status: 'error' as const, message: updateErrorMessage(error) };
    setState(state);
    return state;
  }
  return updateState;
}

export async function downloadUpdate(): Promise<void> {
  if (updateState.status !== 'available') throw new Error('No update is ready to download.');
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  if (updateState.status !== 'ready') throw new Error('No downloaded update is ready to install.');
  autoUpdater.quitAndInstall();
}

export function getUpdateState(): UpdateState { return updateState; }
