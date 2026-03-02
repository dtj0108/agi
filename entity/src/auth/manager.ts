/**
 * Local auth manager
 *
 * Handles provider-agnostic OIDC login, credential persistence,
 * refresh, and runtime status checks.
 */

import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import { OidcProvider } from './providers/oidc.js';
import { runLoopbackLogin } from './flows/loopback.js';
import { runDeviceCodeLogin } from './flows/device-code.js';
import { KeychainAuthStorage } from './storage/keychain.js';
import { FileAuthStorage } from './storage/file.js';

const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

function toNumber(value: any, fallback: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trimTrailingSlash(value: any) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeScopes(scopes: any) {
  if (Array.isArray(scopes)) {
    return scopes.map((scope: any) => String(scope).trim()).filter(Boolean);
  }
  if (typeof scopes === 'string') {
    return scopes
      .split(/[\s,]+/)
      .map((scope: any) => scope.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_SCOPES];
}

function isNonEmptyString(value: any) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseJwtExp(token: any) {
  if (!isNonEmptyString(token)) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (!Number.isFinite(parsed?.exp)) return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

function normalizeTokenSet(tokenResponse: any, { issuer, clientId, scope }: any, previous: any = null) {
  if (!isNonEmptyString(tokenResponse?.access_token)) {
    throw new Error('OAuth token response missing access_token');
  }

  const expiresIn = toNumber(tokenResponse.expires_in, null);
  const computedExpiresAt =
    expiresIn !== null
      ? Date.now() + Math.max(1, expiresIn) * 1000
      : parseJwtExp(tokenResponse.id_token) || parseJwtExp(tokenResponse.access_token) || null;

  return {
    provider: 'oidc',
    issuer: trimTrailingSlash(issuer),
    clientId: String(clientId || previous?.clientId || ''),
    scope: String(scope || previous?.scope || ''),
    tokenType: String(tokenResponse.token_type || previous?.tokenType || 'Bearer'),
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || previous?.refreshToken || null,
    idToken: tokenResponse.id_token || previous?.idToken || null,
    expiresAt: computedExpiresAt,
    obtainedAt: Date.now(),
  };
}

function isTokenExpired(expiresAtMs: any, skewMs: any = 60_000) {
  if (!Number.isFinite(expiresAtMs)) return false;
  return Date.now() + skewMs >= expiresAtMs;
}

function openBrowserUrl(url: any) {
  let command = null;
  let args: any[] = [];

  if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  return new Promise((resolve: any, reject: any) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

function buildDefaultAuthConfig(config: any) {
  const auth = config.auth || {};
  const oauth = auth.oauth || {};
  const storage = auth.storage || {};

  return {
    mode: auth.mode || 'hybrid',
    oauth: {
      provider: oauth.provider || 'oidc',
      issuer: oauth.issuer || '',
      clientId: oauth.clientId || '',
      scopes: normalizeScopes(oauth.scopes),
      flow: oauth.flow || 'auto',
      callbackHost: oauth.callbackHost || '127.0.0.1',
      callbackPort: toNumber(oauth.callbackPort, 1455),
      callbackPortRange: toNumber(oauth.callbackPortRange, 25),
      extraAuthorizeParams:
        oauth.extraAuthorizeParams && typeof oauth.extraAuthorizeParams === 'object'
          ? oauth.extraAuthorizeParams
          : {},
    },
    storage: {
      mode: storage.mode || 'keychain_fallback_file',
      filePath: storage.filePath || join(homedir(), '.entity', 'auth.json'),
    },
    llmCredentialSource: config.llm?.credentialSource || 'auto',
  };
}

export class AuthManager {
  config: any;
  credentialSource: any;
  credentials: any;
  credentialsLoaded: any;
  fileStorage: any;
  keychainStorage: any;
  provider: any;
  settings: any;
  constructor(config: any, dependencies: any = {}) {
    this.config = config;
    this.settings = buildDefaultAuthConfig(config);
    this.provider = dependencies.provider || new OidcProvider();

    this.keychainStorage =
      dependencies.keychainStorage || new KeychainAuthStorage({ service: 'entity.oauth', account: 'default' });
    this.fileStorage = dependencies.fileStorage || new FileAuthStorage(this.settings.storage.filePath);

    this.credentials = null;
    this.credentialSource = null;
    this.credentialsLoaded = false;
  }

  allowsApiKey() {
    return this.settings.mode === 'api_key' || this.settings.mode === 'hybrid';
  }

  allowsOAuth() {
    return this.settings.mode === 'oauth' || this.settings.mode === 'hybrid';
  }

  hasConfiguredApiKey() {
    return isNonEmptyString(this.config?.llm?.apiKey);
  }

  async loadCredentials({ reload = false }: any = {}) {
    if (reload) {
      this.credentialsLoaded = false;
    }

    if (this.credentialsLoaded) {
      return this.credentials;
    }

    this.credentialsLoaded = true;
    this.credentials = null;
    this.credentialSource = null;

    if (!this.allowsOAuth()) {
      return null;
    }

    if (this.settings.storage.mode === 'keychain_fallback_file' && this.keychainStorage.isAvailable()) {
      const fromKeychain = this.keychainStorage.load();
      if (fromKeychain) {
        this.credentials = fromKeychain;
        this.credentialSource = this.keychainStorage.source;
        return this.credentials;
      }
    }

    const fromFile = this.fileStorage.load();
    if (fromFile) {
      this.credentials = fromFile;
      this.credentialSource = this.fileStorage.source;
      return this.credentials;
    }

    return null;
  }

  async persistCredentials(credentials: any) {
    if (!credentials) {
      throw new Error('Cannot persist empty credentials');
    }

    if (this.settings.storage.mode === 'keychain_fallback_file' && this.keychainStorage.isAvailable()) {
      try {
        this.keychainStorage.save(credentials);
        this.fileStorage.clear();
        this.credentials = credentials;
        this.credentialSource = this.keychainStorage.source;
        this.credentialsLoaded = true;
        return;
      } catch {
        // Continue with file fallback.
      }
    }

    this.fileStorage.save(credentials);
    this.credentials = credentials;
    this.credentialSource = this.fileStorage.source;
    this.credentialsLoaded = true;
  }

  async clearCredentials() {
    this.keychainStorage.clear();
    this.fileStorage.clear();
    this.credentials = null;
    this.credentialSource = null;
    this.credentialsLoaded = true;
  }

  chooseFlow({
    flow,
    deviceCode = false,
    noBrowser = false
  }: any = {}) {
    if (deviceCode) return 'device_code';

    const desired = flow || this.settings.oauth.flow;
    if (desired !== 'auto') {
      return desired;
    }

    const interactive = Boolean(process.stdin?.isTTY && process.stdout?.isTTY);
    if (!interactive) {
      return 'device_code';
    }

    return 'browser';
  }

  validateOAuthSettings({ issuer, clientId, scopes }: any) {
    if (!isNonEmptyString(issuer)) {
      throw new Error('OAuth issuer is required');
    }
    if (!isNonEmptyString(clientId)) {
      throw new Error('OAuth clientId is required');
    }
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new Error('OAuth scopes are required');
    }
  }

  async login(options: any = {}) {
    if (!this.allowsOAuth()) {
      throw new Error(`OAuth login is disabled when auth.mode=${this.settings.mode}`);
    }

    const issuer = trimTrailingSlash(options.issuer || this.settings.oauth.issuer);
    const clientId = options.clientId || this.settings.oauth.clientId;
    const scopes = normalizeScopes(options.scopes || this.settings.oauth.scopes);
    this.validateOAuthSettings({ issuer, clientId, scopes });

    const flow = this.chooseFlow(options);

    let tokens: any;
    let authUrl = null;
    let deviceAuth = null;

    if (flow === 'device_code') {
      const result = await runDeviceCodeLogin({
        provider: this.provider,
        issuer,
        clientId,
        scopes,
        onPrompt: options.onDevicePrompt,
      });
      tokens = result.tokens;
      deviceAuth = result.deviceAuth;
    } else {
      const result = await runLoopbackLogin({
        provider: this.provider,
        issuer,
        clientId,
        scopes,
        callbackHost: options.callbackHost || this.settings.oauth.callbackHost,
        callbackPort: toNumber(options.callbackPort, this.settings.oauth.callbackPort),
        callbackPortRange: toNumber(options.callbackPortRange, this.settings.oauth.callbackPortRange),
        openBrowser: async (url: any) => {
          authUrl = url;
          if (typeof options.onAuthorizationUrl === 'function') {
            await options.onAuthorizationUrl(url);
          }
          if (!options.noBrowser) {
            await openBrowserUrl(url);
          }
        },
        extraAuthorizeParams: this.settings.oauth.extraAuthorizeParams,
      });

      tokens = result.tokens;
      authUrl = result.authUrl;
    }

    const normalized = normalizeTokenSet(tokens, {
      issuer,
      clientId,
      scope: scopes.join(' '),
    });

    await this.persistCredentials(normalized);

    return {
      flow,
      authUrl,
      deviceAuth,
      status: await this.getAuthStatus({ reload: false }),
    };
  }

  async logout() {
    await this.clearCredentials();
    return this.getAuthStatus({ reload: false });
  }

  async refreshTokens({ force = false }: any = {}) {
    if (!this.allowsOAuth()) return null;

    const current = await this.loadCredentials();
    if (!current?.refreshToken) {
      return null;
    }

    if (!force && !isTokenExpired(current.expiresAt)) {
      return current;
    }

    const metadata = await this.provider.discoverMetadata(current.issuer);
    const refreshed = await this.provider.refreshToken({
      metadata,
      issuer: current.issuer,
      clientId: current.clientId,
      refreshToken: current.refreshToken,
      scope: current.scope,
    });

    const merged = normalizeTokenSet(
      {
        ...refreshed,
        refresh_token: refreshed.refresh_token || current.refreshToken,
      },
      {
        issuer: current.issuer,
        clientId: current.clientId,
        scope: current.scope,
      },
      current
    );

    await this.persistCredentials(merged);
    return merged;
  }

  async getOAuthAccessToken({ forceRefresh = false }: any = {}) {
    if (!this.allowsOAuth()) return null;

    let credentials = await this.loadCredentials();
    if (!credentials?.accessToken) {
      return null;
    }

    if (forceRefresh || isTokenExpired(credentials.expiresAt)) {
      try {
        credentials = await this.refreshTokens({ force: true });
      } catch {
        return null;
      }
    }

    return credentials?.accessToken || null;
  }

  async resolveOpenAICredential() {
    const source = this.settings.llmCredentialSource;

    if (source === 'config') {
      return this.hasConfiguredApiKey()
        ? { token: this.config.llm.apiKey, source: 'config' }
        : { token: null, source: 'config' };
    }

    if (source === 'auth_store') {
      const oauthToken = await this.getOAuthAccessToken();
      return { token: oauthToken, source: oauthToken ? 'oauth' : 'oauth_missing' };
    }

    // auto
    if (this.settings.mode === 'api_key') {
      return this.hasConfiguredApiKey()
        ? { token: this.config.llm.apiKey, source: 'config' }
        : { token: null, source: 'config_missing' };
    }

    if (this.settings.mode === 'oauth') {
      const oauthToken = await this.getOAuthAccessToken();
      return { token: oauthToken, source: oauthToken ? 'oauth' : 'oauth_missing' };
    }

    // hybrid default: preserve existing API key behavior, then fallback to OAuth.
    if (this.hasConfiguredApiKey()) {
      return { token: this.config.llm.apiKey, source: 'config' };
    }

    const oauthToken = await this.getOAuthAccessToken();
    return { token: oauthToken, source: oauthToken ? 'oauth' : 'oauth_missing' };
  }

  async getAuthStatus({ reload = true }: any = {}) {
    const hasApiKey = this.hasConfiguredApiKey() && this.allowsApiKey();
    const oauthCredentials = this.allowsOAuth()
      ? await this.loadCredentials({ reload })
      : null;

    const oauthLoggedIn = Boolean(oauthCredentials?.accessToken);
    if (oauthLoggedIn) {
      return {
        mode: this.settings.mode,
        provider: this.settings.oauth.provider,
        loggedIn: true,
        expiresAt: Number.isFinite(oauthCredentials.expiresAt)
          ? new Date(oauthCredentials.expiresAt).toISOString()
          : null,
        source: 'oauth',
      };
    }

    if (hasApiKey) {
      return {
        mode: this.settings.mode,
        provider: 'api_key',
        loggedIn: true,
        expiresAt: null,
        source: 'api_key',
      };
    }

    return {
      mode: this.settings.mode,
      provider: this.settings.oauth.provider,
      loggedIn: false,
      expiresAt: null,
      source: 'missing',
    };
  }
}

export function normalizeAuthConfig(config: any) {
  return buildDefaultAuthConfig(config);
}
