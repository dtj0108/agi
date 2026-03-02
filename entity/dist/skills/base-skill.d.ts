/**
 * Base Skill Class
 *
 * Abstract base class for all skills. Skills extend this class
 * and implement the execute() method.
 */
export declare class BaseSkill {
    config: any;
    description: any;
    manifest: any;
    name: any;
    version: any;
    constructor(manifest: any, config?: any);
    /**
     * Get the tier level for an action
     */
    getTier(action: any): any;
    /**
     * Get action definition
     */
    getAction(action: any): any;
    /**
     * List all available actions
     */
    getActions(): any;
    /**
     * Validate params against manifest schema
     */
    validateParams(action: any, params: any): boolean;
    /**
     * Apply default values to params
     */
    applyDefaults(action: any, params: any): any;
    /**
     * Execute an action - override in subclass
     */
    execute(action: any, params: any): Promise<void>;
    /**
     * Get skill metadata for display
     */
    getMetadata(): {
        name: any;
        version: any;
        description: any;
        author: any;
        actions: any;
        configSchema: any;
    };
}
//# sourceMappingURL=base-skill.d.ts.map