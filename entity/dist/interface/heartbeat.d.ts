/**
 * Heartbeat
 *
 * Triggers autonomous cognitive cycles on a schedule.
 */
import { EventEmitter } from 'events';
export declare class Heartbeat extends EventEmitter {
    cognitiveEngine: any;
    config: any;
    enabled: any;
    prompt: any;
    schedule: any;
    task: any;
    constructor(config: any, cognitiveEngine: any);
    /**
     * Start the heartbeat scheduler
     */
    start(): void;
    /**
     * Stop the heartbeat scheduler
     */
    stop(): void;
    /**
     * Trigger a heartbeat cycle immediately
     */
    triggerNow(): Promise<any>;
    /**
     * Update the heartbeat schedule at runtime
     */
    updateSchedule(newSchedule: any): {
        schedule: any;
        enabled: any;
    };
    /**
     * Update the heartbeat prompt
     */
    updatePrompt(newPrompt: any): {
        prompt: any;
    };
    /**
     * Enable or disable the heartbeat
     */
    setEnabled(enabled: any): {
        enabled: any;
    };
    /**
     * Get current heartbeat status
     */
    getStatus(): {
        enabled: any;
        schedule: any;
        prompt: any;
        running: boolean;
    };
    /**
     * Load preferences from mind file (called on startup)
     */
    loadFromMind(mindPath: any): Promise<void>;
}
//# sourceMappingURL=heartbeat.d.ts.map