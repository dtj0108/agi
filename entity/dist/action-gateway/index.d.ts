/**
 * Action Gateway
 *
 * Routes action requests to execution engines with security enforcement.
 * All actions pass through here for validation and logging.
 */
import { EventEmitter } from 'events';
export declare class ActionGateway extends EventEmitter {
    approvalTimeout: any;
    blockedPatterns: any;
    config: any;
    configHandler: any;
    engines: any;
    logger: any;
    pendingApprovals: any;
    constructor(config: any, executionEngines: any);
    /**
     * Set the config handler (called by InterfaceLayer)
     */
    setConfigHandler(handler: any): void;
    /**
     * Execute an action with security checks
     */
    executeAction(action: any): Promise<any>;
    /**
     * Request approval for a tiered action
     */
    requestApproval(actionId: any, action: any): Promise<unknown>;
    /**
     * Approve a pending action
     */
    approve(actionId: any): boolean;
    /**
     * Deny a pending action
     */
    deny(actionId: any): boolean;
    /**
     * Classify the tier of an action
     */
    classifyTier(action: any): any;
    /**
     * Get the active autonomy level with safe fallback.
     */
    getAutonomyLevel(): any;
    /**
     * Get tier threshold at or above which approval is required.
     * Returns null when approvals are disabled by policy.
     */
    getApprovalThreshold(level?: any): 3 | 2 | null;
    /**
     * Determine if a tier requires explicit approval under current policy.
     */
    requiresApprovalForTier(tier: any): boolean;
    /**
     * Get action history
     */
    getHistory(limit?: any): Promise<any>;
    /**
     * Get pending approvals
     */
    getPendingApprovals(): {
        id: any;
        tool: any;
        command: any;
        reason: any;
        tier: any;
        timestamp: number;
    }[];
    /**
     * Execute a config action
     */
    executeConfig(params: any): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map