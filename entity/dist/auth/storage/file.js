/**
 * File-backed auth storage
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
export class FileAuthStorage {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    get source() {
        return 'file';
    }
    load() {
        if (!existsSync(this.filePath)) {
            return null;
        }
        const raw = readFileSync(this.filePath, 'utf-8');
        if (!raw.trim()) {
            return null;
        }
        return JSON.parse(raw);
    }
    save(payload) {
        mkdirSync(dirname(this.filePath), { recursive: true });
        writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, {
            mode: 0o600,
        });
        try {
            chmodSync(this.filePath, 0o600);
        }
        catch {
            // best effort on platforms/filesystems that do not support chmod
        }
    }
    clear() {
        if (existsSync(this.filePath)) {
            unlinkSync(this.filePath);
        }
    }
}
//# sourceMappingURL=file.js.map