/**
 * Local auth manager
 *
 * Handles provider-agnostic OIDC login, credential persistence,
 * refresh, and runtime status checks.
 */
export declare class AuthManager {
    config: any;
    credentialSource: any;
    credentials: any;
    credentialsLoaded: any;
    fileStorage: any;
    keychainStorage: any;
    provider: any;
    settings: any;
    constructor(config: any, dependencies?: any);
    allowsApiKey(): boolean;
    allowsOAuth(): boolean;
    hasConfiguredApiKey(): boolean;
    loadCredentials({ reload }?: any): Promise<any>;
    persistCredentials(credentials: any): Promise<void>;
    clearCredentials(): Promise<void>;
    chooseFlow({ flow, deviceCode, noBrowser }?: any): any;
    validateOAuthSettings({ issuer, clientId, scopes }: any): void;
    login(options?: any): Promise<{
        flow: any;
        authUrl: any;
        deviceAuth: any;
        status: {
            mode: any;
            provider: any;
            loggedIn: boolean;
            expiresAt: string | null;
            source: string;
        };
    }>;
    logout(): Promise<{
        mode: any;
        provider: any;
        loggedIn: boolean;
        expiresAt: string | null;
        source: string;
    }>;
    refreshTokens({ force }?: any): Promise<any>;
    getOAuthAccessToken({ forceRefresh }?: any): Promise<any>;
    resolveOpenAICredential(): Promise<{
        token: any;
        source: string;
    }>;
    getAuthStatus({ reload }?: any): Promise<{
        mode: any;
        provider: any;
        loggedIn: boolean;
        expiresAt: string | null;
        source: string;
    }>;
}
export declare function normalizeAuthConfig(config: any): {
    mode: any;
    oauth: {
        provider: any;
        issuer: any;
        clientId: any;
        scopes: any[];
        flow: any;
        callbackHost: any;
        callbackPort: any;
        callbackPortRange: any;
        extraAuthorizeParams: any;
    };
    storage: {
        mode: any;
        filePath: any;
    };
    llmCredentialSource: any;
};
//# sourceMappingURL=manager.d.ts.map