import fs from 'fs';
import path from 'path';

/**
 * Centralises writable paths so packaged builds never depend on their install
 * directory. CLI callers may set WHITEBOARD_APP_DATA_DIR for portable runs.
 */
export interface AppPaths {
  root: string;
  configFile: string;
  credentialsFile: string;
  databaseFile: string;
  fileTreeFile: string;
  logsDir: string;
  logFile: string;
  browserDir: string;
  browserProfileDir: string;
  exportsDir: string;
}

export function getAppDataRoot(): string {
  if (process.env.WHITEBOARD_APP_DATA_DIR) return path.resolve(process.env.WHITEBOARD_APP_DATA_DIR);
  if (process.versions.electron) {
    try {
      // Loaded lazily so the CLI remains portable without Electron.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron') as { app?: { getPath(name: string): string } };
      if (electron.app?.getPath) return path.join(electron.app.getPath('userData'), 'data');
    } catch {
      // Fall through to OS defaults.
    }
  }
  const roaming = process.env.APPDATA || process.env.XDG_CONFIG_HOME;
  return path.resolve(roaming || '.', 'whiteboard-downloader');
}

export function getAppPaths(): AppPaths {
  const root = getAppDataRoot();
  return {
    root,
    configFile: path.join(root, 'settings.json'),
    credentialsFile: path.join(root, 'credentials.bin'),
    databaseFile: path.join(root, 'whiteboard.db'),
    fileTreeFile: path.join(root, 'file_tree.json'),
    logsDir: path.join(root, 'logs'),
    logFile: path.join(root, 'logs', 'whiteboard.log'),
    browserDir: path.join(root, 'browsers'),
    browserProfileDir: path.join(root, 'browser-profile'),
    exportsDir: path.join(root, 'agent-export'),
  };
}

export function ensureAppPaths(): AppPaths {
  const paths = getAppPaths();
  for (const dir of [paths.root, paths.logsDir, paths.browserDir, paths.browserProfileDir, paths.exportsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return paths;
}
