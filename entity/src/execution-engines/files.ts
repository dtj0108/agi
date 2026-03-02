/**
 * File Operations
 *
 * Scoped file operations with path traversal prevention.
 * All paths are validated against allowed/blocked lists.
 */

import {
  readFile, writeFile, appendFile, rename, unlink,
  readdir, stat, mkdir,
} from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, relative, normalize } from 'path';
import globModule from 'glob';

const glob: any = (globModule as any).glob ?? (globModule as any);

export class FileOperations {
  allowedPaths: any;
  blockedPaths: any;
  config: any;
  mindPath: any;
  workspacePath: any;
  constructor(config: any) {
    this.config = config;
    this.workspacePath = resolve(config.actions?.shell?.workingDir || './entity-workspace');
    this.mindPath = resolve(config.mind?.path || './mind');

    // Allowed paths
    this.allowedPaths = [
      this.workspacePath,
      this.mindPath,
      ...(config.actions?.files?.allowedPaths || []).map((p: any) => resolve(p)),
    ];

    // Blocked paths
    this.blockedPaths = [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/System',
      '/Library',
      '/private/etc',
      '/var/log',
      resolve(process.env.HOME || '', '.ssh'),
      resolve(process.env.HOME || '', '.gnupg'),
      resolve(process.env.HOME || '', '.aws'),
      ...(config.actions?.files?.blockedPaths || []).map((p: any) => resolve(p)),
    ];
  }

  /**
   * Validate a path for an operation
   */
  validatePath(inputPath: any, operation: any = 'read') {
    // Step 1: Resolve to absolute path
    const absolutePath = resolve(inputPath);

    // Step 2: Normalize to remove .. and .
    const normalizedPath = normalize(absolutePath);

    // Step 3: Verify the resolved path matches what we expect
    if (absolutePath !== normalizedPath) {
      throw new SecurityError(`Path normalization mismatch: potential traversal attack`);
    }

    // Step 4: Check against blocked paths
    for (const blocked of this.blockedPaths) {
      if (normalizedPath.startsWith(blocked + '/') || normalizedPath === blocked) {
        throw new SecurityError(`Access denied: path is in blocked area: ${blocked}`);
      }
    }

    // Step 5: Check against allowed paths
    let isAllowed = false;
    for (const allowed of this.allowedPaths) {
      if (normalizedPath.startsWith(allowed + '/') || normalizedPath === allowed) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      throw new SecurityError(`Access denied: path not in allowed areas`);
    }

    // Step 6: For write/delete operations, verify appropriate location
    if (['write', 'append', 'delete', 'move'].includes(operation)) {
      const inWorkspace = normalizedPath.startsWith(this.workspacePath + '/') ||
                          normalizedPath === this.workspacePath;
      const inMind = normalizedPath.startsWith(this.mindPath + '/') ||
                     normalizedPath === this.mindPath;

      if (!inWorkspace && !inMind) {
        throw new SecurityError(`Write operations only allowed in workspace or mind directories`);
      }
    }

    return normalizedPath;
  }

  /**
   * Check if a path is in the workspace
   */
  isInWorkspace(path: any) {
    const resolved = resolve(path);
    return resolved.startsWith(this.workspacePath + '/') ||
           resolved === this.workspacePath;
  }

  /**
   * Execute a file operation
   */
  async execute(params: any) {
    const { operation, action } = params;
    const op = operation || action;

    switch (op) {
      case 'read':
        return this.read(params.path);
      case 'write':
        return this.write(params.path, params.content);
      case 'append':
        return this.append(params.path, params.content);
      case 'move':
        return this.move(params.src, params.dst);
      case 'delete':
        return this.delete(params.path);
      case 'list':
        return this.list(params.path);
      case 'search':
        return this.search(params.path, params.pattern);
      case 'exists':
        return this.exists(params.path);
      case 'stat':
        return this.stat(params.path);
      default:
        throw new Error(`Unknown file operation: ${op}`);
    }
  }

  /**
   * Read a file
   */
  async read(path: any) {
    const validPath = this.validatePath(path, 'read');
    const content = await readFile(validPath, 'utf8');

    return {
      success: true,
      path: validPath,
      content,
      size: content.length,
    };
  }

  /**
   * Write to a file
   */
  async write(path: any, content: any) {
    const validPath = this.validatePath(path, 'write');

    // Ensure directory exists
    const dir = resolve(validPath, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(validPath, content, 'utf8');

    return {
      success: true,
      path: validPath,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Append to a file
   */
  async append(path: any, content: any) {
    const validPath = this.validatePath(path, 'append');

    // Ensure directory exists
    const dir = resolve(validPath, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await appendFile(validPath, content, 'utf8');

    return {
      success: true,
      path: validPath,
      bytesAppended: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Move/rename a file
   */
  async move(src: any, dst: any) {
    const validSrc = this.validatePath(src, 'read');
    const validDst = this.validatePath(dst, 'write');

    // Ensure destination directory exists
    const dir = resolve(validDst, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await rename(validSrc, validDst);

    return {
      success: true,
      from: validSrc,
      to: validDst,
    };
  }

  /**
   * Delete a file
   */
  async delete(path: any) {
    const validPath = this.validatePath(path, 'delete');
    await unlink(validPath);

    return {
      success: true,
      path: validPath,
    };
  }

  /**
   * List directory contents
   */
  async list(path: any) {
    const validPath = this.validatePath(path, 'read');
    const entries = await readdir(validPath, { withFileTypes: true });

    return {
      success: true,
      path: validPath,
      entries: entries.map((e: any) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      })),
    };
  }

  /**
   * Search for files matching a pattern
   */
  async search(basePath: any, pattern: any) {
    const validPath = this.validatePath(basePath, 'read');
    const fullPattern = join(validPath, pattern);

    const files = await glob(fullPattern, {
      nodir: false,
      dot: false,
    });

    // Validate each result is still in allowed paths
    const validFiles = files.filter((f: any) => {
      try {
        this.validatePath(f, 'read');
        return true;
      } catch {
        return false;
      }
    });

    return {
      success: true,
      basePath: validPath,
      pattern,
      files: validFiles,
    };
  }

  /**
   * Check if a file exists
   */
  async exists(path: any) {
    const validPath = this.validatePath(path, 'read');

    return {
      success: true,
      path: validPath,
      exists: existsSync(validPath),
    };
  }

  /**
   * Get file stats
   */
  async stat(path: any) {
    const validPath = this.validatePath(path, 'read');
    const stats = await stat(validPath);

    return {
      success: true,
      path: validPath,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
    };
  }
}

/**
 * Security error for file operations
 */
class SecurityError extends Error {
  constructor(message: any) {
    super(message);
    this.name = 'SecurityError';
  }
}
