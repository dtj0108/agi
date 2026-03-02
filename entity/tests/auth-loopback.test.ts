/**
 * Loopback OAuth flow tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import { runLoopbackLogin } from '../src/auth/flows/loopback.js';

async function canBindLoopback() {
  return new Promise((resolve: any) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(0, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

function createProvider() {
  return {
    discoverMetadata: async () => ({
      authorization_endpoint: 'https://issuer.example.com/oauth/authorize',
      token_endpoint: 'https://issuer.example.com/oauth/token',
    }),
    buildAuthorizationUrl: ({ redirectUri, state }: any) => {
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        state,
      });
      return `https://issuer.example.com/oauth/authorize?${params.toString()}`;
    },
    exchangeAuthorizationCode: async ({ code, redirectUri, codeVerifier }: any) => {
      assert.strictEqual(code, 'auth-code');
      assert.ok(codeVerifier);
      assert.ok(redirectUri.startsWith('http://127.0.0.1:'));
      return {
        access_token: 'oauth-access',
        refresh_token: 'oauth-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      };
    },
  };
}

describe('runLoopbackLogin', () => {
  it('completes login when callback code and state match', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }
    const provider = createProvider();

    const result = await runLoopbackLogin({
      provider,
      issuer: 'https://issuer.example.com',
      clientId: 'client-123',
      scopes: ['openid', 'profile'],
      callbackHost: '127.0.0.1',
      callbackPort: 39500,
      callbackPortRange: 20,
      openBrowser: async (authUrl: any) => {
        const parsed = new URL(authUrl);
        const redirectUri = parsed.searchParams.get('redirect_uri');
        const state = parsed.searchParams.get('state');
        setTimeout(() => {
          fetch(`${redirectUri}?code=auth-code&state=${encodeURIComponent(state)}`).catch(() => {});
        }, 10);
      },
      timeoutMs: 5000,
    });

    assert.strictEqual(result.tokens.access_token, 'oauth-access');
    assert.strictEqual(result.tokens.refresh_token, 'oauth-refresh');
  });

  it('rejects login when callback state mismatches', async (t: any) => {
    if (!(await canBindLoopback())) {
      t.skip('Loopback sockets are unavailable in this runtime');
      return;
    }
    const provider = createProvider();

    await assert.rejects(
      () =>
        runLoopbackLogin({
          provider,
          issuer: 'https://issuer.example.com',
          clientId: 'client-123',
          scopes: ['openid', 'profile'],
          callbackHost: '127.0.0.1',
          callbackPort: 39600,
          callbackPortRange: 20,
          openBrowser: async (authUrl: any) => {
            const parsed = new URL(authUrl);
            const redirectUri = parsed.searchParams.get('redirect_uri');
            setTimeout(() => {
              fetch(`${redirectUri}?code=auth-code&state=wrong-state`).catch(() => {});
            }, 10);
          },
          timeoutMs: 5000,
        }),
      /state mismatch/i
    );
  });
});
