/**
 * Skills Registry
 *
 * Discovers, loads, and manages skill instances.
 * Supports both built-in skills and self-authored skills from the mind.
 */
import { EventEmitter } from 'events';
export declare class SkillsRegistry extends EventEmitter {
    authoredSkills: any;
    config: any;
    loadErrors: any;
    mindPath: any;
    mindServer: any;
    skills: any;
    validator: any;
    constructor(config?: any, mindServer?: any);
    /**
     * Set up hot-reload for authored skills
     */
    setupHotReload(): void;
    /**
     * Load all built-in skills from a directory
     */
    loadBuiltIn(builtInPath: any): Promise<void>;
    /**
     * Load user-installed skills from a directory
     */
    loadUserSkills(userPath: any): Promise<void>;
    /**
     * Load self-authored skills from the mind directory
     */
    loadAuthoredSkills(mindPath: any): Promise<void>;
    /**
     * Load a single self-authored skill
     */
    loadAuthoredSkill(skillPath: any): Promise<any>;
    /**
     * Reload a self-authored skill
     */
    reloadAuthoredSkill(name: any, skillPath: any): Promise<any>;
    /**
     * Load a single skill from a directory
     */
    loadSkill(skillPath: any): Promise<any>;
    /**
     * Get a skill by name (checks both built-in and authored)
     */
    get(name: any): any;
    /**
     * Check if a skill exists (checks both built-in and authored)
     */
    has(name: any): any;
    /**
     * Check if a skill is self-authored
     */
    isAuthored(name: any): any;
    /**
     * List all loaded skills (both built-in and authored)
     */
    list(): any[];
    /**
     * List only built-in skills
     */
    listBuiltIn(): any[];
    /**
     * List only self-authored skills
     */
    listAuthored(): any[];
    /**
     * List skill names only (both built-in and authored)
     */
    names(): unknown[];
    /**
     * Get skills formatted for LLM context
     */
    getContextForLLM(): string;
    /**
     * Get self-authored skills formatted for LLM context
     */
    getAuthoredContextForLLM(): string;
    /**
     * Reload a specific skill
     */
    reloadSkill(name: any, skillPath: any): Promise<any>;
    /**
     * Get load errors
     */
    getLoadErrors(): any;
}
//# sourceMappingURL=registry.d.ts.map