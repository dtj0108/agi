/**
 * OIDC Provider helper
 *
 * Provider-agnostic OpenID Connect primitives for authorization code,
 * device code, and refresh token flows.
 */
export declare class OidcProvider {
    metadataCache: any;
    timeoutMs: any;
    constructor({ timeoutMs }?: any);
    normalizeIssuer(issuer: any): string;
    discoverMetadata(issuer: any, { force }?: any): Promise<any>;
    buildAuthorizationUrl({ metadata, issuer, clientId, redirectUri, scope, state, codeChallenge, extraParams, }: any): string;
    exchangeAuthorizationCode({ metadata, issuer, clientId, code, redirectUri, codeVerifier, }: any): Promise<any>;
    startDeviceAuthorization({ metadata, issuer, clientId, scope }: any): Promise<any>;
    pollDeviceToken({ metadata, issuer, clientId, deviceCode, interval, expiresIn }: any): Promise<any>;
    refreshToken({ metadata, issuer, clientId, refreshToken, scope }: any): Promise<any>;
}
//# sourceMappingURL=oidc.d.ts.map