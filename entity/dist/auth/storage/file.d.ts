/**
 * File-backed auth storage
 */
export declare class FileAuthStorage {
    filePath: any;
    constructor(filePath: any);
    get source(): string;
    load(): any;
    save(payload: any): void;
    clear(): void;
}
//# sourceMappingURL=file.d.ts.map