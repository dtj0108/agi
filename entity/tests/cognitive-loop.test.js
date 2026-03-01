/**
 * Cognitive Loop Tests
 *
 * Note: These tests require the mind directory to exist.
 * Run `npm run init-mind` before running these tests.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Cognitive Loop', () => {
  before(() => {
    // Check if mind directory exists
    const mindPath = join(projectRoot, 'mind');
    if (!existsSync(mindPath)) {
      console.log('Skipping cognitive loop tests - mind directory not initialized');
      console.log('Run "npm run init-mind" to enable these tests');
    }
  });

  describe('OrientPhase', () => {
    it('can be imported', async () => {
      const { OrientPhase } = await import('../src/cognitive-engine/orient.js');
      assert.ok(OrientPhase);
    });
  });

  describe('ThinkPhase', () => {
    it('can be imported', async () => {
      const { ThinkPhase } = await import('../src/cognitive-engine/think.js');
      assert.ok(ThinkPhase);
    });
  });

  describe('PlanPhase', () => {
    it('can be imported', async () => {
      const { PlanPhase } = await import('../src/cognitive-engine/plan.js');
      assert.ok(PlanPhase);
    });
  });

  describe('ActPhase', () => {
    it('can be imported', async () => {
      const { ActPhase } = await import('../src/cognitive-engine/act.js');
      assert.ok(ActPhase);
    });
  });

  describe('SensePhase', () => {
    it('can be imported', async () => {
      const { SensePhase } = await import('../src/cognitive-engine/sense.js');
      assert.ok(SensePhase);
    });

    it('structures results correctly', async () => {
      const { SensePhase } = await import('../src/cognitive-engine/sense.js');
      const sense = new SensePhase({});

      const observations = sense.execute({
        results: [
          {
            tool: 'shell',
            action: 'ls',
            success: true,
            output: 'file1.txt\nfile2.txt',
            duration: 100,
            exitCode: 0,
          },
        ],
      });

      assert.strictEqual(observations.length, 1);
      assert.strictEqual(observations[0].tool, 'shell');
      assert.strictEqual(observations[0].success, true);
    });
  });

  describe('ReflectPhase', () => {
    it('can be imported', async () => {
      const { ReflectPhase } = await import('../src/cognitive-engine/reflect.js');
      assert.ok(ReflectPhase);
    });
  });

  describe('UpdatePhase', () => {
    it('can be imported', async () => {
      const { UpdatePhase } = await import('../src/cognitive-engine/update.js');
      assert.ok(UpdatePhase);
    });

    it('calculates emotional momentum correctly', async () => {
      const { UpdatePhase } = await import('../src/cognitive-engine/update.js');

      const mindPath = join(projectRoot, 'mind');
      const update = new UpdatePhase(mindPath, {
        cognitive: {
          emotionalDecayRate: 0.1,
          emotionalMomentum: 0.3,
        },
      });

      const currentState = {
        primary: 'curiosity',
        intensity: 0.5,
        secondary: null,
        secondaryIntensity: 0,
      };

      // Provide both think and reflect shifts to get a positive delta
      const thinkShift = {
        primary: { emotion: 'excitement', delta: 0.5 },
        secondary: null,
      };

      const reflectUpdate = {
        primary: { emotion: 'excitement', delta: 0.5 },
        secondary: null,
      };

      const newState = update.updateEmotionalState(currentState, thinkShift, reflectUpdate);

      // Formula: new = old * (1 - decay) + avgDelta * momentum
      // new = 0.5 * 0.9 + 0.5 * 0.3 = 0.45 + 0.15 = 0.6
      assert.ok(newState.intensity > currentState.intensity);
      assert.ok(newState.intensity <= 1.0);
      assert.ok(newState.intensity >= 0.0);
      assert.strictEqual(newState.primary, 'excitement');
    });
  });

  describe('CognitiveEngine', () => {
    it('can be imported', async () => {
      const { CognitiveEngine } = await import('../src/cognitive-engine/index.js');
      assert.ok(CognitiveEngine);
    });
  });

  describe('LLM', () => {
    it('can be imported', async () => {
      const { LLM } = await import('../src/cognitive-engine/llm.js');
      assert.ok(LLM);
    });

    it('flattens system prompts correctly', async () => {
      const { LLM } = await import('../src/cognitive-engine/llm.js');
      const llm = new LLM({
        llm: {
          api: 'openai-completions',
          baseUrl: 'http://localhost',
          apiKey: 'test',
          model: 'test',
        },
        security: {},
      });

      const flat = llm.flattenSystemPrompt([
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2' },
      ]);

      assert.strictEqual(flat, 'Part 1\n\nPart 2');
    });

    it('parses JSON with markdown fences', async () => {
      const { LLM } = await import('../src/cognitive-engine/llm.js');
      const llm = new LLM({
        llm: {
          api: 'openai-completions',
          baseUrl: 'http://localhost',
          apiKey: 'test',
          model: 'test',
        },
        security: {},
      });

      const result = llm.parseJSON('```json\n{"test": true}\n```');
      assert.deepStrictEqual(result, { test: true });
    });
  });
});
