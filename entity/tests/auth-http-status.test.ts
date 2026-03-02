/**
 * HTTP auth status endpoint tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HttpServer } from '../src/interface/http.js';

async function getServerPort(httpServer: any) {
  if (httpServer.server?.listening) {
    const address = httpServer.server.address();
    return typeof address === 'object' ? address.port : null;
  }

  await new Promise((resolve: any, reject: any) => {
    const timer = setTimeout(() => reject(new Error('HTTP server did not start listening')), 5000);
    httpServer.server.once('listening', () => {
      clearTimeout(timer);
      resolve();
    });
    httpServer.server.once('error', (err: any) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const address = httpServer.server.address();
  return typeof address === 'object' ? address.port : null;
}

function createConfig() {
  return {
    llm: {
      model: 'test-model',
      maxTokens: 128,
      temperature: 0,
      promptCaching: false,
    },
    actions: {
      autonomy: 'balanced',
      blockedPatterns: [],
    },
    autonomy: {
      mode: 'manual',
      go: {
        minDelayMs: 1000,
        maxConsecutiveErrors: 3,
      },
    },
    heartbeat: {
      enabled: false,
      schedule: '*/30 * * * *',
      prompt: 'heartbeat',
    },
    interface: {
      host: '127.0.0.1',
      httpPort: 0,
      wsPort: 0,
      enableCli: false,
      corsOrigins: ['*'],
      apiKey: null,
    },
  };
}

describe('GET /auth/status', () => {
  it('returns local auth status and mirrors it in /status payload', async (t: any) => {
    const authStatus = {
      mode: 'hybrid',
      provider: 'oidc',
      loggedIn: true,
      expiresAt: '2030-01-01T00:00:00.000Z',
      source: 'oauth',
    };

    const http = new HttpServer(
      createConfig(),
      {
        getStatus: async () => ({
          name: 'Entity',
          cycleCount: 1,
          currentPhase: null,
          lastCycleAt: null,
          emotionalState: { primary: 'neutral', intensity: 0.5 },
        }),
      },
      {
        approve: () => false,
        deny: () => false,
      },
      {
        readFile: async () => '',
      },
      null,
      {
        getAuthStatus: async () => authStatus,
      }
    );

    http.start();
    t.after(() => http.stop());

    const port = await getServerPort(http);

    const authResponse = await fetch(`http://127.0.0.1:${port}/auth/status`);
    assert.strictEqual(authResponse.status, 200);
    const authPayload = await authResponse.json();
    assert.deepStrictEqual(authPayload, authStatus);

    const statusResponse = await fetch(`http://127.0.0.1:${port}/status`);
    assert.strictEqual(statusResponse.status, 200);
    const statusPayload = await statusResponse.json();
    assert.deepStrictEqual(statusPayload.auth, authStatus);
  });
});
