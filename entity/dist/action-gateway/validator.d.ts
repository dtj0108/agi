/**
 * Shell Command Validator
 *
 * Parses and validates shell commands for security.
 * Detects dangerous patterns like command injection.
 */
export interface ParsedCommand {
    safe: boolean;
    reason?: string | null;
    segments?: any[];
    hasBackgroundExec?: boolean;
    hasRedirection?: boolean;
    redirectionTargets?: any[];
    binary?: string | null;
    args?: string[];
    original?: string;
}
/**
 * Parse and validate a shell command
 */
export declare function parseCommand(commandString: any): ParsedCommand;
/**
 * Resolve a binary name to its full path
 */
export declare function resolveBinaryPath(binary: any): any;
/**
 * Validate that a command is safe to execute
 */
export declare function validateCommand(command: any): ParsedCommand;
//# sourceMappingURL=validator.d.ts.map