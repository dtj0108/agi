/**
 * Shell Command Validator
 *
 * Parses and validates shell commands for security.
 * Detects dangerous patterns like command injection.
 */
/**
 * Parse and validate a shell command
 */
export declare function parseCommand(commandString: any): {
    safe: boolean;
    binary: any;
    args: any[];
    original: any;
} | {
    safe: boolean;
    reason: null;
    segments: any[];
    hasBackgroundExec: boolean;
    hasRedirection: boolean;
    redirectionTargets: any[];
} | {
    safe: boolean;
    reason: string;
};
/**
 * Resolve a binary name to its full path
 */
export declare function resolveBinaryPath(binary: any): any;
/**
 * Validate that a command is safe to execute
 */
export declare function validateCommand(command: any): {
    safe: boolean;
    binary: any;
    args: any[];
    original: any;
} | {
    safe: boolean;
    reason: null;
    segments: any[];
    hasBackgroundExec: boolean;
    hasRedirection: boolean;
    redirectionTargets: any[];
} | {
    safe: boolean;
    reason: string;
};
//# sourceMappingURL=validator.d.ts.map