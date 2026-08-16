/**
 * Shell Validator Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCommand } from '../src/action-gateway/validator.js';

// parseCommand returns a discriminated union of shapes; the tests probe
// fields across branches, so widen locally to one optional-field view.
type ParsedCommand = {
  safe: boolean;
  reason?: string | null;
  segments?: Array<{ binary: string; args: string[] }>;
};

function parse(command: string): ParsedCommand {
  return parseCommand(command) as ParsedCommand;
}

describe('Shell Validator', () => {
  describe('parseCommand', () => {
    it('parses simple commands', () => {
      const result = parse('ls -la');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments![0]!.binary, 'ls');
      assert.deepStrictEqual(result.segments![0]!.args, ['-la']);
    });

    it('detects command substitution with $()', () => {
      const result = parse('echo $(whoami)');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('Command substitution'));
    });

    it('detects command substitution with backticks', () => {
      const result = parse('echo `whoami`');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('Command substitution'));
    });

    it('rejects pipe operators', () => {
      const result = parse('cat file.txt | grep pattern');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('operator'));
    });

    it('rejects chain operators', () => {
      const result = parse('mkdir test && cd test');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('operator'));
    });

    it('rejects redirections', () => {
      const result = parse('echo malicious > /etc/passwd');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('Redirection'));
    });

    it('rejects normal redirections too', () => {
      const result = parse('echo test > output.txt');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('Redirection'));
    });

    it('handles quoted strings', () => {
      const result = parse('echo "hello world"');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments![0]!.binary, 'echo');
    });

    it('handles empty command', () => {
      const result = parse('');
      assert.strictEqual(result.safe, false);
    });

    it('rejects background execution', () => {
      const result = parse('sleep 10 &');
      assert.strictEqual(result.safe, false);
      assert.ok(result.reason!.includes('Background'));
    });

    it('allows metacharacters inside quotes', () => {
      const result = parse('echo "a|b && c; d > e"');
      assert.strictEqual(result.safe, true);
      assert.strictEqual(result.segments![0]!.binary, 'echo');
    });
  });
});
