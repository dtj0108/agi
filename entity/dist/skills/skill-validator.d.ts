/**
 * Skill Validator
 *
 * AST-based static analysis to detect forbidden patterns in Entity-authored skills.
 * Ensures generated code doesn't contain dangerous constructs before execution.
 */
export declare class SkillValidator {
    options: any;
    constructor(options?: any);
    /**
     * Validate skill code for safety
     * @param {string} code - The JavaScript code to validate
     * @returns {{ safe: boolean, reason?: string, warnings: string[] }}
     */
    validate(code: any): any;
    /**
     * Walk AST and check for forbidden constructs
     */
    walkAST(node: any, result?: any): any;
    /**
     * Check member expressions for forbidden access patterns
     */
    checkMemberExpression(node: any, result: any): void;
    /**
     * Check if an import source is allowed
     */
    isAllowedImport(source: any): boolean;
    /**
     * Check for suspicious patterns that warrant warnings
     */
    checkSuspiciousPatterns(code: any): {
        warnings: any[];
    };
    /**
     * Validate a complete skill (manifest + code)
     */
    validateSkill(manifest: any, code: any): {
        valid: boolean;
        errors: any[];
        warnings: any[];
    };
}
export default SkillValidator;
//# sourceMappingURL=skill-validator.d.ts.map