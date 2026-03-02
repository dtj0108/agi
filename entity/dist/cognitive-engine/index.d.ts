/**
 * Cognitive Engine
 *
 * Orchestrates the 7-phase cognitive loop.
 * This is the entity's consciousness.
 */
import { EventEmitter } from 'events';
export declare class CognitiveEngine extends EventEmitter {
    act: any;
    actionGateway: any;
    config: any;
    currentPhase: any;
    cycleCount: any;
    cycleQueue: any;
    lastEmotionalState: any;
    lastThoughts: any;
    llm: any;
    mindPath: any;
    mindServer: any;
    orient: any;
    paused: any;
    phaseErrors: any;
    plan: any;
    promptBuilder: any;
    reflect: any;
    safeMode: any;
    sense: any;
    skillsExecutor: any;
    telemetry: any;
    think: any;
    update: any;
    constructor(config: any, actionGateway: any, mindServer: any, skillsExecutor?: any);
    /**
     * Route self-authored skill approval through ActionGateway pending approvals.
     */
    requestSkillAuthorApproval(skillApprovalPayload: any): Promise<{
        approved: boolean;
        approvalId: null;
        approved_by: string;
        reason?: undefined;
    } | {
        approved: boolean;
        approvalId: string;
        approved_by?: undefined;
        reason?: undefined;
    } | {
        approved: boolean;
        approvalId: string;
        reason: any;
        approved_by?: undefined;
    }>;
    /**
     * Initialize the cognitive engine
     */
    initialize(): Promise<void>;
    /**
     * Run one complete cognitive cycle
     */
    runCycle(stimulus: any): Promise<any>;
    /**
     * Internal cycle implementation (serialized by runCycle queue)
     */
    runCycleInternal(stimulus: any): Promise<{
        cycleId: string;
        stimulus: any;
        phases: Record<string, any>;
        userResponse: any;
        thoughts: any;
        emotionalState: any;
        thoughtsGenerated: number;
        actionsExecuted: any;
        totalDuration: number;
        errors: any[];
    }>;
    /**
     * Handle a phase error
     */
    handlePhaseError(phase: any, error: any, stimulus: any): Promise<void>;
    /**
     * Enter safe mode due to repeated failures
     */
    enterSafeMode(phase: any, error: any): Promise<void>;
    /**
     * Trigger a deeper self-reflection cycle
     */
    triggerDeepReflection(): Promise<void>;
    /**
     * Append to thought stream
     */
    appendToThoughtStream(content: any): Promise<void>;
    /**
     * Log an error to audit log
     */
    logError(phase: any, error: any): Promise<void>;
    /**
     * Get minimal context when orient fails
     */
    getMinimalContext(): {
        identity: string;
        values: string;
        voice: string;
        emotions: any;
        goals: string;
        worldContext: string;
        toolbox: string;
        recentThoughts: any;
        relevantMemories: never[];
        timestamp: string;
        cycleNumber: any;
    };
    /**
     * Get default thought when think fails
     */
    getDefaultThought(): {
        thoughts: string;
        needsAction: boolean;
        userResponse: null;
        emotionalShift: {
            primary: {
                emotion: string;
                delta: number;
            };
            secondary: null;
        };
        actionIntent: null;
    };
    /**
     * Default fallback returned when think schema validation cannot be recovered
     */
    createThinkFallback(context: any, stimulus: any): {
        thoughts: string;
        needsAction: boolean;
        userResponse: null;
        emotionalShift: {
            primary: {
                emotion: string;
                delta: number;
            };
            secondary: null;
        };
        actionIntent: null;
    };
    /**
     * Default fallback returned when plan schema validation cannot be recovered
     */
    createPlanFallback(context: any, thought: any): {
        goal: any;
        steps: never[];
        rollback: null;
        emotionalContext: string;
    };
    /**
     * Default fallback returned when reflect schema validation cannot be recovered
     */
    createReflectFallback(context: any, thought: any, plan: any, observations: any): {
        reflection: string;
        emotionalUpdate: {
            primary: {
                emotion: string;
                delta: number;
            };
            secondary: null;
        };
        goalUpdate: null;
        skillLearned: null;
        valueAlignment: number;
        lessonsLearned: never[];
    };
    /**
     * Get current status
     */
    getStatus(): Promise<{
        cycleCount: any;
        currentPhase: any;
        paused: any;
        safeMode: any;
        emotions: any;
        goalCount: number;
    }>;
    /**
     * Get recent thoughts
     */
    getRecentThoughts(limit?: any): Promise<any>;
    /**
     * Get current state
     */
    getState(): {
        cycleCount: any;
        emotions: any;
        paused: any;
        safeMode: any;
    };
    /**
     * Save state (for shutdown)
     */
    saveState(): Promise<void>;
    /**
     * Write a thought (for shutdown message)
     */
    writeThought(content: any): Promise<void>;
    /**
     * Pause the cognitive engine
     */
    pause(): void;
    /**
     * Resume the cognitive engine
     */
    resume(): void;
    /**
     * Check if paused
     */
    isPaused(): any;
    /**
     * Get cycle count
     */
    getCycleCount(): any;
    /**
     * Get current phase
     */
    getCurrentPhase(): any;
    /**
     * Approve a pending action
     */
    approve(actionId: any): any;
    /**
     * Deny a pending action
     */
    deny(actionId: any): any;
    /**
     * Update cognitive configuration at runtime
     */
    updateCognitiveConfig(key: any, value: any): {
        success: boolean;
        error: string;
        temperature?: undefined;
        emotionalDecayRate?: undefined;
        emotionalMomentum?: undefined;
        reflectionInterval?: undefined;
        maxTokens?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        temperature: number | undefined;
        error?: undefined;
        emotionalDecayRate?: undefined;
        emotionalMomentum?: undefined;
        reflectionInterval?: undefined;
        maxTokens?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        emotionalDecayRate: number | undefined;
        error?: undefined;
        temperature?: undefined;
        emotionalMomentum?: undefined;
        reflectionInterval?: undefined;
        maxTokens?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        emotionalMomentum: number | undefined;
        error?: undefined;
        temperature?: undefined;
        emotionalDecayRate?: undefined;
        reflectionInterval?: undefined;
        maxTokens?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        reflectionInterval: number | undefined;
        error?: undefined;
        temperature?: undefined;
        emotionalDecayRate?: undefined;
        emotionalMomentum?: undefined;
        maxTokens?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        maxTokens: number | undefined;
        error?: undefined;
        temperature?: undefined;
        emotionalDecayRate?: undefined;
        emotionalMomentum?: undefined;
        reflectionInterval?: undefined;
        retryAttempts?: undefined;
    } | {
        success: boolean;
        retryAttempts: number | undefined;
        error?: undefined;
        temperature?: undefined;
        emotionalDecayRate?: undefined;
        emotionalMomentum?: undefined;
        reflectionInterval?: undefined;
        maxTokens?: undefined;
    };
    /**
     * Get current cognitive configuration
     */
    getCognitiveConfig(): {
        temperature: any;
        emotionalDecayRate: any;
        emotionalMomentum: any;
        reflectionInterval: any;
        maxTokens: any;
        retryAttempts: any;
    };
}
//# sourceMappingURL=index.d.ts.map