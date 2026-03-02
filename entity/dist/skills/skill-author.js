/**
 * Skill Author
 *
 * Generates skill manifest and code from Entity's reflection output.
 * Handles validation, sandboxed testing, and saving to mind.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { SkillValidator } from './skill-validator.js';
import { SkillSandbox } from './skill-sandbox.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class SkillAuthor {
    authoredSkillsPath;
    config;
    mindPath;
    sandbox;
    validator;
    constructor(config, mindPath) {
        this.config = config;
        this.mindPath = mindPath;
        this.validator = new SkillValidator();
        this.sandbox = new SkillSandbox({
            timeout: 5000,
            allowFetch: true,
            allowConsole: true,
        });
        // Path for authored skills in mind
        this.authoredSkillsPath = join(mindPath, 'actions/skills/authored');
    }
    /**
     * Generate a skill from reflection output
     * @param {object} skillAuthored - The skillAuthored object from reflection
     * @returns {Promise<{success: boolean, manifest?: object, code?: string, path?: string, error?: string}>}
     */
    async generateSkill(skillAuthored) {
        try {
            // Step 1: Validate the input
            const inputValidation = this.validateInput(skillAuthored);
            if (!inputValidation.valid) {
                return { success: false, error: inputValidation.error };
            }
            // Step 2: Generate manifest
            const manifest = this.generateManifest(skillAuthored);
            // Step 3: Generate implementation code
            const code = this.generateCode(skillAuthored);
            // Step 4: Validate generated code
            const codeValidation = this.validator.validateSkill(manifest, code);
            if (!codeValidation.valid) {
                return {
                    success: false,
                    error: `Code validation failed: ${codeValidation.errors.join(', ')}`,
                    warnings: codeValidation.warnings,
                };
            }
            // Step 5: Test in sandbox with basic test cases
            const testResult = await this.testInSandbox(code, skillAuthored.name, skillAuthored.actions);
            if (!testResult.success) {
                return {
                    success: false,
                    error: `Sandbox test failed: ${testResult.error}`,
                };
            }
            // Generate metadata
            const meta = {
                authoredAt: new Date().toISOString(),
                author: 'entity-self-authored',
                reasoning: skillAuthored.reasoning,
                version: '1.0.0',
                approved: false, // Requires user approval
            };
            const skillPath = join(this.authoredSkillsPath, skillAuthored.name);
            return {
                success: true,
                manifest,
                code,
                meta,
                path: skillPath,
                warnings: codeValidation.warnings,
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    /**
     * Validate the skillAuthored input
     */
    validateInput(skillAuthored) {
        if (!skillAuthored || typeof skillAuthored !== 'object') {
            return { valid: false, error: 'skillAuthored must be an object' };
        }
        if (!skillAuthored.name || typeof skillAuthored.name !== 'string') {
            return { valid: false, error: 'Skill must have a name' };
        }
        if (!/^[a-z][a-z0-9-]*$/.test(skillAuthored.name)) {
            return { valid: false, error: 'Skill name must be lowercase alphanumeric with hyphens' };
        }
        if (!skillAuthored.description || typeof skillAuthored.description !== 'string') {
            return { valid: false, error: 'Skill must have a description' };
        }
        if (!Array.isArray(skillAuthored.actions) || skillAuthored.actions.length === 0) {
            return { valid: false, error: 'Skill must have at least one action' };
        }
        for (const action of skillAuthored.actions) {
            if (!action.name || typeof action.name !== 'string') {
                return { valid: false, error: 'Each action must have a name' };
            }
            if (!action.implementation || typeof action.implementation !== 'string') {
                return { valid: false, error: `Action "${action.name}" must have implementation code` };
            }
        }
        if (!skillAuthored.reasoning || typeof skillAuthored.reasoning !== 'string') {
            return { valid: false, error: 'Skill must have reasoning for why it was created' };
        }
        return { valid: true };
    }
    /**
     * Generate manifest.json from skillAuthored
     */
    generateManifest(skillAuthored) {
        return {
            name: skillAuthored.name,
            version: '1.0.0',
            description: skillAuthored.description,
            author: 'entity-self-authored',
            authoredAt: new Date().toISOString(),
            actions: skillAuthored.actions.map((action) => ({
                name: action.name,
                description: action.description || '',
                tier: 4, // All authored skills are Tier 4
                params: action.params || {},
            })),
        };
    }
    /**
     * Generate skill implementation code
     */
    generateCode(skillAuthored) {
        const className = this.toPascalCase(skillAuthored.name) + 'Skill';
        // Generate the switch cases for execute()
        const switchCases = skillAuthored.actions.map((action) => `      case '${action.name}':\n        return this.${this.toCamelCase(action.name)}(params);`).join('\n');
        // Generate the action methods
        const actionMethods = skillAuthored.actions.map((action) => {
            // Build parameter destructuring
            const paramNames = Object.keys(action.params || {});
            const paramsList = paramNames.length > 0
                ? `{ ${paramNames.join(', ')} }`
                : 'params';
            return `  /**
   * ${action.description || action.name}
   */
  async ${this.toCamelCase(action.name)}(${paramsList}) {
    ${action.implementation}
  }`;
        }).join('\n\n');
        // Generate the full skill class
        const code = `/**
 * ${skillAuthored.name}
 *
 * ${skillAuthored.description}
 *
 * Self-authored by Entity.
 * Reason: ${skillAuthored.reasoning}
 */

import { BaseSkill } from './base-skill.js';

export default class ${className} extends BaseSkill {
  async execute(action, params) {
    switch (action) {
${switchCases}
      default:
        throw new Error(\`Unknown action: \${action}\`);
    }
  }

${actionMethods}
}
`;
        return code;
    }
    /**
     * Test the skill in sandbox
     */
    async testInSandbox(code, skillName, actions) {
        // Validate structure first
        const structureResult = this.sandbox.validateStructure(code, skillName);
        if (!structureResult.valid) {
            return { success: false, error: structureResult.error };
        }
        // Generate basic test cases for each action
        // These just verify the action can be called without throwing
        const testCases = actions.map((action) => ({
            action: action.name,
            params: this.generateMockParams(action.params || {}),
        }));
        // Run tests (skip if no test cases)
        if (testCases.length === 0) {
            return { success: true };
        }
        // Test each action individually to get better error messages
        for (const testCase of testCases) {
            const result = await this.sandbox.execute(code, skillName, testCase.action, testCase.params);
            // We only care that it doesn't crash during basic validation
            // Actual functionality testing happens after approval
            if (!result.success && result.error.includes('Parse error')) {
                return { success: false, error: `Action ${testCase.action}: ${result.error}` };
            }
        }
        return { success: true };
    }
    /**
     * Generate mock parameters for testing
     */
    generateMockParams(paramsSchema) {
        const params = {};
        for (const [name, schema] of Object.entries(paramsSchema)) {
            // @ts-expect-error TODO(ts-migration): TS(2339): Property 'default' does not exist on type 'unknown... Remove this comment to see the full error message
            if (schema.default !== undefined) {
                // @ts-expect-error TODO(ts-migration): TS(2339): Property 'default' does not exist on type 'unknown... Remove this comment to see the full error message
                params[name] = schema.default;
                continue;
            }
            // @ts-expect-error TODO(ts-migration): TS(2339): Property 'type' does not exist on type 'unknown'.
            switch (schema.type) {
                case 'string':
                    params[name] = 'test';
                    break;
                case 'number':
                    params[name] = 0;
                    break;
                case 'boolean':
                    params[name] = false;
                    break;
                case 'array':
                    params[name] = [];
                    break;
                case 'object':
                    params[name] = {};
                    break;
                default:
                    params[name] = null;
            }
        }
        return params;
    }
    /**
     * Save an approved skill to mind
     */
    async saveSkill(skillResult) {
        const { manifest, code, meta, path } = skillResult;
        // Ensure directory exists
        if (!existsSync(path)) {
            await mkdir(path, { recursive: true });
        }
        const baseSkillSource = await this.loadBaseSkillSource();
        // Mark as approved
        meta.approved = true;
        meta.approvedAt = new Date().toISOString();
        meta.codeHash = this.computeCodeHash(code);
        meta.hashAlgorithm = 'sha256';
        // Write files
        await Promise.all([
            writeFile(join(path, 'manifest.json'), JSON.stringify(manifest, null, 2)),
            writeFile(join(path, 'index.js'), code),
            writeFile(join(path, 'base-skill.js'), baseSkillSource),
            writeFile(join(path, '.meta.json'), JSON.stringify(meta, null, 2)),
        ]);
        return {
            success: true,
            path,
            name: manifest.name,
        };
    }
    /**
     * Convert kebab-case to PascalCase
     */
    toPascalCase(str) {
        return str
            .split('-')
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join('');
    }
    /**
     * Convert kebab-case to camelCase
     */
    toCamelCase(str) {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
    /**
     * Format skill for user approval display
     */
    formatForApproval(skillResult) {
        const { manifest, code, meta } = skillResult;
        return {
            name: manifest.name,
            description: manifest.description,
            actions: manifest.actions.map((a) => ({
                name: a.name,
                description: a.description,
                params: a.params,
            })),
            reasoning: meta.reasoning,
            code,
            codePreview: code.slice(0, 1000) + (code.length > 1000 ? '\n...' : ''),
        };
    }
    /**
     * Load canonical BaseSkill source for authored skill bundles.
     */
    async loadBaseSkillSource() {
        const candidates = [
            join(__dirname, 'base-skill.js'),
            join(__dirname, '..', '..', 'dist', 'skills', 'base-skill.js'),
        ];
        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                return readFile(candidate, 'utf-8');
            }
        }
        // Fallback for source-only runs before build output exists.
        return `export class BaseSkill {
  constructor(manifest, config = {}) {
    this.manifest = manifest;
    this.config = config;
    this.name = manifest.name;
    this.version = manifest.version;
    this.description = manifest.description;
  }

  getTier(action) {
    const actionDef = this.manifest.actions?.find((a) => a.name === action);
    return actionDef?.tier ?? 2;
  }

  async execute() {
    throw new Error('Not implemented - subclass must override execute()');
  }
}
`;
    }
    /**
     * Compute deterministic code hash for tamper detection.
     */
    computeCodeHash(code) {
        return createHash('sha256').update(code).digest('hex');
    }
}
export default SkillAuthor;
//# sourceMappingURL=skill-author.js.map