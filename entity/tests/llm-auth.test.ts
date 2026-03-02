/**
 * LLM auth credential selection tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LLM } from '../src/cognitive-engine/llm.js';
import { configureTelemetry } from '../src/observability/telemetry.js';

function createConfig({ apiKey = '', credentialSource = 'auto' }: any = {}) {
  return {
    llm: {
      api: 'openai-completions',
      baseUrl: 'https://example.com/v1',
      apiKey,
      credentialSource,
      model: 'gpt-test',
      maxTokens: 128,
      temperature: 0,
      retryAttempts: 1,
      retryDelayMs: 1,
      timeoutMs: 1000,
      maxJsonRepairAttempts: 1,
      promptCaching: false,
    },
    auth: {
      mode: 'hybrid',
      oauth: {
        provider: 'oidc',
        issuer: 'https://issuer.example.com',
        clientId: 'client-123',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        flow: 'auto',
        callbackHost: '127.0.0.1',
        callbackPort: 1455,
        callbackPortRange: 5,
      },
      storage: {
        mode: 'keychain_fallback_file',
        filePath: '/tmp/entity-llm-auth.json',
      },
    },
    security: {
      tokenUsagePath: null,
    },
  };
}

describe('LLM OpenAI credential resolution', () => {
  it('uses OAuth token when credentialSource=auth_store and API key is absent', async () => {
    configureTelemetry({ enabled: false });

    const llm = new LLM(createConfig({ apiKey: '', credentialSource: 'auth_store' }));
    llm.authManager = {
      resolveOpenAICredential: async () => ({ token: 'oauth-token', source: 'oauth' }),
      refreshTokens: async () => null,
    };

    const originalFetch = global.fetch;
    let authHeader = null;

    global.fetch = async (url: any, options: any) => {
      authHeader = options.headers.Authorization;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    try {
      const result = await llm.completeOpenAI('system', [], {});
      assert.strictEqual(authHeader, 'Bearer oauth-token');
      assert.strictEqual(result.text, 'ok');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('retries once after 401 when using OAuth source and refresh succeeds', async () => {
    configureTelemetry({ enabled: false });

    const llm = new LLM(createConfig({ apiKey: '', credentialSource: 'auth_store' }));
    let token = 'oauth-old';

    llm.authManager = {
      resolveOpenAICredential: async () => ({ token, source: 'oauth' }),
      refreshTokens: async () => {
        token = 'oauth-new';
        return { accessToken: token };
      },
    };

    const originalFetch = global.fetch;
    const authHeaders: any[] = [];
    let callCount = 0;

    global.fetch = async (url: any, options: any) => {
      callCount += 1;
      authHeaders.push(options.headers.Authorization);

      if (callCount === 1) {
        return new Response('unauthorized', { status: 401 });
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok-after-refresh' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    try {
      const result = await llm.completeOpenAI('system', [], {});
      assert.strictEqual(callCount, 2);
      assert.deepStrictEqual(authHeaders, ['Bearer oauth-old', 'Bearer oauth-new']);
      assert.strictEqual(result.text, 'ok-after-refresh');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back to configured API key when auth manager has no token', async () => {
    configureTelemetry({ enabled: false });

    const llm = new LLM(createConfig({ apiKey: 'config-token', credentialSource: 'auto' }));
    llm.authManager = {
      resolveOpenAICredential: async () => ({ token: null, source: 'oauth_missing' }),
      refreshTokens: async () => null,
    };

    const originalFetch = global.fetch;
    let authHeader = null;

    global.fetch = async (url: any, options: any) => {
      authHeader = options.headers.Authorization;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok-config' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    try {
      const result = await llm.completeOpenAI('system', [], {});
      assert.strictEqual(authHeader, 'Bearer config-token');
      assert.strictEqual(result.text, 'ok-config');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
