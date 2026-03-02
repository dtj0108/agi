/**
 * Shell Executor
 *
 * Executes shell commands using spawn (not exec) for safety.
 * Handles timeout, output limits, and environment filtering.
 */
export declare class ShellExecutor {
    config: any;
    defaultTimeout: any;
    maxOutputBytes: any;
    restrictedEnv: any;
    workingDir: any;
    constructor(config: any);
    /**
     * Build a restricted environment for shell commands
     */
    buildRestrictedEnv(): {
        [key: string]: string | undefined;
    };
    /**
     * Execute a shell command
     */
    execute(command: any, options?: any): Promise<unknown>;
    /**
     * Parse command string into binary and arguments array
     */
    parseCommandForSpawn(command: any): {
        binary: any;
        args: any[];
    };
}
//# sourceMappingURL=shell.d.ts.map