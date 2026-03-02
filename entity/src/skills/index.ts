/**
 * Skills Executor
 *
 * Execution engine that routes skill actions to the appropriate
 * skill implementation.
 */

export class SkillsExecutor {
  registry: any;
  constructor(registry: any) {
    this.registry = registry;
  }

  /**
   * Execute a skill action
   *
   * @param {Object} params - Action parameters
   * @param {string} params.skill - Skill name (e.g., "web-search")
   * @param {string} params.action - Action name (e.g., "search")
   * @param {Object} params... - Additional action-specific parameters
   * @returns {Object} Result with success flag and output/error
   */
  async execute(params: any) {
    const { skill, action, ...args } = params;

    // Validate required fields
    if (!skill) {
      return { success: false, error: 'Missing required param: skill' };
    }
    if (!action) {
      return { success: false, error: 'Missing required param: action' };
    }

    // Get skill instance
    const skillInstance = this.registry.get(skill);
    if (!skillInstance) {
      return {
        success: false,
        error: `Skill not found: ${skill}. Available: ${this.registry.names().join(', ') || 'none'}`
      };
    }

    // Check if action exists
    const actionDef = skillInstance.getAction(action);
    if (!actionDef) {
      const available = skillInstance.getActions().map((a: any) => a.name).join(', ');
      return {
        success: false,
        error: `Unknown action: ${action}. Available actions for ${skill}: ${available || 'none'}`
      };
    }

    try {
      // Validate and apply defaults
      const finalParams = skillInstance.applyDefaults(action, args);
      skillInstance.validateParams(action, finalParams);

      // Execute the action
      const startTime = Date.now();
      const result = await skillInstance.execute(action, finalParams);
      const duration = Date.now() - startTime;

      return {
        success: true,
        skill,
        action,
        duration_ms: duration,
        ...result,
      };
    } catch (err: any) {
      return {
        success: false,
        skill,
        action,
        error: err.message,
      };
    }
  }

  /**
   * Get the tier level for a skill action
   * Self-authored skills are always Tier 4
   */
  getTier(skill: any, action: any) {
    // Check if skill is self-authored (always Tier 4)
    if (this.registry.isAuthored(skill)) {
      return 4;
    }

    const skillInstance = this.registry.get(skill);
    if (!skillInstance) {
      return 2; // Default to Tier 2 if skill not found
    }
    return skillInstance.getTier(action);
  }

  /**
   * Check if a skill is self-authored
   */
  isAuthored(skill: any) {
    return this.registry.isAuthored(skill);
  }

  /**
   * Check if a skill action exists
   */
  hasAction(skill: any, action: any) {
    const skillInstance = this.registry.get(skill);
    if (!skillInstance) return false;
    return !!skillInstance.getAction(action);
  }

  /**
   * List all available skills
   */
  listSkills() {
    return this.registry.list();
  }

  /**
   * List only self-authored skills
   */
  listAuthoredSkills() {
    return this.registry.listAuthored();
  }

  /**
   * Get skills context for LLM (built-in only)
   */
  getContextForLLM() {
    return this.registry.getContextForLLM();
  }

  /**
   * Get self-authored skills context for LLM
   */
  getAuthoredContextForLLM() {
    return this.registry.getAuthoredContextForLLM();
  }
}

// Re-export for convenience
export { SkillsRegistry } from './registry.js';
export { BaseSkill } from './base-skill.js';
