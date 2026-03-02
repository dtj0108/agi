/**
 * Shell Executor
 *
 * Executes shell commands using spawn (not exec) for safety.
 * Handles timeout, output limits, and environment filtering.
 */
import { spawn } from 'child_process';
export class ShellExecutor {
    config;
    defaultTimeout;
    maxOutputBytes;
    restrictedEnv;
    workingDir;
    constructor(config) {
        this.config = config;
        this.defaultTimeout = config.actions?.shell?.timeout || 30000;
        this.workingDir = config.actions?.shell?.workingDir || process.cwd();
        this.maxOutputBytes = config.actions?.shell?.maxOutputBytes || 1024 * 1024;
        this.restrictedEnv = this.buildRestrictedEnv();
    }
    /**
     * Build a restricted environment for shell commands
     */
    buildRestrictedEnv() {
        const env = { ...process.env };
        // Remove sensitive environment variables
        const sensitiveKeys = [
            'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
            'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ENTITY_LLM_API_KEY',
            'DATABASE_URL', 'DB_PASSWORD', 'DB_USER',
            'SECRET_KEY', 'PRIVATE_KEY', 'API_KEY', 'API_SECRET',
            'GITHUB_TOKEN', 'GH_TOKEN', 'GITLAB_TOKEN',
            'NPM_TOKEN', 'NPM_AUTH_TOKEN',
            'SSH_PRIVATE_KEY', 'SSH_KEY',
        ];
        for (const key of sensitiveKeys) {
            delete env[key];
        }
        // Also remove any key containing PASSWORD, SECRET, TOKEN, KEY
        for (const key of Object.keys(env)) {
            const upper = key.toUpperCase();
            if (upper.includes('PASSWORD') ||
                upper.includes('SECRET') ||
                upper.includes('_TOKEN') ||
                upper.includes('_KEY') ||
                upper.includes('CREDENTIAL')) {
                delete env[key];
            }
        }
        // Set restricted PATH if configured
        if (this.config.actions?.shell?.env?.PATH) {
            env.PATH = this.config.actions.shell.env.PATH;
        }
        return env;
    }
    /**
     * Execute a shell command
     */
    async execute(command, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const cwd = options.cwd || this.workingDir;
        return new Promise((resolve) => {
            const startTime = Date.now();
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let killed = false;
            let killReason = null;
            // Parse command to extract binary and args
            const { binary, args } = this.parseCommandForSpawn(command);
            if (!binary) {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: 'Empty command',
                    exitCode: 1,
                    duration_ms: 0,
                    error: 'Empty command',
                });
                return;
            }
            const proc = spawn(binary, args, {
                cwd,
                env: this.restrictedEnv,
                shell: false, // IMPORTANT: No shell interpretation
                uid: options.uid,
                gid: options.gid,
            });
            // Set up timeout
            const timeoutHandle = setTimeout(() => {
                timedOut = true;
                killReason = 'timeout';
                proc.kill('SIGKILL');
            }, timeout);
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
                // Prevent memory exhaustion
                if (stdout.length > this.maxOutputBytes) {
                    killed = true;
                    killReason = 'output_limit';
                    proc.kill('SIGKILL');
                }
            });
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
                if (stderr.length > this.maxOutputBytes) {
                    killed = true;
                    killReason = 'output_limit';
                    proc.kill('SIGKILL');
                }
            });
            proc.on('close', (code, signal) => {
                clearTimeout(timeoutHandle);
                resolve({
                    success: code === 0 && !timedOut && !killed,
                    stdout,
                    stderr,
                    exitCode: code,
                    signal,
                    duration_ms: Date.now() - startTime,
                    timedOut,
                    killed: killReason,
                });
            });
            proc.on('error', (err) => {
                clearTimeout(timeoutHandle);
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: err.message,
                    exitCode: null,
                    duration_ms: Date.now() - startTime,
                });
            });
        });
    }
    /**
     * Parse command string into binary and arguments array
     */
    parseCommandForSpawn(command) {
        if (!command || typeof command !== 'string') {
            return { binary: null, args: [] };
        }
        const tokens = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        for (let i = 0; i < command.length; i++) {
            const char = command[i];
            // Handle escape characters
            if (char === '\\' && !inSingleQuote && i + 1 < command.length) {
                current += command[i + 1];
                i++;
                continue;
            }
            if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                continue;
            }
            if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }
            if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (current) {
            tokens.push(current);
        }
        return {
            binary: tokens[0] || null,
            args: tokens.slice(1),
        };
    }
}
//# sourceMappingURL=shell.js.map