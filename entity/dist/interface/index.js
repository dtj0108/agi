/**
 * Interface Layer
 *
 * Boots and coordinates all interface components.
 */
import { HttpServer } from './http.js';
import { WebSocketInterface } from './websocket.js';
import { CLI } from './cli.js';
import { Heartbeat } from './heartbeat.js';
import { AutonomyController } from './autonomy.js';
import { getTelemetry } from '../observability/telemetry.js';
import { getAuthManager } from '../auth/index.js';
export class InterfaceLayer {
    authManager;
    autonomy;
    cli;
    cognitiveEngine;
    config;
    heartbeat;
    http;
    killCallback;
    killRequested;
    stopping;
    ws;
    constructor(config, cognitiveEngine, actionGateway, mindServer) {
        this.config = config;
        this.cognitiveEngine = cognitiveEngine;
        this.authManager = getAuthManager(config);
        this.heartbeat = new Heartbeat(config, cognitiveEngine);
        this.autonomy = new AutonomyController(config, cognitiveEngine, this.heartbeat);
        this.http = new HttpServer(config, cognitiveEngine, actionGateway, mindServer, this.autonomy, this.authManager);
        this.ws = new WebSocketInterface(config, cognitiveEngine, actionGateway);
        this.cli = new CLI(config, cognitiveEngine, mindServer, this.autonomy);
        this.stopping = false;
        this.killRequested = false;
        // Register as config handler with ActionGateway
        actionGateway.setConfigHandler(this);
        // Forward events
        this.http.on('kill', () => this.onKill());
        this.http.on('pause', () => this.onPause());
        this.http.on('resume', () => this.onResume());
        this.cli.on('kill', () => this.onKill());
        this.cli.on('pause', () => this.onPause());
        this.cli.on('resume', () => this.onResume());
        this.cli.on('exit', () => this.onExit());
        this.cognitiveEngine.on('approval_needed', (data) => {
            this.ws.emitPlanApprovalNeeded(data);
        });
        this.killCallback = null;
    }
    /**
     * Set callback for kill events
     */
    onKillRequest(callback) {
        this.killCallback = callback;
    }
    /**
     * Start all interfaces
     */
    start() {
        const telemetry = getTelemetry();
        this.http.start();
        this.ws.start();
        // Only start CLI if enabled
        if (this.config.interface?.enableCli !== false) {
            this.cli.start();
        }
        this.autonomy.start();
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
        telemetry.recordEvent('interface_started', {
            httpPort: this.config.interface?.httpPort,
            wsPort: this.config.interface?.wsPort,
            autonomyMode: this.autonomy.getStatus().mode,
        });
    }
    /**
     * Stop all interfaces
     */
    stop() {
        const telemetry = getTelemetry();
        if (this.stopping)
            return;
        this.stopping = true;
        this.http.stop();
        this.ws.stop();
        this.cli.stop();
        this.autonomy.stop();
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 1.
        telemetry.recordEvent('interface_stopped');
    }
    /**
     * Handle kill request
     */
    onKill() {
        const telemetry = getTelemetry();
        if (this.killRequested)
            return;
        this.killRequested = true;
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 1.
        telemetry.recordEvent('interface_kill_requested');
        if (this.killCallback) {
            this.killCallback();
        }
        else {
            process.emit('SIGTERM');
        }
    }
    /**
     * Handle pause
     */
    onPause() {
        this.autonomy.pause();
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 1.
        getTelemetry().recordEvent('interface_paused');
    }
    /**
     * Handle resume
     */
    onResume() {
        this.autonomy.resume();
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 1.
        getTelemetry().recordEvent('interface_resumed');
    }
    /**
     * Handle clean exit from CLI
     */
    onExit() {
        if (this.stopping)
            return;
        this.onKill();
    }
    /**
     * Update heartbeat schedule
     */
    updateHeartbeatSchedule(schedule) {
        return this.heartbeat.updateSchedule(schedule);
    }
    /**
     * Update heartbeat prompt
     */
    updateHeartbeatPrompt(prompt) {
        return this.heartbeat.updatePrompt(prompt);
    }
    /**
     * Enable or disable heartbeat
     */
    setHeartbeatEnabled(enabled) {
        return this.heartbeat.setEnabled(enabled);
    }
    /**
     * Get heartbeat status
     */
    getHeartbeatStatus() {
        return this.heartbeat.getStatus();
    }
    /**
     * Update autonomy mode
     */
    updateAutonomyMode(mode) {
        return this.autonomy.setMode(mode, { source: 'config' });
    }
    /**
     * Update autonomy go min delay
     */
    updateAutonomyGoMinDelayMs(minDelayMs) {
        const parsed = Number(minDelayMs);
        if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error(`Invalid autonomy.go.minDelayMs: ${minDelayMs}`);
        }
        return this.autonomy.updateGoConfig({ minDelayMs: Math.trunc(parsed) }, { source: 'config' });
    }
    /**
     * Update autonomy go max consecutive errors
     */
    updateAutonomyGoMaxConsecutiveErrors(maxConsecutiveErrors) {
        const parsed = Number(maxConsecutiveErrors);
        if (!Number.isFinite(parsed) || parsed < 1) {
            throw new Error(`Invalid autonomy.go.maxConsecutiveErrors: ${maxConsecutiveErrors}`);
        }
        return this.autonomy.updateGoConfig({ maxConsecutiveErrors: Math.trunc(parsed) }, { source: 'config' });
    }
    /**
     * Get autonomy status
     */
    getAutonomyStatus() {
        return this.autonomy.getStatus();
    }
    /**
     * Update cognitive engine configuration
     */
    updateCognitiveConfig(key, value) {
        return this.cognitiveEngine.updateCognitiveConfig(key, value);
    }
    /**
     * Get cognitive engine configuration
     */
    getCognitiveConfig() {
        return this.cognitiveEngine.getCognitiveConfig();
    }
}
//# sourceMappingURL=index.js.map