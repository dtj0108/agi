/**
 * Skills HTTP security and contract tests.
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
      approvalTimeout: 1000,
    },
    llm: {},
    autonomy: {},
    heartbeat: {},
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

describe('Skills HTTP Security', () => {
  it('rejects tier-3/4 test calls with approvalRequired and does not execute', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const executeCalls: any[] = [];
    const actionGateway = {
      engines: {
        skills: {
          getTier: () => 4,
          isAuthored: () => true,
          listSkills: () => [],
          registry: { get: () => null },
        },
      },
      approve: () => false,
      deny: () => false,
      getHistory: async () => [],
      executeAction: async (action: any) => {
        executeCalls.push(action);
        return { success: true };
      },
    };

    const http = new HttpServer(createConfig(), createCognitiveEngineStub(), actionGateway, createMindServerStub());
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/skills/demo/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run' }),
    });

    assert.strictEqual(response.status, 403);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.approvalRequired, true);
    assert.strictEqual(data.tier, 4);
    assert.strictEqual(executeCalls.length, 0);
  });

  it('routes tier-1/2 skill tests through ActionGateway with dashboard source tag', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const executeCalls: any[] = [];
    const actionGateway = {
      engines: {
        skills: {
          getTier: () => 2,
          isAuthored: () => false,
          listSkills: () => [],
          registry: { get: () => null },
        },
      },
      approve: () => false,
      deny: () => false,
      getHistory: async () => [],
      executeAction: async (action: any) => {
        executeCalls.push(action);
        return { success: true, output: 'ok' };
      },
    };

    const http = new HttpServer(createConfig(), createCognitiveEngineStub(), actionGateway, createMindServerStub());
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const response = await fetch(`http://127.0.0.1:${port}/skills/demo/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', query: 'entity ai' }),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.tier, 2);

    assert.strictEqual(executeCalls.length, 1);
    assert.strictEqual(executeCalls[0].tool, 'skill');
    assert.strictEqual(executeCalls[0].source, 'dashboard_test');
    assert.strictEqual(executeCalls[0].intent, 'Dashboard skill test');
    assert.strictEqual(executeCalls[0].params.skill, 'demo');
    assert.strictEqual(executeCalls[0].params.action, 'search');
  });

  it('returns skill metadata with authored flag and tier summary', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const skillMetadata = {
      name: 'authored-skill',
      version: '1.0.0',
      description: 'Self-authored',
      actions: [{ name: 'run', tier: 4 }],
    };

    const actionGateway = {
      engines: {
        skills: {
          getTier: () => 4,
          isAuthored: (name: any) => name === 'authored-skill',
          listSkills: () => [{ ...skillMetadata, _authored: true }],
          registry: {
            get: () => ({
              getMetadata: () => ({ ...skillMetadata }),
            }),
          },
        },
      },
      approve: () => false,
      deny: () => false,
      getHistory: async () => [],
      executeAction: async () => ({ success: true }),
    };

    const http = new HttpServer(createConfig(), createCognitiveEngineStub(), actionGateway, createMindServerStub());
    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const listResponse = await fetch(`http://127.0.0.1:${port}/skills`);
    assert.strictEqual(listResponse.status, 200);
    const listData = await listResponse.json();
    assert.strictEqual(Array.isArray(listData.skills), true);
    assert.strictEqual(listData.skills[0]._authored, true);
    assert.deepStrictEqual(listData.skills[0].tierSummary, {
      actionCount: 1,
      minTier: 4,
      maxTier: 4,
      requiresApproval: true,
    });

    const detailResponse = await fetch(`http://127.0.0.1:${port}/skills/authored-skill`);
    assert.strictEqual(detailResponse.status, 200);
    const detailData = await detailResponse.json();
    assert.strictEqual(detailData._authored, true);
    assert.strictEqual(detailData.tierSummary.maxTier, 4);
  });
});
