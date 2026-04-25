import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { Config } from '../types';

// Load environment variables
dotenvConfig();

// Zod schema for configuration validation
const ConfigSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  baseUrl: z.string().url().default('https://shs.blackboardchina.cn'),
  loginUrl: z.string().url().default('https://shs.blackboardchina.cn/webapps/login/'),
  downloadDir: z.string().default('./downloads'),
  maxConcurrentDownloads: z.number().int().positive().default(5),
  downloadTimeout: z.number().int().positive().default(60000),
  browserType: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  headless: z.boolean().default(true),
  browserTimeout: z.number().int().positive().default(30000),
  databasePath: z.string().default('./whiteboard.db'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logFile: z.string().default('./logs/whiteboard.log'),
  courseFilter: z.string().optional(),
  maxRetries: z.number().int().nonnegative().default(3),
  retryDelay: z.number().int().nonnegative().default(2000),
  fileTreePath: z.string().default(''),
});

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const downloadDir = process.env.DOWNLOAD_DIR || './downloads';
  const config = {
    username: process.env.BB_USERNAME || '',
    password: process.env.BB_PASSWORD || '',
    baseUrl: process.env.BB_BASE_URL || 'https://shs.blackboardchina.cn',
    loginUrl: process.env.BB_LOGIN_URL || 'https://shs.blackboardchina.cn/webapps/login/',
    downloadDir,
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '5', 10),
    downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '60000', 10),
    browserType: (process.env.BROWSER_TYPE || 'chromium') as 'chromium' | 'firefox' | 'webkit',
    headless: process.env.HEADLESS !== 'false',
    browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    databasePath: process.env.DATABASE_PATH || './whiteboard.db',
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    logFile: process.env.LOG_FILE || './logs/whiteboard.log',
    courseFilter: process.env.COURSE_FILTER,
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '2000', 10),
    fileTreePath: process.env.FILE_TREE_PATH || path.join(downloadDir, 'file_tree.json'),
  };

  // Validate configuration
  return ConfigSchema.parse(config);
}

export function stripUndefinedOverrides<T extends Record<string, unknown>>(obj?: Partial<T>): Partial<T> {
  if (!obj) return {};
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export function compactConfigOverrides(input: Partial<Config>): Partial<Config> {
  const out: Partial<Config> = {};
  for (const [key, value] of Object.entries(input) as Array<[keyof Config, unknown]>) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    (out as Record<keyof Config, unknown>)[key] = value;
  }
  return out;
}

/**
 * Get configuration with optional overrides
 */
export function getConfig(overrides?: Partial<Config>): Config {
  const baseConfig = loadConfig();
  return { ...baseConfig, ...stripUndefinedOverrides(overrides) };
}
