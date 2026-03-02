/**
 * Update Phase
 *
 * Phase 7 of the cognitive loop.
 * Updates mind files based on cycle results.
 */
export declare class UpdatePhase {
    approvalHandler: any;
    circuitBreakerCycles: any;
    circuitBreakerThreshold: any;
    config: any;
    decayRate: any;
    highIntensityCycles: any;
    mindPath: any;
    mindServer: any;
    momentumFactor: any;
    skillAuthor: any;
    constructor(mindPath: any, config: any, mindServer?: any, approvalHandler?: any);
    /**
     * Execute the update phase
     */
    execute(context: any, thought: any, reflection: any, observations: any): Promise<{
        filesUpdated: any[];
        emotionalStateAfter: {
            primary: any;
            intensity: number;
            secondary: any;
            secondaryIntensity: number;
            momentum: string;
            source: string;
            influences: {
                communication: string;
                goals: string;
                reflection: string;
                actions: string;
            };
            lastUpdated: string;
        };
        newMemoryPath: string;
        skillsUpdated: any[];
    }>;
    /**
     * Update emotional state with momentum
     */
    updateEmotionalState(currentState: any, thinkShift: any, reflectUpdate: any): {
        primary: any;
        intensity: number;
        secondary: any;
        secondaryIntensity: number;
        momentum: string;
        source: string;
        influences: {
            communication: string;
            goals: string;
            reflection: string;
            actions: string;
        };
        lastUpdated: string;
    };
    /**
     * Calculate emotional momentum direction
     */
    calculateMomentum(oldIntensity: any, newIntensity: any): "stable" | "increasing" | "decreasing";
    /**
     * Calculate how emotions influence behavior
     */
    calculateInfluences(emotion: any, intensity: any): {
        communication: string;
        goals: string;
        reflection: string;
        actions: string;
    };
    /**
     * Save emotional state to file
     */
    saveEmotionalState(state: any): Promise<void>;
    /**
     * Create an episodic memory entry
     */
    createEpisodicMemory(timestamp: any, thought: any, reflection: any, observations: any): Promise<string>;
    /**
     * Update goals with progress
     */
    updateGoals(goalUpdate: any): Promise<void>;
    /**
     * Save a learned skill
     */
    saveSkill(skill: any): Promise<string>;
    /**
     * Update capabilities with new skill
     */
    updateCapabilities(skill: any): Promise<void>;
    /**
     * Handle self-authored skill creation (Tier 4)
     * Generates, validates, and requests approval for new skills
     */
    handleSkillAuthoring(skillAuthored: any): Promise<any>;
    /**
     * Request user approval for a self-authored skill
     */
    requestSkillApproval(skillData: any): Promise<any>;
    /**
     * Update world context with observations
     */
    updateWorldContext(observations: any): Promise<void>;
    /**
     * Update preferences file after config change
     */
    updatePreferences(observations: any): Promise<void>;
}
//# sourceMappingURL=update.d.ts.map