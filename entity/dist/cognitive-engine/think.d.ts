/**
 * Think Phase
 *
 * Phase 2 of the cognitive loop.
 * Processes stimulus and generates thoughts.
 */
export declare class ThinkPhase {
    fallbackFactory: any;
    llm: any;
    mindPath: any;
    promptBuilder: any;
    constructor(llm: any, promptBuilder: any, mindPath: any, options?: any);
    /**
     * Execute the think phase
     */
    execute(context: any, stimulus: any): Promise<{
        thoughts: any;
        needsAction: boolean;
        userResponse: any;
        emotionalShift: {
            primary: {
                emotion: any;
                delta: number;
            };
            secondary: {
                emotion: any;
                delta: number;
            } | null;
        };
        actionIntent: any;
    }>;
    /**
     * Normalize emotional shift values
     */
    normalizeEmotionalShift(shift: any): {
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
     * Clamp delta value to -1.0 to 1.0
     */
    clampDelta(delta: any): number;
    /**
     * Append an entry to the thought stream
     */
    appendToThoughtStream(thoughts: any, phase: any): Promise<void>;
}
//# sourceMappingURL=think.d.ts.map