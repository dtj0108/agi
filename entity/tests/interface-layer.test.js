/**
 * Interface layer lifecycle tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { InterfaceLayer } from '../src/interface/index.js';

class FakeCognitiveEngine extends EventEmitter {
  updateCognitiveConfig() {
    return { success: true };
  }

  getCognitiveConfig() {
    return {};
  }

  pause() {}

  resume() {}
}

class FakeActionGateway {
  setConfigHandler() {}
}

describe('InterfaceLayer lifecycle', () => {
  it('routes CLI exit through kill flow once', () => {
    const cognitiveEngine = new FakeCognitiveEngine();
    const actionGateway = new FakeActionGateway();

    const layer = new InterfaceLayer(
      {
        interface: {
          enableCli: false,
        },
        heartbeat: {
          enabled: false,
        },
      },
      cognitiveEngine,
      actionGateway,
      { readFile: async () => '' }
    );

    let kills = 0;
    layer.onKillRequest(() => {
      kills++;
    });

    layer.onExit();
    layer.onExit();

    assert.strictEqual(kills, 1);
  });

  it('does not emit extra kill during controlled stop', () => {
    const cognitiveEngine = new FakeCognitiveEngine();
    const actionGateway = new FakeActionGateway();

    const layer = new InterfaceLayer(
      {
        interface: {
          enableCli: false,
        },
        heartbeat: {
          enabled: false,
        },
      },
      cognitiveEngine,
      actionGateway,
      { readFile: async () => '' }
    );

    let kills = 0;
    layer.onKillRequest(() => {
      kills++;
    });

    layer.stop();
    layer.onExit();

    assert.strictEqual(kills, 0);
  });
});
