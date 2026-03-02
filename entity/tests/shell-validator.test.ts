/**
 * Shell Validator Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCommand } from '../src/action-gateway/validator.js';

describe('Shell Validator', () => {
  describe('parseCommand', () => {
    it('parses simple commands', () => {
      const result = parseCommand('ls -la');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments[0].binary, 'ls');
      assert.deepStrictEqual(result.segments[0].args, ['-la']);
    });

    it('detects command substitution with $()', () => {
      const result = parseCommand('echo $(whoami)');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('Command substitution'));
    });

    it('detects command substitution with backticks', () => {
      const result = parseCommand('echo `whoami`');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('Command substitution'));
    });

    it('rejects pipe operators', () => {
      const result = parseCommand('cat file.txt | grep pattern');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('operator'));
    });

    it('rejects chain operators', () => {
      const result = parseCommand('mkdir test && cd test');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('operator'));
    });

    it('rejects redirections', () => {
      const result = parseCommand('echo malicious > /etc/passwd');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('Redirection'));
    });

    it('rejects normal redirections too', () => {
      const result = parseCommand('echo test > output.txt');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('Redirection'));
    });

    it('handles quoted strings', () => {
      const result = parseCommand('echo "hello world"');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments[0].binary, 'echo');
    });

    it('handles empty command', () => {
      const result = parseCommand('');
      assert.strictEqual(result.safe, false);
    });

    it('rejects background execution', () => {
      const result = parseCommand('sleep 10 &');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason.includes('Background'));
    });

    it('allows metacharacters inside quotes', () => {
      const result = parseCommand('echo "a|b && c; d > e"');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments[0].binary, 'echo');
    });
  });
});
