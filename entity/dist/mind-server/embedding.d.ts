/**
 * Embedding Service
 *
 * Model-agnostic embedding wrapper supporting OpenAI and local providers.
 * Uses raw fetch() for maximum flexibility - no SDK dependencies.
 */
export declare class EmbeddingService {
    apiKey: any;
    baseUrl: any;
    batchSize: any;
    dimensions: any;
    enabled: any;
    model: any;
    provider: any;
    retryAttempts: any;
    retryDelayMs: any;
    timeoutMs: any;
    constructor(config: any);
    /**
     * Check if embedding service is enabled and configured
     */
    isEnabled(): boolean;
    /**
     * Get dimensions for the current model
     */
    getDimensions(): any;
    /**
     * Get the model name
     */
    getModel(): any;
    /**
     * Embed a single text
     */
    embed(text: any): Promise<any>;
    /**
     * Embed multiple texts in a batch
     */
    embedBatch(texts: any): Promise<any[]>;
    /**
     * Retry wrapper with exponential backoff
     */
    embedWithRetry(texts: any): Promise<any>;
    /**
     * OpenAI Embeddings API
     */
    embedOpenAI(texts: any): Promise<any>;
    /**
     * Local sentence-transformers server
     * Expects POST /embed with { texts: [...], model: "..." }
     * Returns { embeddings: [[...], [...]] }
     */
    embedLocal(texts: any): Promise<any>;
    /**
     * Handle API errors
     */
    handleError(response: any): Promise<void>;
    /**
     * Convert Float32Array to Buffer for sqlite-vec BLOB storage
     */
    toBlob(embedding: any): Buffer<any> | null;
    /**
     * Convert Buffer from sqlite-vec back to Float32Array
     */
    fromBlob(buffer: any): Float32Array<any> | null;
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a: any, b: any): number;
    /**
     * Sleep helper
     */
    sleep(ms: any): Promise<unknown>;
}
//# sourceMappingURL=embedding.d.ts.map