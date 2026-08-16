/**
 * Git Manager
 *
 * Auto-commits mind file changes and provides history/rollback capabilities.
 * Uses simple-git for all git operations.
 */
export declare class GitManager {
    commitTimer: any;
    debounceMs: any;
    git: any;
    initialized: any;
    mindPath: any;
    pendingFiles: any;
    constructor(mindPath: any, options?: any);
    /**
     * Initialize git repository if needed
     */
    initialize(): Promise<any>;
    /**
     * Schedule a commit for changed files (debounced)
     */
    scheduleCommit(filePath: any): void;
    /**
     * Commit all pending files
     */
    commitPending(): Promise<{
        hash: any;
        message: any;
        files: any;
    } | null>;
    /**
     * Commit specific files
     */
    commit(files: any, message?: any): Promise<{
        hash: any;
        message: any;
        files: any;
    } | null>;
    /**
     * Commit all changes (for shutdown, etc.)
     */
    commitAll(message?: any): Promise<{
        hash: any;
        message: any;
    } | null>;
    /**
     * Get commit history for a specific file
     */
    getHistory(filePath: any, options?: any): Promise<{
        filepath: string;
        commits: any;
    }>;
    /**
     * Get file contents at a specific commit
     */
    getFileAtCommit(filePath: any, commitHash: any): Promise<any>;
    /**
     * Get a snapshot of the mind at a specific date
     */
    getSnapshot(date: any): Promise<{
        hash: any;
        date: any;
        message: any;
    } | null>;
    /**
     * Rollback to a specific commit
     * Uses checkout to restore files while preserving history
     */
    rollback(commitHash: any): Promise<{
        hash: any;
        rolledBackTo: any;
    }>;
    /**
     * Get the current HEAD commit hash
     */
    getCurrentHash(): Promise<any>;
    /**
     * Get diff between current state and a commit
     */
    getDiff(filePath: any, fromHash?: any): Promise<any>;
    /**
     * Get overall repository status
     */
    getStatus(): Promise<{
        current: any;
        tracking: any;
        files: any;
        ahead: any;
        behind: any;
    }>;
}
//# sourceMappingURL=git.d.ts.map