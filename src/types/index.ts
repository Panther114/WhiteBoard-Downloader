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
  includeNonSubjectCourses: boolean;
  maxRetries: number;
  retryDelay: number;
  /** Path to the JSON file-tree cache. Defaults to <downloadDir>/file_tree.json. */
  fileTreePath: string;
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

// ---------------------------------------------------------------------------
// File-tree cache — mirrors Blackboard's course / section / folder hierarchy
// ---------------------------------------------------------------------------

export interface FileTreeEntry {
  url: string;
  localPath: string;
  size?: number;
  downloadedAt: string; // ISO-8601
  mimeType?: string;
}

export interface FileTreeFolder {
  files: Record<string, FileTreeEntry>;
}

export interface FileTreeSection {
  folders: Record<string, FileTreeFolder>;
}

export interface FileTreeCourse {
  sections: Record<string, FileTreeSection>;
}

export interface FileTree {
  /** Schema version for future migrations. */
  version: number;
  /** ISO-8601 timestamp of last update. */
  generatedAt: string;
  courses: Record<string, FileTreeCourse>;
}
