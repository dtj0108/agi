/**
 * File Integrity Verification
 *
 * Computes and verifies SHA-256 checksums for mind files.
 * Used to detect unauthorized modifications.
 */
/**
 * Compute SHA-256 hash of a string or buffer
 */
export declare function computeChecksum(content: any): string;
/**
 * Compute checksum of a file
 */
export declare function computeFileChecksum(filePath: any): string;
/**
 * Load checksums from file
 */
export declare function loadChecksums(checksumsPath: any): Record<string, string>;
/**
 * Save checksums to file
 */
export declare function saveChecksums(checksumsPath: any, checksums: any): void;
/**
 * Compute checksums for all files in a directory
 */
export declare function computeDirectoryChecksums(dirPath: any): Promise<Record<string, string>>;
/**
 * Verify checksums and return differences
 */
export declare function verifyChecksums(dirPath: any, storedChecksums: any): Promise<{
    valid: boolean;
    differences: {
        modified: string[];
        added: string[];
        removed: string[];
    };
    currentChecksums: Record<string, string>;
}>;
/**
 * Update a single file's checksum
 */
export declare function updateFileChecksum(checksumsPath: any, filePath: any, basePath: any): string;
/**
 * Remove a file's checksum entry
 */
export declare function removeFileChecksum(checksumsPath: any, filePath: any, basePath: any): void;
//# sourceMappingURL=checksums.d.ts.map