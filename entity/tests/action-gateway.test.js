/**
 * Action Gateway Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyTier, isBlocked } from '../src/action-gateway/permissions.js';

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
});
