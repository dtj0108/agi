/**
 * Interface Security Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpServer } from '../src/interface/http.js';
import { MindServer } from '../src/mind-server/index.js';

function createTestConfig(mindPath) {
  return {
    mind: {
      path: mindPath,
      indexPath: join(mindPath, '.index.db'),
      gitDebounceMs: 10,
      fileWatchDebounceMs: 10,
    },
    embedding: {
      enabled: false,
    },
    interface: {
      host: '127.0.0.1',
      httpPort: 0,
      corsOrigins: ['*'],
      apiKey: null,
    },
    actions: {
      approvalTimeout: 1000,
    },
  };
}

describe('Interface Security', () => {
  it('rejects traversal and maps INVALID_PATH/ENOENT to 400/404', async (t) => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'entity-interface-security-'));
    const mindPath = join(tempRoot, 'mind');
    await mkdir(join(mindPath, 'identity'), { recursive: true });
    await writeFile(join(mindPath, 'identity/self.md'), '# Identity\n', 'utf-8');

    t.after(async () => {
      await rm(tempRoot, { recursive: true, force: true });
    });

    const config = createTestConfig(mindPath);
    const mindServer = new MindServer(config);

    const cognitiveEngine = {
      runCycle: async () => ({ cycleId: 'test', userResponse: 'ok', thoughts: '', emotionalState: {} }),
      getStatus: async () => ({ cycleCount: 0 }),
      pause: () => {},
      resume: () => {},
      approve: () => false,
      deny: () => false,
    };

    const actionGateway = {
      approve: () => false,
      deny: () => false,
      getHistory: async () => [],
    };

    const http = new HttpServer(config, cognitiveEngine, actionGateway, mindServer);

    const ok = await mindServer.readFile('identity/self.md');
    assert.ok(ok.includes('# Identity'));

    await assert.rejects(
      () => mindServer.readFile('../package.json'),
      (error) => {
        assert.strictEqual(error.code, 'INVALID_PATH');
        assert.deepStrictEqual(http.mapMindReadError(error), {
          status: 400,
          error: 'Invalid path',
        });
        return true;
      }
    );

    await assert.rejects(
      () => mindServer.readFile('identity/missing.md'),
      (error) => {
        assert.strictEqual(error.code, 'ENOENT');
        assert.deepStrictEqual(http.mapMindReadError(error), {
          status: 404,
          error: 'File not found',
        });
        return true;
      }
    );
  });
});
