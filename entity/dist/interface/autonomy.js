/**
 * Autonomy Controller
 *
 * Controls autonomous runtime behavior:
 * - manual: no automatic cycles
 * - heartbeat: cron-scheduled cycles
 * - go: continuous autonomous cycles with guardrails
 */
import { EventEmitter } from 'events';
import { getTelemetry } from '../observability/telemetry.js';
const VALID_MODES = new Set(['manual', 'heartbeat', 'go']);
export class AutonomyController extends EventEmitter {
    cognitiveEngine;
    config;
    consecutiveErrors;
    delayResolve;
    delayTimer;
    goConfig;
    goLoopPromise;
    goRunning;
    goStopRequested;
    heartbeat;
    mode;
    paused;
    constructor(config, cognitiveEngine, heartbeat) {
        super();
        this.config = config;
        this.cognitiveEngine = cognitiveEngine;
        this.heartbeat = heartbeat;
        this.mode = this.normalizeMode(config.autonomy?.mode);
        this.paused = false;
        this.goConfig = {
            minDelayMs: this.normalizeMinDelay(config.autonomy?.go?.minDelayMs),
            maxConsecutiveErrors: this.normalizeMaxErrors(config.autonomy?.go?.maxConsecutiveErrors),
        };
        this.consecutiveErrors = 0;
        this.goRunning = false;
        this.goStopRequested = false;
        this.goLoopPromise = null;
        this.delayTimer = null;
        this.delayResolve = null;
        this.ensureConfigShape();
    }
    ensureConfigShape() {
        this.config.autonomy = this.config.autonomy || {};
        this.config.autonomy.mode = this.mode;
        this.config.autonomy.go = this.config.autonomy.go || {};
        this.config.autonomy.go.minDelayMs = this.goConfig.minDelayMs;
        this.config.autonomy.go.maxConsecutiveErrors = this.goConfig.maxConsecutiveErrors;
    }
    normalizeMode(mode) {
        return VALID_MODES.has(mode) ? mode : 'go';
    }
    normalizeMinDelay(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return 2000;
        return Math.max(0, Math.trunc(parsed));
    }
    normalizeMaxErrors(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return 3;
        return Math.max(1, Math.trunc(parsed));
    }
    start() {
        if (this.paused) {
            return this.getStatus();
        }
        this.startForMode(this.mode);
        return this.getStatus();
    }
    stop() {
        this.stopAllRuntimes();
        return this.getStatus();
    }
    pause() {
        this.paused = true;
        this.stopAllRuntimes();
        return this.getStatus();
    }
    resume() {
        this.paused = false;
        if (this.mode === 'go' && this.goRunning && this.goLoopPromise) {
            this.goLoopPromise.finally(() => {
                if (!this.paused && this.mode === 'go' && !this.goRunning) {
                    this.startGoLoop();
                }
            });
            return this.getStatus();
        }
        this.startForMode(this.mode);
        return this.getStatus();
    }
    setMode(mode, metadata = {}) {
        const telemetry = getTelemetry();
        if (!VALID_MODES.has(mode)) {
            throw new Error(`Invalid autonomy mode: ${mode}`);
        }
        const normalized = mode;
        const previousMode = this.mode;
        this.stopAllRuntimes();
        this.mode = normalized;
        this.config.autonomy.mode = normalized;
        this.consecutiveErrors = 0;
        if (!this.paused) {
            this.startForMode(normalized);
        }
        telemetry.recordEvent('autonomy_mode_changed', {
            previousMode,
            mode: normalized,
            paused: this.paused,
            source: metadata.source || 'unknown',
        });
        this.emit('mode_changed', {
            previousMode,
            mode: normalized,
            source: metadata.source || 'unknown',
        });
        return this.getStatus();
    }
    updateGoConfig(update = {}, metadata = {}) {
        const nextConfig = {
            minDelayMs: update.minDelayMs !== undefined
                ? this.normalizeMinDelay(update.minDelayMs)
                : this.goConfig.minDelayMs,
            maxConsecutiveErrors: update.maxConsecutiveErrors !== undefined
                ? this.normalizeMaxErrors(update.maxConsecutiveErrors)
                : this.goConfig.maxConsecutiveErrors,
        };
        this.goConfig = nextConfig;
        this.config.autonomy.go.minDelayMs = nextConfig.minDelayMs;
        this.config.autonomy.go.maxConsecutiveErrors = nextConfig.maxConsecutiveErrors;
        getTelemetry().recordEvent('autonomy_go_config_updated', {
            minDelayMs: this.goConfig.minDelayMs,
            maxConsecutiveErrors: this.goConfig.maxConsecutiveErrors,
            source: metadata.source || 'unknown',
        });
        return this.getStatus();
    }
    async triggerNow(metadata = {}) {
        return this.cognitiveEngine.runCycle({
            type: 'system',
            content: 'Manual autonomy trigger.',
            metadata: {
                source: metadata.source || 'autonomy_manual',
                timestamp: new Date().toISOString(),
            },
        });
    }
    getStatus() {
        return {
            mode: this.mode,
            paused: this.paused,
            go: {
                running: this.goRunning,
                minDelayMs: this.goConfig.minDelayMs,
                maxConsecutiveErrors: this.goConfig.maxConsecutiveErrors,
                consecutiveErrors: this.consecutiveErrors,
            },
            heartbeat: this.heartbeat.getStatus(),
        };
    }
    startForMode(mode) {
        if (mode === 'manual') {
            return;
        }
        if (mode === 'heartbeat') {
            this.heartbeat.start();
            return;
        }
        this.startGoLoop();
    }
    stopAllRuntimes() {
        this.heartbeat.stop();
        this.stopGoLoop();
    }
    startGoLoop() {
        if (this.goRunning) {
            return;
        }
        const telemetry = getTelemetry();
        this.goRunning = true;
        this.goStopRequested = false;
        this.consecutiveErrors = 0;
        telemetry.recordEvent('autonomy_go_started', {
            minDelayMs: this.goConfig.minDelayMs,
            maxConsecutiveErrors: this.goConfig.maxConsecutiveErrors,
        });
        this.goLoopPromise = this.runGoLoop().finally(() => {
            this.goRunning = false;
            this.goLoopPromise = null;
            telemetry.recordEvent('autonomy_go_stopped', {
                mode: this.mode,
                paused: this.paused,
            });
        });
    }
    stopGoLoop() {
        this.goStopRequested = true;
        if (this.delayTimer) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
        }
        if (this.delayResolve) {
            const resolve = this.delayResolve;
            this.delayResolve = null;
            resolve();
        }
    }
    async waitBetweenCycles() {
        const ms = this.goConfig.minDelayMs;
        if (ms <= 0) {
            return;
        }
        await new Promise((resolve) => {
            this.delayResolve = resolve;
            this.delayTimer = setTimeout(() => {
                this.delayTimer = null;
                this.delayResolve = null;
                resolve();
            }, ms);
        });
    }
    async runGoLoop() {
        const telemetry = getTelemetry();
        while (!this.goStopRequested && !this.paused && this.mode === 'go') {
            try {
                await this.cognitiveEngine.runCycle({
                    type: 'system',
                    content: 'Continue autonomous operation and pursue my goals.',
                    metadata: {
                        source: 'autonomy_go',
                        timestamp: new Date().toISOString(),
                    },
                });
                this.consecutiveErrors = 0;
                telemetry.incrementCounter('autonomy_go_cycle_success', 1, { mode: this.mode });
            }
            catch (error) {
                this.consecutiveErrors += 1;
                telemetry.incrementCounter('autonomy_go_cycle_failed', 1, { mode: this.mode });
                telemetry.recordError('autonomy', error, {
                    stage: 'go_loop',
                    consecutiveErrors: this.consecutiveErrors,
                });
                if (this.consecutiveErrors >= this.goConfig.maxConsecutiveErrors) {
                    this.mode = 'manual';
                    this.config.autonomy.mode = 'manual';
                    this.goStopRequested = true;
                    telemetry.recordEvent('autonomy_go_guard_trip', {
                        reason: 'max_consecutive_errors',
                        consecutiveErrors: this.consecutiveErrors,
                        maxConsecutiveErrors: this.goConfig.maxConsecutiveErrors,
                    });
                    this.emit('guard_trip', {
                        reason: 'max_consecutive_errors',
                        consecutiveErrors: this.consecutiveErrors,
                    });
                    break;
                }
            }
            if (this.goStopRequested || this.paused || this.mode !== 'go') {
                break;
            }
            await this.waitBetweenCycles();
        }
    }
}
export function isValidAutonomyMode(mode) {
    return VALID_MODES.has(mode);
}
//# sourceMappingURL=autonomy.js.map