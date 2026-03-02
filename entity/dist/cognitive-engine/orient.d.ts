/**
 * Orient Phase
 *
 * Phase 1 of the cognitive loop.
 * Reads mind files and assembles self-awareness context.
 */
export declare class OrientPhase {
    config: any;
    maxRelevantMemories: any;
    maxThoughtsInContext: any;
    mindPath: any;
    mindServer: any;
    constructor(mindPath: any, config: any, mindServer?: any);
    /**
     * Execute the orient phase
     */
    execute(cycleNumber?: any, stimulus?: any): Promise<{
        identity: string;
        values: string;
        voice: string;
        emotions: any;
        goals: string;
        worldContext: string;
        toolbox: string;
        preferences: string;
        recentThoughts: any;
        relevantMemories: any[];
        timestamp: string;
        cycleNumber: any;
    }>;
    /**
     * Read a mind file, returning empty string if not found
     */
    readMindFile(relativePath: any): Promise<string>;
    /**
     * Parse thought stream into array of recent entries
     */
    parseThoughtStream(content: any): any;
    /**
     * Update world context with current timestamp
     */
    updateWorldContext(): Promise<void>;
    /**
     * Retrieve semantically relevant memories based on stimulus
     */
    retrieveRelevantMemories(stimulus: any): Promise<any>;
}
//# sourceMappingURL=orient.d.ts.map