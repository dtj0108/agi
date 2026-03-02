/**
 * Structured Logger
 *
 * Provides consistent logging with levels, timestamps, colors, and optional file output.
 */
declare const colors: {
    reset: string;
    dim: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
};
declare const levelConfig: {
    debug: {
        priority: number;
        color: string;
        label: string;
    };
    info: {
        priority: number;
        color: string;
        label: string;
    };
    warn: {
        priority: number;
        color: string;
        label: string;
    };
    error: {
        priority: number;
        color: string;
        label: string;
    };
};
declare class Logger {
    colorize: any;
    context: any;
    level: keyof typeof levelConfig;
    logFile: any;
    timestamps: any;
    constructor(options?: any);
    /**
     * Create a child logger with additional context
     */
    child(context: any): Logger;
    /**
     * Format a log message
     */
    format(level: keyof typeof levelConfig, message: any, data: any): string;
    /**
     * Core log method
     */
    log(level: keyof typeof levelConfig, message: any, data: any): void;
    debug(message: any, data: any): void;
    info(message: any, data: any): void;
    warn(message: any, data: any): void;
    error(message: any, data: any): void;
}
export declare function configureLogger(options: any): Logger;
export declare function getLogger(context: any): Logger;
export { Logger, colors };
//# sourceMappingURL=logger.d.ts.map