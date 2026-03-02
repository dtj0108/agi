/**
 * Skills Executor
 *
 * Execution engine that routes skill actions to the appropriate
 * skill implementation.
 */
export declare class SkillsExecutor {
    registry: any;
    constructor(registry: any);
    /**
     * Execute a skill action
     *
     * @param {Object} params - Action parameters
     * @param {string} params.skill - Skill name (e.g., "web-search")
     * @param {string} params.action - Action name (e.g., "search")
     * @param {Object} params... - Additional action-specific parameters
     * @returns {Object} Result with success flag and output/error
     */
    execute(params: any): Promise<any>;
    /**
     * Get the tier level for a skill action
     * Self-authored skills are always Tier 4
     */
    getTier(skill: any, action: any): any;
    /**
     * Check if a skill is self-authored
     */
    isAuthored(skill: any): any;
    /**
     * Check if a skill action exists
     */
    hasAction(skill: any, action: any): boolean;
    /**
     * List all available skills
     */
    listSkills(): any;
    /**
     * List only self-authored skills
     */
    listAuthoredSkills(): any;
    /**
     * Get skills context for LLM (built-in only)
     */
    getContextForLLM(): any;
    /**
     * Get self-authored skills context for LLM
     */
    getAuthoredContextForLLM(): any;
}
export { SkillsRegistry } from './registry.js';
export { BaseSkill } from './base-skill.js';
//# sourceMappingURL=index.d.ts.map