import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { WhiteboardDownloader } from '../index';
import { Config, Course, DiscoveredFile, FileTree } from '../types';
import { sanitizeFilename } from '../utils/helpers';
import { isFileInTree } from '../fileTree';
import { WorkflowSummary, DiscoverCoursesOptions, DiscoverFilesResult } from './types';

function filterAlreadyDownloaded(
  files: DiscoveredFile[],
  fileTree: FileTree,
): { files: DiscoveredFile[]; skippedOnDisk: number } {
  const result: DiscoveredFile[] = [];
  let skippedOnDisk = 0;

  for (const file of files) {
    const sanitized = sanitizeFilename(file.name);

    const inTree =
      isFileInTree(fileTree, file.courseName, file.sectionName, file.savePath, file.name) ||
      isFileInTree(fileTree, file.courseName, file.sectionName, file.savePath, sanitized);

    const existsByOriginal = !inTree && fs.existsSync(path.join(file.savePath, file.name));
    const existsBySanitized =
      !inTree && sanitized !== file.name && fs.existsSync(path.join(file.savePath, sanitized));

    if (inTree || existsByOriginal || existsBySanitized) {
      skippedOnDisk++;
    } else {
      result.push(file);
    }
  }

  return { files: result, skippedOnDisk };
}

export class DownloadWorkflow extends EventEmitter {
  private readonly config: Config;
  private wbDownloader: WhiteboardDownloader | null = null;

  constructor(config: Config) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.emit('login:start', {});
    this.wbDownloader = new WhiteboardDownloader(this.config);

    this.wbDownloader.on('download:start', data => this.emit('download:start', data));
    this.wbDownloader.on('download:progress', data => this.emit('download:progress', data));
    this.wbDownloader.on('download:complete', data => this.emit('download:complete', data));
    this.wbDownloader.on('download:error', data => this.emit('download:error', data));
    this.wbDownloader.on('download:skip', data => this.emit('download:skip', data));

    try {
      await this.wbDownloader.initialize();
      this.emit('login:success', {});
    } catch (error) {
      this.emit('login:failure', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async discoverCourses(options?: DiscoverCoursesOptions): Promise<Course[]> {
    if (!this.wbDownloader) {
      throw new Error('Workflow not initialized. Call initialize() first.');
    }

    const courses = await this.wbDownloader.getCourses();
    const filtered = this.filterCourses(courses, options);
    this.emit('courses:discovered', { total: courses.length, visible: filtered.length });
    return filtered;
  }

  async discoverFiles(selectedCourses: Course[]): Promise<DiscoverFilesResult> {
    if (!this.wbDownloader) {
      throw new Error('Workflow not initialized. Call initialize() first.');
    }

    this.emit('files:discovery:start', { courseCount: selectedCourses.length });
    const discovered = await this.wbDownloader.discoverAllFiles(selectedCourses);
    this.emit('files:discovery:complete', { filesDiscovered: discovered.length });

    const enriched = await this.wbDownloader.fetchFileMetadata(discovered);
    const filtered = filterAlreadyDownloaded(enriched, this.wbDownloader.getFileTree());
    this.emit('files:ready', {
      filesDiscovered: discovered.length,
      filesSelectable: filtered.files.length,
      skippedOnDisk: filtered.skippedOnDisk,
    });

    return {
      discovered,
      enriched,
      files: filtered.files,
      skippedOnDisk: filtered.skippedOnDisk,
    };
  }

  async downloadSelected(files: DiscoveredFile[]): Promise<void> {
    if (!this.wbDownloader) {
      throw new Error('Workflow not initialized. Call initialize() first.');
    }
    await this.wbDownloader.downloadSelected(files);
  }

  getDownloader(): WhiteboardDownloader {
    if (!this.wbDownloader) {
      throw new Error('Workflow not initialized. Call initialize() first.');
    }
    return this.wbDownloader;
  }

  emitSummary(summary: WorkflowSummary): void {
    this.emit('summary:ready', summary);
  }

  async cleanup(): Promise<void> {
    if (this.wbDownloader) {
      await this.wbDownloader.cleanup();
      this.wbDownloader = null;
    }
  }

  private filterCourses(courses: Course[], options?: DiscoverCoursesOptions): Course[] {
    const pattern = options?.filterPattern?.trim();
    if (!pattern) return courses;

    try {
      const regex = new RegExp(pattern);
      return courses.filter(course => regex.test(course.name));
    } catch {
      return courses;
    }
  }
}

export { filterAlreadyDownloaded };

