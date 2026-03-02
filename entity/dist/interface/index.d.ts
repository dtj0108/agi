/**
 * Interface Layer
 *
 * Boots and coordinates all interface components.
 */
export declare class InterfaceLayer {
    authManager: any;
    autonomy: any;
    cli: any;
    cognitiveEngine: any;
    config: any;
    heartbeat: any;
    http: any;
    killCallback: any;
    killRequested: any;
    stopping: any;
    ws: any;
    constructor(config: any, cognitiveEngine: any, actionGateway: any, mindServer: any);
    /**
     * Set callback for kill events
     */
    onKillRequest(callback: any): void;
    /**
     * Start all interfaces
     */
    start(): void;
    /**
     * Stop all interfaces
     */
    stop(): void;
    /**
     * Handle kill request
     */
    onKill(): void;
    /**
     * Handle pause
     */
    onPause(): void;
    /**
     * Handle resume
     */
    onResume(): void;
    /**
     * Handle clean exit from CLI
     */
    onExit(): void;
    /**
     * Update heartbeat schedule
     */
    updateHeartbeatSchedule(schedule: any): any;
    /**
     * Update heartbeat prompt
     */
    updateHeartbeatPrompt(prompt: any): any;
    /**
     * Enable or disable heartbeat
     */
    setHeartbeatEnabled(enabled: any): any;
    /**
     * Get heartbeat status
     */
    getHeartbeatStatus(): any;
    /**
     * Update autonomy mode
     */
    updateAutonomyMode(mode: any): any;
    /**
     * Update autonomy go min delay
     */
    updateAutonomyGoMinDelayMs(minDelayMs: any): any;
    /**
     * Update autonomy go max consecutive errors
     */
    updateAutonomyGoMaxConsecutiveErrors(maxConsecutiveErrors: any): any;
    /**
     * Get autonomy status
     */
    getAutonomyStatus(): any;
    /**
     * Update cognitive engine configuration
     */
    updateCognitiveConfig(key: any, value: any): any;
    /**
     * Get cognitive engine configuration
     */
    getCognitiveConfig(): any;
}
//# sourceMappingURL=index.d.ts.map