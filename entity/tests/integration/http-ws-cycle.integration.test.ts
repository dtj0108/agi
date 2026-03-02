/**
 * Integration: HTTP message flow emits corresponding WebSocket cycle events.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { canBindLoopback, openWsClient, postJson, startInProcessEntity } from './helpers.js';

describe('HTTP + WS + cognitive cycle integration', () => {
  it('propagates one HTTP /message cycle through WebSocket events using the same cycleId', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const harness = await startInProcessEntity({
      llmBehavior: { needsAction: false },
    });

    const wsClient = await openWsClient(harness.wsUrl);

    t.after(async () => {
      await wsClient.close();
      await harness.stop();
    });

    const { response, data } = await postJson(harness.baseUrl, '/message', {
      content: 'hello from integration test',
      metadata: { source: 'integration' },
    });

    assert.strictEqual(response.status, 200);
    assert.ok(data.cycleId);
    assert.strictEqual(typeof data.response, 'string');

    const thought = await wsClient.waitFor(
      (message: any) => message.type === 'thought' && message.cycleId === data.cycleId
    );
    const cycleComplete = await wsClient.waitFor(
      (message: any) => message.type === 'cycle_complete' && message.cycleId === data.cycleId
    );

    assert.strictEqual(thought.cycleId, data.cycleId);
    assert.strictEqual(cycleComplete.cycleId, data.cycleId);
    assert.ok(typeof cycleComplete.duration === 'number');
  });
});
