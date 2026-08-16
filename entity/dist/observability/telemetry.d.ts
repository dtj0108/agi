/**
 * Telemetry
 *
 * File-first structured telemetry for events and metrics.
 */
declare class Telemetry {
    enabled: any;
    events: any;
    eventsPath: any;
    maxInMemory: any;
    metrics: any;
    metricsPath: any;
    redactKeys: any;
    windowMinutes: any;
    constructor(options?: any);
    ensureDirectories(): void;
    sanitize(data: any): any;
    pushBounded(array: any, item: any): void;
    writeJsonl(path: any, record: any): void;
    recordEvent(type: any, data?: any): void;
    recordError(component: any, error: any, context?: any): void;
    incrementCounter(name: any, value?: any, labels?: any): void;
    observeDuration(name: any, durationMs: any, labels?: any): void;
    getRecentErrors(limit?: any): any;
    getRecentMetrics(windowMinutes?: any): any;
    sumCounters(metrics: any, name: any): any;
    snapshotHealth(windowMinutes?: any): {
        llmSchemaFallbackRate1h: number;
        cycleFailureRate1h: number;
        errorCount1h: any;
        lastErrorAt: any;
    };
    flush(): void;
}
declare class NoopTelemetry {
    recordEvent(_type?: any, _data?: any): void;
    recordError(_component?: any, _error?: any, _context?: any): void;
    incrementCounter(_name?: any, _value?: any, _labels?: any): void;
    observeDuration(_name?: any, _durationMs?: any, _labels?: any): void;
    getRecentErrors(_limit?: any): never[];
    getRecentMetrics(_windowMinutes?: any): never[];
    snapshotHealth(_windowMinutes?: any): {
        llmSchemaFallbackRate1h: number;
        cycleFailureRate1h: number;
        errorCount1h: number;
        lastErrorAt: null;
    };
    flush(): void;
}
export declare function configureTelemetry(options?: any): Telemetry | NoopTelemetry;
export declare function getTelemetry(): Telemetry | NoopTelemetry;
export { Telemetry, NoopTelemetry };
//# sourceMappingURL=telemetry.d.ts.map