/**
 * Local loopback OAuth flow
 */
export declare function runLoopbackLogin({ provider, issuer, clientId, scopes, callbackHost, callbackPort, callbackPortRange, openBrowser, extraAuthorizeParams, timeoutMs, }: any): Promise<{
    authUrl: any;
    callbackPort: any;
    redirectUri: string;
    tokens: any;
}>;
//# sourceMappingURL=loopback.d.ts.map