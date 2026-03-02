/**
 * LLM Wrapper
 *
 * Model-agnostic LLM wrapper supporting both OpenAI and Anthropic API formats.
 * Uses raw fetch() for maximum flexibility - no SDK dependencies.
 */

import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getTelemetry } from '../observability/telemetry.js';
import { compileJsonSchema } from './json-schema-validator.js';
import { getAuthManager } from '../auth/index.js';

export class LLM {
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
  constructor(config: any) {
    this.api = config.llm.api;
    this.baseUrl = config.llm.baseUrl;
    this.apiKey = config.llm.apiKey;
    this.credentialSource = config.llm.credentialSource || 'auto';
    this.model = config.llm.model;
    this.maxTokens = config.llm.maxTokens || 8192;
    this.temperature = config.llm.temperature || 0.7;
    this.promptCaching = config.llm.promptCaching && config.llm.api === 'anthropic-messages';
    this.retryAttempts = config.llm.retryAttempts || 3;
    this.retryDelayMs = config.llm.retryDelayMs || 1000;
    this.timeoutMs = config.llm.timeoutMs || 120000;
    this.maxJsonRepairAttempts = config.llm.maxJsonRepairAttempts || 1;
    this.tokenUsagePath = config.security?.tokenUsagePath;
    this.telemetry = getTelemetry();
    this.validatorCache = new Map();
    this.authManager = getAuthManager(config);

    // Ensure token usage directory exists
    if (this.tokenUsagePath) {
      try {
        mkdirSync(dirname(this.tokenUsagePath), { recursive: true });
      } catch {
        this.telemetry.recordError('llm', new Error('Failed to create token usage directory'), {
          path: this.tokenUsagePath,
        });
      }
    }
  }

  /**
   * Main completion method - routes to appropriate API
   */
  async complete(systemPrompt: any, messages: any, options: any = {}) {
    const startTime = Date.now();
    const phase = options.phase || 'unknown';

    let result: any;
    if (this.api === 'openai-completions') {
      result = await this.completeWithRetry(
        () => this.completeOpenAI(systemPrompt, messages, options)
      );
    } else {
      result = await this.completeWithRetry(
        () => this.completeAnthropic(systemPrompt, messages, options)
      );
    }

    // Log token usage
    const latency = Date.now() - startTime;
    await this.logUsage(phase, result.usage, this.model, latency);
    this.telemetry.observeDuration('llm.complete.duration_ms', latency, { phase, api: this.api });
    this.telemetry.incrementCounter('llm.complete.total', 1, { phase, api: this.api });

    return result;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async completeWithRetry(fn: any) {
    let lastError: any;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        this.telemetry.incrementCounter('llm.complete.retry', 1, { error: error.name || 'Error' });

        if (error.name === 'RateLimitError') {
          const delay = Math.pow(2, attempt) * (error.retryAfter || 1) * 1000;
          await this.sleep(delay);
          continue;
        }

        if (error.name === 'AuthError') {
          this.telemetry.recordError('llm', error, { stage: 'auth' });
          throw error;
        }

        // For other errors, retry with exponential backoff
        await this.sleep(Math.pow(2, attempt) * this.retryDelayMs);
      }
    }

