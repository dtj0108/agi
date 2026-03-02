/**
 * Autonomy config API contract tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'net';
import { HttpServer } from '../src/interface/http.js';

async function canBindLoopback() {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
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

function createActionGatewayStub(config) {
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

describe('Autonomy config API', () => {
  it('returns canonical and compatibility autonomy fields from GET /config', async (t) => {
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

    const address = http.server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    assert.ok(port);

    const response = await fetch(`http://127.0.0.1:${port}/config`);
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.strictEqual(data.actions.autonomy, 'balanced');
    assert.deepStrictEqual(data.actions.blockedPatterns, ['rm -rf /']);
    assert.strictEqual(data.autonomy.level, 'balanced');
    assert.deepStrictEqual(data.autonomy.blockedPatterns, ['rm -rf /']);
  });

  it('accepts canonical actions.autonomy updates via PUT /config', async (t) => {
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

    const address = http.server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    assert.ok(port);

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

  it('accepts legacy autonomy.level compatibility payloads', async (t) => {
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

    const address = http.server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    assert.ok(port);

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

  it('rejects invalid autonomy values without mutating runtime config', async (t) => {
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

    const address = http.server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    assert.ok(port);

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
});
