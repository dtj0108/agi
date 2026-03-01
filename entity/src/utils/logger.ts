/**
 * Structured Logger
 *
 * Provides consistent logging with levels, timestamps, colors, and optional file output.
 */

import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

interface LevelConfig {
  priority: number;
  color: string;
  label: string;
}

const levelConfig: Record<LogLevel, LevelConfig> = {
  debug: { priority: 0, color: colors.dim, label: 'DEBUG' },
  info: { priority: 1, color: colors.cyan, label: 'INFO' },
  warn: { priority: 2, color: colors.yellow, label: 'WARN' },
  error: { priority: 3, color: colors.red, label: 'ERROR' },
};

export interface LoggerOptions {
  level?: LogLevel;
  colorize?: boolean;
  timestamps?: boolean;
  logFile?: string | null;
  context?: string | null;
}

export class Logger {
  private level: LogLevel;
  private colorize: boolean;
  private timestamps: boolean;
  private logFile: string | null;
  private context: string | null;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.colorize = options.colorize !== false;
    this.timestamps = options.timestamps !== false;
    this.logFile = options.logFile ?? null;
    this.context = options.context ?? null;

    // Ensure log directory exists
    if (this.logFile) {
      try {
        mkdirSync(dirname(this.logFile), { recursive: true });
      } catch {
        // Directory may already exist
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    return new Logger({
      level: this.level,
      colorize: this.colorize,
      timestamps: this.timestamps,
      logFile: this.logFile,
      context: this.context ? `${this.context}:${context}` : context,
    });
  }

  /**
   * Format a log message
   */
  private format(level: LogLevel, message: string, data?: unknown): string {
    const config = levelConfig[level];
    const parts: string[] = [];

    // Timestamp
    if (this.timestamps) {
      const ts = new Date().toISOString();
      parts.push(this.colorize ? `${colors.dim}${ts}${colors.reset}` : ts);
    }

    // Level
    const levelStr = `[${config.label}]`;
    parts.push(this.colorize ? `${config.color}${levelStr}${colors.reset}` : levelStr);

    // Context
    if (this.context) {
      const ctxStr = `[${this.context}]`;
      parts.push(this.colorize ? `${colors.magenta}${ctxStr}${colors.reset}` : ctxStr);
    }

    // Message
    parts.push(message);

    // Data
    if (data !== undefined) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      parts.push(this.colorize ? `${colors.dim}${dataStr}${colors.reset}` : dataStr);
    }

    return parts.join(' ');
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const config = levelConfig[level];
    const currentPriority = levelConfig[this.level]?.priority ?? 1;

    if (config.priority < currentPriority) {
      return;
    }

    const formatted = this.format(level, message, data);

    // Console output
    if (level === 'error') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }

    // File output (without colors)
    if (this.logFile) {
      const plainFormatted = formatted.replace(/\x1b\[[0-9;]*m/g, '');
      try {
        appendFileSync(this.logFile, plainFormatted + '\n');
      } catch {
        // Silently fail file logging
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}

// Default logger instance (will be configured on startup)
let defaultLogger = new Logger();

/**
 * Configure the default logger instance
 */
export function configureLogger(options: LoggerOptions): Logger {
  defaultLogger = new Logger(options);
  return defaultLogger;
}

/**
 * Get a logger instance, optionally with context
 */
export function getLogger(context?: string): Logger {
  return context ? defaultLogger.child(context) : defaultLogger;
}
