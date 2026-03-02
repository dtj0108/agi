/**
 * File Watcher
 *
 * Watches the /mind/ directory for file changes using chokidar.
 * Emits events for file additions, changes, and removals.
 */
import { EventEmitter } from 'events';
export declare class FileWatcher extends EventEmitter {
    debounceMs: any;
    mindPath: any;
    pendingChanges: any;
    ready: any;
    watcher: any;
    constructor(mindPath: any, options?: any);
    /**
     * Start watching the mind directory
     */
    start(): this;
    /**
     * Handle a file change with debouncing
     */
    handleChange(eventType: any, filePath: any): void;
    /**
     * Emit the appropriate event for a file change
     */
    emitChange(eventType: any, filePath: any): Promise<void>;
    /**
     * Get all currently watched paths
     */
    getWatchedPaths(): any[];
    /**
     * Stop watching
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=file-watcher.d.ts.map