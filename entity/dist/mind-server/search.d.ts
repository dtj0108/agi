/**
 * Search Index
 *
 * SQLite FTS5 full-text search over mind files.
 * Optionally supports vector search via sqlite-vec when embeddings are enabled.
 * Maintains a searchable index of all mind file contents.
 */
export declare class SearchIndex {
    db: any;
    dbPath: any;
    embeddingService: any;
    ftsTable: any;
    mindPath: any;
    stmts: any;
    vectorsEnabled: any;
    constructor(mindPath: any, dbPath: any, embeddingService?: any);
    /**
     * Initialize the database and create tables
     */
    initialize(): Promise<void>;
    /**
     * Compute SHA-256 checksum of content
     */
    computeChecksum(content: any): string;
    /**
     * Index a file (add or update)
     * Optionally generates embedding if service is available
     */
    indexFile(path: any, content: any, generateEmbedding?: any): Promise<{
        path: string;
        checksum: string;
    }>;
    /**
     * Remove a file from the index
     */
    removeFile(path: any): {
        path: string;
    };
    /**
     * Search the index
     */
    search(query: any, options?: any): {
        results: any;
        total: any;
        query: any;
        error?: undefined;
    } | {
        results: never[];
        total: number;
        query: any;
        error: string;
    };
    /**
     * Escape special FTS5 query characters
     */
    escapeQuery(query: any): any;
    /**
     * Get content of a specific file from the index
     */
    getFileContent(path: any): any;
    /**
     * Rebuild the entire index from the filesystem
     */
    rebuildIndex(includeEmbeddings?: any): Promise<{
        indexed: number;
        total: any;
    }>;
    /**
     * Get all files in a directory recursively
     */
    getAllFiles(dirPath: any, files?: any): Promise<any>;
    /**
     * Get all indexed files with their checksums
     */
    getAllIndexed(): any;
    /**
     * Close the database connection
     */
    close(): void;
    /**
     * Initialize vector tables if embeddings are enabled
     */
    initializeVectorTables(): Promise<void>;
    /**
     * Check if vector search is available
     */
    hasEmbeddings(): any;
    /**
     * Index embedding for a file
     */
    indexEmbedding(relativePath: any, content: any): Promise<{
        path: any;
        dimensions: any;
    } | null>;
    /**
     * Semantic vector search
     */
    vectorSearch(query: any, options?: any): Promise<{
        results: any;
        total: any;
        query: any;
        method: string;
        error?: undefined;
    } | {
        results: never[];
        total: number;
        query: any;
        error: any;
        method?: undefined;
    }>;
    /**
     * Hybrid search combining FTS5 + vector similarity
     */
    hybridSearch(query: any, options?: any): Promise<{
        results: any;
        total: number;
        query: any;
        method: string;
        weights?: undefined;
    } | {
        results: any[];
        total: number;
        query: any;
        method: string;
        weights: {
            vector: any;
            fts: any;
        };
    }>;
}
//# sourceMappingURL=search.d.ts.map