/**
 * Act Phase
 *
 * Phase 4 of the cognitive loop.
 * Executes the plan via the Action Gateway.
 */

import { EventEmitter } from 'events';

export class ActPhase extends EventEmitter {
  constructor(actionGateway, config) {
    super();
    this.actionGateway = actionGateway;
    this.config = config;
    this.pendingApprovals = new Map();
    this.approvalTimeout = config.actions?.approvalTimeout || 300000;
  }

  /**
   * Execute the act phase
   */
  async execute(plan) {
    // If no plan, return null
    if (!plan) {
      return null;
    }

    // Check if approval is needed
    if (plan.needsApproval) {
      try {
        await this.waitForApproval(plan);
      } catch (error) {
        return {
          planId: plan.planId,
          results: [],
          completed: false,
          aborted: true,
          abortReason: error.message || 'denied',
        };
      }
    }

    // Execute steps sequentially
    const results = [];
    let aborted = false;
    let abortReason = null;

    for (const step of plan.steps) {
      const result = await this.executeStep(step, plan);
      results.push(result);

      // Check if we should continue
      if (!this.shouldContinue(result, step)) {
        aborted = true;
        abortReason = result.error || 'Step failed';
        break;
      }
    }

    return {
      planId: plan.planId,
      results,
      completed: !aborted && results.length === plan.steps.length,
      aborted,
      abortReason,
    };
  }

  /**
   * Execute a single step
   */
  async executeStep(step, plan) {
    const startTime = Date.now();

    try {
      const params = this.buildParams(step);
      const result = await this.actionGateway.executeAction({
        tool: step.tool,
        params,
        intent: step.intent,
        tier: step.tier,
      });

      return {
        stepIndex: step.stepIndex,
        tool: step.tool,
        action: step.action,
        intent: step.intent || '',
        success: result.success !== false,
        output: result.stdout || result.output || result.content || null,
        error: result.error || null,
        duration: Date.now() - startTime,
        exitCode: result.exitCode ?? null,
        approved_by: result.approved_by,
        params,
        rawResult: result,
      };
    } catch (error) {
      return {
        stepIndex: step.stepIndex,
        tool: step.tool,
        action: step.action,
        intent: step.intent || '',
        success: false,
        output: null,
        error: error.message,
        duration: Date.now() - startTime,
        exitCode: null,
        params: this.buildParams(step),
        rawResult: {
          success: false,
          error: error.message,
        },
      };
    }
  }

  /**
   * Build params object for action gateway
   */
  buildParams(step) {
    const params = { ...step.params };

    // Add action type for browser and file tools
    if (step.tool === 'browser' || step.tool === 'file') {
      params.action = step.action;
    }

    // For shell, ensure command is present
    if (step.tool === 'shell' && !params.command) {
      params.command = step.action;
    }

    return params;
  }

  /**
   * Determine if execution should continue after a step
   */
  shouldContinue(result, step) {
    // If successful, continue
    if (result.success) {
      return true;
    }

    // For shell commands, some exit codes are acceptable
    if (step.tool === 'shell') {
      // grep returns 1 when no matches found - not really a failure
      if (result.exitCode === 1 && step.action?.includes('grep')) {
        return true;
      }
      // diff returns 1 when files differ - often expected
      if (result.exitCode === 1 && step.action?.includes('diff')) {
        return true;
      }
    }

    // Otherwise, stop on failure
    return false;
  }

  /**
   * Wait for user approval of a plan
   */
  async waitForApproval(plan) {
    return new Promise((resolve, reject) => {
      // Store the pending approval
      this.pendingApprovals.set(plan.planId, { resolve, reject });

      // Emit approval needed event
      this.emit('approval_needed', {
        planId: plan.planId,
        plan,
        message: `Tier 3 action requires approval`,
      });

      // Set timeout
      setTimeout(() => {
        if (this.pendingApprovals.has(plan.planId)) {
          this.pendingApprovals.delete(plan.planId);
          reject(new Error('Approval timeout'));
        }
      }, this.approvalTimeout);
    });
  }

  /**
   * Approve a pending plan
   */
  approve(planId) {
    const pending = this.pendingApprovals.get(planId);
    if (pending) {
      this.pendingApprovals.delete(planId);
      pending.resolve();
      return true;
    }
    return false;
  }

  /**
   * Deny a pending plan
   */
  deny(planId) {
    const pending = this.pendingApprovals.get(planId);
    if (pending) {
      this.pendingApprovals.delete(planId);
      pending.reject(new Error('User denied'));
      return true;
    }
    return false;
  }

  /**
   * Abort a plan
   */
  abortPlan(planId) {
    return this.deny(planId);
  }
}
