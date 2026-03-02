/**
 * Integration: approval round-trip over WebSocket during HTTP-triggered cycles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { canBindLoopback, openWsClient, postJson, startInProcessEntity } from './helpers.js';

describe('Approval flow integration', () => {
  it('handles approve and deny round-trips for plan approvals', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const harness = await startInProcessEntity({
      llmBehavior: {
        needsAction: true,
        approvalPlan: true,
      },
      autonomy: 'balanced',
    });

    const wsClient = await openWsClient(harness.wsUrl);

    t.after(async () => {
      await wsClient.close();
      await harness.stop();
    });

    // Approve path
    const approveResponsePromise = postJson(harness.baseUrl, '/message', {
      content: 'run approval flow (approve)',
    });

    const approvalNeeded = await wsClient.waitFor(
      (message: any) => message.type === 'approval_needed' && message.approvalType === 'plan'
    );
    assert.ok(approvalNeeded.approvalId);

    wsClient.sendJson({
      type: 'approve',
      approvalId: approvalNeeded.approvalId,
    });

    const approvalResult = await wsClient.waitFor(
      (message: any) => message.type === 'approval_result' && message.approvalId === approvalNeeded.approvalId
    );
    assert.strictEqual(approvalResult.success, true);
    assert.strictEqual(approvalResult.approved, true);

    const approveResponse = await approveResponsePromise;
    assert.strictEqual(approveResponse.response.status, 200);
    assert.ok(approveResponse.data.cycleId);

    // Deny path
    const denyResponsePromise = postJson(harness.baseUrl, '/message', {
      content: 'run approval flow (deny)',
    });

    const deniedApprovalNeeded = await wsClient.waitFor(
      (message: any) =>
        message.type === 'approval_needed' &&
        message.approvalType === 'plan' &&
        message.approvalId !== approvalNeeded.approvalId
    );
    assert.ok(deniedApprovalNeeded.approvalId);

    wsClient.sendJson({
      type: 'deny',
      approvalId: deniedApprovalNeeded.approvalId,
    });

    const deniedResult = await wsClient.waitFor(
      (message: any) => message.type === 'approval_result' && message.approvalId === deniedApprovalNeeded.approvalId
    );
    assert.strictEqual(deniedResult.success, true);
    assert.strictEqual(deniedResult.approved, false);

    const denyResponse = await denyResponsePromise;
    assert.strictEqual(denyResponse.response.status, 200);
    assert.ok(denyResponse.data.cycleId);
  });

  it('does not emit plan approvals in full_trust mode for tier-3 plans', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const harness = await startInProcessEntity({
      llmBehavior: {
        needsAction: true,
        approvalPlan: true,
      },
      autonomy: 'full_trust',
    });

    const wsClient = await openWsClient(harness.wsUrl);

    t.after(async () => {
      await wsClient.close();
      await harness.stop();
    });

    const response = await postJson(harness.baseUrl, '/message', {
      content: 'run tier-3 flow in full trust',
    });

    assert.strictEqual(response.response.status, 200);
    assert.ok(response.data.cycleId);

    await new Promise((resolve: any) => setTimeout(resolve, 300));
    const hasPlanApproval = wsClient.messages.some(
      (message: any) => message.type === 'approval_needed' && message.approvalType === 'plan'
    );
    assert.strictEqual(hasPlanApproval, false);
  });

  it('emits plan approvals for tier-2 plans in conservative mode', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const harness = await startInProcessEntity({
      llmBehavior: {
        needsAction: true,
        tier2Plan: true,
      },
      autonomy: 'conservative',
    });

    const wsClient = await openWsClient(harness.wsUrl);

    t.after(async () => {
      await wsClient.close();
      await harness.stop();
    });

    const responsePromise = postJson(harness.baseUrl, '/message', {
      content: 'run tier-2 flow in conservative',
    });

    const approvalNeeded = await wsClient.waitFor(
      (message: any) => message.type === 'approval_needed' && message.approvalType === 'plan'
    );
    assert.ok(approvalNeeded.approvalId);

    wsClient.sendJson({
      type: 'approve',
      approvalId: approvalNeeded.approvalId,
    });

    const approvalResult = await wsClient.waitFor(
      (message: any) => message.type === 'approval_result' && message.approvalId === approvalNeeded.approvalId
    );
    assert.strictEqual(approvalResult.approved, true);

    const response = await responsePromise;
    assert.strictEqual(response.response.status, 200);
    assert.ok(response.data.cycleId);
  });
});
