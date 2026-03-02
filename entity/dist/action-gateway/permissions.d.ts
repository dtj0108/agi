/**
 * Permissions
 *
 * Tier classification for actions.
 * Tier 1: Read-only, auto-approved
 * Tier 2: Write operations, notify user
 * Tier 3: Destructive/sensitive, require approval
 * Tier 4: Self-authored code execution, require code review + approval
 */
/**
 * Classify the tier of an action
 */
export declare function classifyTier(action: any): any;
/**
 * Check if an action matches blocked patterns
 */
export declare function isBlocked(action: any, blockedPatterns?: any): boolean;
//# sourceMappingURL=permissions.d.ts.map