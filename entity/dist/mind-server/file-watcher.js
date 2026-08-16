/**
 * File Watcher
 *
 * Watches the /mind/ directory for file changes using chokidar.
 * Emits events for file additions, changes, and removals.
 */
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { readFile } from 'fs/promises';
import { relative } from 'path';
export class FileWatcher extends EventEmitter {
    debounceMs;
    mindPath;
    pendingChanges;
    ready;
    watcher;
    constructor(mindPath, options = {}) {
        super();
        this.mindPath = mindPath;
        this.debounceMs = options.debounceMs || 100;
        this.watcher = null;
        this.pendingChanges = new Map();
        this.ready = false;
    }
    /**
     * Start watching the mind directory
     */
    start() {
        this.watcher = chokidar.watch(this.mindPath, {
            ignored: [
                /(^|[\/\\])\../, // Hidden files
                '**/node_modules/**',
                '**/.git/**',
                '**/.index.db',
                '**/.index.db-journal',
                '**/*.swp',
                '**/*~',
            ],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 50,
                pollInterval: 10,
            },
        });
        this.watcher.on('add', (path) => this.handleChange('add', path));
        this.watcher.on('change', (path) => this.handleChange('change', path));
        this.watcher.on('unlink', (path) => this.handleChange('unlink', path));
        this.watcher.on('ready', () => {
            this.ready = true;
            this.emit('ready');
        });
        this.watcher.on('error', (error) => {
            this.emit('error', { component: 'file-watcher', error });
        });
        return this;
    }
    /**
     * Handle a file change with debouncing
     */
    handleChange(eventType, filePath) {
        const key = `${eventType}:${filePath}`;
        // Clear any pending debounce for this file
        if (this.pendingChanges.has(key)) {
            clearTimeout(this.pendingChanges.get(key));
        }
        // Set up debounced handler
        const timeout = setTimeout(async () => {
            this.pendingChanges.delete(key);
            await this.emitChange(eventType, filePath);
        }, this.debounceMs);
        this.pendingChanges.set(key, timeout);
    }
    /**
     * Emit the appropriate event for a file change
     */
    async emitChange(eventType, filePath) {
        const relativePath = relative(this.mindPath, filePath);
        const timestamp = new Date().toISOString();
        try {
            switch (eventType) {
                case 'add': {
                    const content = await readFile(filePath, 'utf-8');
                    this.emit('file:added', {
                        path: filePath,
                        relativePath,
                        content,
                        timestamp,
                    });
                    break;
                }
                case 'change': {
                    const content = await readFile(filePath, 'utf-8');
                    this.emit('file:changed', {
                        path: filePath,
                        relativePath,
                        content,
                        timestamp,
                    });
                    break;
                }
                case 'unlink': {
                    this.emit('file:removed', {
                        path: filePath,
                        relativePath,
                        timestamp,
                    });
                    break;
                }
            }
        }
        catch (error) {
            this.emit('error', {
                component: 'file-watcher',
                error,
                context: { eventType, filePath },
            });
        }
    }
    /**
     * Get all currently watched paths
     */
    getWatchedPaths() {
        if (!this.watcher)
            return [];
        const watched = this.watcher.getWatched();
        const paths = [];
        for (const [dir, files] of Object.entries(watched)) {
            for (const file of files) {
                paths.push(`${dir}/${file}`);
            }
        }
        return paths;
    }
    /**
     * Stop watching
     */
    async stop() {
        // Clear pending debounces
        for (const timeout of this.pendingChanges.values()) {
            clearTimeout(timeout);
        }
        this.pendingChanges.clear();
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
        this.ready = false;
    }
}
//# sourceMappingURL=file-watcher.js.map