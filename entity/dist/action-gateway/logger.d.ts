/**
 * Security Logger
 *
 * Logs all actions and security events to mind/security/.
 */
export declare class SecurityLogger {
    actionLogPath: any;
    auditLogPath: any;
    constructor(config: any);
    /**
     * Ensure log directories exist
     */
    ensureDirectories(): void;
    /**
     * Log an executed action
     */
    logAction(action: any, result: any): void;
    /**
     * Log a rejected action
     */
    logRejection(action: any, reason: any): void;
    /**
     * Log a security event
     */
    logSecurityEvent(eventType: any, details: any): void;
    /**
     * Log approval request
     */
    logApprovalRequest(actionId: any, action: any): void;
    /**
     * Log approval decision
     */
    logApprovalDecision(actionId: any, approved: any, reason: any): void;
    /**
     * Append an entry to the action log (JSONL format)
     */
    appendToActionLog(entry: any): void;
    /**
     * Append a line to the audit log
     */
    appendToAuditLog(line: any): void;
    /**
     * Summarize output to max length
     */
    summarize(text: any, maxLength: any): string | null;
    /**
     * Get recent action history
     */
    getHistory(limit?: any): Promise<any[]>;
}
//# sourceMappingURL=logger.d.ts.map