/**
 * Heartbeat Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Heartbeat } from '../src/interface/heartbeat.js';

function createHeartbeat() {
  const cognitiveEngine = {
    runCycle: async () => ({ ok: true }),
  };

  const heartbeat = new Heartbeat(
    {
      heartbeat: {
        enabled: true,
        schedule: '*/5 * * * *',
        prompt: 'test prompt',
      },
    },
    cognitiveEngine
  );

  return heartbeat;
}

describe('Heartbeat', () => {
  it('start() is idempotent and does not schedule duplicate tasks', () => {
    const heartbeat = createHeartbeat();

    heartbeat.start();
    const firstTask = heartbeat.task;
    assert.ok(firstTask);

    heartbeat.start();
    assert.strictEqual(heartbeat.task, firstTask);

    heartbeat.stop();
  });

  it('setEnabled(true) starts the scheduler when enabled and no task exists', () => {
    const heartbeat = createHeartbeat();

    assert.strictEqual(heartbeat.task, null);

    heartbeat.setEnabled(true);
    const firstTask = heartbeat.task;
    assert.ok(firstTask);

    heartbeat.setEnabled(true);
    assert.strictEqual(heartbeat.task, firstTask);

    heartbeat.setEnabled(false);
    assert.strictEqual(heartbeat.task, null);
  });
});
