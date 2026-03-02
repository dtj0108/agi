/**
 * Reflect Phase
 *
 * Phase 6 of the cognitive loop.
 * Evaluates what happened and generates reflection.
 */
export declare class ReflectPhase {
    fallbackFactory: any;
    llm: any;
    mindPath: any;
    promptBuilder: any;
    constructor(llm: any, promptBuilder: any, mindPath: any, options?: any);
    /**
     * Execute the reflect phase
     */
    execute(context: any, thought: any, plan: any, observations: any): Promise<{
        reflection: any;
        emotionalUpdate: {
            primary: {
                emotion: any;
                delta: number;
            };
            secondary: {
                emotion: any;
                delta: number;
            } | null;
        };
        goalUpdate: any;
        skillLearned: any;
        skillAuthored: any;
        valueAlignment: number;
        lessonsLearned: any;
    }>;
    /**
     * Normalize emotional update values
     */
    normalizeEmotionalUpdate(update: any): {
        primary: {
            emotion: any;
            delta: number;
        };
        secondary: {
            emotion: any;
            delta: number;
        } | null;
    };
    /**
     * Clamp a value to a range
     */
    clampValue(value: any, min: any, max: any): number;
    /**
     * Save reflection to mind directory
     */
    saveReflection(reflection: any, thought: any, plan: any, observations: any): Promise<void>;
}
//# sourceMappingURL=reflect.d.ts.map