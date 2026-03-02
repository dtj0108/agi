/**
 * Cognitive engine cycle serialization tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CognitiveEngine } from '../src/cognitive-engine/index.js';

function sleep(ms: any) {
  return new Promise((resolve: any) => setTimeout(resolve, ms));
}

describe('CognitiveEngine.runCycle queue', () => {
  it('serializes concurrent runCycle calls without overlap', async () => {
    const engine = Object.create(CognitiveEngine.prototype);
    engine.cycleQueue = Promise.resolve();

    let active = 0;
    let maxActive = 0;
    const order: any[] = [];

    engine.runCycleInternal = async (stimulus: any) => {
      const id = stimulus.id;
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`start-${id}`);
      await sleep(20);
      order.push(`end-${id}`);
      active -= 1;
      return { id };
    };

    const [a, b, c] = await Promise.all([
      engine.runCycle({ id: 1 }),
      engine.runCycle({ id: 2 }),
      engine.runCycle({ id: 3 }),
    ]);

    assert.deepStrictEqual([a.id, b.id, c.id], [1, 2, 3]);
    assert.strictEqual(maxActive, 1);
    assert.deepStrictEqual(order, [
      'start-1', 'end-1',
      'start-2', 'end-2',
      'start-3', 'end-3',
    ]);
  });
});

