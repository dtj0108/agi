/**
 * Base Skill Class
 *
 * Abstract base class for all skills. Skills extend this class
 * and implement the execute() method.
 */

export class BaseSkill {
  constructor(manifest, config = {}) {
    this.manifest = manifest;
    this.config = config;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
  }

  /**
   * Get the tier level for an action
   */
  getTier(action) {
    const actionDef = this.manifest.actions?.find(a => a.name === action);
    return actionDef?.tier ?? 2;
  }

  /**
   * Get action definition
   */
  getAction(action) {
    return this.manifest.actions?.find(a => a.name === action);
  }

  /**
   * List all available actions
   */
  getActions() {
    return this.manifest.actions || [];
  }

  /**
   * Validate params against manifest schema
   */
  validateParams(action, params) {
    const actionDef = this.getAction(action);
    if (!actionDef) {
      throw new Error(`Unknown action: ${action}`);
    }

    const paramSchema = actionDef.params || {};

    // Check required params
    for (const [name, schema] of Object.entries(paramSchema)) {
      if (schema.required && !(name in params)) {
        throw new Error(`Missing required param: ${name}`);
      }

      // Type validation
      if (name in params && schema.type) {
        const value = params[name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (schema.type === 'array' && !Array.isArray(value)) {
          throw new Error(`Param ${name} must be an array`);
        } else if (schema.type !== 'array' && actualType !== schema.type) {
          throw new Error(`Param ${name} must be a ${schema.type}`);
        }
      }

      // Enum validation
      if (name in params && schema.enum) {
        if (!schema.enum.includes(params[name])) {
          throw new Error(`Param ${name} must be one of: ${schema.enum.join(', ')}`);
        }
      }
    }

    return true;
  }

  /**
   * Apply default values to params
   */
  applyDefaults(action, params) {
    const actionDef = this.getAction(action);
    if (!actionDef) return params;

    const result = { ...params };
    const paramSchema = actionDef.params || {};

    for (const [name, schema] of Object.entries(paramSchema)) {
      if (!(name in result) && 'default' in schema) {
        result[name] = schema.default;
      }
    }

    return result;
  }

  /**
   * Execute an action - override in subclass
   */
  async execute(action, params) {
    throw new Error('Not implemented - subclass must override execute()');
  }

  /**
   * Get skill metadata for display
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.manifest.author,
      actions: this.manifest.actions,
      configSchema: this.manifest.config,
    };
  }
}
