/**
 * Security Logger
 *
 * Logs all actions and security events to mind/security/.
 */
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
export class SecurityLogger {
    actionLogPath;
    auditLogPath;
    constructor(config) {
        this.actionLogPath = config.security.actionLogPath;
        this.auditLogPath = config.security.auditLogPath;
        this.ensureDirectories();
    }
    /**
     * Ensure log directories exist
     */
    ensureDirectories() {
        for (const path of [this.actionLogPath, this.auditLogPath]) {
            const dir = dirname(path);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        }
    }
    /**
     * Log an executed action
     */
    logAction(action, result) {
        const entry = {
            timestamp: new Date().toISOString(),
            tool: action.tool,
            command: action.params?.command || null,
            url: action.params?.url || null,
            path: action.params?.path || null,
            intent: action.intent,
            source: action.source || null,
            tier: action.tier,
            approved_by: result.approved_by || 'auto',
            exit_code: result.exitCode ?? null,
            status: result.success !== false ? 'success' : 'failure',
            duration_ms: result.duration_ms,
            output_summary: this.summarize(result.stdout || result.output, 200),
            error: result.error || null,
        };
        this.appendToActionLog(entry);
    }
    /**
     * Log a rejected action
     */
    logRejection(action, reason) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'REJECTION',
            tool: action.tool,
            command: action.params?.command || null,
            url: action.params?.url || null,
            path: action.params?.path || null,
            intent: action.intent,
            source: action.source || null,
            reason,
        };
        // Log to audit log
        const auditLine = `[${entry.timestamp}] REJECTED: ${action.tool} - ${reason}\n`;
        this.appendToAuditLog(auditLine);
        // Also log to action log
        this.appendToActionLog({
            ...entry,
            approved_by: 'blocked',
            status: 'rejected',
        });
    }
    /**
     * Log a security event
     */
    logSecurityEvent(eventType, details) {
        const line = `[${new Date().toISOString()}] ${eventType}: ${JSON.stringify(details)}\n`;
        this.appendToAuditLog(line);
    }
    /**
     * Log approval request
     */
    logApprovalRequest(actionId, action) {
        const line = `[${new Date().toISOString()}] APPROVAL_REQUESTED: ${actionId} - ${action.tool}\n`;
        this.appendToAuditLog(line);
    }
    /**
     * Log approval decision
     */
    logApprovalDecision(actionId, approved, reason) {
        const decision = approved ? 'APPROVED' : 'DENIED';
        const line = `[${new Date().toISOString()}] ${decision}: ${actionId}${reason ? ' - ' + reason : ''}\n`;
        this.appendToAuditLog(line);
    }
    /**
     * Append an entry to the action log (JSONL format)
     */
    appendToActionLog(entry) {
        try {
            appendFileSync(this.actionLogPath, JSON.stringify(entry) + '\n');
        }
        catch {
            // Silently fail
        }
    }
    /**
     * Append a line to the audit log
     */
    appendToAuditLog(line) {
        try {
            appendFileSync(this.auditLogPath, line);
        }
        catch {
            // Silently fail
        }
    }
    /**
     * Summarize output to max length
     */
    summarize(text, maxLength) {
        if (!text)
            return null;
        const str = String(text);
        if (str.length <= maxLength)
            return str;
        return str.substring(0, maxLength - 3) + '...';
    }
    /**
     * Get recent action history
     */
    async getHistory(limit = 50) {
        try {
            const { readFileSync } = await import('fs');
            const content = readFileSync(this.actionLogPath, 'utf-8');
            const lines = content.trim().split('\n').filter((l) => l);
            // Parse last N lines
            const entries = [];
            const start = Math.max(0, lines.length - limit);
            for (let i = start; i < lines.length; i++) {
                try {
                    entries.push(JSON.parse(lines[i] ?? ''));
                }
                catch {
                    // Skip malformed lines
                }
            }
            return entries;
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=logger.js.map