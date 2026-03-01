#!/usr/bin/env node
/**
 * Soak runner for long-running daemon validation.
 *
 * - Starts deterministic mock LLM server
 * - Starts entity daemon as child process
 * - Drives mixed HTTP traffic and keeps a WS subscriber
 * - Samples /status health during run
 * - Writes JSON + markdown reports
 */

import { spawn } from 'child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import WebSocket from 'ws';
import { startMockLlmServer } from '../test/mock-llm-server.js';

function parseArgs(argv) {
  const args = {};
  for (const entry of argv) {
    if (!entry.startsWith('--')) continue;
    const [key, value] = entry.slice(2).split('=');
    args[key] = value ?? 'true';
  }
  return args;
}

function parseDuration(value, fallbackMs) {
  if (!value) return fallbackMs;
  const match = String(value).trim().match(/^(\d+)(s|m|h)$/i);
  if (!match) return fallbackMs;
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  return amount * 60 * 60 * 1000;
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) return rejectPort(error);
        resolvePort(port);
      });
    });
  });
}

async function sleep(ms) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHttpHealth(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return true;
    } catch {
      // Retry until timeout
    }
    await sleep(250);
  }
  return false;
}

function thresholdProfile(name) {
  const normalized = String(name || 'balanced').toLowerCase();
  if (normalized === 'strict') {
    return {
      name: 'strict',
      maxLlmSchemaFallbackRate: 0.01,
      maxCycleFailureRate: 0.005,
      maxRequestFailureRate: 0.005,
    };
  }

  if (normalized === 'relaxed') {
    return {
      name: 'relaxed',
      maxLlmSchemaFallbackRate: 0.03,
      maxCycleFailureRate: 0.02,
      maxRequestFailureRate: 0.02,
    };
  }

  return {
    name: 'balanced',
    maxLlmSchemaFallbackRate: 0.02,
    maxCycleFailureRate: 0.01,
    maxRequestFailureRate: 0.01,
  };
}

async function createMindFixture(rootDir) {
  const mindPath = join(rootDir, 'mind');
  const directories = [
    'identity',
    'emotions',
    'goals',
    'world',
    'actions',
    'actions/plans',
    'thoughts',
    'thoughts/reflections',
    'memory/episodic',
    'self',
    'security',
  ];

  for (const directory of directories) {
    await mkdir(join(mindPath, directory), { recursive: true });
  }

  const now = new Date().toISOString();
  await Promise.all([
    writeFile(join(mindPath, 'identity/self.md'), '# Self\nI am a soak-test entity.\n', 'utf-8'),
    writeFile(join(mindPath, 'identity/values.md'), '# Values\n- Safety\n- Reliability\n', 'utf-8'),
    writeFile(join(mindPath, 'identity/voice.md'), '# Voice\nDirect and concise.\n', 'utf-8'),
    writeFile(
      join(mindPath, 'emotions/state.json'),
      JSON.stringify({
        primary: 'neutral',
        intensity: 0.5,
        secondary: null,
        secondaryIntensity: 0,
        momentum: 'stable',
        source: 'soak-fixture',
        lastUpdated: now,
      }, null, 2),
      'utf-8'
    ),
    writeFile(join(mindPath, 'goals/active.md'), '# Goals\n- Remain stable during soak\n', 'utf-8'),
    writeFile(join(mindPath, 'world/context.md'), `# Context\nLast updated: ${now}\n`, 'utf-8'),
    writeFile(join(mindPath, 'actions/toolbox.md'), '# Toolbox\n- shell\n- file\n- browser\n- config\n', 'utf-8'),
    writeFile(join(mindPath, 'actions/capabilities.md'), '# Capabilities\n', 'utf-8'),
    writeFile(join(mindPath, 'thoughts/stream.md'), '# Thought Stream\n', 'utf-8'),
    writeFile(join(mindPath, 'self/preferences.md'), '# Preferences\n- **Interval**: Every 30 minutes (*/30 * * * *)\n', 'utf-8'),
  ]);

  return mindPath;
}

