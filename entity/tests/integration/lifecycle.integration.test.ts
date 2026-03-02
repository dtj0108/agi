/**
 * Integration: lifecycle and auth gates across HTTP and WS interfaces.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import {
  canBindLoopback,
  getJson,
  openWsClient,
  postJson,
  startInProcessEntity,
  waitForCondition,
} from './helpers.js';

describe('Lifecycle integration', () => {
  it('enforces auth and supports pause/resume/kill lifecycle paths', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const apiKey = 'integration-secret';
    const harness = await startInProcessEntity({
      apiKey,
      llmBehavior: { needsAction: false },
    });

    t.after(async () => {
      await harness.stop();
    });

    const unauthorizedStatus = await getJson(harness.baseUrl, '/status');
    assert.strictEqual(unauthorizedStatus.response.status, 401);

    const authorizedStatus = await getJson(harness.baseUrl, '/status', apiKey);
    assert.strictEqual(authorizedStatus.response.status, 200);

    const unauthorizedWs = new WebSocket(harness.wsUrl);
    const unauthorizedClose = await new Promise((resolveClose: any, rejectClose: any) => {
      const timeout = setTimeout(() => rejectClose(new Error('Unauthorized WS close timeout')), 5000);
      unauthorizedWs.once('close', (code: any, reason: any) => {
        clearTimeout(timeout);
        resolveClose({ code, reason: reason?.toString() || '' });
      });
      unauthorizedWs.once('error', () => {
        // Unauthorized client may emit close after an error depending on runtime timing.
      });
    });
    assert.strictEqual(unauthorizedClose.code, 1008);

    const wsClient = await openWsClient(harness.wsUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    t.after(async () => {
      await wsClient.close();
    });

    const pauseResult = await postJson(harness.baseUrl, '/pause', {}, apiKey);
    assert.strictEqual(pauseResult.response.status, 200);
    assert.strictEqual(pauseResult.data.paused, true);

    const pausedMessage = await postJson(harness.baseUrl, '/message', { content: 'should fail while paused' }, apiKey);
    assert.strictEqual(pausedMessage.response.status, 503);

    const resumeResult = await postJson(harness.baseUrl, '/resume', {}, apiKey);
    assert.strictEqual(resumeResult.response.status, 200);
    assert.strictEqual(resumeResult.data.paused, false);

    const resumedMessage = await postJson(harness.baseUrl, '/message', { content: 'works after resume' }, apiKey);
    assert.strictEqual(resumedMessage.response.status, 200);
    assert.ok(resumedMessage.data.cycleId);

    let killCalls = 0;
    harness.interfaceLayer.onKillRequest(() => {
      killCalls += 1;
    });

    const killResult = await postJson(harness.baseUrl, '/kill', {}, apiKey);
    assert.strictEqual(killResult.response.status, 200);

    const killObserved = await waitForCondition(() => killCalls === 1, 2000);
    assert.strictEqual(killObserved, true);
    assert.strictEqual(killCalls, 1);
  });
});
