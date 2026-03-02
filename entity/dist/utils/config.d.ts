/**
 * Configuration Loader
 *
 * Loads config from:
 * 1. config/default.js (base)
 * 2. config/local.js (overrides, if exists)
 * 3. Environment variables (highest priority)
 */
declare const projectRoot: string;
/**
 * Load and merge configuration
 */
export declare function loadConfig(): Promise<any>;
export declare function getConfig(): Promise<any>;
export { projectRoot };
//# sourceMappingURL=config.d.ts.map