import { Course, DiscoveredFile } from '../types';

export interface DiscoverFilesResult {
  discovered: DiscoveredFile[];
  enriched: DiscoveredFile[];
  files: DiscoveredFile[];
  skippedOnDisk: number;
}

export interface WorkflowSummary {
  coursesDiscovered: number;
  coursesSelected: number;
  filesDiscovered: number;
  filesSelected: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesFailed: number;
  failedFiles: Array<{ name: string; reason: string }>;
}

export interface DiscoverCoursesOptions {
  filterPattern?: string;
}

export interface DownloadPreparation {
  selectedCourses: Course[];
  selectedFiles: DiscoveredFile[];
}

