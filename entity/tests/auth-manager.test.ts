/**
 * Auth manager behavior tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createAuthManager } from '../src/auth/index.js';

function createConfig({ apiKey = '', authFilePath = '/tmp/entity-auth-test.json' }: any = {}) {
  return {
    projectRoot: '/tmp/entity-test',
    llm: {
      apiKey,
      credentialSource: 'auto',
    },
    auth: {
      mode: 'hybrid',
      oauth: {
        provider: 'oidc',
        issuer: 'https://issuer.example.com',
        clientId: 'client-123',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        flow: 'device_code',
        callbackHost: '127.0.0.1',
        callbackPort: 1455,
        callbackPortRange: 5,
      },
      storage: {
        mode: 'keychain_fallback_file',
        filePath: authFilePath,
      },
    },
  };
}

function createProvider() {
  return {
    discoverMetadata: async () => ({
      authorization_endpoint: 'https://issuer.example.com/oauth/authorize',
      token_endpoint: 'https://issuer.example.com/oauth/token',
      device_authorization_endpoint: 'https://issuer.example.com/oauth/device',
    }),
    startDeviceAuthorization: async () => ({
      device_code: 'device-code',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://issuer.example.com/device',
      verification_uri_complete: 'https://issuer.example.com/device?code=ABCD-EFGH',
      interval: 1,
      expires_in: 300,
    }),
    pollDeviceToken: async () => ({
      access_token: 'oauth-access',
      refresh_token: 'oauth-refresh',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: 'header.payload.sig',
    }),
    refreshToken: async () => ({
      access_token: 'oauth-access-refreshed',
      refresh_token: 'oauth-refresh-2',
      token_type: 'Bearer',
      expires_in: 3600,
    }),
  };
}

function createKeychainStorage({ available = true, saveThrows = false }: any = {}) {
  return {
    source: 'keychain',
    isAvailable: () => available,
    load: () => null,
    save: () => {
      if (saveThrows) {
        throw new Error('keychain unavailable');
      }
    },
    clear: () => {},
  };
}

type StoredCredentials = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
} & Record<string, unknown>;

function createMemoryFileStorage() {
  let value: StoredCredentials | null = null;
  return {
    source: 'file',
    load: () => value,
    save: (payload: any) => {
      value = payload;
    },
    clear: () => {
      value = null;
    },
    get value() {
      return value;
    },
  };
}

describe('AuthManager', () => {
  it('falls back to file storage when keychain save fails', async () => {
    const fileStorage = createMemoryFileStorage();
    const manager = createAuthManager(createConfig(), {
      provider: createProvider(),
      keychainStorage: createKeychainStorage({ available: true, saveThrows: true }),
      fileStorage,
    });

    let prompted = false;
    const result = await manager.login({
      flow: 'device_code',
      onDevicePrompt: async () => {
        prompted = true;
      },
    });

    assert.strictEqual(prompted, true);
    assert.strictEqual(result.status.loggedIn, true);
    assert.strictEqual(result.status.source, 'oauth');
    assert.ok(fileStorage.value);
    assert.strictEqual(fileStorage.value.accessToken, 'oauth-access');
  });

  it('refreshes expired OAuth tokens and persists the updated token set', async () => {
    const fileStorage = createMemoryFileStorage();
    const manager = createAuthManager(createConfig(), {
      provider: createProvider(),
      keychainStorage: createKeychainStorage({ available: false }),
      fileStorage,
    });

    await manager.login({ flow: 'device_code' });

    await manager.persistCredentials({
      ...fileStorage.value,
      expiresAt: Date.now() - 10_000,
    });

    const refreshed = await manager.refreshTokens({ force: true });
    assert.ok(refreshed);
    assert.strictEqual(refreshed.accessToken, 'oauth-access-refreshed');
    assert.strictEqual(fileStorage.value?.accessToken, 'oauth-access-refreshed');
    assert.strictEqual(fileStorage.value?.refreshToken, 'oauth-refresh-2');
  });

  it('keeps API key precedence in hybrid auto mode and falls back to oauth when missing', async () => {
    const oauthCredentials = {
      provider: 'oidc',
      issuer: 'https://issuer.example.com',
      clientId: 'client-123',
      scope: 'openid profile email offline_access',
      tokenType: 'Bearer',
      accessToken: 'oauth-token',
      refreshToken: 'refresh-token',
      idToken: 'header.payload.sig',
      expiresAt: Date.now() + 3600_000,
      obtainedAt: Date.now(),
    };

    const managerWithApiKey = createAuthManager(createConfig({ apiKey: 'config-token' }), {
      provider: createProvider(),
      keychainStorage: createKeychainStorage({ available: false }),
      fileStorage: {
        source: 'file',
        load: () => oauthCredentials,
        save: () => {},
        clear: () => {},
      },
    });

    const withApiKey = await managerWithApiKey.resolveOpenAICredential();
    assert.strictEqual(withApiKey.token, 'config-token');
    assert.strictEqual(withApiKey.source, 'config');

    const managerWithoutApiKey = createAuthManager(createConfig({ apiKey: '' }), {
      provider: createProvider(),
      keychainStorage: createKeychainStorage({ available: false }),
      fileStorage: {
        source: 'file',
        load: () => oauthCredentials,
        save: () => {},
        clear: () => {},
      },
    });

    const withoutApiKey = await managerWithoutApiKey.resolveOpenAICredential();
    assert.strictEqual(withoutApiKey.token, 'oauth-token');
    assert.strictEqual(withoutApiKey.source, 'oauth');
  });
});
