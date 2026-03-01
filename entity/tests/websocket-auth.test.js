/**
 * WebSocket Interface Security Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { WebSocketInterface } from '../src/interface/websocket.js';

class FakeCognitiveEngine extends EventEmitter {
  getState() {
    return { cycleCount: 0 };
  }

  async runCycle() {
    return { cycleId: 'cycle-1', userResponse: 'ok' };
  }

  approve() {
    return false;
  }

  deny() {
    return false;
  }
}

class FakeActionGateway extends EventEmitter {
  approve() {
    return false;
  }

  deny() {
    return false;
  }
}

describe('WebSocket Interface security behavior', () => {
  it('resolves server bind options and enforces API key auth', () => {
    const cognitiveEngine = new FakeCognitiveEngine();
    const actionGateway = new FakeActionGateway();

    const wsInterface = new WebSocketInterface(
      {
        interface: {
          wsPort: 4321,
          host: '127.0.0.1',
          apiKey: 'test-key',
        },
      },
      cognitiveEngine,
      actionGateway
    );

    assert.deepStrictEqual(wsInterface.getServerOptions(), {
      port: 4321,
      host: '127.0.0.1',
    });

    const unauthorized = wsInterface.isAuthorized({
      headers: { authorization: 'Bearer wrong-key', host: 'localhost' },
      url: '/',
    });
    assert.strictEqual(unauthorized, false);

    const authorizedByHeader = wsInterface.isAuthorized({
      headers: { authorization: 'Bearer test-key', host: 'localhost' },
      url: '/',
    });
    assert.strictEqual(authorizedByHeader, true);

    const authorizedByQuery = wsInterface.isAuthorized({
      headers: { host: 'localhost' },
      url: '/?api_key=test-key',
    });
    assert.strictEqual(authorizedByQuery, true);
  });

  it('emits normalized approval payloads for action and plan approvals', () => {
    const cognitiveEngine = new FakeCognitiveEngine();
    const actionGateway = new FakeActionGateway();

    const wsInterface = new WebSocketInterface(
      {
        interface: {
          apiKey: null,
        },
      },
      cognitiveEngine,
      actionGateway
    );

    const messages = [];
    wsInterface.broadcast = (message) => {
      messages.push(message);
    };

    wsInterface.broadcastApprovalNeeded({
      approvalType: 'action',
      approvalId: 'action-123',
      actionId: 'action-123',
      action: { tool: 'shell' },
      message: 'approve action',
    });

    wsInterface.emitPlanApprovalNeeded({
      planId: 'plan-456',
      plan: { steps: [] },
      message: 'approve plan',
    });

    assert.deepStrictEqual(messages[0], {
      type: 'approval_needed',
      approvalType: 'action',
      approvalId: 'action-123',
      actionId: 'action-123',
      action: { tool: 'shell' },
      message: 'approve action',
    });

    assert.strictEqual(messages[1].type, 'approval_needed');
    assert.strictEqual(messages[1].approvalType, 'plan');
    assert.strictEqual(messages[1].approvalId, 'plan-456');
    assert.strictEqual(messages[1].planId, 'plan-456');
    assert.deepStrictEqual(messages[1].plan, { steps: [] });
  });
});
