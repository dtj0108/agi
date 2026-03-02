/**
 * Skill Author
 *
 * Generates skill manifest and code from Entity's reflection output.
 * Handles validation, sandboxed testing, and saving to mind.
 */
export declare class SkillAuthor {
    authoredSkillsPath: any;
    config: any;
    mindPath: any;
    sandbox: any;
    validator: any;
    constructor(config: any, mindPath: any);
    /**
     * Generate a skill from reflection output
     * @param {object} skillAuthored - The skillAuthored object from reflection
     * @returns {Promise<{success: boolean, manifest?: object, code?: string, path?: string, error?: string}>}
     */
    generateSkill(skillAuthored: any): Promise<{
        success: boolean;
        error: string;
        warnings: any;
        manifest?: undefined;
        code?: undefined;
        meta?: undefined;
        path?: undefined;
    } | {
        success: boolean;
        manifest: {
            name: any;
            version: string;
            description: any;
            author: string;
            authoredAt: string;
            actions: any;
        };
        code: string;
        meta: {
            authoredAt: string;
            author: string;
            reasoning: any;
            version: string;
            approved: boolean;
        };
        path: string;
        warnings: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        warnings?: undefined;
        manifest?: undefined;
        code?: undefined;
        meta?: undefined;
        path?: undefined;
    }>;
    /**
     * Validate the skillAuthored input
     */
    validateInput(skillAuthored: any): {
        valid: boolean;
        error: string;
    } | {
        valid: boolean;
        error?: undefined;
    };
    /**
     * Generate manifest.json from skillAuthored
     */
    generateManifest(skillAuthored: any): {
        name: any;
        version: string;
        description: any;
        author: string;
        authoredAt: string;
        actions: any;
    };
    /**
     * Generate skill implementation code
     */
    generateCode(skillAuthored: any): string;
    /**
     * Test the skill in sandbox
     */
    testInSandbox(code: any, skillName: any, actions: any): Promise<{
        success: boolean;
        error: any;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    /**
     * Generate mock parameters for testing
     */
    generateMockParams(paramsSchema: any): Record<string, any>;
    /**
     * Save an approved skill to mind
     */
    saveSkill(skillResult: any): Promise<{
        success: boolean;
        path: any;
        name: any;
    }>;
    /**
     * Convert kebab-case to PascalCase
     */
    toPascalCase(str: any): any;
    /**
     * Convert kebab-case to camelCase
     */
    toCamelCase(str: any): any;
    /**
     * Format skill for user approval display
     */
    formatForApproval(skillResult: any): {
        name: any;
        description: any;
        actions: any;
        reasoning: any;
        code: any;
        codePreview: string;
    };
    /**
     * Load canonical BaseSkill source for authored skill bundles.
     */
    loadBaseSkillSource(): Promise<string>;
    /**
     * Compute deterministic code hash for tamper detection.
     */
    computeCodeHash(code: any): string;
}
export default SkillAuthor;
//# sourceMappingURL=skill-author.d.ts.map