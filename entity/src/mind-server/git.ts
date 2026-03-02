/**
 * Git Manager
 *
 * Auto-commits mind file changes and provides history/rollback capabilities.
 * Uses simple-git for all git operations.
 */

import simpleGit from 'simple-git';
import { relative, basename } from 'path';

export class GitManager {
  commitTimer: any;
  debounceMs: any;
  git: any;
  initialized: any;
  mindPath: any;
  pendingFiles: any;
  constructor(mindPath: any, options: any = {}) {
    this.mindPath = mindPath;
    this.debounceMs = options.debounceMs || 500;
    this.git = simpleGit(mindPath);
    this.pendingFiles = new Set();
    this.commitTimer = null;
    this.initialized = false;
  }

  /**
   * Initialize git repository if needed
   */
  async initialize() {
    try {
      // Check if already a git repo
      await this.git.revparse(['--git-dir']);
      this.initialized = true;
    } catch {
      // Not a git repo, initialize it
      await this.git.init();
      await this.git.add('-A');
      await this.git.commit('mind: initial state');
      this.initialized = true;
    }

    return this.initialized;
  }

  /**
   * Schedule a commit for changed files (debounced)
   */
  scheduleCommit(filePath: any) {
    const relativePath = relative(this.mindPath, filePath);
    this.pendingFiles.add(relativePath);

    // Clear existing timer
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
    }

    // Set new timer
    this.commitTimer = setTimeout(async () => {
      await this.commitPending();
    }, this.debounceMs);
  }

  /**
   * Commit all pending files
   */
  async commitPending() {
    if (this.pendingFiles.size === 0) return null;

    const files = [...this.pendingFiles];
    this.pendingFiles.clear();
    this.commitTimer = null;

    // @ts-expect-error TODO(ts-migration): TS(2554): Expected 2 arguments, but got 1.
    return this.commit(files);
  }

  /**
   * Commit specific files
   */
  async commit(files: any, message: any) {
    if (!files || files.length === 0) return null;

    try {
      // Stage files
      await this.git.add(files);

      // Generate commit message if not provided
      if (!message) {
        if (files.length === 1) {
          message = `mind: update ${basename(files[0])}`;
        } else {
          message = `mind: update ${files.length} files`;
        }
      }

      // Commit
      const result = await this.git.commit(message);

      return {
        hash: result.commit,
        message,
        files,
      };
    } catch (error: any) {
      // If nothing to commit, that's okay
      if (error.message.includes('nothing to commit')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Commit all changes (for shutdown, etc.)
   */
  async commitAll(message: any = 'mind: save state') {
    try {
      await this.git.add('-A');
      const result = await this.git.commit(message);
      return {
        hash: result.commit,
        message,
      };
    } catch (error: any) {
      if (error.message.includes('nothing to commit')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get commit history for a specific file
   */
  async getHistory(filePath: any, options: any = {}) {
    const relativePath = relative(this.mindPath, filePath);
    const limit = options.limit || 50;

    try {
      const log = await this.git.log({
        file: relativePath,
        maxCount: limit,
      });

      return {
        filepath: relativePath,
        commits: log.all.map((commit: any) => ({
          hash: commit.hash,
          message: commit.message,
          date: commit.date,
          author: commit.author_name,
        })),
      };
    } catch {
      return { filepath: relativePath, commits: [] };
    }
  }

  /**
   * Get file contents at a specific commit
   */
  async getFileAtCommit(filePath: any, commitHash: any) {
    const relativePath = relative(this.mindPath, filePath);

    try {
      const content = await this.git.show([`${commitHash}:${relativePath}`]);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get a snapshot of the mind at a specific date
   */
  async getSnapshot(date: any) {
    try {
      // Find the commit closest to the given date
      const log = await this.git.log({
        before: date,
        maxCount: 1,
      });

      if (log.all.length === 0) {
        return null;
      }

      return {
        hash: log.all[0].hash,
        date: log.all[0].date,
        message: log.all[0].message,
      };
    } catch {
      return null;
    }
  }

  /**
   * Rollback to a specific commit
   * Uses checkout to restore files while preserving history
   */
  async rollback(commitHash: any) {
    // Commit any pending changes first
    await this.commitAll('mind: pre-rollback state');

    // Checkout the commit's content without changing HEAD
    await this.git.checkout([commitHash, '--', '.']);

    // Commit the rollback
    const result = await this.git.commit(`mind: rollback to ${commitHash.slice(0, 7)}`);

    return {
      hash: result.commit,
      rolledBackTo: commitHash,
    };
  }

  /**
   * Get the current HEAD commit hash
   */
  async getCurrentHash() {
    try {
      const result = await this.git.revparse(['HEAD']);
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get diff between current state and a commit
   */
  async getDiff(filePath: any, fromHash: any = 'HEAD') {
    const relativePath = filePath ? relative(this.mindPath, filePath) : null;

    try {
      const args = relativePath
        ? [fromHash, '--', relativePath]
        : [fromHash];
      const diff = await this.git.diff(args);
      return diff;
    } catch {
      return null;
    }
  }

  /**
   * Get overall repository status
   */
  async getStatus() {
    const status = await this.git.status();
    return {
      current: status.current,
      tracking: status.tracking,
      files: status.files,
      ahead: status.ahead,
      behind: status.behind,
    };
  }
}
