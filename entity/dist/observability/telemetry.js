/**
 * Telemetry
 *
 * File-first structured telemetry for events and metrics.
 */
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
class Telemetry {
    enabled;
    events;
    eventsPath;
    maxInMemory;
    metrics;
    metricsPath;
    redactKeys;
    windowMinutes;
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.eventsPath = options.eventsPath || null;
        this.metricsPath = options.metricsPath || null;
        this.windowMinutes = options.windowMinutes || 60;
        this.redactKeys = new Set((options.redactKeys || []).map((k) => String(k).toLowerCase()));
        this.events = [];
        this.metrics = [];
        this.maxInMemory = 5000;
        this.ensureDirectories();
    }
    ensureDirectories() {
        if (!this.enabled)
            return;
        for (const path of [this.eventsPath, this.metricsPath]) {
            if (!path)
                continue;
            try {
                const dir = dirname(path);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }
            }
            catch {
                // Best effort only
            }
        }
    }
    sanitize(data) {
        const visit = (value, key = '') => {
            if (value === null || value === undefined)
                return value;
            if (Array.isArray(value)) {
                return value.map((item) => visit(item));
            }
            if (typeof value === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(value)) {
                    const lower = String(k).toLowerCase();
                    if (this.redactKeys.has(lower)) {
                        out[k] = '[REDACTED]';
                    }
                    else {
                        out[k] = visit(v, k);
                    }
                }
                return out;
            }
            if (typeof value === 'string' && key && this.redactKeys.has(String(key).toLowerCase())) {
                return '[REDACTED]';
            }
            return value;
        };
        return visit(data);
    }
    pushBounded(array, item) {
        array.push(item);
        if (array.length > this.maxInMemory) {
            array.splice(0, array.length - this.maxInMemory);
        }
    }
    writeJsonl(path, record) {
        if (!this.enabled || !path)
            return;
        try {
            appendFileSync(path, JSON.stringify(record) + '\n');
        }
        catch {
            // Best effort only
        }
    }
    recordEvent(type, data = {}) {
        if (!this.enabled)
            return;
        const event = {
            timestamp: new Date().toISOString(),
            type,
            data: this.sanitize(data),
        };
        this.pushBounded(this.events, event);
        this.writeJsonl(this.eventsPath, event);
    }
    recordError(component, error, context = {}) {
        const errObj = {
            component,
            severity: 'error',
            message: error?.message || String(error),
            name: error?.name || 'Error',
            stack: error?.stack || null,
            context,
        };
        this.recordEvent('error', errObj);
        this.incrementCounter('errors.total', 1, { component });
    }
    incrementCounter(name, value = 1, labels = {}) {
        if (!this.enabled)
            return;
        const metric = {
            timestamp: new Date().toISOString(),
            kind: 'counter',
            name,
            value,
            labels: this.sanitize(labels),
        };
        this.pushBounded(this.metrics, metric);
        this.writeJsonl(this.metricsPath, metric);
    }
    observeDuration(name, durationMs, labels = {}) {
        if (!this.enabled)
            return;
        const metric = {
            timestamp: new Date().toISOString(),
            kind: 'duration',
            name,
            value: Number(durationMs) || 0,
            labels: this.sanitize(labels),
        };
        this.pushBounded(this.metrics, metric);
        this.writeJsonl(this.metricsPath, metric);
    }
    getRecentErrors(limit = 50) {
        return this.events
            .filter((event) => event.type === 'error')
            .slice(-limit)
            .reverse();
    }
    getRecentMetrics(windowMinutes = this.windowMinutes) {
        const cutoff = Date.now() - (windowMinutes * 60 * 1000);
        return this.metrics.filter((metric) => Date.parse(metric.timestamp) >= cutoff);
    }
    sumCounters(metrics, name) {
        return metrics
            .filter((metric) => metric.kind === 'counter' && metric.name === name)
            .reduce((sum, metric) => sum + (Number(metric.value) || 0), 0);
    }
    snapshotHealth(windowMinutes = this.windowMinutes) {
        const windowMetrics = this.getRecentMetrics(windowMinutes);
        const windowMs = windowMinutes * 60 * 1000;
        const cutoff = Date.now() - windowMs;
        const recentErrors = this.events.filter((event) => event.type === 'error' && Date.parse(event.timestamp) >= cutoff);
        const llmSchemaTotal = this.sumCounters(windowMetrics, 'llm.schema.total');
        const llmFallbackTotal = this.sumCounters(windowMetrics, 'llm.schema.fallback');
        const cycleTotal = this.sumCounters(windowMetrics, 'cycle.total');
        const cycleFailed = this.sumCounters(windowMetrics, 'cycle.failed');
        return {
            llmSchemaFallbackRate1h: llmSchemaTotal > 0 ? llmFallbackTotal / llmSchemaTotal : 0,
            cycleFailureRate1h: cycleTotal > 0 ? cycleFailed / cycleTotal : 0,
            errorCount1h: recentErrors.length,
            lastErrorAt: recentErrors.length > 0 ? recentErrors[recentErrors.length - 1].timestamp : null,
        };
    }
    flush() {
        // Synchronous append is already flushed per write.
        // Keep this method for interface compatibility.
    }
}
class NoopTelemetry {
    recordEvent() { }
    recordError() { }
    incrementCounter() { }
    observeDuration() { }
    getRecentErrors() { return []; }
    getRecentMetrics() { return []; }
    snapshotHealth() {
        return {
            llmSchemaFallbackRate1h: 0,
            cycleFailureRate1h: 0,
            errorCount1h: 0,
            lastErrorAt: null,
        };
    }
    flush() { }
}
let telemetryInstance = new NoopTelemetry();
export function configureTelemetry(options = {}) {
    if (options.enabled === false) {
        telemetryInstance = new NoopTelemetry();
    }
    else {
        // @ts-expect-error TODO(ts-migration): TS(2322): Type 'Telemetry' is not assignable to type 'NoopTe... Remove this comment to see the full error message
        telemetryInstance = new Telemetry(options);
    }
    return telemetryInstance;
}
export function getTelemetry() {
    return telemetryInstance;
}
export { Telemetry, NoopTelemetry };
//# sourceMappingURL=telemetry.js.map