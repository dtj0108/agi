/**
 * Shell Command Validator
 *
 * Parses and validates shell commands for security.
 * Detects dangerous patterns like command injection.
 */
import { execSync } from 'child_process';
// Cache for binary path resolution
const binaryCache = new Map();
// Blocked path prefixes for redirections
const BLOCKED_REDIRECT_PATHS = [
    '/etc',
    '/usr',
    '/bin',
    '/sbin',
    '/System',
    '/Library',
    '/var/log',
    '/var/run',
    '/private/etc',
];
/**
 * Parse and validate a shell command
 */
export function parseCommand(commandString) {
    const result = {
        safe: true,
        reason: null,
        segments: [],
        hasBackgroundExec: false,
        hasRedirection: false,
        redirectionTargets: [],
    };
    if (!commandString || typeof commandString !== 'string') {
        return { safe: false, reason: 'Empty or invalid command' };
    }
    const command = commandString.trim();
    // Step 1: Detect command substitution (highest priority block)
    if (hasCommandSubstitution(command)) {
        return { safe: false, reason: 'Command substitution detected: $() or backticks not allowed' };
    }
    // Step 2: Reject shell operators not supported by shell:false execution
    const unsupportedSyntax = detectUnsupportedShellSyntax(command);
    if (unsupportedSyntax) {
        return { safe: false, reason: unsupportedSyntax };
    }
    // Step 3: Parse a single segment
    const segment = parseSegment(command);
    if (!segment.safe) {
        return segment;
    }
    result.segments.push(segment);
    return result;
}
/**
 * Detect command substitution patterns
 */
function hasCommandSubstitution(cmd) {
    // Detect $(...) - but not just $VAR
    // Match $( followed by anything until )
    const dollarParenRegex = /\$\([^)]*\)/;
    // Detect backticks
    const backtickRegex = /`[^`]*`/;
    return dollarParenRegex.test(cmd) || backtickRegex.test(cmd);
}
/**
 * Detect unsupported shell operators/meta syntax outside quotes
 */
function detectUnsupportedShellSyntax(cmd) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < cmd.length; i++) {
        const char = cmd[i];
        const nextChar = cmd[i + 1];
        // Handle escaped characters outside single quotes
        if (char === '\\' && !inSingleQuote && i + 1 < cmd.length) {
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
        if (inSingleQuote || inDoubleQuote) {
            continue;
        }
        if (char === '&' && nextChar === '&') {
            return 'Shell operator not allowed: &&';
        }
        if (char === '|' && nextChar === '|') {
            return 'Shell operator not allowed: ||';
        }
        if (char === '|') {
            return 'Shell operator not allowed: |';
        }
        if (char === ';') {
            return 'Shell operator not allowed: ;';
        }
        if (char === '&') {
            return 'Background execution is not allowed';
        }
        if (char === '>' || char === '<') {
            return 'Redirection is not allowed';
        }
    }
    return null;
}
/**
 * Split command on pipe characters (but not ||)
 */
function splitOnPipes(cmd) {
    const segments = [];
    let current = '';
    let i = 0;
    while (i < cmd.length) {
        // Handle escapes
        if (cmd[i] === '\\' && i + 1 < cmd.length) {
            current += cmd[i] + cmd[i + 1];
            i += 2;
            continue;
        }
        // Check for || (logical OR, not a pipe)
        if (cmd[i] === '|' && cmd[i + 1] === '|') {
            current += '||';
            i += 2;
            continue;
        }
        // Single pipe - split point
        if (cmd[i] === '|') {
            if (current.trim()) {
                segments.push(current.trim());
            }
            current = '';
            i++;
            continue;
        }
        current += cmd[i];
        i++;
    }
    if (current.trim()) {
        segments.push(current.trim());
    }
    return segments;
}
/**
 * Split command on chain operators (&& || ;)
 */
function splitOnChains(cmd) {
    const segments = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let i = 0;
    while (i < cmd.length) {
        const char = cmd[i];
        const nextChar = cmd[i + 1];
        // Track quote state
        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        }
        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }
        // Only split outside quotes
        if (!inSingleQuote && !inDoubleQuote) {
            // Check for && or ||
            if ((char === '&' && nextChar === '&') ||
                (char === '|' && nextChar === '|')) {
                if (current.trim()) {
                    segments.push(current.trim());
                }
                current = '';
                i += 2;
                continue;
            }
            // Check for ;
            if (char === ';') {
                if (current.trim()) {
                    segments.push(current.trim());
                }
                current = '';
                i++;
                continue;
            }
        }
        current += char;
        i++;
    }
    if (current.trim()) {
        segments.push(current.trim());
    }
    return segments;
}
/**
 * Parse a single command segment
 */
function parseSegment(segment) {
    // Remove leading redirections and environment variables
    let cleanSegment = segment
        .replace(/^\s*[A-Z_][A-Z_0-9]*=\S+\s+/gi, '') // Remove VAR=value prefix
        .replace(/^[<>]\s*\S+\s*/, '') // Remove leading redirections
        .replace(/\s*[<>]+\s*\S+\s*$/g, '') // Remove trailing redirections
        .trim();
    // Handle empty segment after cleaning
    if (!cleanSegment) {
        return { safe: true, binary: null, args: [], original: segment };
    }
    // Parse into binary and args
    const tokens = tokenize(cleanSegment);
    if (tokens.length === 0) {
        return { safe: true, binary: null, args: [], original: segment };
    }
    const binary = tokens[0];
    const args = tokens.slice(1);
    return {
        safe: true,
        binary,
        args,
        original: segment,
    };
}
/**
 * Tokenize a command string respecting quotes
 */
function tokenize(cmd) {
    const tokens = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < cmd.length; i++) {
        const char = cmd[i];
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
    return tokens;
}
/**
 * Extract redirection targets from a command
 */
function extractRedirectionTargets(cmd) {
    const targets = [];
    // Match > >> < patterns followed by paths
    // Be careful not to match inside quotes
    const regex = /(?:^|[^<>])(>>?|<)\s*([^\s&|;><]+)/g;
    let match;
    while ((match = regex.exec(cmd)) !== null) {
        const target = match[2];
        // Skip if it looks like a file descriptor (e.g., &1, &2)
        if (!target.startsWith('&')) {
            targets.push(target);
        }
    }
    return targets;
}
/**
 * Check if a path is blocked for redirections
 */
function isBlockedPath(path) {
    // Handle relative paths by checking for traversal
    if (path.includes('..')) {
        // Could potentially reach blocked paths
        return true;
    }
    // Check against blocked prefixes
    for (const prefix of BLOCKED_REDIRECT_PATHS) {
        if (path.startsWith(prefix + '/') || path === prefix) {
            return true;
        }
    }
    return false;
}
/**
 * Resolve a binary name to its full path
 */
export function resolveBinaryPath(binary) {
    // Handle absolute paths
    if (binary.startsWith('/')) {
        return binary;
    }
    // Check cache
    if (binaryCache.has(binary)) {
        return binaryCache.get(binary);
    }
    try {
        const result = execSync(`which ${binary}`, {
            encoding: 'utf8',
            timeout: 1000,
        }).trim();
        binaryCache.set(binary, result);
        return result;
    }
    catch {
        binaryCache.set(binary, null);
        return null;
    }
}
/**
 * Validate that a command is safe to execute
 */
export function validateCommand(command) {
    const parsed = parseCommand(command);
    if (!parsed.safe) {
        return parsed;
    }
    // Additional validation can be added here
    // For example, checking specific dangerous argument patterns
    return parsed;
}
//# sourceMappingURL=validator.js.map