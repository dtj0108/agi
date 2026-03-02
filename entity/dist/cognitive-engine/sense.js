/**
 * Sense Phase
 *
 * Phase 5 of the cognitive loop.
 * Structures raw results into observations.
 */
export class SensePhase {
    config;
    maxOutputLength;
    constructor(config) {
        this.config = config;
        this.maxOutputLength = 1000;
    }
    /**
     * Execute the sense phase
     */
    execute(actResults) {
        // If no results, return empty observations
        if (!actResults || !actResults.results) {
            return [];
        }
        // Transform each result into an observation
        return actResults.results.map((result) => this.structureResult(result));
    }
    /**
     * Structure a single result into an observation
     */
    structureResult(result) {
        const observation = {
            tool: result.tool,
            action: result.action,
            intent: result.intent || result.action,
            success: result.success,
            output: this.summarizeOutput(result.output),
            duration_ms: result.duration,
            error: result.error || null,
            params: result.params || null,
            result: result.rawResult || null,
            metadata: {},
        };
        // Add tool-specific metadata
        switch (result.tool) {
            case 'shell':
                observation.metadata = {
                    exitCode: result.exitCode,
                    stdout: this.truncate(result.output, 2000),
                    stderr: result.stderr ? this.truncate(result.stderr, 500) : null,
                };
                break;
            case 'browser':
                observation.metadata = {
                    url: result.url,
                    domSummary: result.domSummary,
                    screenshotPath: result.screenshotPath,
                    elementCount: result.elementCount,
                };
                break;
            case 'file':
                observation.metadata = {
                    path: result.path,
                    size: result.size || result.bytesWritten,
                    operation: result.action,
                };
                break;
        }
        return observation;
    }
    /**
     * Summarize output, truncating if too long
     */
    summarizeOutput(output) {
        if (!output)
            return null;
        const str = String(output);
        if (str.length <= this.maxOutputLength) {
            return str;
        }
        // Take first 500 chars, last 200 chars, with truncation marker
        const first = str.slice(0, 500);
        const last = str.slice(-200);
        const truncated = str.length - 700;
        return `${first}\n... [truncated ${truncated} chars] ...\n${last}`;
    }
    /**
     * Truncate string to max length
     */
    truncate(str, maxLength) {
        if (!str)
            return null;
        if (str.length <= maxLength)
            return str;
        return str.slice(0, maxLength) + '...';
    }
}
//# sourceMappingURL=sense.js.map