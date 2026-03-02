/**
 * Action Gateway Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { classifyTier, isBlocked } from '../src/action-gateway/permissions.js';
import { ActionGateway } from '../src/action-gateway/index.js';

function createGatewayConfig(testName, autonomy = 'balanced') {
  const basePath = join(process.cwd(), 'entity-workspace', 'test-artifacts', testName);
  mkdirSync(basePath, { recursive: true });

  return {
    actions: {
      autonomy,
      approvalTimeout: 500,
      blockedPatterns: [],
    },
    security: {
      actionLogPath: join(basePath, 'action_log.jsonl'),
      auditLogPath: join(basePath, 'audit.log'),
    },
    _testBasePath: basePath,
  };
}

describe('Action Gateway Permissions', () => {
  describe('classifyTier', () => {
    it('classifies ls as Tier 1', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'ls -la' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies cat as Tier 1', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'cat file.txt' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies git status as Tier 1', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'git status' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies git commit as Tier 2', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'git commit -m "test"' } });
      assert.strictEqual(tier, 2);
    });

    it('classifies mkdir as Tier 2', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'mkdir test' } });
      assert.strictEqual(tier, 2);
    });

    it('classifies rm as Tier 3', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'rm -rf test' } });
      assert.strictEqual(tier, 3);
    });

    it('classifies chmod as Tier 3', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'chmod 755 file' } });
      assert.strictEqual(tier, 3);
    });

    it('classifies unknown commands as Tier 3', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'unknowncommand' } });
      assert.strictEqual(tier, 3);
    });

    it('classifies browser screenshot as Tier 1', () => {
      const tier = classifyTier({ tool: 'browser', params: { action: 'screenshot' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies browser click as Tier 2', () => {
      const tier = classifyTier({ tool: 'browser', params: { action: 'click' } });
      assert.strictEqual(tier, 2);
    });

    it('classifies file read as Tier 1', () => {
      const tier = classifyTier({ tool: 'file', params: { operation: 'read' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies config status reads as Tier 1', () => {
      const tier = classifyTier({ tool: 'config', params: { setting: 'heartbeat.status' } });
      assert.strictEqual(tier, 1);
    });

    it('classifies config updates as Tier 2', () => {
      const tier = classifyTier({ tool: 'config', params: { setting: 'cognitive.temperature' } });
      assert.strictEqual(tier, 2);
    });

    it('classifies npm install as Tier 2', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'npm install express' } });
      assert.strictEqual(tier, 2);
    });

    it('classifies node --version as Tier 1', () => {
      const tier = classifyTier({ tool: 'shell', params: { command: 'node --version' } });
      assert.strictEqual(tier, 1);
    });
  });

  describe('isBlocked', () => {
    it('blocks commands matching patterns', () => {
      const action = { tool: 'shell', params: { command: 'rm -rf /' } };
      const blocked = isBlocked(action, ['rm -rf /']);
      assert.strictEqual(blocked, true);
    });

    it('allows commands not matching patterns', () => {
      const action = { tool: 'shell', params: { command: 'ls' } };
      const blocked = isBlocked(action, ['rm -rf /']);
      assert.strictEqual(blocked, false);
    });

    it('handles regex patterns', () => {
      const action = { tool: 'shell', params: { command: 'chmod 777 /tmp/test' } };
      const blocked = isBlocked(action, [/chmod 777/]);
      assert.strictEqual(blocked, true);
    });
  });

  describe('executeAction approvals', () => {
    it('requires explicit approval for tier-4 skill actions', async (t) => {
      const executed = [];
      const config = createGatewayConfig('gateway-tier4', 'balanced');
      t.after(async () => {
        await rm(config._testBasePath, { recursive: true, force: true });
      });

      const gateway = new ActionGateway(
        config,
        {
          skills: {
            getTier: () => 4,
            execute: async () => {
              executed.push(true);
              return { success: true };
            },
          },
        }
      );

      const approvalEventPromise = new Promise((resolve) => {
        gateway.once('approval_required', resolve);
      });

      const actionPromise = gateway.executeAction({
        tool: 'skill',
        params: { skill: 'demo', action: 'run' },
        intent: 'Tier 4 approval test',
      });

      const approvalEvent = await approvalEventPromise;
      assert.ok(approvalEvent.actionId);
      assert.strictEqual(approvalEvent.action.tool, 'skill');

      const pending = gateway.getPendingApprovals();
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].id, approvalEvent.actionId);

      const approved = gateway.approve(approvalEvent.actionId);
      assert.strictEqual(approved, true);

      const result = await actionPromise;
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.approved_by, 'user');
      assert.strictEqual(executed.length, 1);
    });

    it('requires approval for tier-2 actions in conservative mode', async (t) => {
      const config = createGatewayConfig('gateway-conservative', 'conservative');
      t.after(async () => {
        await rm(config._testBasePath, { recursive: true, force: true });
      });

      const gateway = new ActionGateway(
        config,
        {
          shell: {
            execute: async () => ({ success: true, stdout: 'ok', exitCode: 0 }),
          },
        }
      );

      const approvalEventPromise = new Promise((resolve) => {
        gateway.once('approval_required', resolve);
      });

      const actionPromise = gateway.executeAction({
        tool: 'shell',
        params: { command: 'mkdir test-dir' },
        intent: 'Create folder',
      });

      const approvalEvent = await approvalEventPromise;
      assert.ok(approvalEvent.actionId);
      assert.strictEqual(approvalEvent.action.tier, 2);
      assert.strictEqual(gateway.getPendingApprovals().length, 1);

      gateway.approve(approvalEvent.actionId);
      const result = await actionPromise;
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.approved_by, 'user');
    });

    it('auto-approves tier-2 actions in balanced mode', async (t) => {
      const config = createGatewayConfig('gateway-balanced-tier2', 'balanced');
      t.after(async () => {
        await rm(config._testBasePath, { recursive: true, force: true });
      });

      const gateway = new ActionGateway(
        config,
        {
          shell: {
            execute: async () => ({ success: true, stdout: 'ok', exitCode: 0 }),
          },
        }
      );

      const result = await gateway.executeAction({
        tool: 'shell',
        params: { command: 'mkdir test-dir' },
        intent: 'Create folder',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.approved_by, 'auto');
      assert.strictEqual(gateway.getPendingApprovals().length, 0);
    });

    it('auto-approves tier-4 actions in full_trust mode', async (t) => {
      const config = createGatewayConfig('gateway-full-trust', 'full_trust');
      t.after(async () => {
        await rm(config._testBasePath, { recursive: true, force: true });
      });

      const gateway = new ActionGateway(
        config,
        {
          skills: {
            getTier: () => 4,
            execute: async () => ({ success: true, output: 'ran' }),
          },
        }
      );

      const result = await gateway.executeAction({
        tool: 'skill',
        params: { skill: 'demo', action: 'run' },
        intent: 'Full trust execution',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.approved_by, 'policy');
      assert.strictEqual(gateway.getPendingApprovals().length, 0);
    });
  });
});
