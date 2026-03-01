/**
 * File Integrity Verification
 *
 * Computes and verifies SHA-256 checksums for mind files.
 * Used to detect unauthorized modifications.
 */

import { createHash, BinaryLike } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';

export type ChecksumMap = Record<string, string>;

export interface ChecksumDifferences {
  modified: string[];
  added: string[];
  removed: string[];
}

export interface VerificationResult {
  valid: boolean;
  differences: ChecksumDifferences;
  currentChecksums: ChecksumMap;
}

/**
 * Compute SHA-256 hash of a string or buffer
 */
export function computeChecksum(content: BinaryLike): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute checksum of a file
 */
export function computeFileChecksum(filePath: string): string {
  const content = readFileSync(filePath);
  return computeChecksum(content);
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath: string, files: string[] = []): Promise<string[]> {
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
export function loadChecksums(checksumsPath: string): ChecksumMap {
  if (!existsSync(checksumsPath)) {
    return {};
  }

  try {
    const content = readFileSync(checksumsPath, 'utf-8');
    return JSON.parse(content) as ChecksumMap;
  } catch {
    return {};
  }
}

/**
 * Save checksums to file
 */
export function saveChecksums(checksumsPath: string, checksums: ChecksumMap): void {
  writeFileSync(checksumsPath, JSON.stringify(checksums, null, 2));
}

/**
 * Compute checksums for all files in a directory
 */
export async function computeDirectoryChecksums(dirPath: string): Promise<ChecksumMap> {
  const checksums: ChecksumMap = {};
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
export async function verifyChecksums(
  dirPath: string,
  storedChecksums: ChecksumMap
): Promise<VerificationResult> {
  const currentChecksums = await computeDirectoryChecksums(dirPath);

  const differences: ChecksumDifferences = {
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
    valid:
      differences.modified.length === 0 &&
      differences.added.length === 0 &&
      differences.removed.length === 0,
    differences,
    currentChecksums,
  };
}

/**
 * Update a single file's checksum
 */
export function updateFileChecksum(
  checksumsPath: string,
  filePath: string,
  basePath: string
): string {
  const checksums = loadChecksums(checksumsPath);
  const relativePath = relative(basePath, filePath);
  checksums[relativePath] = computeFileChecksum(filePath);
  saveChecksums(checksumsPath, checksums);
  return checksums[relativePath];
}

/**
 * Remove a file's checksum entry
 */
export function removeFileChecksum(
  checksumsPath: string,
  filePath: string,
  basePath: string
): void {
  const checksums = loadChecksums(checksumsPath);
  const relativePath = relative(basePath, filePath);
  delete checksums[relativePath];
  saveChecksums(checksumsPath, checksums);
}
