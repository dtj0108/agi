/**
 * Network/lightweight daemon smoke test.
 * Runs only when ENTITY_ENABLE_NET_TESTS=1.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import { canBindLoopback, createMindFixture, getFreePort, openWsClient, postJson } from './helpers.js';

// The mock LLM server lives under scripts/, outside the tests TS project.
// Load it through a non-literal dynamic import so the compiler does not pull
// it into this program, and type its surface locally.
type MockLlmServer = {
  baseUrl: string;
  port: number;
  stop: () => Promise<void>;
};
type MockLlmModule = {
  startMockLlmServer: (options: {
    host: string;
    port: number;
    behavior: { needsAction: boolean };
  }) => Promise<MockLlmServer>;
};
const mockLlmModuleSpecifier = '../../scripts/test/mock-llm-server.js';

type ProcessExit = { code: number | null; signal: string | null };

async function waitForHttpHealth(baseUrl: any, timeoutMs: any = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return true;
    } catch {
      // Retry
    }
    await new Promise((resolveWait: any) => setTimeout(resolveWait, 250));
  }
  return false;
}

async function waitForProcessExit(child: any, timeoutMs: any = 15000): Promise<ProcessExit> {
  return new Promise<ProcessExit>((resolveExit) => {
    const timeout = setTimeout(() => resolveExit({ code: null, signal: 'TIMEOUT' }), timeoutMs);
    child.once('exit', (code: any, signal: any) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

describe('Daemon smoke (net-gated)', () => {
  it('boots daemon with mock LLM and handles one HTTP+WS cycle', async (t: any) => {
    if (process.env.ENTITY_ENABLE_NET_TESTS !== '1') {
      t.skip('Set ENTITY_ENABLE_NET_TESTS=1 to enable daemon smoke test');
      return;
    }
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }

    const tempRoot = await mkdtemp(join(tmpdir(), 'entity-daemon-smoke-'));
    const mindPath = await createMindFixture(tempRoot);
    const httpPort = await getFreePort();
    const wsPort = await getFreePort();
    const mockPort = await getFreePort();
    const { startMockLlmServer } = (await import(mockLlmModuleSpecifier)) as MockLlmModule;
    const mockServer = await startMockLlmServer({
      host: '127.0.0.1',
      port: mockPort,
      behavior: { needsAction: false },
    });

    let stdout = '';
    let stderr = '';
    const daemon = spawn(process.execPath, ['dist/index.js'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ENTITY_DAEMON: '1',
        ENTITY_ENABLE_CLI: 'false',
        ENTITY_INTERFACE_HOST: '127.0.0.1',
        ENTITY_HTTP_PORT: String(httpPort),
        ENTITY_WS_PORT: String(wsPort),
        ENTITY_LLM_API: 'openai-completions',
        ENTITY_LLM_BASE_URL: mockServer.baseUrl,
        ENTITY_LLM_API_KEY: 'mock-key',
        ENTITY_LLM_MODEL: 'mock-model',
        ENTITY_EMBEDDING_ENABLED: 'false',
        ENTITY_MIND_PATH: mindPath,
        ENTITY_MIND_INDEX_PATH: join(mindPath, '.index.db'),
        ENTITY_OBSERVABILITY_EVENTS_PATH: join(mindPath, 'security/events.jsonl'),
        ENTITY_OBSERVABILITY_METRICS_PATH: join(mindPath, 'security/metrics.jsonl'),
        ENTITY_SECURITY_AUDIT_LOG_PATH: join(mindPath, 'security/audit.log'),
        ENTITY_SECURITY_ACTION_LOG_PATH: join(mindPath, 'security/action_log.json'),
        ENTITY_SECURITY_TOKEN_USAGE_PATH: join(mindPath, 'security/token_usage.jsonl'),
        ENTITY_SECURITY_CHECKSUMS_PATH: join(mindPath, 'security/checksums.json'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    daemon.stdout?.on('data', (chunk: any) => {
      stdout += chunk.toString();
    });
    daemon.stderr?.on('data', (chunk: any) => {
      stderr += chunk.toString();
    });

    t.after(async () => {
      try {
        if (daemon.exitCode === null && daemon.signalCode === null) {
          daemon.kill('SIGTERM');
          await waitForProcessExit(daemon, 5000);
        }
      } finally {
        await mockServer.stop();
        await rm(tempRoot, { recursive: true, force: true });
      }
    });

    const baseUrl = `http://127.0.0.1:${httpPort}`;
    const ready = await waitForHttpHealth(baseUrl, 30000);
    assert.strictEqual(ready, true, `daemon failed to become healthy\nstdout:\n${stdout}\nstderr:\n${stderr}`);

    const wsClient = await openWsClient(`ws://127.0.0.1:${wsPort}`);
    t.after(async () => {
      await wsClient.close();
    });

    const { response, data } = await postJson(baseUrl, '/message', {
      content: 'smoke cycle',
      metadata: { source: 'net-smoke' },
    });

    assert.strictEqual(response.status, 200, `unexpected status with daemon logs\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    assert.ok(data.cycleId);

    const cycleComplete = await wsClient.waitFor(
      (message: any) => message.type === 'cycle_complete' && message.cycleId === data.cycleId,
      10000
    );
    assert.strictEqual(cycleComplete.cycleId, data.cycleId);

    const killResult = await postJson(baseUrl, '/kill', {});
    assert.strictEqual(killResult.response.status, 200);

    const exit = await waitForProcessExit(daemon, 15000);
    assert.notStrictEqual(exit.signal, 'TIMEOUT', `daemon did not exit after /kill\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    assert.strictEqual(exit.code, 0, `daemon exited unexpectedly\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  });
});
