/**
 * Autonomy config API contract tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'net';
import { HttpServer } from '../src/interface/http.js';

async function canBindLoopback() {
  return new Promise((resolve: any) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function getServerPort(http: any) {
  for (let i = 0; i < 50; i += 1) {
    const address = http.server?.address?.();
    const port = typeof address === 'object' && address ? address.port : null;
    if (port) return port;
    await new Promise((resolve: any) => setTimeout(resolve, 10));
  }

  throw new Error('HTTP server did not bind to a port');
}

function createConfig() {
  return {
    interface: {
      host: '127.0.0.1',
      httpPort: 0,
      corsOrigins: ['*'],
      apiKey: null,
    },
    actions: {
      autonomy: 'balanced',
      blockedPatterns: ['rm -rf /'],
      approvalTimeout: 1000,
    },
    llm: {
      model: 'test-model',
      maxTokens: 1024,
      temperature: 0.2,
      promptCaching: false,
    },
    heartbeat: {
      enabled: true,
      schedule: '*/30 * * * *',
      prompt: 'heartbeat',
    },
    autonomy: {
      mode: 'go',
      go: {
        minDelayMs: 2000,
        maxConsecutiveErrors: 3,
      },
    },
  };
}

function createCognitiveEngineStub() {
  return {
    runCycle: async () => ({ cycleId: 'test', userResponse: 'ok', thoughts: '', emotionalState: {} }),
    getStatus: async () => ({ cycleCount: 0, currentPhase: null }),
    pause: () => {},
    resume: () => {},
    approve: () => false,
    deny: () => false,
  };
}

function createMindServerStub() {
  return {
    readFile: async () => '',
    rollback: async () => ({ success: true }),
    getTree: async () => ({}),
  };
}

function createActionGatewayStub(config: any) {
  return {
    getAutonomyLevel: () => config.actions.autonomy,
    engines: {},
    approve: () => false,
    deny: () => false,
    getHistory: async () => [],
    getPendingApprovals: () => [],
    executeAction: async () => ({ success: true }),
  };
}

function createAutonomyStub(config: any) {
  let mode = config.autonomy?.mode || 'go';
  let minDelayMs = config.autonomy?.go?.minDelayMs ?? 2000;
  let maxConsecutiveErrors = config.autonomy?.go?.maxConsecutiveErrors ?? 3;

  return {
    setMode: (nextMode: any) => {
      mode = nextMode;
      config.autonomy.mode = nextMode;
      return {
        mode,
        paused: false,
        go: {
          running: mode === 'go',
          minDelayMs,
          maxConsecutiveErrors,
          consecutiveErrors: 0,
        },
        heartbeat: {
          enabled: true,
          schedule: '*/30 * * * *',
          prompt: 'heartbeat',
          running: mode === 'heartbeat',
        },
      };
    },
    updateGoConfig: (update: any) => {
      minDelayMs = update.minDelayMs ?? minDelayMs;
      maxConsecutiveErrors = update.maxConsecutiveErrors ?? maxConsecutiveErrors;
      config.autonomy.go = { minDelayMs, maxConsecutiveErrors };
      return {
        mode,
        paused: false,
        go: {
          running: mode === 'go',
          minDelayMs,
          maxConsecutiveErrors,
          consecutiveErrors: 0,
        },
        heartbeat: {
          enabled: true,
          schedule: '*/30 * * * *',
          prompt: 'heartbeat',
          running: mode === 'heartbeat',
        },
      };
    },
    getStatus: () => ({
      mode,
      paused: false,
      go: {
        running: mode === 'go',
        minDelayMs,
        maxConsecutiveErrors,
        consecutiveErrors: 0,
      },
      heartbeat: {
        enabled: true,
        schedule: '*/30 * * * *',
        prompt: 'heartbeat',
        running: mode === 'heartbeat',
      },
    }),
  };
}

describe('Autonomy config API', () => {
  it('returns canonical and compatibility autonomy fields from GET /config', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`);
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.strictEqual(data.actions.autonomy, 'balanced');
    assert.deepStrictEqual(data.actions.blockedPatterns, ['rm -rf /']);
    assert.strictEqual(data.autonomy.mode, 'go');
    assert.strictEqual(data.autonomy.go.minDelayMs, 2000);
    assert.strictEqual(data.autonomy.go.maxConsecutiveErrors, 3);
    assert.strictEqual(data.autonomy.level, 'balanced');
    assert.deepStrictEqual(data.autonomy.blockedPatterns, ['rm -rf /']);
  });

  it('accepts canonical actions.autonomy updates via PUT /config', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: {
          autonomy: 'full_trust',
          blockedPatterns: ['chmod 777'],
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(config.actions.autonomy, 'full_trust');
    assert.deepStrictEqual(config.actions.blockedPatterns, ['chmod 777']);
  });

  it('accepts canonical autonomy.mode updates via PUT /config', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autonomy: {
          mode: 'heartbeat',
          go: {
            minDelayMs: 1500,
            maxConsecutiveErrors: 5,
          },
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(config.autonomy.mode, 'heartbeat');
    assert.strictEqual(config.autonomy.go.minDelayMs, 1500);
    assert.strictEqual(config.autonomy.go.maxConsecutiveErrors, 5);
  });

  it('accepts legacy autonomy.level compatibility payloads', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autonomy: {
          level: 'conservative',
          blockedPatterns: ['eval('],
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(config.actions.autonomy, 'conservative');
    assert.deepStrictEqual(config.actions.blockedPatterns, ['eval(']);
  });

  it('rejects invalid autonomy values without mutating runtime config', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: { autonomy: 'unsafe-mode' } }),
    });

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(config.actions.autonomy, 'balanced');
  });

  it('rejects invalid autonomy.mode values without mutating runtime config', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub()
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autonomy: { mode: 'always-on' } }),
    });

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(config.autonomy.mode, 'go');
  });

  it('supports go/stop runtime control endpoints', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const config = createConfig();
    const autonomy = createAutonomyStub(config);
    const http = new HttpServer(
      config,
      createCognitiveEngineStub(),
      createActionGatewayStub(config),
      createMindServerStub(),
      autonomy
    );
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const goResponse = await fetch(`http://127.0.0.1:${port}/go`, {
      method: 'POST',
    });
    assert.strictEqual(goResponse.status, 200);
    const goData = await goResponse.json();
    assert.strictEqual(goData.success, true);
    assert.strictEqual(goData.autonomy.mode, 'go');

    const stopResponse = await fetch(`http://127.0.0.1:${port}/stop`, {
      method: 'POST',
    });
    assert.strictEqual(stopResponse.status, 200);
    const stopData = await stopResponse.json();
    assert.strictEqual(stopData.success, true);
    assert.strictEqual(stopData.autonomy.mode, 'manual');
  });
});
