/**
 * LLM schema validation and fallback tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LLM } from '../src/cognitive-engine/llm.js';
import { configureTelemetry } from '../src/observability/telemetry.js';

const SIMPLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: {
    answer: { type: 'string', minLength: 1 },
  },
};

function createConfig() {
  return {
    llm: {
      api: 'openai-completions',
      baseUrl: 'http://127.0.0.1:9',
      apiKey: 'test-key',
      model: 'test-model',
      maxTokens: 256,
      temperature: 0,
      retryAttempts: 1,
      retryDelayMs: 1,
      timeoutMs: 1000,
      maxJsonRepairAttempts: 1,
    },
    security: {
      tokenUsagePath: null,
    },
  };
}

describe('LLM.completeJSON', () => {
  it('returns parsed content and validation metadata for valid JSON/schema', async () => {
    configureTelemetry({ enabled: false });
    const llm = new LLM(createConfig());

    llm.complete = async () => ({
      text: JSON.stringify({ answer: 'ok' }),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    });

    const result = await llm.completeJSON('system', [], SIMPLE_SCHEMA, {
      phase: 'think',
      maxRepairAttempts: 0,
      fallbackFactory: () => ({ answer: 'fallback' }),
    });

    assert.strictEqual(result.parsed.answer, 'ok');
    assert.strictEqual(result.repairAttemptsUsed, 0);
    assert.strictEqual(result.fallbackUsed, false);
    assert.strictEqual(result.validation.valid, true);
  });

  it('attempts one repair after malformed JSON and succeeds', async () => {
    configureTelemetry({ enabled: false });
    const llm = new LLM(createConfig());
    const outputs = [
      '{invalid-json',
      JSON.stringify({ answer: 'fixed' }),
    ];

    llm.complete = async () => ({
      text: outputs.shift(),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    });

    const result = await llm.completeJSON('system', [], SIMPLE_SCHEMA, {
      phase: 'reflect',
      maxRepairAttempts: 1,
      fallbackFactory: () => ({ answer: 'fallback' }),
    });

    assert.strictEqual(result.parsed.answer, 'fixed');
    assert.strictEqual(result.repairAttemptsUsed, 1);
    assert.strictEqual(result.fallbackUsed, false);
  });

  it('uses deterministic fallback when schema stays invalid after attempts', async () => {
    configureTelemetry({ enabled: false });
    const llm = new LLM(createConfig());

    llm.complete = async () => ({
      text: JSON.stringify({ wrong: 'shape' }),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    });

    const result = await llm.completeJSON('system', [], SIMPLE_SCHEMA, {
      phase: 'plan',
      maxRepairAttempts: 0,
      fallbackFactory: () => ({ answer: 'fallback' }),
    });

    assert.strictEqual(result.parsed.answer, 'fallback');
    assert.strictEqual(result.fallbackUsed, true);
    assert.strictEqual(result.validation.source, 'fallback');
  });

  it('throws when fallback payload does not satisfy schema', async () => {
    configureTelemetry({ enabled: false });
    const llm = new LLM(createConfig());

    llm.complete = async () => ({
      text: JSON.stringify({ wrong: 'shape' }),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    });

    await assert.rejects(
      () => llm.completeJSON('system', [], SIMPLE_SCHEMA, {
        phase: 'plan',
        maxRepairAttempts: 0,
        fallbackFactory: () => ({ wrong: 'shape' }),
      }),
      /Fallback payload failed schema validation/
    );
  });
});

