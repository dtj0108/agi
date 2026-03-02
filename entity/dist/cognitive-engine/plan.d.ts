/**
 * Plan Phase
 *
 * Phase 3 of the cognitive loop.
 * Creates an action plan if needed.
 */
export declare class PlanPhase {
    actionGateway: any;
    fallbackFactory: any;
    llm: any;
    maxSteps: any;
    mindPath: any;
    promptBuilder: any;
    constructor(llm: any, promptBuilder: any, mindPath: any, actionGateway: any, options?: any);
    /**
     * Execute the plan phase
     */
    execute(context: any, thought: any): Promise<{
        planId: string;
        goal: any;
        steps: any;
        rollback: any;
        emotionalContext: any;
        needsApproval: boolean;
        createdAt: string;
    } | null>;
    /**
     * Normalize plan steps
     */
    normalizeSteps(steps: any): any;
    /**
     * Save plan to mind directory
     */
    savePlan(plan: any): Promise<void>;
}
//# sourceMappingURL=plan.d.ts.map