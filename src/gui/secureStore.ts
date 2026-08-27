import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import { AppPaths } from '../appPaths';
import { readEnvFile } from '../utils/envFile';

export interface DesktopSettings {
  username: string;
  downloadDir: string;
  headless: boolean;
  courseFilter: string;
  autoCheckUpdates: boolean;
}

const defaults: DesktopSettings = {
  username: '',
  downloadDir: path.join(process.env.USERPROFILE || '.', 'Downloads', 'BlackboardChina'),
  headless: true,
  courseFilter: '',
  autoCheckUpdates: true,
};

export class SecureDesktopStore {
  constructor(private readonly paths: AppPaths) {}

  loadSettings(): DesktopSettings {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.paths.configFile, 'utf8')) as Partial<DesktopSettings>;
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  }

  saveSettings(settings: Partial<DesktopSettings>): DesktopSettings {
    const next = { ...this.loadSettings(), ...settings };
    fs.mkdirSync(path.dirname(this.paths.configFile), { recursive: true });
    fs.writeFileSync(this.paths.configFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }

  async getPassword(): Promise<string> {
    if (!fs.existsSync(this.paths.credentialsFile) || !safeStorage.isEncryptionAvailable()) return '';
    const encrypted = fs.readFileSync(this.paths.credentialsFile);
    const storage = safeStorage as typeof safeStorage & {
      decryptStringAsync?: (input: Buffer) => Promise<{ result: string }>;
    };
    if (storage.decryptStringAsync) return (await storage.decryptStringAsync(encrypted)).result;
    return safeStorage.decryptString(encrypted);
  }

  async setPassword(password: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    const storage = safeStorage as typeof safeStorage & { encryptStringAsync?: (value: string) => Promise<Buffer> };
    const encrypted = storage.encryptStringAsync ? await storage.encryptStringAsync(password) : safeStorage.encryptString(password);
    fs.writeFileSync(this.paths.credentialsFile, encrypted);
  }

  clearPassword(): void {
    if (fs.existsSync(this.paths.credentialsFile)) fs.rmSync(this.paths.credentialsFile, { force: true });
  }

  async migrateLegacySettings(): Promise<{ migrated: boolean }> {
    if (fs.existsSync(this.paths.configFile)) return { migrated: false };
    const legacy = path.join(process.env.APPDATA || '', 'whiteboard-downloader', '.env');
    if (!legacy || !fs.existsSync(legacy)) return { migrated: false };
    const env = readEnvFile(legacy);
    this.saveSettings({
      username: env.BB_USERNAME || '',
      downloadDir: env.DOWNLOAD_DIR || defaults.downloadDir,
      headless: env.HEADLESS !== 'false',
      courseFilter: env.COURSE_FILTER || '',
    });
    if (env.BB_PASSWORD) await this.setPassword(env.BB_PASSWORD);
    // Preserve a non-secret migration marker; legacy data is never deleted.
    fs.writeFileSync(path.join(this.paths.root, 'migration-v1.json'), JSON.stringify({ migratedAt: new Date().toISOString(), source: legacy }) + '\n');
    return { migrated: true };
  }

  async applyToEnvironment(): Promise<DesktopSettings> {
    const settings = this.loadSettings();
    const password = await this.getPassword();
    Object.assign(process.env, {
      BB_USERNAME: settings.username,
      BB_PASSWORD: password,
      DOWNLOAD_DIR: settings.downloadDir,
      HEADLESS: String(settings.headless),
      COURSE_FILTER: settings.courseFilter,
      DATABASE_PATH: this.paths.databaseFile,
      FILE_TREE_PATH: this.paths.fileTreeFile,
      LOG_FILE: this.paths.logFile,
      BROWSER_PROFILE_DIR: this.paths.browserProfileDir,
      USE_SYSTEM_EDGE: 'true',
      WHITEBOARD_APP_DATA_DIR: this.paths.root,
    });
    return settings;
  }
}
