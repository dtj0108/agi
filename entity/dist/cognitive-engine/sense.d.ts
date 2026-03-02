/**
 * Sense Phase
 *
 * Phase 5 of the cognitive loop.
 * Structures raw results into observations.
 */
export declare class SensePhase {
    config: any;
    maxOutputLength: any;
    constructor(config: any);
    /**
     * Execute the sense phase
     */
    execute(actResults: any): any;
    /**
     * Structure a single result into an observation
     */
    structureResult(result: any): {
        tool: any;
        action: any;
        intent: any;
        success: any;
        output: string | null;
        duration_ms: any;
        error: any;
        params: any;
        result: any;
        metadata: {};
    };
    /**
     * Summarize output, truncating if too long
     */
    summarizeOutput(output: any): string | null;
    /**
     * Truncate string to max length
     */
    truncate(str: any, maxLength: any): any;
}
//# sourceMappingURL=sense.d.ts.map