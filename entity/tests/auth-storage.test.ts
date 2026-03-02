/**
 * Auth storage tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileAuthStorage } from '../src/auth/storage/file.js';

describe('FileAuthStorage', () => {
  it('writes credentials with 0600 permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'entity-auth-storage-'));
    const filePath = join(root, 'auth.json');
    const storage = new FileAuthStorage(filePath);

    storage.save({ accessToken: 'token', refreshToken: 'refresh' });

    const mode = statSync(filePath).mode & 0o777;
    assert.strictEqual(mode, 0o600);

    const loaded = storage.load();
    assert.strictEqual(loaded.accessToken, 'token');
    assert.strictEqual(loaded.refreshToken, 'refresh');
  });
});
