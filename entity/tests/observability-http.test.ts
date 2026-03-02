/**
 * HTTP observability endpoint tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { once } from 'events';
import { createServer } from 'net';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { HttpServer } from '../src/interface/http.js';
import { configureTelemetry, getTelemetry } from '../src/observability/telemetry.js';

async function requestJson(url: any, options: any = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

async function canBindLoopback() {
  return new Promise((resolve: any) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

describe('HTTP observability diagnostics', () => {
  it('exposes health fields on /status and protects diagnostics routes with API key auth', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const tempRoot = await mkdtemp(join(tmpdir(), 'entity-http-observability-'));
    const config = {
      interface: {
        host: '127.0.0.1',
        httpPort: 0,
        apiKey: 'secret',
        corsOrigins: ['*'],
      },
      observability: {
        enabled: true,
        eventsPath: join(tempRoot, 'events.jsonl'),
        metricsPath: join(tempRoot, 'metrics.jsonl'),
        windowMinutes: 60,
        redactKeys: [],
      },
      actions: {
        approvalTimeout: 1000,
      },
    };

    configureTelemetry(config.observability);
    const telemetry = getTelemetry();
    telemetry.incrementCounter('llm.schema.total', 10);
    telemetry.incrementCounter('llm.schema.fallback', 1);
    telemetry.incrementCounter('cycle.total', 20);
    telemetry.incrementCounter('cycle.failed', 1);
    telemetry.recordError('http', new Error('test diagnostics error'));

    const cognitiveEngine = {
      runCycle: async () => ({
        userResponse: 'ok',
        thoughts: 'ok',
        emotionalState: { primary: 'neutral', intensity: 0.5 },
        cycleId: 'cycle-test',
      }),
      getStatus: async () => ({
        cycleCount: 5,
        currentPhase: null,
        safeMode: false,
        emotions: { primary: 'neutral', intensity: 0.5 },
      }),
      pause: () => {},
      resume: () => {},
      approve: () => false,
      deny: () => false,
    };

    const actionGateway = {
      approve: () => false,
      deny: () => false,
      getHistory: async () => [],
    };

    const mindServer = {
      readFile: async () => 'test',
      rollback: async () => ({ success: true }),
    };

    const http = new HttpServer(config, cognitiveEngine, actionGateway, mindServer);
    http.start();
    await once(http.server, 'listening');

    t.after(async () => {
      http.stop();
      configureTelemetry({ enabled: false });
      await rm(tempRoot, { recursive: true, force: true });
    });

    const port = http.server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const unauthorized = await fetch(`${baseUrl}/diagnostics/errors`);
    assert.strictEqual(unauthorized.status, 401);

    const authHeaders = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };

    const { response: statusResponse, body: statusBody } = await requestJson(`${baseUrl}/status`, {
      headers: authHeaders,
    });
    assert.strictEqual(statusResponse.status, 200);
    assert.ok(statusBody.health);
    assert.strictEqual(typeof statusBody.health.llmSchemaFallbackRate1h, 'number');
    assert.strictEqual(typeof statusBody.health.cycleFailureRate1h, 'number');
    assert.strictEqual(typeof statusBody.health.errorCount1h, 'number');
    assert.ok(statusBody.health.lastErrorAt);

    const { response: errorsResponse, body: errorsBody } = await requestJson(
      `${baseUrl}/diagnostics/errors?limit=5`,
      { headers: authHeaders }
    );
    assert.strictEqual(errorsResponse.status, 200);
    assert.ok(Array.isArray(errorsBody.errors));
    assert.ok(errorsBody.count >= 1);

    const { response: metricsResponse, body: metricsBody } = await requestJson(
      `${baseUrl}/diagnostics/metrics?window=60`,
      { headers: authHeaders }
    );
    assert.strictEqual(metricsResponse.status, 200);
    assert.ok(Array.isArray(metricsBody.metrics));
    assert.ok(metricsBody.count >= 4);
  });
});
