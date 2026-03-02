/**
 * OS keychain-backed auth storage.
 *
 * Falls back to file storage when unavailable.
 */
export declare class KeychainAuthStorage {
    account: any;
    service: any;
    constructor({ service, account }?: any);
    get source(): string;
    isAvailable(): boolean;
    load(): any;
    save(payload: any): void;
    clear(): void;
}
//# sourceMappingURL=keychain.d.ts.map