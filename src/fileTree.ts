/**
 * File-tree cache — a JSON file that mirrors Blackboard's course / section /
 * folder hierarchy.  Used to avoid expensive per-run filesystem scans when
 * checking for already-downloaded files.
 *
 * Layout:  <DOWNLOAD_DIR>/file_tree.json
 */

import fs from 'fs';
import path from 'path';
import { FileTree, FileTreeEntry } from './types';
import { log } from './utils/logger';

/** Current schema version.  Bump when the shape changes. */
const FILE_TREE_VERSION = 1;

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Load and parse an existing file tree from disk.
 * Returns an empty tree if the file does not exist or cannot be parsed.
 */
export function loadFileTree(filePath: string): FileTree {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as FileTree;
      if (parsed.version && parsed.courses) {
        log.debug(`Loaded file tree from ${filePath} (generated ${parsed.generatedAt})`);
        return parsed;
      }
    }
  } catch (err: any) {
    log.warn(`Could not load file tree from ${filePath}: ${err.message}`);
  }
  return createEmptyTree();
}

/**
 * Atomically write the file tree to disk (write → .tmp → rename).
 */
export function saveFileTree(tree: FileTree, filePath: string): void {
  tree.generatedAt = new Date().toISOString();

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(tree, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  log.debug(`File tree saved to ${filePath}`);
}

// ---------------------------------------------------------------------------
// Lookup / mutation helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a specific file already exists in the tree.
 */
export function isFileInTree(
  tree: FileTree,
  courseName: string,
  sectionName: string,
  folderPath: string,
  filename: string,
): boolean {
  return !!(
    tree.courses[courseName]?.sections[sectionName]?.folders[folderPath]?.files[filename]
  );
}

/**
 * Add (or update) a file entry in the tree.  Creates intermediate nodes
 * (course / section / folder) on the fly.
 */
export function addFileToTree(
  tree: FileTree,
  courseName: string,
  sectionName: string,
  folderPath: string,
  filename: string,
  entry: FileTreeEntry,
): void {
  if (!tree.courses[courseName]) {
    tree.courses[courseName] = { sections: {} };
  }
  const course = tree.courses[courseName];

  if (!course.sections[sectionName]) {
    course.sections[sectionName] = { folders: {} };
  }
  const section = course.sections[sectionName];

  if (!section.folders[folderPath]) {
    section.folders[folderPath] = { files: {} };
  }

  section.folders[folderPath].files[filename] = entry;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyTree(): FileTree {
  return {
    version: FILE_TREE_VERSION,
    generatedAt: new Date().toISOString(),
    courses: {},
  };
}

/**
 * Build a file tree from an existing download directory by scanning the
 * filesystem.  This is the migration path for users who already have
 * downloaded files but no `file_tree.json` yet.
 *
 * Expected layout:  <downloadDir>/<course>/<section>/[subfolder/]*<file>
 *
 * Only the first two directory levels are treated as course/section;
 * everything below that is collapsed into the folder path key.
 */
export function buildFileTreeFromDisk(downloadDir: string): FileTree {
  const tree = createEmptyTree();

  if (!fs.existsSync(downloadDir)) return tree;

  const courseNames = readdirSafe(downloadDir).filter(name =>
    fs.statSync(path.join(downloadDir, name)).isDirectory()
  );

  for (const courseName of courseNames) {
    const coursePath = path.join(downloadDir, courseName);
    const sectionNames = readdirSafe(coursePath).filter(name =>
      fs.statSync(path.join(coursePath, name)).isDirectory()
    );

    for (const sectionName of sectionNames) {
      const sectionPath = path.join(coursePath, sectionName);
      scanFolderRecursive(tree, courseName, sectionName, sectionPath, sectionPath);
    }
  }

  log.info(`Built file tree from disk: ${countFiles(tree)} files across ${courseNames.length} courses`);
  return tree;
}

function scanFolderRecursive(
  tree: FileTree,
  courseName: string,
  sectionName: string,
  baseSectionPath: string,
  currentPath: string,
): void {
  const entries = readdirSafe(currentPath);

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanFolderRecursive(tree, courseName, sectionName, baseSectionPath, fullPath);
    } else if (stat.isFile() && !entry.startsWith('.')) {
      // Use the section-relative directory path as the folder key
      const folderPath = currentPath;
      addFileToTree(tree, courseName, sectionName, folderPath, entry, {
        url: '',
        localPath: fullPath,
        size: stat.size,
        downloadedAt: stat.mtime.toISOString(),
      });
    }
  }
}

function readdirSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function countFiles(tree: FileTree): number {
  let count = 0;
  for (const course of Object.values(tree.courses)) {
    for (const section of Object.values(course.sections)) {
      for (const folder of Object.values(section.folders)) {
        count += Object.keys(folder.files).length;
      }
    }
  }
  return count;
}
