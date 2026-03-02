/**
 * Autonomy Controller Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AutonomyController } from '../src/interface/autonomy.js';

class FakeHeartbeat {
  constructor() {
    this.enabled = true;
    this.schedule = '*/30 * * * *';
    this.prompt = 'heartbeat';
    this.running = false;
    this.startCount = 0;
    this.stopCount = 0;
  }

  start() {
    this.running = true;
    this.startCount += 1;
  }

  stop() {
    this.running = false;
    this.stopCount += 1;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      schedule: this.schedule,
      prompt: this.prompt,
      running: this.running,
    };
  }
}

function sleep(ms: any) {
  return new Promise((resolve: any) => setTimeout(resolve, ms));
}

async function waitFor(check: any, timeoutMs: any = 500) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await sleep(5);
  }
}

describe('AutonomyController', () => {
  it('go mode starts continuous autonomous cycles', async (t: any) => {
    let cycles = 0;
    const config = {
      autonomy: {
        mode: 'manual',
        go: { minDelayMs: 1, maxConsecutiveErrors: 3 },
      },
    };
    const cognitiveEngine = {
      runCycle: async () => {
        cycles += 1;
        return { ok: true };
      },
    };
    const heartbeat = new FakeHeartbeat();
    const controller = new AutonomyController(config, cognitiveEngine, heartbeat);
    t.after(() => controller.stop());

    controller.setMode('go', { source: 'test' });
    await waitFor(() => cycles >= 2);

    controller.setMode('manual', { source: 'test' });
    const frozen = cycles;
    await sleep(25);

    assert.ok(frozen >= 2);
    assert.strictEqual(cycles, frozen);
  });

  it('stop to manual halts go loop and keeps process available', async (t: any) => {
    let cycles = 0;
    const controller = new AutonomyController(
      {
        autonomy: {
          mode: 'go',
          go: { minDelayMs: 1, maxConsecutiveErrors: 3 },
        },
      },
      {
        runCycle: async () => {
          cycles += 1;
          return { ok: true };
        },
      },
      new FakeHeartbeat()
    );
    t.after(() => controller.stop());

    controller.start();
    await waitFor(() => cycles >= 1);
    controller.setMode('manual', { source: 'test' });

    const afterStop = cycles;
    await sleep(25);
    assert.strictEqual(controller.getStatus().mode, 'manual');
    assert.strictEqual(cycles, afterStop);
  });

  it('heartbeat mode uses heartbeat scheduler path', () => {
    const heartbeat = new FakeHeartbeat();
    const controller = new AutonomyController(
      {
        autonomy: {
          mode: 'manual',
          go: { minDelayMs: 1, maxConsecutiveErrors: 3 },
        },
      },
      {
        runCycle: async () => ({ ok: true }),
      },
      heartbeat
    );

    controller.setMode('heartbeat', { source: 'test' });
    const status = controller.getStatus();

    assert.strictEqual(status.mode, 'heartbeat');
    assert.strictEqual(status.go.running, false);
    assert.strictEqual(heartbeat.startCount, 1);
    assert.strictEqual(heartbeat.running, true);

    controller.stop();
  });

  it('pause and resume stop/start automatic execution for selected mode', async (t: any) => {
    let cycles = 0;
    const controller = new AutonomyController(
      {
        autonomy: {
          mode: 'go',
          go: { minDelayMs: 1, maxConsecutiveErrors: 3 },
        },
      },
      {
        runCycle: async () => {
          cycles += 1;
          return { ok: true };
        },
      },
      new FakeHeartbeat()
    );
    t.after(() => controller.stop());

    controller.start();
    await waitFor(() => cycles >= 1);
    controller.pause();
    const pausedAt = cycles;
    await sleep(25);
    assert.strictEqual(cycles, pausedAt);

    controller.resume();
    await waitFor(() => cycles > pausedAt);
  });

  it('guard trips to manual after repeated go failures', async (t: any) => {
    let attempts = 0;
    const controller = new AutonomyController(
      {
        autonomy: {
          mode: 'manual',
          go: { minDelayMs: 1, maxConsecutiveErrors: 3 },
        },
      },
      {
        runCycle: async () => {
          attempts += 1;
          throw new Error('boom');
        },
      },
      new FakeHeartbeat()
    );
    t.after(() => controller.stop());

    controller.setMode('go', { source: 'test' });
    await waitFor(() => controller.getStatus().mode === 'manual');

    const status = controller.getStatus();
    assert.ok(attempts >= 3);
    assert.strictEqual(status.mode, 'manual');
    assert.strictEqual(status.go.running, false);
  });
});

