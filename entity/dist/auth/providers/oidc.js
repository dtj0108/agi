/**
 * OIDC Provider helper
 *
 * Provider-agnostic OpenID Connect primitives for authorization code,
 * device code, and refresh token flows.
 */
function trimTrailingSlash(url) {
    return String(url || '').replace(/\/+$/, '');
}
function formEncode(payload) {
    return new URLSearchParams(Object.entries(payload)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])).toString();
}
async function readJsonOrText(response) {
    const text = await response.text();
    try {
        return { text, json: JSON.parse(text) };
    }
    catch {
        return { text, json: null };
    }
}
function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timer),
    };
}
export class OidcProvider {
    metadataCache;
    timeoutMs;
    constructor({ timeoutMs = 20000 } = {}) {
        this.timeoutMs = timeoutMs;
        this.metadataCache = new Map();
    }
    normalizeIssuer(issuer) {
        const normalized = trimTrailingSlash(issuer);
        if (!normalized) {
            throw new Error('OIDC issuer is required');
        }
        return normalized;
    }
    async discoverMetadata(issuer, { force = false } = {}) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        if (!force && this.metadataCache.has(normalizedIssuer)) {
            return this.metadataCache.get(normalizedIssuer);
        }
        const wellKnownUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
        const { signal, clear } = createTimeoutSignal(this.timeoutMs);
        try {
            const response = await fetch(wellKnownUrl, { signal });
            if (!response.ok) {
                const { text } = await readJsonOrText(response);
                throw new Error(`OIDC discovery failed (${response.status}): ${text || 'no body'}`);
            }
            const metadata = await response.json();
            if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
                throw new Error('OIDC metadata missing authorization_endpoint or token_endpoint');
            }
            this.metadataCache.set(normalizedIssuer, metadata);
            return metadata;
        }
        finally {
            clear();
        }
    }
    buildAuthorizationUrl({ metadata, issuer, clientId, redirectUri, scope, state, codeChallenge, extraParams = {}, }) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        const authorizationEndpoint = metadata?.authorization_endpoint || `${normalizedIssuer}/oauth/authorize`;
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            ...extraParams,
        });
        return `${authorizationEndpoint}?${params.toString()}`;
    }
    async exchangeAuthorizationCode({ metadata, issuer, clientId, code, redirectUri, codeVerifier, }) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        const tokenEndpoint = metadata?.token_endpoint || `${normalizedIssuer}/oauth/token`;
        const body = formEncode({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: codeVerifier,
        });
        const { signal, clear } = createTimeoutSignal(this.timeoutMs);
        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
                signal,
            });
            const { text, json } = await readJsonOrText(response);
            if (!response.ok) {
                const detail = json?.error_description || json?.error || text || 'unknown token exchange error';
                throw new Error(`OIDC token exchange failed (${response.status}): ${detail}`);
            }
            return json;
        }
        finally {
            clear();
        }
    }
    async startDeviceAuthorization({ metadata, issuer, clientId, scope }) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        const endpoint = metadata?.device_authorization_endpoint;
        if (!endpoint) {
            throw new Error('OIDC device_authorization_endpoint is not available for this provider');
        }
        const body = formEncode({
            client_id: clientId,
            scope,
        });
        const { signal, clear } = createTimeoutSignal(this.timeoutMs);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
                signal,
            });
            const { text, json } = await readJsonOrText(response);
            if (!response.ok) {
                const detail = json?.error_description || json?.error || text || 'unknown device authorization error';
                throw new Error(`OIDC device authorization failed (${response.status}): ${detail}`);
            }
            return {
                issuer: normalizedIssuer,
                ...json,
            };
        }
        finally {
            clear();
        }
    }
    async pollDeviceToken({ metadata, issuer, clientId, deviceCode, interval = 5, expiresIn = 900 }) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        const tokenEndpoint = metadata?.token_endpoint || `${normalizedIssuer}/oauth/token`;
        const startedAt = Date.now();
        let pollIntervalMs = Math.max(1, Number(interval) || 5) * 1000;
        const expiresAtMs = startedAt + Math.max(30, Number(expiresIn) || 900) * 1000;
        while (Date.now() < expiresAtMs) {
            const body = formEncode({
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                client_id: clientId,
                device_code: deviceCode,
            });
            const { signal, clear } = createTimeoutSignal(this.timeoutMs);
            try {
                const response = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body,
                    signal,
                });
                const { text, json } = await readJsonOrText(response);
                if (response.ok) {
                    return json;
                }
                const errorCode = json?.error || '';
                if (errorCode === 'authorization_pending') {
                    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                    continue;
                }
                if (errorCode === 'slow_down') {
                    pollIntervalMs += 5000;
                    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
                    continue;
                }
                if (errorCode === 'expired_token') {
                    throw new Error('Device code expired before authorization completed');
                }
                const detail = json?.error_description || json?.error || text || 'unknown device token error';
                throw new Error(`OIDC device token polling failed (${response.status}): ${detail}`);
            }
            finally {
                clear();
            }
        }
        throw new Error('Device authorization timed out');
    }
    async refreshToken({ metadata, issuer, clientId, refreshToken, scope }) {
        const normalizedIssuer = this.normalizeIssuer(issuer);
        const tokenEndpoint = metadata?.token_endpoint || `${normalizedIssuer}/oauth/token`;
        const body = formEncode({
            grant_type: 'refresh_token',
            client_id: clientId,
            refresh_token: refreshToken,
            scope,
        });
        const { signal, clear } = createTimeoutSignal(this.timeoutMs);
        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
                signal,
            });
            const { text, json } = await readJsonOrText(response);
            if (!response.ok) {
                const detail = json?.error_description || json?.error || text || 'unknown refresh error';
                throw new Error(`OIDC refresh failed (${response.status}): ${detail}`);
            }
            return json;
        }
        finally {
            clear();
        }
    }
}
//# sourceMappingURL=oidc.js.map