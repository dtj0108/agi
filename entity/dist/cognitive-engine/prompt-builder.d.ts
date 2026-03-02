/**
 * Prompt Builder
 *
 * Assembles the full prompt from mind files with caching support.
 * Handles phase-specific instructions and prompt structure.
 */
export declare class PromptBuilder {
    config: any;
    promptCaching: any;
    skillsExecutor: any;
    constructor(config: any, skillsExecutor?: any);
    /**
     * Set the skills executor (can be set after construction)
     */
    setSkillsExecutor(executor: any): void;
    /**
     * Get skills context for LLM prompts
     */
    getSkillsContext(): string;
    /**
     * Build the system prompt for a cognitive phase
     */
    buildSystemPrompt(context: any, phase: any): string | ({
        type: string;
        text: string;
        cache_control: {
            type: string;
        };
    } | {
        type: string;
        text: string;
        cache_control?: undefined;
    })[];
    /**
     * Build a flat string prompt (for OpenAI format)
     */
    buildFlatPrompt(context: any, phase: any): string;
    /**
     * Build a prompt with cache_control blocks (for Anthropic format)
     */
    buildCachedPrompt(context: any, phase: any): ({
        type: string;
        text: string;
        cache_control: {
            type: string;
        };
    } | {
        type: string;
        text: string;
        cache_control?: undefined;
    })[];
    /**
     * Build message array for LLM
     */
    buildMessages(stimulus: any): {
        role: string;
        content: string;
    }[];
    /**
     * Build messages for plan phase
     */
    buildPlanMessages(thought: any): {
        role: string;
        content: string;
    }[];
    /**
     * Build messages for reflect phase
     */
    buildReflectMessages(thought: any, plan: any, observations: any): {
        role: string;
        content: string;
    }[];
    /**
     * Get phase instructions
     */
    getPhaseInstructions(phase: any): string;
}
//# sourceMappingURL=prompt-builder.d.ts.map