    if (lastError) {
      this.telemetry.recordError('llm', lastError, { stage: 'complete_with_retry_exhausted' });
    }
    throw lastError;
  }

  /**
   * OpenAI Chat Completions format
   */
  async completeOpenAI(systemPrompt: any, messages: any, options: any) {
    const flatSystemPrompt = this.flattenSystemPrompt(systemPrompt);

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: flatSystemPrompt },
        ...messages,
      ],
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature ?? this.temperature,
    };

    return this.completeOpenAIRequest(body, { allowRefreshRetry: true });
  }

  async completeOpenAIRequest(body: any, { allowRefreshRetry = true }: any = {}): Promise<any> {
    const credential = await this.resolveOpenAICredential();
    if (!credential?.token) {
      const error = new Error('OpenAI authentication missing. Configure an API key or run `entity login`.');
      error.name = 'AuthError';
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credential.token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isAuthError = response.status === 401 || response.status === 403;
        if (isAuthError && allowRefreshRetry && credential.source === 'oauth') {
          const refreshed = await this.authManager.refreshTokens({ force: true }).catch(() => null);
          if (refreshed?.accessToken) {
            return this.completeOpenAIRequest(body, { allowRefreshRetry: false });
          }
        }
        await this.handleError(response);
      }

      const data: any = await response.json();

      return {
        text: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          cachedTokens: 0,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async resolveOpenAICredential() {
    if (this.credentialSource === 'config') {
      return { token: this.apiKey, source: 'config' };
    }

    const resolved = await this.authManager.resolveOpenAICredential();
    if (resolved?.token) {
      return resolved;
    }

    // Preserve old behavior by defaulting back to configured API key in mixed setups.
    if (this.apiKey) {
      return { token: this.apiKey, source: 'config' };
    }

    return resolved;
  }

  /**
   * Anthropic Messages format with optional prompt caching
   */
  async completeAnthropic(systemPrompt: any, messages: any, options: any) {
    // systemPrompt can be a string or array of content blocks (for caching)
    const system = Array.isArray(systemPrompt)
      ? systemPrompt
      : [{ type: 'text', text: systemPrompt }];

    const body = {
      model: this.model,
      system,
      messages,
      max_tokens: options.maxTokens || this.maxTokens,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };

    // Enable prompt caching beta if configured
    if (this.promptCaching) {
      headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleError(response);
      }

      const data: any = await response.json();

      return {
        text: data.content[0].text,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          cachedTokens: data.usage?.cache_read_input_tokens || 0,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Complete and parse JSON response
   */
  async completeJSON(systemPrompt: any, messages: any, schema: any, options: any = {}) {
    const phase = options.phase || 'unknown';
    const maxRepairAttempts = Math.max(0, options.maxRepairAttempts ?? this.maxJsonRepairAttempts);
    const fallbackFactory = options.fallbackFactory;
    const validate = this.getValidator(schema);

    const jsonInstruction = `

Respond ONLY with a JSON object matching this JSON Schema:
${JSON.stringify(schema, null, 2)}

Do not include markdown code fences. Output raw JSON only.`;

    const basePrompt = this.appendToSystemPrompt(systemPrompt, jsonInstruction);
    let currentPrompt = basePrompt;
    let repairAttemptsUsed = 0;
    let lastResult = null;
    let lastFailureMessage = 'Unknown schema validation failure';

    for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
      const result = await this.complete(currentPrompt, messages, options);
      lastResult = result;

      let parsed: any;
      try {
        parsed = this.parseJSON(result.text);
      } catch (parseError: any) {
        lastFailureMessage = `Invalid JSON: ${parseError.message}`;
        this.telemetry.recordEvent('llm_schema_validation_failed', {
          phase,
          reason: 'parse_error',
          message: parseError.message,
        });

        if (attempt < maxRepairAttempts) {
          repairAttemptsUsed++;
          this.telemetry.recordEvent('llm_repair_attempt', { phase, attempt: repairAttemptsUsed });
          currentPrompt = this.appendToSystemPrompt(
            basePrompt,
            this.buildRepairInstruction(lastFailureMessage)
          );
          continue;
        }

        break;
      }

      const valid = validate(parsed);
      if (valid) {
        this.telemetry.incrementCounter('llm.schema.total', 1, { phase });
        this.telemetry.recordEvent('llm_schema_success', {
          phase,
          repairAttemptsUsed,
        });
        return {
          ...result,
          parsed,
          validation: { valid: true, errors: [] },
          repairAttemptsUsed,
          fallbackUsed: false,
        };
      }

      const errors = this.formatValidationErrors(validate.errors);
      lastFailureMessage = `Schema mismatch: ${errors.join('; ')}`;
      this.telemetry.recordEvent('llm_schema_validation_failed', {
        phase,
        reason: 'schema_mismatch',
        errors,
      });

      if (attempt < maxRepairAttempts) {
        repairAttemptsUsed++;
        this.telemetry.recordEvent('llm_repair_attempt', { phase, attempt: repairAttemptsUsed });
        currentPrompt = this.appendToSystemPrompt(
          basePrompt,
          this.buildRepairInstruction(lastFailureMessage)
        );
        continue;
      }
    }

    this.telemetry.incrementCounter('llm.schema.total', 1, { phase });
    this.telemetry.incrementCounter('llm.schema.fallback', 1, { phase });
    this.telemetry.recordEvent('llm_fallback_used', {
      phase,
      repairAttemptsUsed,
      reason: lastFailureMessage,
    });

    if (typeof fallbackFactory !== 'function') {
      throw new Error(`Failed to produce valid JSON for phase "${phase}": ${lastFailureMessage}`);
    }

    const fallback = fallbackFactory();
    const fallbackValid = validate(fallback);
    if (!fallbackValid) {
      const errors = this.formatValidationErrors(validate.errors);
      throw new Error(`Fallback payload failed schema validation for phase "${phase}": ${errors.join('; ')}`);
    }

    return {
      ...(lastResult || { text: '', usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 } }),
      text: JSON.stringify(fallback),
      parsed: fallback,
      validation: { valid: true, errors: [], source: 'fallback' },
      repairAttemptsUsed,
      fallbackUsed: true,
    };
  }

  /**
   * Compile and cache schema validators
   */
  getValidator(schema: any) {
    const key = JSON.stringify(schema);
    if (this.validatorCache.has(key)) {
      return this.validatorCache.get(key);
    }
    const validator = compileJsonSchema(schema);
    this.validatorCache.set(key, validator);
    return validator;
  }

  /**
   * Format validation errors for prompts and telemetry
   */
  formatValidationErrors(errors: any = []) {
    return errors.map((error: any) => `${error.instancePath || '/'} ${error.message}`.trim());
  }

  /**
   * Build repair instruction for invalid JSON/schema attempts
   */
  buildRepairInstruction(reason: any) {
    return `

CRITICAL: Your previous response was invalid.
Reason: ${reason}
Output ONLY a JSON object that fully matches the required schema.
Do not include commentary or markdown fences.`;
  }

  /**
   * Parse JSON from LLM response, handling markdown fences
   */
  parseJSON(text: any) {
    let jsonText = text.trim();

    // Remove markdown code fences if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText);
  }

  /**
   * Handle API errors
   */
  async handleError(response: any) {
    const status = response.status;
    let body: any;
    try {
      body = await response.text();
    } catch {
      body = 'Unable to read response body';
    }

    if (status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
      const error = new Error(`Rate limited. Retry after ${retryAfter}s`);
      error.name = 'RateLimitError';
      // @ts-expect-error TODO(ts-migration): TS(2339): Property 'retryAfter' does not exist on type 'Erro... Remove this comment to see the full error message
      error.retryAfter = retryAfter;
      throw error;
    }

    if (status === 401 || status === 403) {
      const error = new Error('Authentication failed. Check API key.');
      error.name = 'AuthError';
      throw error;
    }

    const error = new Error(`LLM API error: ${status} - ${body}`);
    error.name = 'LLMError';
    // @ts-expect-error TODO(ts-migration): TS(2339): Property 'status' does not exist on type 'Error'.
    error.status = status;
    this.telemetry.recordEvent('llm_api_error', { status });
    throw error;
  }

  /**
   * Flatten content blocks to string (for OpenAI format)
   */
  flattenSystemPrompt(prompt: any) {
    if (typeof prompt === 'string') return prompt;
    return prompt.map((block: any) => block.text).join('\n\n');
  }

  /**
   * Append instruction to system prompt (handles both formats)
   */
  appendToSystemPrompt(prompt: any, instruction: any) {
    if (typeof prompt === 'string') {
      return prompt + instruction;
    }
    // For array format, append to last block
    const lastIndex = prompt.length - 1;
    return [
      ...prompt.slice(0, lastIndex),
      { ...prompt[lastIndex], text: prompt[lastIndex].text + instruction },
    ];
  }

  /**
   * Log token usage
   */
  async logUsage(phase: any, usage: any, model: any, latencyMs: any) {
    if (!this.tokenUsagePath) return;

    const entry = {
      timestamp: new Date().toISOString(),
      phase,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      model,
      latency_ms: latencyMs,
    };

    try {
      appendFileSync(this.tokenUsagePath, JSON.stringify(entry) + '\n');
    } catch {
      this.telemetry.recordError('llm', new Error('Failed to write token usage log'), {
        phase,
      });
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms: any) {
    return new Promise((resolve: any) => setTimeout(resolve, ms));
  }
}
