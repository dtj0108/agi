/**
 * Base Skill Class
 *
 * Abstract base class for all skills. Skills extend this class
 * and implement the execute() method.
 */

export class BaseSkill {
  config: any;
  description: any;
  manifest: any;
  name: any;
  version: any;
  constructor(manifest: any, config: any = {}) {
    this.manifest = manifest;
    this.config = config;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
  }

  /**
   * Get the tier level for an action
   */
  getTier(action: any) {
    const actionDef = this.manifest.actions?.find((a: any) => a.name === action);
    return actionDef?.tier ?? 2;
  }

  /**
   * Get action definition
   */
  getAction(action: any) {
    return this.manifest.actions?.find((a: any) => a.name === action);
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
  validateParams(action: any, params: any) {
    const actionDef = this.getAction(action);
    if (!actionDef) {
      throw new Error(`Unknown action: ${action}`);
    }

    const paramSchema = actionDef.params || {};

    // Check required params
    for (const [name, schema] of Object.entries(paramSchema)) {
      // @ts-expect-error TODO(ts-migration): TS(2339): Property 'required' does not exist on type 'unknow... Remove this comment to see the full error message
      if (schema.required && !(name in params)) {
        throw new Error(`Missing required param: ${name}`);
      }

      // Type validation
      // @ts-expect-error TODO(ts-migration): TS(2339): Property 'type' does not exist on type 'unknown'.
      if (name in params && schema.type) {
        const value = params[name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        // @ts-expect-error TODO(ts-migration): TS(2339): Property 'type' does not exist on type 'unknown'.
        if (schema.type === 'array' && !Array.isArray(value)) {
          throw new Error(`Param ${name} must be an array`);
        // @ts-expect-error TODO(ts-migration): TS(2339): Property 'type' does not exist on type 'unknown'.
        } else if (schema.type !== 'array' && actualType !== schema.type) {
          // @ts-expect-error TODO(ts-migration): TS(2339): Property 'type' does not exist on type 'unknown'.
          throw new Error(`Param ${name} must be a ${schema.type}`);
        }
      }

      // Enum validation
      // @ts-expect-error TODO(ts-migration): TS(2339): Property 'enum' does not exist on type 'unknown'.
      if (name in params && schema.enum) {
        // @ts-expect-error TODO(ts-migration): TS(2339): Property 'enum' does not exist on type 'unknown'.
        if (!schema.enum.includes(params[name])) {
          // @ts-expect-error TODO(ts-migration): TS(2339): Property 'enum' does not exist on type 'unknown'.
          throw new Error(`Param ${name} must be one of: ${schema.enum.join(', ')}`);
        }
      }
    }

    return true;
  }

  /**
   * Apply default values to params
   */
  applyDefaults(action: any, params: any) {
    const actionDef = this.getAction(action);
    if (!actionDef) return params;

    const result = { ...params };
    const paramSchema = actionDef.params || {};

    for (const [name, schema] of Object.entries(paramSchema)) {
      // @ts-expect-error TODO(ts-migration): TS(2361): The right-hand side of an 'in' expression must not... Remove this comment to see the full error message
      if (!(name in result) && 'default' in schema) {
        result[name] = schema.default;
      }
    }

    return result;
  }

  /**
   * Execute an action - override in subclass
   */
  async execute(action: any, params: any) {
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
