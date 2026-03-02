/**
 * File Integrity Verification
 *
 * Computes and verifies SHA-256 checksums for mind files.
 * Used to detect unauthorized modifications.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Compute SHA-256 hash of a string or buffer
 */
export function computeChecksum(content: any) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute checksum of a file
 */
export function computeFileChecksum(filePath: any) {
  const content = readFileSync(filePath);
  return computeChecksum(content);
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath: any, files: any = []) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    // Skip hidden files and directories (like .git, .index.db)
    if (entry.name.startsWith('.')) {
      continue;
    }

    if (entry.isDirectory()) {
      await getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load checksums from file
 */
export function loadChecksums(checksumsPath: any) {
  if (!existsSync(checksumsPath)) {
    return {} as Record<string, string>;
  }

  try {
    const content = readFileSync(checksumsPath, 'utf-8');
    return JSON.parse(content) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

/**
 * Save checksums to file
 */
export function saveChecksums(checksumsPath: any, checksums: any) {
  writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));
}

/**
 * Compute checksums for all files in a directory
 */
export async function computeDirectoryChecksums(dirPath: any) {
  const checksums: Record<string, string> = {};
  const files = await getAllFiles(dirPath);

  for (const file of files) {
    const relativePath = relative(dirPath, file);
    checksums[relativePath] = computeFileChecksum(file);
  }

  return checksums;
}

/**
 * Verify checksums and return differences
 */
export async function verifyChecksums(dirPath: any, storedChecksums: any) {
  const currentChecksums = await computeDirectoryChecksums(dirPath);

  const differences: { modified: string[]; added: string[]; removed: string[] } = {
    modified: [],
    added: [],
    removed: [],
  };

  // Check for modified and removed files
  for (const [path, hash] of Object.entries(storedChecksums)) {
    if (!(path in currentChecksums)) {
      differences.removed.push(path);
    } else if (currentChecksums[path] !== hash) {
      differences.modified.push(path);
    }
  }

  // Check for added files
  for (const path of Object.keys(currentChecksums)) {
    if (!(path in storedChecksums)) {
      differences.added.push(path);
    }
  }

  return {
    valid: differences.modified.length === 0 &&
           differences.added.length === 0 &&
           differences.removed.length === 0,
    differences,
    currentChecksums,
  };
}

/**
 * Update a single file's checksum
 */
export function updateFileChecksum(checksumsPath: any, filePath: any, basePath: any) {
  const checksums = loadChecksums(checksumsPath);
  const relativePath = relative(basePath, filePath);
  checksums[relativePath] = computeFileChecksum(filePath);
  saveChecksums(checksumsPath, checksums);
  return checksums[relativePath];
}

/**
 * Remove a file's checksum entry
 */
export function removeFileChecksum(checksumsPath: any, filePath: any, basePath: any) {
  const checksums = loadChecksums(checksumsPath);
  const relativePath = relative(basePath, filePath);
  delete checksums[relativePath];
  saveChecksums(checksumsPath, checksums);
}
