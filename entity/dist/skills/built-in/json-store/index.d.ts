/**
 * JSON Store Skill
 *
 * Persistent key-value storage for Entity data.
 */
import { BaseSkill } from '../../base-skill.js';
export default class JsonStoreSkill extends BaseSkill {
    data: any;
    storagePath: any;
    constructor(manifest: any, config: any);
    /**
     * Load data from disk
     */
    load(): any;
    /**
     * Save data to disk
     */
    save(): void;
    execute(action: any, params: any): Promise<{
        key: any;
        value: any;
        found: boolean;
    } | {
        key: any;
        value: any;
        previousValue: any;
        created: boolean;
        updated: boolean;
    } | {
        key: any;
        deleted: boolean;
        previousValue: any;
    } | {
        keys: string[];
        count: number;
        prefix: any;
    } | {
        cleared: boolean;
        deletedCount: number;
    }>;
    /**
     * Get a value by key
     */
    get({ key }: any): {
        key: any;
        value: any;
        found: boolean;
    };
    /**
     * Set a value for a key
     */
    set({ key, value }: any): {
        key: any;
        value: any;
        previousValue: any;
        created: boolean;
        updated: boolean;
    };
    /**
     * Delete a key
     */
    delete({ key }: any): {
        key: any;
        deleted: boolean;
        previousValue: any;
    };
    /**
     * List all keys
     */
    list({ prefix }?: any): {
        keys: string[];
        count: number;
        prefix: any;
    };
    /**
     * Clear all data
     */
    clear(): {
        cleared: boolean;
        deletedCount: number;
    };
}
//# sourceMappingURL=index.d.ts.map