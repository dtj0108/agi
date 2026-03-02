/**
 * Mind Server
 *
 * Coordinates file watching, search indexing, and git auto-commits.
 * This is the infrastructure layer that maintains the entity's mind filesystem.
 */
import { EventEmitter } from 'events';
export declare class MindServer extends EventEmitter {
    config: any;
    embeddingService: any;
    fileWatcher: any;
    git: any;
    mindPath: any;
    search: any;
    started: any;
    constructor(config: any);
    /**
     * Start all mind server components
     */
    start(): Promise<void>;
    /**
     * Handle file addition
     */
    onFileAdded(event: any): Promise<void>;
    /**
     * Handle file change
     */
    onFileChanged(event: any): Promise<void>;
    /**
     * Handle file removal
     */
    onFileRemoved(event: any): void;
    /**
     * Read a mind file by relative path
     */
    readFile(relativePath: any): Promise<string>;
    /**
     * Resolve and validate a path inside the mind directory
     */
    resolveMindPath(relativePath: any): string;
    /**
     * Search the mind (FTS5 full-text search)
     */
    searchMind(query: any, options: any): any;
    /**
     * Vector search the mind (semantic similarity)
     */
    vectorSearchMind(query: any, options: any): Promise<any>;
    /**
     * Hybrid search the mind (FTS + vector combined)
     */
    hybridSearchMind(query: any, options: any): Promise<any>;
    /**
     * Check if embeddings/vector search is available
     */
    hasEmbeddings(): any;
    /**
     * Get file history
     */
    getHistory(filePath: any): Promise<any>;
    /**
     * Get snapshot at date
     */
    getSnapshot(date: any): Promise<any>;
    /**
     * Rollback to commit
     */
    rollback(commitHash: any): Promise<any>;
    /**
     * Stop all components
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map