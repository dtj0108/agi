/**
 * LLM Wrapper
 *
 * Model-agnostic LLM wrapper supporting both OpenAI and Anthropic API formats.
 * Uses raw fetch() for maximum flexibility - no SDK dependencies.
 */
export declare class LLM {
    api: any;
    apiKey: any;
    authManager: any;
    baseUrl: any;
    credentialSource: any;
    maxJsonRepairAttempts: any;
    maxTokens: any;
    model: any;
    promptCaching: any;
    retryAttempts: any;
    retryDelayMs: any;
    telemetry: any;
    temperature: any;
    timeoutMs: any;
    tokenUsagePath: any;
    validatorCache: any;
    constructor(config: any);
    /**
     * Main completion method - routes to appropriate API
     */
    complete(systemPrompt: any, messages: any, options?: any): Promise<any>;
    /**
     * Retry wrapper with exponential backoff
     */
    completeWithRetry(fn: any): Promise<any>;
    /**
     * OpenAI Chat Completions format
     */
    completeOpenAI(systemPrompt: any, messages: any, options: any): Promise<any>;
    completeOpenAIRequest(body: any, { allowRefreshRetry }?: any): Promise<any>;
    resolveOpenAICredential(): Promise<any>;
    /**
     * Anthropic Messages format with optional prompt caching
     */
    completeAnthropic(systemPrompt: any, messages: any, options: any): Promise<{
        text: any;
        usage: {
            inputTokens: any;
            outputTokens: any;
            cachedTokens: any;
        };
    }>;
    /**
     * Complete and parse JSON response
     */
    completeJSON(systemPrompt: any, messages: any, schema: any, options?: any): Promise<any>;
    /**
     * Compile and cache schema validators
     */
    getValidator(schema: any): any;
    /**
     * Format validation errors for prompts and telemetry
     */
    formatValidationErrors(errors?: any): any;
    /**
     * Build repair instruction for invalid JSON/schema attempts
     */
    buildRepairInstruction(reason: any): string;
    /**
     * Parse JSON from LLM response, handling markdown fences
     */
    parseJSON(text: any): any;
    /**
     * Handle API errors
     */
    handleError(response: any): Promise<void>;
    /**
     * Flatten content blocks to string (for OpenAI format)
     */
    flattenSystemPrompt(prompt: any): any;
    /**
     * Append instruction to system prompt (handles both formats)
     */
    appendToSystemPrompt(prompt: any, instruction: any): string | any[];
    /**
     * Log token usage
     */
    logUsage(phase: any, usage: any, model: any, latencyMs: any): Promise<void>;
    /**
     * Sleep helper
     */
    sleep(ms: any): Promise<unknown>;
}
//# sourceMappingURL=llm.d.ts.map