async function closeWebSocket(ws) {
  if (!ws) return;
  if (ws.readyState === WebSocket.CLOSED) return;
  await new Promise((resolveClose) => {
    ws.once('close', () => resolveClose());
    ws.close();
  });
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function formatReportMarkdown(report) {
  const status = report.pass ? 'PASS' : 'FAIL';
  const lines = [
    `# Soak Report (${status})`,
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Duration (ms): ${report.durationMs}`,
    `- Threshold Profile: ${report.thresholds.name}`,
    `- Requests: ${report.requests.total}`,
    `- Request Failures: ${report.requests.failed}`,
    `- Request Failure Rate: ${report.requests.failureRate}`,
    `- Max LLM Schema Fallback Rate: ${report.health.maxLlmSchemaFallbackRate}`,
    `- Max Cycle Failure Rate: ${report.health.maxCycleFailureRate}`,
    `- Daemon Exited Early: ${report.daemon.exitedEarly}`,
    `- WS Messages: ${report.websocket.totalMessages}`,
    '',
    '## Failures',
  ];

  if (report.failures.length === 0) {
    lines.push('- None');
  } else {
    for (const failure of report.failures) {
      lines.push(`- ${failure}`);
    }
  }

  lines.push('');
  lines.push('## Health Samples');
  if (report.health.samples.length === 0) {
    lines.push('- None captured');
  } else {
    for (const sample of report.health.samples.slice(-10)) {
      lines.push(`- ${sample.timestamp}: fallback=${sample.health.llmSchemaFallbackRate1h}, cycleFailure=${sample.health.cycleFailureRate1h}, errors=${sample.health.errorCount1h}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const durationMs = parseDuration(args.duration, 15 * 60 * 1000);
  const thresholds = thresholdProfile(args.thresholds || 'balanced');
  const requestIntervalMs = parseDuration(args.requestInterval || '10s', 10 * 1000);
  const healthIntervalMs = parseDuration(args.healthInterval || '30s', 30 * 1000);

  const runStartedAt = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportsDir = join('/Users/drewbaskin/agi/entity', 'entity-workspace', 'reports');
  await mkdir(reportsDir, { recursive: true });

  const tempRoot = await mkdtemp(join(tmpdir(), 'entity-soak-'));
  const mindPath = await createMindFixture(tempRoot);
  await mkdir(join(tempRoot, 'entity-workspace'), { recursive: true });

  const httpPort = await getFreePort();
  const wsPort = await getFreePort();
  const mockPort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const wsUrl = `ws://127.0.0.1:${wsPort}`;

  let daemon = null;
  let ws = null;
  let daemonExitedEarly = false;
  let daemonExitInfo = { code: null, signal: null };
  const daemonStdout = [];
  const daemonStderr = [];

  const report = {
    timestamp: new Date().toISOString(),
    durationMs,
    thresholds,
    pass: false,
    failures: [],
    requests: {
      total: 0,
      failed: 0,
      durationsMs: [],
    },
    websocket: {
      totalMessages: 0,
      byType: {},
      parseErrors: 0,
    },
    health: {
      samples: [],
      maxLlmSchemaFallbackRate: 0,
      maxCycleFailureRate: 0,
      maxErrorCount1h: 0,
    },
    daemon: {
      exitedEarly: false,
      exitCode: null,
      exitSignal: null,
      stdoutTail: [],
      stderrTail: [],
    },
  };

  const mockServer = await startMockLlmServer({
    host: '127.0.0.1',
    port: mockPort,
    behavior: { needsAction: false },
  });

  try {
    daemon = spawn(process.execPath, ['src/index.js'], {
      cwd: '/Users/drewbaskin/agi/entity',
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

    daemon.stdout?.on('data', (chunk) => {
      daemonStdout.push(chunk.toString());
      if (daemonStdout.length > 500) daemonStdout.shift();
    });
    daemon.stderr?.on('data', (chunk) => {
      daemonStderr.push(chunk.toString());
      if (daemonStderr.length > 500) daemonStderr.shift();
    });
    daemon.on('exit', (code, signal) => {
      daemonExitInfo = { code, signal };
      daemonExitedEarly = Date.now() - runStartedAt < durationMs;
    });

    const ready = await waitForHttpHealth(baseUrl, 60000);
    if (!ready) {
      report.failures.push('Daemon did not become healthy within timeout');
      throw new Error('Daemon did not become healthy within timeout');
    }

    ws = new WebSocket(wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      const timeout = setTimeout(() => rejectOpen(new Error('WS open timeout')), 10000);
      ws.once('open', () => {
        clearTimeout(timeout);
        resolveOpen();
      });
      ws.once('error', (error) => {
        clearTimeout(timeout);
        rejectOpen(error);
      });
    });

    ws.on('message', (raw) => {
      report.websocket.totalMessages += 1;
      try {
        const message = JSON.parse(raw.toString());
        const type = message.type || 'unknown';
        report.websocket.byType[type] = (report.websocket.byType[type] || 0) + 1;
      } catch {
        report.websocket.parseErrors += 1;
      }
    });

    const endAt = runStartedAt + durationMs;
    let nextRequestAt = Date.now();
    let nextHealthAt = Date.now();
    let requestId = 0;

    while (Date.now() < endAt) {
      if (daemon.exitCode !== null || daemon.signalCode !== null) {
        report.failures.push('Daemon exited before soak completion');
        break;
      }

      const now = Date.now();

      if (now >= nextRequestAt) {
        requestId += 1;
        report.requests.total += 1;

        const requestStart = Date.now();
        try {
          const response = await fetch(`${baseUrl}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `soak message ${requestId}`,
              metadata: { source: 'soak' },
            }),
          });

          report.requests.durationsMs.push(Date.now() - requestStart);
          if (!response.ok) {
            report.requests.failed += 1;
          } else {
            await response.json().catch(() => null);
          }
        } catch {
          report.requests.durationsMs.push(Date.now() - requestStart);
          report.requests.failed += 1;
        }

        nextRequestAt = now + requestIntervalMs;
      }

      if (now >= nextHealthAt) {
        try {
          const response = await fetch(`${baseUrl}/status`);
          if (response.ok) {
            const status = await response.json();
            const health = status.health || {};
            report.health.samples.push({
              timestamp: new Date().toISOString(),
              health,
            });
            report.health.maxLlmSchemaFallbackRate = Math.max(
              report.health.maxLlmSchemaFallbackRate,
              Number(health.llmSchemaFallbackRate1h || 0)
            );
            report.health.maxCycleFailureRate = Math.max(
              report.health.maxCycleFailureRate,
              Number(health.cycleFailureRate1h || 0)
            );
            report.health.maxErrorCount1h = Math.max(
              report.health.maxErrorCount1h,
              Number(health.errorCount1h || 0)
            );
          }
        } catch {
          // Best effort health sampling
        }

        nextHealthAt = now + healthIntervalMs;
      }

      await sleep(250);
    }

    if (daemonExitedEarly) {
      report.failures.push('Daemon exited early during soak');
    }
  } catch (error) {
    report.failures.push(`Runner error: ${error.message}`);
  } finally {
    try {
      await closeWebSocket(ws);
    } catch {
      // Ignore cleanup errors
    }

    try {
      if (daemon && daemon.exitCode === null && daemon.signalCode === null) {
        await fetch(`${baseUrl}/kill`, { method: 'POST' }).catch(() => null);
        const exited = await new Promise((resolveExit) => {
          const timeout = setTimeout(() => resolveExit(false), 10000);
          daemon.once('exit', () => {
            clearTimeout(timeout);
            resolveExit(true);
          });
        });
        if (!exited) {
          daemon.kill('SIGKILL');
        }
      }
    } catch {
      if (daemon && daemon.exitCode === null && daemon.signalCode === null) {
        daemon.kill('SIGKILL');
      }
    }

    try {
      await mockServer.stop();
    } catch {
      // Ignore cleanup errors
    }

    await rm(tempRoot, { recursive: true, force: true });
  }

  report.daemon.exitedEarly = daemonExitedEarly;
  report.daemon.exitCode = daemonExitInfo.code;
  report.daemon.exitSignal = daemonExitInfo.signal;
  report.daemon.stdoutTail = daemonStdout.join('').trim().split('\n').slice(-50);
  report.daemon.stderrTail = daemonStderr.join('').trim().split('\n').slice(-50);
  report.requests.failureRate = report.requests.total > 0
    ? report.requests.failed / report.requests.total
    : 0;
  report.requests.p95LatencyMs = percentile(report.requests.durationsMs, 95);
  report.requests.maxLatencyMs = report.requests.durationsMs.length
    ? Math.max(...report.requests.durationsMs)
    : 0;

  if (report.health.maxLlmSchemaFallbackRate >= thresholds.maxLlmSchemaFallbackRate) {
    report.failures.push(
      `LLM schema fallback rate exceeded threshold (${report.health.maxLlmSchemaFallbackRate} >= ${thresholds.maxLlmSchemaFallbackRate})`
    );
  }
  if (report.health.maxCycleFailureRate >= thresholds.maxCycleFailureRate) {
    report.failures.push(
      `Cycle failure rate exceeded threshold (${report.health.maxCycleFailureRate} >= ${thresholds.maxCycleFailureRate})`
    );
  }
  if (report.requests.failureRate >= thresholds.maxRequestFailureRate) {
    report.failures.push(
      `Request failure rate exceeded threshold (${report.requests.failureRate} >= ${thresholds.maxRequestFailureRate})`
    );
  }
  if (daemonExitedEarly) {
    report.failures.push('Daemon stability check failed (early exit)');
  }

  report.pass = report.failures.length === 0;

  const jsonPath = join(reportsDir, `soak-${timestamp}.json`);
  const mdPath = join(reportsDir, `soak-${timestamp}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await writeFile(mdPath, formatReportMarkdown(report), 'utf-8');

  console.log(`Soak report written: ${jsonPath}`);
  console.log(`Soak summary written: ${mdPath}`);
  console.log(`Status: ${report.pass ? 'PASS' : 'FAIL'}`);
  if (report.failures.length > 0) {
    for (const failure of report.failures) {
      console.error(`- ${failure}`);
    }
  }

  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error('Soak runner failed:', error);
  process.exit(1);
});

