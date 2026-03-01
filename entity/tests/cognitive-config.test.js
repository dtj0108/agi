/**
 * Cognitive Runtime Config Validation Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CognitiveEngine } from '../src/cognitive-engine/index.js';

function createEngine() {
  const config = {
    mind: {
      path: '/tmp/entity-test-mind',
    },
    llm: {
      api: 'openai-completions',
      baseUrl: 'http://localhost',
      apiKey: 'test-key',
      model: 'test-model',
      maxTokens: 4096,
      temperature: 0.7,
      retryAttempts: 3,
      retryDelayMs: 1,
      timeoutMs: 100,
      promptCaching: false,
    },
    cognitive: {
      reflectionInterval: 10,
      emotionalDecayRate: 0.1,
      emotionalMomentum: 0.3,
      circuitBreakerThreshold: 0.95,
      circuitBreakerCycles: 5,
    },
    actions: {
      approvalTimeout: 1000,
    },
    security: {},
  };

  const actionGateway = {
    classifyTier: () => 1,
    executeAction: async () => ({ success: true }),
  };

  return new CognitiveEngine(config, actionGateway, null);
}

describe('CognitiveEngine.updateCognitiveConfig', () => {
  it('rejects invalid numeric values without mutating runtime config', () => {
    const engine = createEngine();

    const initial = engine.getCognitiveConfig();

    const invalidTemp = engine.updateCognitiveConfig('temperature', 'not-a-number');
    assert.strictEqual(invalidTemp.success, false);

    const invalidTokens = engine.updateCognitiveConfig('maxTokens', '');
    assert.strictEqual(invalidTokens.success, false);

    const invalidRetries = engine.updateCognitiveConfig('retryAttempts', 'NaN');
    assert.strictEqual(invalidRetries.success, false);

    const after = engine.getCognitiveConfig();
    assert.deepStrictEqual(after, initial);
  });

  it('accepts valid numeric updates and clamps to safe ranges', () => {
    const engine = createEngine();

    const temp = engine.updateCognitiveConfig('temperature', 1.5);
    assert.deepStrictEqual(temp, { success: true, temperature: 1 });

    const tokens = engine.updateCognitiveConfig('maxTokens', 999999);
    assert.deepStrictEqual(tokens, { success: true, maxTokens: 32000 });

    const retries = engine.updateCognitiveConfig('retryAttempts', 11);
    assert.deepStrictEqual(retries, { success: true, retryAttempts: 10 });

    const interval = engine.updateCognitiveConfig('reflectionInterval', 7.9);
    assert.deepStrictEqual(interval, { success: true, reflectionInterval: 7 });
  });
});
