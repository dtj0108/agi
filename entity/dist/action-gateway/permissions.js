/**
 * Permissions
 *
 * Tier classification for actions.
 * Tier 1: Read-only, auto-approved
 * Tier 2: Write operations, notify user
 * Tier 3: Destructive/sensitive, require approval
 * Tier 4: Self-authored code execution, require code review + approval
 */
// Shell commands by tier
const TIER_1_SHELL = new Set([
    'ls', 'cat', 'head', 'tail', 'find', 'grep', 'wc', 'du', 'df',
    'whoami', 'date', 'uname', 'which', 'pwd', 'echo', 'env', 'printenv',
    'node', 'python', 'python3', 'ruby', 'php',
    'git', 'npm', 'yarn', 'pnpm',
]);
const TIER_1_GIT_SUBCOMMANDS = new Set([
    'status', 'log', 'diff', 'show', 'branch', 'remote', 'tag',
    'rev-parse', 'ls-files', 'ls-tree',
]);
const TIER_2_SHELL = new Set([
    'mkdir', 'touch', 'cp', 'mv', 'tee',
    'curl', 'wget', 'http',
]);
const TIER_2_GIT_SUBCOMMANDS = new Set([
    'add', 'commit', 'push', 'pull', 'fetch', 'checkout', 'merge',
    'stash', 'clone', 'init',
]);
const TIER_3_GIT_SUBCOMMANDS = new Set([
    'reset', 'rebase', 'revert', 'cherry-pick',
    'reflog', 'gc', 'prune',
    'push --force', 'push -f',
]);
const TIER_3_SHELL = new Set([
    'rm', 'rmdir', 'chmod', 'chown', 'chgrp',
    'systemctl', 'launchctl', 'service',
    'ssh', 'scp', 'rsync', 'sftp',
    'apt', 'apt-get', 'brew', 'yum', 'dnf', 'pacman',
    'sudo', 'su', 'doas',
    'kill', 'killall', 'pkill',
    'shutdown', 'reboot', 'halt',
    'mount', 'umount',
    'dd', 'mkfs', 'fdisk', 'parted',
]);
// Browser actions by tier
const TIER_1_BROWSER = new Set([
    'screenshot', 'getSemanticSnapshot', 'getDom', 'scroll', 'wait',
]);
const TIER_2_BROWSER = new Set([
    'click', 'type', 'evaluate', 'download', 'fillForm',
]);
/**
 * Classify the tier of an action
 */
export function classifyTier(action) {
    switch (action.tool) {
        case 'shell':
            return classifyShellTier(action.params?.command || action.params);
        case 'browser':
            return classifyBrowserTier(action.params);
        case 'file':
            return classifyFileTier(action.params);
        case 'config':
            return classifyConfigTier(action.params);
        case 'skill':
            return classifySkillTier(action.params);
        default:
            return 3; // Unknown tools default to highest tier
    }
}
/**
 * Classify skill action tier
 * Built-in skills use their declared tier (1-3)
 * Authored skills are always Tier 4
 */
function classifySkillTier(params) {
    // If no params or skill name, default to Tier 3
    if (!params?.skill) {
        return 3;
    }
    // Check if this is an authored skill (metadata indicates it)
    // The SkillsExecutor will provide this info
    if (params._authored === true) {
        return 4;
    }
    // For built-in skills, use the tier from the skill manifest
    // This will be resolved by the SkillsExecutor.getTier() method
    // Default to Tier 2 for skills without explicit tier
    return params._tier || 2;
}
/**
 * Classify config action tier
 * Config changes are Tier 2 (logged but auto-approved)
 */
function classifyConfigTier(params) {
    const setting = params?.setting;
    // Reading status is Tier 1
    if (setting === 'heartbeat.status' || setting === 'cognitive.status' || setting === 'autonomy.status') {
        return 1;
    }
    // Heartbeat settings are Tier 2 (internal, not dangerous)
    if (setting?.startsWith('heartbeat.')) {
        return 2;
    }
    // Cognitive settings are Tier 2 (internal, not dangerous)
    if (setting?.startsWith('cognitive.')) {
        return 2;
    }
    // Autonomy runtime settings are Tier 2
    if (setting?.startsWith('autonomy.')) {
        return 2;
    }
    // Unknown config settings default to Tier 2
    return 2;
}
/**
 * Classify shell command tier
 */
