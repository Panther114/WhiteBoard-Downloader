import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import axios from 'axios';
import { Config } from '../types';
import { readEnvFile, hasValidCredentials } from './envFile';

export type DoctorStatus = 'pass' | 'fail' | 'warn';
export interface DoctorCheck {
  status: DoctorStatus;
  message: string;
  required?: boolean;
}

export function isSupportedNodeVersion(versionString: string): boolean {
  const match = versionString.match(/v?(\d+)/i);
  if (!match) return false;
  const major = Number(match[1]);
  return major >= 18 && major < 24;
}

export function formatDoctorLine(check: DoctorCheck): string {
  const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
  return `${icon} ${check.message}`;
}

export function checkWritableDir(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function checkPlaywrightChromiumInstalled(): boolean {
  try {
    const executable = chromium.executablePath();
    return Boolean(executable && fs.existsSync(executable));
  } catch {
    return false;
  }
}

export async function checkUrlReachable(url: string, timeout = 8000): Promise<boolean> {
  try {
    await axios.get(url, { timeout, maxRedirects: 5, validateStatus: s => s >= 200 && s < 500 });
    return true;
  } catch {
    return false;
  }
}

export function evaluateConfigEnv(envPath: string): {
  exists: boolean;
  validCredentials: boolean;
  env: Record<string, string>;
} {
  const exists = fs.existsSync(envPath);
  const env = exists ? readEnvFile(envPath) : {};
  return {
    exists,
    validCredentials: hasValidCredentials(env),
    env,
  };
}

export interface ConfigReadyForLaunchResult {
  ok: boolean;
  reason?: string;
}

export function isConfigReadyForLaunch(envPath: string): ConfigReadyForLaunchResult {
  const { exists, validCredentials, env } = evaluateConfigEnv(envPath);
  if (!exists) {
    return { ok: false, reason: '.env missing' };
  }

  if (!validCredentials) {
    return { ok: false, reason: 'Blackboard credentials missing or placeholder values' };
  }

  return { ok: true };
}

export function getDoctorPaths(config: Config): { downloadDir: string; logDir: string; dbDir: string } {
  return {
    downloadDir: path.resolve(config.downloadDir),
    logDir: path.resolve(path.dirname(config.logFile)),
    dbDir: path.resolve(path.dirname(config.databasePath)),
  };
}
