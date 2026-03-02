/**
 * File Operations
 *
 * Scoped file operations with path traversal prevention.
 * All paths are validated against allowed/blocked lists.
 */
export declare class FileOperations {
    allowedPaths: any;
    blockedPaths: any;
    config: any;
    mindPath: any;
    workspacePath: any;
    constructor(config: any);
    /**
     * Validate a path for an operation
     */
    validatePath(inputPath: any, operation?: any): string;
    /**
     * Check if a path is in the workspace
     */
    isInWorkspace(path: any): boolean;
    /**
     * Execute a file operation
     */
    execute(params: any): Promise<{
        success: boolean;
        from: string;
        to: string;
    } | {
        success: boolean;
        path: string;
    } | {
        success: boolean;
        basePath: string;
        pattern: any;
        files: any;
    }>;
    /**
     * Read a file
     */
    read(path: any): Promise<{
        success: boolean;
        path: string;
        content: string;
        size: number;
    }>;
    /**
     * Write to a file
     */
    write(path: any, content: any): Promise<{
        success: boolean;
        path: string;
        bytesWritten: number;
    }>;
    /**
     * Append to a file
     */
    append(path: any, content: any): Promise<{
        success: boolean;
        path: string;
        bytesAppended: number;
    }>;
    /**
     * Move/rename a file
     */
    move(src: any, dst: any): Promise<{
        success: boolean;
        from: string;
        to: string;
    }>;
    /**
     * Delete a file
     */
    delete(path: any): Promise<{
        success: boolean;
        path: string;
    }>;
    /**
     * List directory contents
     */
    list(path: any): Promise<{
        success: boolean;
        path: string;
        entries: {
            name: any;
            type: string;
        }[];
    }>;
    /**
     * Search for files matching a pattern
     */
    search(basePath: any, pattern: any): Promise<{
        success: boolean;
        basePath: string;
        pattern: any;
        files: any;
    }>;
    /**
     * Check if a file exists
     */
    exists(path: any): Promise<{
        success: boolean;
        path: string;
        exists: boolean;
    }>;
    /**
     * Get file stats
     */
    stat(path: any): Promise<{
        success: boolean;
        path: string;
        isFile: boolean;
        isDirectory: boolean;
        size: number;
        modified: string;
        created: string;
    }>;
}
//# sourceMappingURL=files.d.ts.map