/**
 * Telemetry contract tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Telemetry } from '../src/observability/telemetry.js';

async function readJsonl(path) {
  const content = await readFile(path, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('Telemetry', () => {
  it('writes structured JSONL records and redacts configured keys', async (t) => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'entity-telemetry-'));
    const eventsPath = join(tempRoot, 'events.jsonl');
    const metricsPath = join(tempRoot, 'metrics.jsonl');

    t.after(async () => {
      await rm(tempRoot, { recursive: true, force: true });
    });

    const telemetry = new Telemetry({
      enabled: true,
      eventsPath,
      metricsPath,
      redactKeys: ['authorization', 'apiKey', 'token'],
      windowMinutes: 60,
    });

    telemetry.recordEvent('request', {
      authorization: 'Bearer secret',
      nested: { apiKey: 'abc123', ok: true },
      keep: 'visible',
    });
    telemetry.incrementCounter('http.request.total', 1, { token: 'sensitive', statusCode: '200' });
    telemetry.observeDuration('http.request.duration_ms', 12, { path: '/status' });

    const events = await readJsonl(eventsPath);
    const metrics = await readJsonl(metricsPath);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'request');
    assert.strictEqual(events[0].data.authorization, '[REDACTED]');
    assert.strictEqual(events[0].data.nested.apiKey, '[REDACTED]');
    assert.strictEqual(events[0].data.keep, 'visible');

    assert.strictEqual(metrics.length, 2);
    assert.strictEqual(metrics[0].kind, 'counter');
    assert.strictEqual(metrics[0].name, 'http.request.total');
    assert.strictEqual(metrics[0].labels.token, '[REDACTED]');
    assert.strictEqual(metrics[1].kind, 'duration');
    assert.strictEqual(metrics[1].name, 'http.request.duration_ms');
  });

  it('computes rolling health summary from counter/error windows', () => {
    const telemetry = new Telemetry({ enabled: true, windowMinutes: 60 });

    telemetry.incrementCounter('llm.schema.total', 100);
    telemetry.incrementCounter('llm.schema.fallback', 1);
    telemetry.incrementCounter('cycle.total', 200);
    telemetry.incrementCounter('cycle.failed', 1);
    telemetry.recordError('cognitive-engine', new Error('test error'));

    const health = telemetry.snapshotHealth(60);

    assert.strictEqual(health.llmSchemaFallbackRate1h, 0.01);
    assert.strictEqual(health.cycleFailureRate1h, 0.005);
    assert.strictEqual(health.errorCount1h, 1);
    assert.ok(typeof health.lastErrorAt === 'string');
  });
});

