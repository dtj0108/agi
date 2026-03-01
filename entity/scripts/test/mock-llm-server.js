#!/usr/bin/env node
/**
 * Deterministic mock LLM server for integration and soak tests.
 * Supports both OpenAI Chat Completions and Anthropic Messages APIs.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=');
    args[key] = value ?? 'true';
  }
  return args;
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') return part.text;
        return JSON.stringify(part);
      }
      return '';
    }).join('\n');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    return JSON.stringify(content);
  }
  return '';
}

function detectPhase(promptText = '') {
  const text = String(promptText).toUpperCase();
  if (text.includes('INSTRUCTIONS FOR THIS PHASE: THINK')) return 'think';
  if (text.includes('INSTRUCTIONS FOR THIS PHASE: PLAN')) return 'plan';
  if (text.includes('INSTRUCTIONS FOR THIS PHASE: REFLECT')) return 'reflect';
  return 'unknown';
}

function buildPayload(phase, behavior = {}) {
  const needsAction = behavior.needsAction === true;
  const approvalPlan = behavior.approvalPlan === true;

  if (phase === 'think') {
    return {
      thoughts: needsAction
        ? 'I should execute a plan for this request.'
        : 'I can respond directly without taking actions.',
      needsAction,
      userResponse: needsAction
        ? 'I will prepare a plan and proceed carefully.'
        : 'Acknowledged. No action is required.',
      emotionalShift: {
        primary: { emotion: 'curiosity', delta: 0.1 },
        secondary: null,
      },
      actionIntent: needsAction ? 'Safely test planned execution' : null,
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
        goal: 'Request approval for a guarded shell action',
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
      goal: 'Read current workspace listing',
      steps: [
        {
          tool: 'shell',
          action: 'ls',
          params: { command: 'ls' },
          intent: 'Collect context from workspace',
        },
      ],
      rollback: null,
      emotionalContext: 'focused',
    };
  }

  if (phase === 'reflect') {
    return {
      reflection: 'The cycle completed and results were evaluated.',
      emotionalUpdate: {
        primary: { emotion: 'satisfied', delta: 0.05 },
        secondary: null,
      },
      goalUpdate: null,
      skillLearned: null,
      valueAlignment: 0.8,
      lessonsLearned: ['Validate output contracts', 'Prefer deterministic execution in tests'],
    };
  }

  return {
    message: 'Unknown phase',
  };
}

function buildPromptTextFromOpenAI(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages.map((message) => contentToText(message.content)).join('\n');
}

function buildPromptTextFromAnthropic(body = {}) {
  const system = Array.isArray(body.system)
    ? body.system.map((block) => contentToText(block)).join('\n')
    : contentToText(body.system);

  const messages = Array.isArray(body.messages)
    ? body.messages.map((message) => contentToText(message.content)).join('\n')
    : '';

  return `${system}\n${messages}`;
}

export async function startMockLlmServer(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number.isFinite(Number(options.port)) ? Number(options.port) : 0;
  const behavior = options.behavior || {};

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      behavior,
    });
  });

  app.post('/chat/completions', (req, res) => {
    const prompt = buildPromptTextFromOpenAI(req.body);
    const phase = detectPhase(prompt);
    const payload = buildPayload(phase, behavior);
    const text = JSON.stringify(payload);

    res.json({
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: req.body?.model || 'mock-model',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: text,
          },
        },
      ],
      usage: {
        prompt_tokens: 32,
        completion_tokens: 24,
        total_tokens: 56,
      },
    });
  });

  app.post('/messages', (req, res) => {
    const prompt = buildPromptTextFromAnthropic(req.body);
    const phase = detectPhase(prompt);
    const payload = buildPayload(phase, behavior);
    const text = JSON.stringify(payload);

    res.json({
      id: `msg_mock_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: req.body?.model || 'mock-model',
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: 32,
        output_tokens: 24,
      },
      stop_reason: 'end_turn',
    });
  });

  const server = await new Promise((resolveServer) => {
    const httpServer = app.listen(port, host, () => resolveServer(httpServer));
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  const stop = async () => {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  };

  return {
    app,
    server,
    host,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    stop,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const behavior = {
    needsAction: args.needsAction === '1' || args.needsAction === 'true',
    approvalPlan: args.approvalPlan === '1' || args.approvalPlan === 'true',
  };

  const server = await startMockLlmServer({
    host: args.host || '127.0.0.1',
    port: args.port ? Number(args.port) : 0,
    behavior,
  });

  console.log(`MOCK_LLM_READY ${server.baseUrl}`);
}

const thisFile = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const isMain = resolve(thisFile) === invokedPath;

if (isMain) {
  main().catch((error) => {
    console.error('MOCK_LLM_ERROR', error);
    process.exit(1);
  });
}
