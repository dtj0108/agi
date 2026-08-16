/**
 * Mind Server
 *
 * Coordinates file watching, search indexing, and git auto-commits.
 * This is the infrastructure layer that maintains the entity's mind filesystem.
 */
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import { isAbsolute, resolve, sep } from 'path';
import { FileWatcher } from './file-watcher.js';
import { SearchIndex } from './search.js';
import { GitManager } from './git.js';
import { EmbeddingService } from './embedding.js';
import { getTelemetry } from '../observability/telemetry.js';
export class MindServer extends EventEmitter {
    config;
    embeddingService;
    fileWatcher;
    git;
    mindPath;
    search;
    started;
    constructor(config) {
        super();
        this.config = config;
        this.mindPath = config.mind.path;
        // Initialize embedding service (may be disabled)
        this.embeddingService = new EmbeddingService(config);
        // Initialize components
        this.fileWatcher = new FileWatcher(this.mindPath, {
            debounceMs: config.mind.fileWatchDebounceMs,
        });
        this.search = new SearchIndex(this.mindPath, config.mind.indexPath, this.embeddingService);
        this.git = new GitManager(this.mindPath, {
            debounceMs: config.mind.gitDebounceMs,
        });
        this.started = false;
    }
    /**
     * Start all mind server components
     */
    async start() {
        const telemetry = getTelemetry();
        // Initialize git
        await this.git.initialize();
        this.emit('git:ready');
        // Initialize search index
        await this.search.initialize();
        await this.search.rebuildIndex();
        this.emit('search:ready');
        // Set up file watcher event handlers
        this.fileWatcher.on('file:added', (event) => this.onFileAdded(event));
        this.fileWatcher.on('file:changed', (event) => this.onFileChanged(event));
        this.fileWatcher.on('file:removed', (event) => this.onFileRemoved(event));
        this.fileWatcher.on('error', (event) => this.emit('error', event));
        // Start file watcher
        this.fileWatcher.start();
        this.fileWatcher.on('ready', () => {
            this.emit('watcher:ready');
        });
        this.started = true;
        telemetry.recordEvent('mind_server_started', { mindPath: this.mindPath });
        this.emit('ready');
    }
    /**
     * Handle file addition
     */
    async onFileAdded(event) {
        const telemetry = getTelemetry();
        try {
            // Index the file (now async due to potential embedding generation)
            await this.search.indexFile(event.path, event.content);
            this.emit('indexed', { path: event.relativePath, timestamp: event.timestamp });
            // Schedule git commit
            this.git.scheduleCommit(event.path);
            telemetry.incrementCounter('mind.file_added', 1);
            // Forward the event
            this.emit('file:added', event);
        }
        catch (error) {
            telemetry.recordError('mind-server', error, { stage: 'file_added', path: event.path });
            this.emit('error', { component: 'mind-server', error, context: { event } });
        }
    }
    /**
     * Handle file change
     */
    async onFileChanged(event) {
        const telemetry = getTelemetry();
        try {
            // Update the index (now async due to potential embedding generation)
            await this.search.indexFile(event.path, event.content);
            this.emit('indexed', { path: event.relativePath, timestamp: event.timestamp });
            // Schedule git commit
            this.git.scheduleCommit(event.path);
            telemetry.incrementCounter('mind.file_changed', 1);
            // Forward the event
            this.emit('file:changed', event);
        }
        catch (error) {
            telemetry.recordError('mind-server', error, { stage: 'file_changed', path: event.path });
            this.emit('error', { component: 'mind-server', error, context: { event } });
        }
    }
    /**
     * Handle file removal
     */
    onFileRemoved(event) {
        const telemetry = getTelemetry();
        // Remove from index
        this.search.removeFile(event.path);
        // Schedule git commit
        this.git.scheduleCommit(event.path);
        // Forward the event
        telemetry.incrementCounter('mind.file_removed', 1);
        this.emit('file:removed', event);
    }
    /**
     * Read a mind file by relative path
     */
    async readFile(relativePath) {
        const telemetry = getTelemetry();
        const fullPath = this.resolveMindPath(relativePath);
        const content = await readFile(fullPath, 'utf-8');
        telemetry.incrementCounter('mind.read', 1);
        return content;
    }
    /**
     * Resolve and validate a path inside the mind directory
     */
    resolveMindPath(relativePath) {
        if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
            const error = new Error('Invalid path');
            error.code = 'INVALID_PATH';
            throw error;
        }
        if (relativePath.includes('\0')) {
            const error = new Error('Invalid path');
            error.code = 'INVALID_PATH';
            throw error;
        }
        if (isAbsolute(relativePath)) {
            const error = new Error('Absolute paths are not allowed');
            error.code = 'INVALID_PATH';
            throw error;
        }
        const mindRoot = resolve(this.mindPath);
        const fullPath = resolve(mindRoot, relativePath);
        const inMind = fullPath === mindRoot || fullPath.startsWith(`${mindRoot}${sep}`);
        if (!inMind) {
            const error = new Error('Path escapes mind directory');
            error.code = 'INVALID_PATH';
            throw error;
        }
        return fullPath;
    }
    /**
     * Search the mind (FTS5 full-text search)
     */
    searchMind(query, options) {
        return this.search.search(query, options);
    }
    /**
     * Vector search the mind (semantic similarity)
     */
    async vectorSearchMind(query, options) {
        return this.search.vectorSearch(query, options);
    }
    /**
     * Hybrid search the mind (FTS + vector combined)
     */
    async hybridSearchMind(query, options) {
        return this.search.hybridSearch(query, options);
    }
    /**
     * Check if embeddings/vector search is available
     */
    hasEmbeddings() {
        return this.search.hasEmbeddings();
    }
    /**
     * Get file history
     */
    async getHistory(filePath) {
        return this.git.getHistory(filePath);
    }
    /**
     * Get snapshot at date
     */
    async getSnapshot(date) {
        return this.git.getSnapshot(date);
    }
    /**
     * Rollback to commit
     */
    async rollback(commitHash) {
        const result = await this.git.rollback(commitHash);
        // Rebuild search index after rollback
        await this.search.rebuildIndex();
        this.emit('rollback', result);
        return result;
    }
    /**
     * Stop all components
     */
    async stop() {
        const telemetry = getTelemetry();
        // Commit any pending changes
        await this.git.commitPending();
        // Stop file watcher
        await this.fileWatcher.stop();
        // Close search index
        this.search.close();
        this.started = false;
        telemetry.recordEvent('mind_server_stopped', { mindPath: this.mindPath });
        this.emit('stopped');
    }
}
//# sourceMappingURL=index.js.map