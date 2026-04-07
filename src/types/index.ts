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

/**
 * A file discovered during the scrape phase, enriched with course/section
 * context for display in the selection GUI.
 */
export interface DiscoveredFile {
  name: string;
  url: string;
  courseName: string;
  sectionName: string;
  /** Absolute local directory where the file should be saved */
  savePath: string;
  size?: number;
  mimeType?: string;
  /** Upper-case extension label, e.g. "PDF", "PPTX" */
  fileType?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
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
