/**
 * Autonomy Controller
 *
 * Controls autonomous runtime behavior:
 * - manual: no automatic cycles
 * - heartbeat: cron-scheduled cycles
 * - go: continuous autonomous cycles with guardrails
 */
import { EventEmitter } from 'events';
export declare class AutonomyController extends EventEmitter {
    cognitiveEngine: any;
    config: any;
    consecutiveErrors: any;
    delayResolve: any;
    delayTimer: any;
    goConfig: any;
    goLoopPromise: any;
    goRunning: any;
    goStopRequested: any;
    heartbeat: any;
    mode: any;
    paused: any;
    constructor(config: any, cognitiveEngine: any, heartbeat: any);
    ensureConfigShape(): void;
    normalizeMode(mode: any): any;
    normalizeMinDelay(value: any): number;
    normalizeMaxErrors(value: any): number;
    start(): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    stop(): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    pause(): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    resume(): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    setMode(mode: any, metadata?: any): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    updateGoConfig(update?: any, metadata?: any): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    triggerNow(metadata?: any): Promise<any>;
    getStatus(): {
        mode: any;
        paused: any;
        go: {
            running: any;
            minDelayMs: any;
            maxConsecutiveErrors: any;
            consecutiveErrors: any;
        };
        heartbeat: any;
    };
    startForMode(mode: any): void;
    stopAllRuntimes(): void;
    startGoLoop(): void;
    stopGoLoop(): void;
    waitBetweenCycles(): Promise<void>;
    runGoLoop(): Promise<void>;
}
export declare function isValidAutonomyMode(mode: any): boolean;
//# sourceMappingURL=autonomy.d.ts.map