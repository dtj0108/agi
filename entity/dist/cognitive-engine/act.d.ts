/**
 * Act Phase
 *
 * Phase 4 of the cognitive loop.
 * Executes the plan via the Action Gateway.
 */
import { EventEmitter } from 'events';
export declare class ActPhase extends EventEmitter {
    actionGateway: any;
    approvalTimeout: any;
    config: any;
    pendingApprovals: any;
    constructor(actionGateway: any, config: any);
    /**
     * Execute the act phase
     */
    execute(plan: any): Promise<{
        planId: any;
        results: any[];
        completed: boolean;
        aborted: boolean;
        abortReason: any;
    } | null>;
    /**
     * Execute a single step
     */
    executeStep(step: any, plan: any): Promise<{
        stepIndex: any;
        tool: any;
        action: any;
        intent: any;
        success: boolean;
        output: any;
        error: any;
        duration: number;
        exitCode: any;
        approved_by: any;
        params: any;
        rawResult: any;
    } | {
        stepIndex: any;
        tool: any;
        action: any;
        intent: any;
        success: boolean;
        output: null;
        error: any;
        duration: number;
        exitCode: null;
        params: any;
        rawResult: {
            success: boolean;
            error: any;
        };
        approved_by?: undefined;
    }>;
    /**
     * Build params object for action gateway
     */
    buildParams(step: any): any;
    /**
     * Determine if execution should continue after a step
     */
    shouldContinue(result: any, step: any): boolean;
    /**
     * Wait for user approval of a plan
     */
    waitForApproval(plan: any): Promise<unknown>;
    /**
     * Approve a pending plan
     */
    approve(planId: any): boolean;
    /**
     * Deny a pending plan
     */
    deny(planId: any): boolean;
    /**
     * Abort a plan
     */
    abortPlan(planId: any): boolean;
}
//# sourceMappingURL=act.d.ts.map