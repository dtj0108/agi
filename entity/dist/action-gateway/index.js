/**
 * Action Gateway
 *
 * Routes action requests to execution engines with security enforcement.
 * All actions pass through here for validation and logging.
 */
import { EventEmitter } from 'events';
import { classifyTier, isBlocked } from './permissions.js';
import { parseCommand } from './validator.js';
import { SecurityLogger } from './logger.js';
import { getTelemetry } from '../observability/telemetry.js';
export class ActionGateway extends EventEmitter {
    approvalTimeout;
    blockedPatterns;
    config;
    configHandler;
    engines;
    logger;
    pendingApprovals;
    constructor(config, executionEngines) {
        super();
        this.config = config;
        this.engines = executionEngines;
        this.logger = new SecurityLogger(config);
        this.pendingApprovals = new Map();
        this.approvalTimeout = config.actions?.approvalTimeout || 300000;
        this.blockedPatterns = config.actions?.blockedPatterns || [];
        this.configHandler = null;
    }
    /**
     * Set the config handler (called by InterfaceLayer)
     */
    setConfigHandler(handler) {
        this.configHandler = handler;
    }
    /**
     * Execute an action with security checks
     */
    async executeAction(action) {
        const startTime = Date.now();
        const telemetry = getTelemetry();
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
        telemetry.incrementCounter('action.total', 1, { tool: action.tool || 'unknown' });
        // Step 1: Validate shell commands
        if (action.tool === 'shell') {
            const validation = parseCommand(action.params?.command);
            if (!validation.safe) {
                // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
                telemetry.incrementCounter('action.rejected', 1, { reason: 'validator', tool: action.tool });
                // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
                telemetry.recordEvent('action_rejected', {
                    tool: action.tool,
                    // @ts-expect-error TODO(ts-migration): TS(2339): Property 'reason' does not exist on type '{ safe: ... Remove this comment to see the full error message
                    reason: validation.reason,
                });
                // @ts-expect-error TODO(ts-migration): TS(2339): Property 'reason' does not exist on type '{ safe: ... Remove this comment to see the full error message
                this.logger.logRejection(action, validation.reason);
                return {
                    success: false,
                    // @ts-expect-error TODO(ts-migration): TS(2339): Property 'reason' does not exist on type '{ safe: ... Remove this comment to see the full error message
                    error: validation.reason,
                    approved_by: 'blocked',
                };
            }
        }
        // Step 2: Check blocklist
        if (isBlocked(action, this.blockedPatterns)) {
            // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
            telemetry.incrementCounter('action.rejected', 1, { reason: 'policy', tool: action.tool });
            // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
            telemetry.recordEvent('action_rejected', {
                tool: action.tool,
                reason: 'Action blocked by security policy',
            });
            this.logger.logRejection(action, 'Action matches blocked pattern');
            return {
                success: false,
                error: 'Action blocked by security policy',
                approved_by: 'blocked',
            };
        }
        // Step 3: Classify tier (special handling for skills)
        let tier;
        if (action.tool === 'skill' && this.engines.skills) {
            tier = action.tier || this.engines.skills.getTier(action.params?.skill, action.params?.action);
        }
        else {
            tier = action.tier || classifyTier(action);
        }
        action.tier = tier;
        // Step 4: Handle based on tier + autonomy policy
        let approved_by = 'auto';
        const requiresApproval = this.requiresApprovalForTier(tier);
        if (tier === 2) {
            // Emit notification for write-class actions.
            this.emit('notification', {
                type: 'tier2_action',
                action,
                message: `Executing Tier 2 action: ${action.tool}`,
            });
        }
        if (requiresApproval) {
            const actionId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
            telemetry.incrementCounter('action.approval_required', 1, { tool: action.tool });
            this.logger.logApprovalRequest(actionId, action);
            try {
                await this.requestApproval(actionId, action);
                approved_by = 'user';
                this.logger.logApprovalDecision(actionId, true);
            }
            catch (err) {
                // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
                telemetry.incrementCounter('action.rejected', 1, { reason: 'approval_denied', tool: action.tool });
                // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
                telemetry.recordEvent('action_rejected', {
                    tool: action.tool,
                    reason: err.message || 'Approval denied',
                });
                this.logger.logApprovalDecision(actionId, false, err.message);
                this.logger.logRejection(action, 'User denied approval');
                return {
                    success: false,
                    error: 'Action denied by user',
                    approved_by: 'blocked',
                };
            }
        }
        else if (tier >= 3) {
            approved_by = 'policy';
            // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 2.
            telemetry.recordEvent('action_auto_approved_by_policy', {
                tool: action.tool,
                tier,
                autonomy: this.getAutonomyLevel(),
            });
        }
        // Step 5: Execute via appropriate engine
        let result;
        try {
            switch (action.tool) {
                case 'shell':
                    result = await this.engines.shell.execute(action.params.command, action.params.options);
                    break;
                case 'browser':
                    result = await this.engines.browser.execute(action.params);
                    break;
                case 'file':
                    result = await this.engines.files.execute(action.params);
                    break;
                case 'config':
                    result = await this.executeConfig(action.params);
                    break;
                case 'skill':
                    if (!this.engines.skills) {
                        throw new Error('Skills engine not initialized');
                    }
                    result = await this.engines.skills.execute(action.params);
                    break;
                default:
                    throw new Error(`Unknown tool: ${action.tool}`);
            }
        }
        catch (err) {
            // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
            telemetry.recordError('action-gateway', err, {
                stage: 'execute',
                tool: action.tool,
            });
            result = {
                success: false,
                error: err.message,
            };
        }
        result.duration_ms = Date.now() - startTime;
        result.approved_by = approved_by;
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
        telemetry.observeDuration('action.duration_ms', result.duration_ms, {
            tool: action.tool || 'unknown',
            tier: String(tier),
            success: String(result.success !== false),
        });
        // @ts-expect-error TODO(ts-migration): TS(2554): Expected 0 arguments, but got 3.
        telemetry.incrementCounter(result.success !== false ? 'action.success' : 'action.failed', 1, {
            tool: action.tool || 'unknown',
            tier: String(tier),
        });
        // Step 6: Log result
        this.logger.logAction(action, result);
        return result;
    }
    /**
     * Request approval for a tiered action
     */
    async requestApproval(actionId, action) {
        return new Promise((resolve, reject) => {
            this.pendingApprovals.set(actionId, { action, resolve, reject });
            this.emit('approval_required', {
                actionId,
                action,
                message: `Tier ${action.tier} action requires approval: ${action.tool}`,
                details: action.params,
            });
            // Timeout after configured duration
            setTimeout(() => {
                if (this.pendingApprovals.has(actionId)) {
                    this.pendingApprovals.delete(actionId);
                    reject(new Error('Approval timeout'));
                }
            }, this.approvalTimeout);
        });
    }
    /**
     * Approve a pending action
     */
    approve(actionId) {
        const pending = this.pendingApprovals.get(actionId);
        if (pending) {
            this.pendingApprovals.delete(actionId);
            pending.resolve();
            return true;
        }
        return false;
    }
    /**
     * Deny a pending action
     */
    deny(actionId) {
        const pending = this.pendingApprovals.get(actionId);
        if (pending) {
            this.pendingApprovals.delete(actionId);
            pending.reject(new Error('User denied'));
            return true;
        }
        return false;
    }
    /**
     * Classify the tier of an action
     */
    classifyTier(action) {
        return classifyTier(action);
    }
    /**
     * Get the active autonomy level with safe fallback.
     */
    getAutonomyLevel() {
        const level = this.config?.actions?.autonomy;
        if (level === 'conservative' || level === 'balanced' || level === 'full_trust') {
            return level;
        }
        return 'balanced';
    }
    /**
     * Get tier threshold at or above which approval is required.
     * Returns null when approvals are disabled by policy.
     */
    getApprovalThreshold(level = this.getAutonomyLevel()) {
        switch (level) {
            case 'conservative':
                return 2;
            case 'balanced':
                return 3;
            case 'full_trust':
                return null;
            default:
                return 3;
        }
    }
    /**
     * Determine if a tier requires explicit approval under current policy.
     */
    requiresApprovalForTier(tier) {
        const threshold = this.getApprovalThreshold();
        if (threshold === null) {
            return false;
        }
        const normalizedTier = Number(tier);
        if (!Number.isFinite(normalizedTier)) {
            return true;
        }
        return normalizedTier >= threshold;
    }
    /**
     * Get action history
     */
    async getHistory(limit = 50) {
        return this.logger.getHistory(limit);
    }
    /**
     * Get pending approvals
     */
    getPendingApprovals() {
        return Array.from(this.pendingApprovals.entries()).map(([id, pending]) => ({
            id,
            tool: pending.action.tool,
            command: pending.action.params?.command || JSON.stringify(pending.action.params),
            reason: pending.action.intent || 'No reason provided',
            tier: pending.action.tier,
            timestamp: Date.now(),
        }));
    }
    /**
     * Execute a config action
     */
    async executeConfig(params) {
        if (!this.configHandler) {
            return {
                success: false,
                error: 'Config handler not initialized',
            };
        }
        try {
            switch (params.setting) {
                case 'heartbeat.schedule':
                    const scheduleResult = this.configHandler.updateHeartbeatSchedule(params.value);
                    return { success: true, ...scheduleResult };
                case 'heartbeat.prompt':
                    const promptResult = this.configHandler.updateHeartbeatPrompt(params.value);
                    return { success: true, ...promptResult };
                case 'heartbeat.enabled':
                    const enabledResult = this.configHandler.setHeartbeatEnabled(params.value);
                    return { success: true, ...enabledResult };
                case 'heartbeat.status':
                    const status = this.configHandler.getHeartbeatStatus();
                    return { success: true, ...status };
                case 'autonomy.mode':
                    return { success: true, ...this.configHandler.updateAutonomyMode(params.value) };
                case 'autonomy.go.minDelayMs':
                    return { success: true, ...this.configHandler.updateAutonomyGoMinDelayMs(params.value) };
                case 'autonomy.go.maxConsecutiveErrors':
                    return { success: true, ...this.configHandler.updateAutonomyGoMaxConsecutiveErrors(params.value) };
                case 'autonomy.status':
                    return { success: true, ...this.configHandler.getAutonomyStatus() };
                // Cognitive settings
                case 'cognitive.temperature':
                    return this.configHandler.updateCognitiveConfig('temperature', params.value);
                case 'cognitive.emotionalDecayRate':
                    return this.configHandler.updateCognitiveConfig('emotionalDecayRate', params.value);
                case 'cognitive.emotionalMomentum':
                    return this.configHandler.updateCognitiveConfig('emotionalMomentum', params.value);
                case 'cognitive.reflectionInterval':
                    return this.configHandler.updateCognitiveConfig('reflectionInterval', params.value);
                // LLM settings
                case 'cognitive.maxTokens':
                    return this.configHandler.updateCognitiveConfig('maxTokens', params.value);
                case 'cognitive.retryAttempts':
                    return this.configHandler.updateCognitiveConfig('retryAttempts', params.value);
                // Get current config
                case 'cognitive.status':
                    const cogConfig = this.configHandler.getCognitiveConfig();
                    return { success: true, ...cogConfig };
                default:
                    return {
                        success: false,
                        error: `Unknown config setting: ${params.setting}`,
                    };
            }
        }
        catch (err) {
            return {
                success: false,
                error: err.message,
            };
        }
    }
}
//# sourceMappingURL=index.js.map