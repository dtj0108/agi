/**
 * HTTP Server
 *
 * Express REST API for external interaction with the entity.
 */
import { EventEmitter } from 'events';
export declare class HttpServer extends EventEmitter {
    actionGateway: any;
    app: any;
    authManager: any;
    autonomy: any;
    cognitiveEngine: any;
    config: any;
    mindServer: any;
    paused: any;
    server: any;
    constructor(config: any, cognitiveEngine: any, actionGateway: any, mindServer: any, autonomy?: any, authManager?: any);
    /**
     * Set up Express middleware
     */
    setupMiddleware(): void;
    /**
     * Set up routes
     */
    setupRoutes(): void;
    /**
     * Set up skills API routes
     */
    setupSkillsRoutes(telemetry: any): void;
    /**
     * Add public metadata used by dashboard clients.
     */
    withSkillMetadata(skill: any, authored?: any): any;
    /**
     * Set up dashboard serving
     */
    setupDashboard(): void;
    /**
     * Start the HTTP server
     */
    start(): void;
    /**
     * Stop the HTTP server
     */
    stop(): void;
    /**
     * Validate autonomy level values from runtime update payloads.
     */
    validateAutonomyLevel(value: any): any;
    /**
     * Validate autonomy mode values from runtime update payloads.
     */
    validateAutonomyMode(value: any): any;
    /**
     * Parse positive integers.
     */
    parsePositiveInt(value: any): number | null;
    /**
     * Parse non-negative integers.
     */
    parseNonNegativeInt(value: any): number | null;
    /**
     * Normalize autonomy go config.
     */
    getAutonomyGoConfig(go: any): {
        minDelayMs: number;
        maxConsecutiveErrors: number;
    };
    /**
     * Safe fallback when ActionGateway helper is unavailable.
     */
    getAutonomyLevelFallback(): any;
    /**
     * Safe fallback when autonomy controller is unavailable.
     */
    getAutonomyStatusFallback(): {
        mode: any;
        paused: any;
        go: {
            consecutiveErrors: number;
            minDelayMs: number;
            maxConsecutiveErrors: number;
            running: boolean;
        };
        heartbeat: {
            enabled: boolean;
            schedule: any;
            prompt: any;
            running: boolean;
        };
    };
    /**
     * Map mind read errors to API status codes
     */
    mapMindReadError(err: any): {
        status: number;
        error: any;
    };
}
//# sourceMappingURL=http.d.ts.map