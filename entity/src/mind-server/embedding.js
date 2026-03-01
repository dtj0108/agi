/**
 * Embedding Service
 *
 * Model-agnostic embedding wrapper supporting OpenAI and local providers.
 * Uses raw fetch() for maximum flexibility - no SDK dependencies.
 */

export class EmbeddingService {
  constructor(config) {
    this.enabled = config.embedding?.enabled || false;
    this.provider = config.embedding?.provider || 'openai';

    if (this.provider === 'openai') {
      this.baseUrl = config.embedding?.openai?.baseUrl || 'https://api.openai.com/v1';
      this.apiKey = config.embedding?.openai?.apiKey || '';
      this.model = config.embedding?.openai?.model || 'text-embedding-3-small';
      this.dimensions = config.embedding?.openai?.dimensions || 1536;
      this.batchSize = config.embedding?.openai?.batchSize || 100;
    } else {
      this.baseUrl = config.embedding?.local?.serverUrl || 'http://localhost:8080';
      this.model = config.embedding?.local?.model || 'all-MiniLM-L6-v2';
      this.dimensions = config.embedding?.local?.dimensions || 384;
      this.batchSize = config.embedding?.local?.batchSize || 32;
    }

    this.retryAttempts = 3;
    this.retryDelayMs = 1000;
    this.timeoutMs = 30000;
  }

  /**
   * Check if embedding service is enabled and configured
   */
  isEnabled() {
    if (!this.enabled) return false;
    if (this.provider === 'openai' && !this.apiKey) return false;
    return true;
  }

  /**
   * Get dimensions for the current model
   */
  getDimensions() {
    return this.dimensions;
  }

  /**
   * Get the model name
   */
  getModel() {
    return this.model;
  }

  /**
   * Embed a single text
   */
  async embed(text) {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0];
  }

  /**
   * Embed multiple texts in a batch
   */
  async embedBatch(texts) {
    if (!this.isEnabled()) {
      throw new Error('Embedding service is not enabled');
    }

    // Filter empty texts
    const validTexts = texts.filter(t => t && t.trim());
    if (validTexts.length === 0) {
      return [];
    }

    // Split into batches if needed
    const batches = [];
    for (let i = 0; i < validTexts.length; i += this.batchSize) {
      batches.push(validTexts.slice(i, i + this.batchSize));
    }

    const allEmbeddings = [];
    for (const batch of batches) {
      const embeddings = await this.embedWithRetry(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async embedWithRetry(texts) {
    let lastError;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        if (this.provider === 'openai') {
          return await this.embedOpenAI(texts);
        } else {
          return await this.embedLocal(texts);
        }
      } catch (error) {
        lastError = error;

        if (error.name === 'RateLimitError') {
          const delay = Math.pow(2, attempt) * (error.retryAfter || 1) * 1000;
          await this.sleep(delay);
          continue;
        }

        if (error.name === 'AuthError') {
          throw error;
        }

        await this.sleep(Math.pow(2, attempt) * this.retryDelayMs);
      }
    }

    throw lastError;
  }

  /**
   * OpenAI Embeddings API
   */
  async embedOpenAI(texts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleError(response);
      }

      const data = await response.json();

      // Sort by index to maintain order
      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => new Float32Array(item.embedding));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Local sentence-transformers server
   * Expects POST /embed with { texts: [...], model: "..." }
   * Returns { embeddings: [[...], [...]] }
   */
  async embedLocal(texts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts, model: this.model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Local embedding server error: ${response.status}`);
      }

      const data = await response.json();
      return data.embeddings.map(emb => new Float32Array(emb));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle API errors
   */
  async handleError(response) {
    const status = response.status;
    let body;
    try {
      body = await response.text();
    } catch {
      body = 'Unable to read response body';
    }

    if (status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
      const error = new Error(`Rate limited. Retry after ${retryAfter}s`);
      error.name = 'RateLimitError';
      error.retryAfter = retryAfter;
      throw error;
    }

    if (status === 401 || status === 403) {
      const error = new Error('Authentication failed. Check API key.');
      error.name = 'AuthError';
      throw error;
    }

    const error = new Error(`Embedding API error: ${status} - ${body}`);
    error.name = 'EmbeddingError';
    error.status = status;
    throw error;
  }

  /**
   * Convert Float32Array to Buffer for sqlite-vec BLOB storage
   */
  toBlob(embedding) {
    if (!embedding) return null;
    return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
  }

  /**
   * Convert Buffer from sqlite-vec back to Float32Array
   */
  fromBlob(buffer) {
    if (!buffer) return null;
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    return new Float32Array(arrayBuffer);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
