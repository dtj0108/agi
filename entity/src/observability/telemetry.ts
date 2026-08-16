/**
 * Telemetry
 *
 * File-first structured telemetry for events and metrics.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

class Telemetry {
  enabled: any;
  events: any;
  eventsPath: any;
  maxInMemory: any;
  metrics: any;
  metricsPath: any;
  redactKeys: any;
  windowMinutes: any;
  constructor(options: any = {}) {
    this.enabled = options.enabled !== false;
    this.eventsPath = options.eventsPath || null;
    this.metricsPath = options.metricsPath || null;
    this.windowMinutes = options.windowMinutes || 60;
    this.redactKeys = new Set((options.redactKeys || []).map((k: any) => String(k).toLowerCase()));

    this.events = [];
    this.metrics = [];
    this.maxInMemory = 5000;

    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!this.enabled) return;
    for (const path of [this.eventsPath, this.metricsPath]) {
      if (!path) continue;
      try {
        const dir = dirname(path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      } catch {
        // Best effort only
      }
    }
  }

  sanitize(data: any) {
    const visit = (value: any, key: any = ''): any => {
      if (value === null || value === undefined) return value;

      if (Array.isArray(value)) {
        return value.map((item: any) => visit(item));
      }

      if (typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
          const lower = String(k).toLowerCase();
          if (this.redactKeys.has(lower)) {
            out[k] = '[REDACTED]';
          } else {
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

  pushBounded(array: any, item: any) {
    array.push(item);
    if (array.length > this.maxInMemory) {
      array.splice(0, array.length - this.maxInMemory);
    }
  }

  writeJsonl(path: any, record: any) {
    if (!this.enabled || !path) return;
    try {
      appendFileSync(path, JSON.stringify(record) + '\n');
    } catch {
      // Best effort only
    }
  }

  recordEvent(type: any, data: any = {}) {
    if (!this.enabled) return;

    const event = {
      timestamp: new Date().toISOString(),
      type,
      data: this.sanitize(data),
    };

    this.pushBounded(this.events, event);
    this.writeJsonl(this.eventsPath, event);
  }

  recordError(component: any, error: any, context: any = {}) {
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

  incrementCounter(name: any, value: any = 1, labels: any = {}) {
    if (!this.enabled) return;

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

  observeDuration(name: any, durationMs: any, labels: any = {}) {
    if (!this.enabled) return;

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

  getRecentErrors(limit: any = 50) {
    return this.events
      .filter((event: any) => event.type === 'error')
      .slice(-limit)
      .reverse();
  }

  getRecentMetrics(windowMinutes: any = this.windowMinutes) {
    const cutoff = Date.now() - (windowMinutes * 60 * 1000);
    return this.metrics.filter((metric: any) => Date.parse(metric.timestamp) >= cutoff);
  }

  sumCounters(metrics: any, name: any) {
    return metrics
      .filter((metric: any) => metric.kind === 'counter' && metric.name === name)
      .reduce((sum: any, metric: any) => sum + (Number(metric.value) || 0), 0);
  }

  snapshotHealth(windowMinutes: any = this.windowMinutes) {
    const windowMetrics = this.getRecentMetrics(windowMinutes);
    const windowMs = windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const recentErrors = this.events.filter(
      (event: any) => event.type === 'error' && Date.parse(event.timestamp) >= cutoff
    );

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
  recordEvent(_type?: any, _data?: any) {}
  recordError(_component?: any, _error?: any, _context?: any) {}
  incrementCounter(_name?: any, _value?: any, _labels?: any) {}
  observeDuration(_name?: any, _durationMs?: any, _labels?: any) {}
  getRecentErrors(_limit?: any) { return []; }
  getRecentMetrics(_windowMinutes?: any) { return []; }
  snapshotHealth(_windowMinutes?: any) {
    return {
      llmSchemaFallbackRate1h: 0,
      cycleFailureRate1h: 0,
      errorCount1h: 0,
      lastErrorAt: null,
    };
  }
  flush() {}
}

let telemetryInstance: Telemetry | NoopTelemetry = new NoopTelemetry();

export function configureTelemetry(options: any = {}) {
  if (options.enabled === false) {
    telemetryInstance = new NoopTelemetry();
  } else {
    telemetryInstance = new Telemetry(options);
  }
  return telemetryInstance;
}

export function getTelemetry() {
  return telemetryInstance;
}

export { Telemetry, NoopTelemetry };
