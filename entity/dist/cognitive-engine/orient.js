/**
 * Orient Phase
 *
 * Phase 1 of the cognitive loop.
 * Reads mind files and assembles self-awareness context.
 */
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
export class OrientPhase {
    config;
    maxRelevantMemories;
    maxThoughtsInContext;
    mindPath;
    mindServer;
    constructor(mindPath, config, mindServer = null) {
        this.mindPath = mindPath;
        this.config = config;
        this.mindServer = mindServer;
        this.maxThoughtsInContext = config.cognitive?.maxThoughtsInContext || 20;
        this.maxRelevantMemories = config.cognitive?.maxRelevantMemories || 5;
    }
    /**
     * Execute the orient phase
     */
    async execute(cycleNumber = 0, stimulus = null) {
        // Read all context files in parallel
        const [identity, values, voice, emotionsRaw, goals, worldContext, toolbox, thoughtStreamRaw, preferences,] = await Promise.all([
            this.readMindFile('identity/self.md'),
            this.readMindFile('identity/values.md'),
            this.readMindFile('identity/voice.md'),
            this.readMindFile('emotions/state.json'),
            this.readMindFile('goals/active.md'),
            this.readMindFile('world/context.md'),
            this.readMindFile('actions/toolbox.md'),
            this.readMindFile('thoughts/stream.md'),
            this.readMindFile('self/preferences.md'),
        ]);
        // Retrieve semantically relevant memories based on stimulus
        let relevantMemories = [];
        if (stimulus && this.mindServer?.hasEmbeddings()) {
            relevantMemories = await this.retrieveRelevantMemories(stimulus);
        }
        // Parse emotions JSON
        let emotions;
        try {
            emotions = JSON.parse(emotionsRaw);
        }
        catch {
            emotions = {
                primary: 'neutral',
                intensity: 0.5,
                secondary: null,
                secondaryIntensity: 0,
                momentum: 'stable',
                source: 'parse error - using defaults',
            };
        }
        // Parse thought stream into recent entries
        const recentThoughts = this.parseThoughtStream(thoughtStreamRaw);
        // Update world context with current timestamp
        await this.updateWorldContext();
        return {
            identity,
            values,
            voice,
            emotions,
            goals,
            worldContext,
            toolbox,
            preferences,
            recentThoughts,
            relevantMemories,
            timestamp: new Date().toISOString(),
            cycleNumber,
        };
    }
    /**
     * Read a mind file, returning empty string if not found
     */
    async readMindFile(relativePath) {
        try {
            const fullPath = join(this.mindPath, relativePath);
            return await readFile(fullPath, 'utf-8');
        }
        catch {
            return '';
        }
    }
    /**
     * Parse thought stream into array of recent entries
     */
    parseThoughtStream(content) {
        if (!content)
            return [];
        // Split on separator (---)
        const entries = content
            .split(/^---$/m)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
        // Return last N entries
        return entries.slice(-this.maxThoughtsInContext);
    }
    /**
     * Update world context with current timestamp
     */
    async updateWorldContext() {
        const contextPath = join(this.mindPath, 'world/context.md');
        try {
            let content = await readFile(contextPath, 'utf-8');
            // Update the timestamp in the context
            const now = new Date().toISOString();
            content = content.replace(/Last updated:.*$/m, `Last updated: ${now}`);
            await writeFile(contextPath, content);
        }
        catch {
            // If file doesn't exist or can't be updated, that's okay
        }
    }
    /**
     * Retrieve semantically relevant memories based on stimulus
     */
    async retrieveRelevantMemories(stimulus) {
        if (!this.mindServer)
            return [];
        // Extract query text from stimulus
        let query = '';
        if (typeof stimulus === 'string') {
            query = stimulus;
        }
        else if (stimulus.content) {
            query = stimulus.content;
        }
        else if (stimulus.text) {
            query = stimulus.text;
        }
        else if (stimulus.message) {
            query = stimulus.message;
        }
        if (!query || query.length < 3)
            return [];
        try {
            // Use hybrid search for best results
            const searchResult = await this.mindServer.hybridSearchMind(query, {
                limit: this.maxRelevantMemories * 2,
                vectorWeight: 0.7,
                ftsWeight: 0.3,
            });
            // Filter to only episodic memories and limit
            const memories = searchResult.results
                .filter((r) => r.path.startsWith('memory/episodic/'))
                .slice(0, this.maxRelevantMemories)
                .map((r) => ({
                path: r.path,
                content: r.content || r.snippet || '',
                relevance: r.combinedScore || r.vectorScore || 0,
            }));
            return memories;
        }
        catch (error) {
            console.warn('Failed to retrieve relevant memories:', error.message);
            return [];
        }
    }
}
//# sourceMappingURL=orient.js.map