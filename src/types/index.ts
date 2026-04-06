/**
 * Type definitions for Blackboard Downloader
 */

export interface Course {
  id: string;
  name: string;
  url: string;
  path: string;
}

export interface ContentFolder {
  name: string;
  url: string;
  path: string;
  parentPath: string;
}

export interface DownloadableFile {
  name: string;
  url: string;
  path: string;
  size?: number;
  mimeType?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export interface SidebarLink {
  title: string;
  url: string;
  path: string;
}

export interface Config {
  username: string;
  password: string;
  baseUrl: string;
  loginUrl: string;
  downloadDir: string;
  maxConcurrentDownloads: number;
  downloadTimeout: number;
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  browserTimeout: number;
  databasePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile: string;
  courseFilter?: string;
  maxRetries: number;
  retryDelay: number;
}

export interface DownloadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

export interface DatabaseRecord {
  id?: number;
  url: string;
  path: string;
  filename: string;
  status: string;
  size?: number;
  downloadedAt?: Date;
  error?: string;
}
