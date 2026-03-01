import { mkdtemp, mkdir, writeFile, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve, sep, isAbsolute } from 'path';
import { createServer } from 'net';
import WebSocket from 'ws';
import { ActionGateway } from '../../src/action-gateway/index.js';
import { CognitiveEngine } from '../../src/cognitive-engine/index.js';
import { InterfaceLayer } from '../../src/interface/index.js';
import { configureTelemetry } from '../../src/observability/telemetry.js';

export async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) return reject(error);
        resolvePort(port);
      });
    });
    server.on('error', reject);
  });
}

export async function canBindLoopback() {
  return new Promise((resolveCanBind) => {
    const server = createServer();
    server.once('error', () => resolveCanBind(false));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolveCanBind(true));
    });
  });
}

export async function createMindFixture(rootDir) {
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
    writeFile(join(mindPath, 'identity/self.md'), '# Self\nI am a test entity.\n', 'utf-8'),
    writeFile(join(mindPath, 'identity/values.md'), '# Values\n- Safety\n- Honesty\n', 'utf-8'),
    writeFile(join(mindPath, 'identity/voice.md'), '# Voice\nDirect and clear.\n', 'utf-8'),
    writeFile(
      join(mindPath, 'emotions/state.json'),
      JSON.stringify({
        primary: 'neutral',
        intensity: 0.5,
        secondary: null,
        secondaryIntensity: 0,
        momentum: 'stable',
        source: 'fixture',
        lastUpdated: now,
      }, null, 2),
      'utf-8'
    ),
    writeFile(join(mindPath, 'goals/active.md'), '# Goals\n- Stay operational\n', 'utf-8'),
    writeFile(join(mindPath, 'world/context.md'), `# Context\nLast updated: ${now}\n`, 'utf-8'),
    writeFile(join(mindPath, 'actions/toolbox.md'), '# Toolbox\n- shell\n- file\n- browser\n- config\n', 'utf-8'),
    writeFile(join(mindPath, 'actions/capabilities.md'), '# Capabilities\n', 'utf-8'),
    writeFile(join(mindPath, 'thoughts/stream.md'), '# Thought Stream\n', 'utf-8'),
    writeFile(join(mindPath, 'self/preferences.md'), '# Preferences\n- **Interval**: Every 30 minutes (*/30 * * * *)\n', 'utf-8'),
  ]);

  return mindPath;
}

function resolveMindPath(mindPath, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    const error = new Error('Invalid path');
    error.code = 'INVALID_PATH';
    throw error;
  }
  if (relativePath.includes('\0')) {
    const error = new Error('Invalid path');
    error.code = 'INVALID_PATH';
    throw error;
  }
  if (isAbsolute(relativePath)) {
    const error = new Error('Invalid path');
    error.code = 'INVALID_PATH';
    throw error;
  }

  const root = resolve(mindPath);
  const fullPath = resolve(root, relativePath);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    const error = new Error('Invalid path');
    error.code = 'INVALID_PATH';
    throw error;
  }

  return fullPath;
}

function createTestMindServer(mindPath) {
  return {
    async readFile(relativePath) {
      const fullPath = resolveMindPath(mindPath, relativePath);
      return readFile(fullPath, 'utf-8');
    },
    async rollback(commitHash) {
      return { success: true, commitHash };
    },
    hasEmbeddings() {
      return false;
    },
    async hybridSearchMind() {
      return { results: [] };
    },
    git: {
      async commitAll() {},
      async commitPending() {},
    },
    async stop() {},
  };
}

function createConfig({ tempRoot, mindPath, httpPort, wsPort, apiKey = null }) {
  const workspacePath = join(tempRoot, 'entity-workspace');
  const securityPath = join(mindPath, 'security');

  return {
    projectRoot: tempRoot,
    mind: {
      path: mindPath,
      indexPath: join(mindPath, '.index.db'),
      gitDebounceMs: 5,
      fileWatchDebounceMs: 5,
    },
    llm: {
      api: 'openai-completions',
      baseUrl: 'http://127.0.0.1:9',
      apiKey: 'test-key',
      model: 'test-model',
      maxTokens: 512,
      temperature: 0,
      promptCaching: false,
      retryAttempts: 1,
      retryDelayMs: 1,
      timeoutMs: 1000,
      maxJsonRepairAttempts: 1,
    },
    embedding: {
      enabled: false,
    },
    cognitive: {
      reflectionInterval: 10,
      maxThoughtsInContext: 5,
      maxRelevantMemories: 0,
      emotionalDecayRate: 0.1,
      emotionalMomentum: 0.3,
      circuitBreakerThreshold: 0.95,
      circuitBreakerCycles: 5,
    },
    actions: {
      approvalTimeout: 5000,
      blockedPatterns: [],
      shell: {
        workingDir: workspacePath,
        timeout: 2000,
        maxOutputBytes: 256 * 1024,
        env: {
          PATH: process.env.PATH || '/usr/bin:/bin',
        },
      },
      browser: {
        allowedDomains: [],
      },
      files: {
        allowedPaths: [workspacePath, mindPath],
        blockedPaths: [],
        maxFileSizeBytes: 10 * 1024 * 1024,
      },
    },
    interface: {
      host: '127.0.0.1',
      httpPort,
      wsPort,
      enableCli: false,
      corsOrigins: ['*'],
      apiKey,
    },
    heartbeat: {
      enabled: false,
      schedule: '*/30 * * * *',
      prompt: 'heartbeat',
    },
    security: {
      auditLogPath: join(securityPath, 'audit.log'),
      actionLogPath: join(securityPath, 'action_log.json'),
      tokenUsagePath: join(securityPath, 'token_usage.jsonl'),
      checksumsPath: join(securityPath, 'checksums.json'),
    },
    observability: {
      enabled: true,
      eventsPath: join(securityPath, 'events.jsonl'),
      metricsPath: join(securityPath, 'metrics.jsonl'),
      windowMinutes: 60,
      redactKeys: ['authorization', 'apiKey', 'api_key', 'token'],
    },
    logging: {
      level: 'error',
    },
  };
}

