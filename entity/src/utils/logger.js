/**
 * Structured Logger
 *
 * Provides consistent logging with levels, timestamps, colors, and optional file output.
 */

import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const levelConfig = {
  debug: { priority: 0, color: colors.dim, label: 'DEBUG' },
  info: { priority: 1, color: colors.cyan, label: 'INFO' },
  warn: { priority: 2, color: colors.yellow, label: 'WARN' },
  error: { priority: 3, color: colors.red, label: 'ERROR' },
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.colorize = options.colorize !== false;
    this.timestamps = options.timestamps !== false;
    this.logFile = options.logFile || null;
    this.context = options.context || null;

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
  child(context) {
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
  format(level, message, data) {
    const config = levelConfig[level];
    const parts = [];

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
  log(level, message, data) {
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
      const plainFormatted = this.format(level, message, data)
        .replace(/\x1b\[[0-9;]*m/g, '');
      try {
        appendFileSync(this.logFile, plainFormatted + '\n');
      } catch {
        // Silently fail file logging
      }
    }
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
}

// Default logger instance (will be configured on startup)
let defaultLogger = new Logger();

export function configureLogger(options) {
  defaultLogger = new Logger(options);
  return defaultLogger;
}

export function getLogger(context) {
  return context ? defaultLogger.child(context) : defaultLogger;
}

export { Logger, colors };