function classifyShellTier(command) {
    if (!command || typeof command !== 'string') {
        return 3;
    }
    // Parse the command to get the binary
    const parsed = parseCommandSimple(command);
    if (!parsed.binary) {
        return 3;
    }
    const binary = parsed.binary;
    const args = parsed.args;
    // Check Tier 3 first (most restrictive)
    if (TIER_3_SHELL.has(binary)) {
        return 3;
    }
    // Check Tier 2
    if (TIER_2_SHELL.has(binary)) {
        return 2;
    }
    // Check Tier 1 with special handling for subcommands
    if (TIER_1_SHELL.has(binary)) {
        // Version flags are always Tier 1
        if (args.includes('--version') || args.includes('-v') || args.includes('-V')) {
            return 1;
        }
        // Git subcommand handling
        if (binary === 'git' && args.length > 0) {
            const subcommand = args[0];
            if (TIER_3_GIT_SUBCOMMANDS?.has(subcommand)) {
                return 3;
            }
            if (TIER_2_GIT_SUBCOMMANDS.has(subcommand)) {
                return 2;
            }
            if (TIER_1_GIT_SUBCOMMANDS.has(subcommand)) {
                return 1;
            }
            // Unknown git subcommand
            return 2;
        }
        // npm/yarn subcommand handling
        if ((binary === 'npm' || binary === 'yarn' || binary === 'pnpm') && args.length > 0) {
            const subcommand = args[0];
            if (['install', 'i', 'add', 'remove', 'uninstall', 'update', 'upgrade'].includes(subcommand)) {
                return 2;
            }
            if (['list', 'ls', 'info', 'view', 'search', 'outdated', 'audit'].includes(subcommand)) {
                return 1;
            }
            if (['publish', 'unpublish', 'deprecate'].includes(subcommand)) {
                return 3;
            }
            return 2;
        }
        return 1;
    }
    // Unknown binary - default to Tier 3
    return 3;
}
/**
 * Classify browser action tier
 */
function classifyBrowserTier(params) {
    const action = params?.action;
    if (TIER_1_BROWSER.has(action)) {
        return 1;
    }
    if (TIER_2_BROWSER.has(action)) {
        return 2;
    }
    // Navigate - depends on whether we have allowed domains
    if (action === 'navigate') {
        // For now, all navigation is Tier 2
        return 2;
    }
    // Login or sensitive operations
    if (action === 'login' || action === 'submitForm') {
        return 3;
    }
    // Unknown action
    return 3;
}
/**
 * Classify file operation tier
 */
function classifyFileTier(params) {
    const operation = params?.operation || params?.action;
    // Read operations are Tier 1
    if (['read', 'list', 'search', 'watch', 'exists', 'stat'].includes(operation)) {
        return 1;
    }
    // Write operations depend on location
    // The file executor will handle path validation
    if (['write', 'append'].includes(operation)) {
        return 1; // Will be validated by file executor
    }
    // Move is Tier 2
    if (operation === 'move') {
        return 2;
    }
    // Delete is Tier 2 in workspace, Tier 3 outside
    if (operation === 'delete') {
        return 2; // Will be validated by file executor
    }
    // Unknown operation
    return 3;
}
/**
 * Simple command parser to extract binary and args
 */
function parseCommandSimple(command) {
    const trimmed = command.trim();
    // Handle empty command
    if (!trimmed) {
        return { binary: null, args: [] };
    }
    // Split on whitespace, respecting quotes
    const tokens = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
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
/**
 * Check if an action matches blocked patterns
 */
export function isBlocked(action, blockedPatterns = []) {
    if (action.tool !== 'shell') {
        return false;
    }
    const command = action.params?.command || '';
    for (const pattern of blockedPatterns) {
        if (typeof pattern === 'string') {
            if (command.includes(pattern)) {
                return true;
            }
        }
        else if (pattern instanceof RegExp) {
            if (pattern.test(command)) {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=permissions.js.map