function createDeterministicLlmResponder(behavior = {}) {
  const needsAction = behavior.needsAction === true;
  const approvalPlan = behavior.approvalPlan === true;

  const payloadForPhase = (phase) => {
    if (phase === 'think') {
      return {
        thoughts: needsAction
          ? 'I should use a plan for this request.'
          : 'I can answer without actions.',
        needsAction,
        userResponse: needsAction
          ? 'I am preparing and executing a safe plan.'
          : 'Done. No external action needed.',
        emotionalShift: {
          primary: { emotion: 'curiosity', delta: 0.1 },
          secondary: null,
        },
        actionIntent: needsAction ? 'Execute a deterministic test step' : null,
      };
    }

    if (phase === 'plan') {
      if (!needsAction) {
        return {
          goal: 'No action required',
          steps: [],
          rollback: null,
          emotionalContext: 'calm',
        };
      }

      if (approvalPlan) {
        return {
          goal: 'Obtain approval for a tier-3 step',
          steps: [
            {
              tool: 'shell',
              action: 'unknowncommand',
              params: { command: 'unknowncommand' },
              intent: 'Exercise approval flow safely',
            },
          ],
          rollback: null,
          emotionalContext: 'cautious',
        };
      }

      return {
        goal: 'Run a simple command',
        steps: [
          {
            tool: 'shell',
            action: 'ls',
            params: { command: 'ls' },
            intent: 'Gather local context',
          },
        ],
        rollback: null,
        emotionalContext: 'focused',
      };
    }

    if (phase === 'reflect') {
      return {
        reflection: 'The execution was reviewed.',
        emotionalUpdate: {
          primary: { emotion: 'neutral', delta: 0 },
          secondary: null,
        },
        goalUpdate: null,
        skillLearned: null,
        valueAlignment: 0.7,
        lessonsLearned: ['Use deterministic data in tests'],
      };
    }

    return { ok: true };
  };

  return async (_systemPrompt, _messages, options = {}) => {
    const payload = payloadForPhase(options.phase || 'unknown');
    return {
      text: JSON.stringify(payload),
      usage: {
        inputTokens: 25,
        outputTokens: 15,
        cachedTokens: 0,
      },
    };
  };
}

export async function startInProcessEntity(options = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'entity-integration-'));
  const mindPath = await createMindFixture(tempRoot);
  await mkdir(join(tempRoot, 'entity-workspace'), { recursive: true });

  const httpPort = await getFreePort();
  const wsPort = await getFreePort();
  const config = createConfig({
    tempRoot,
    mindPath,
    httpPort,
    wsPort,
    apiKey: options.apiKey || null,
  });

  configureTelemetry(config.observability);

  const mindServer = createTestMindServer(mindPath);
  const executionEngines = {
    shell: {
      async execute(command) {
        if (command === 'unknowncommand') {
          return { success: false, error: 'spawn unknowncommand ENOENT', exitCode: null };
        }
        return { success: true, stdout: 'ok', exitCode: 0 };
      },
    },
    browser: {
      async execute() {
        return { success: true };
      },
    },
    files: {
      async execute() {
        return { success: true };
      },
    },
  };

  const actionGateway = new ActionGateway(config, executionEngines);
  const cognitiveEngine = new CognitiveEngine(config, actionGateway, mindServer);
  cognitiveEngine.llm.complete = createDeterministicLlmResponder(options.llmBehavior || {});
  await cognitiveEngine.initialize();

  const interfaceLayer = new InterfaceLayer(config, cognitiveEngine, actionGateway, mindServer);
  interfaceLayer.start();

  const baseUrl = `http://${config.interface.host}:${config.interface.httpPort}`;
  const wsUrl = `ws://${config.interface.host}:${config.interface.wsPort}`;

  const stop = async () => {
    try {
      interfaceLayer.stop();
    } finally {
      configureTelemetry({ enabled: false });
      await rm(tempRoot, { recursive: true, force: true });
    }
  };

  return {
    tempRoot,
    mindPath,
    config,
    interfaceLayer,
    cognitiveEngine,
    actionGateway,
    baseUrl,
    wsUrl,
    stop,
  };
}

export async function postJson(baseUrl, path, body, apiKey = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}

export async function getJson(baseUrl, path, apiKey = null) {
  const headers = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const response = await fetch(`${baseUrl}${path}`, { headers });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}

export async function openWsClient(url, options = {}) {
  const ws = new WebSocket(url, {
    headers: options.headers || {},
  });
  const messages = [];

  await new Promise((resolveOpen, rejectOpen) => {
    const timeout = setTimeout(() => rejectOpen(new Error('WebSocket open timeout')), 5000);
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
    try {
      messages.push(JSON.parse(raw.toString()));
    } catch {
      // Ignore invalid JSON payloads in tests
    }
  });

  const waitFor = async (predicate, timeoutMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = messages.find(predicate);
      if (found) return found;
      await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    }
    throw new Error('Timed out waiting for WebSocket message');
  };

  const sendJson = (payload) => {
    ws.send(JSON.stringify(payload));
  };

  const close = async () => {
    if (ws.readyState === WebSocket.CLOSED) {
      return;
    }
    await new Promise((resolveClose) => {
      ws.once('close', () => resolveClose());
      ws.close();
    });
  };

  return { ws, messages, waitFor, sendJson, close };
}

export async function waitForCondition(check, timeoutMs = 5000, intervalMs = 20) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  return false;
}
