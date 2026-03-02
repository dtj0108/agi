/**
 * Skill Sandbox
 *
 * Provides isolated execution environment for Entity-authored skills
 * using Node.js vm module with restricted context.
 */
import vm from 'vm';
import { EventEmitter } from 'events';
export declare class SkillSandbox extends EventEmitter {
    activeTimers: any;
    executionCount: any;
    options: any;
    constructor(options?: any);
    /**
     * Create a sandboxed context for skill execution
     */
    createContext(skillName: any): vm.Context;
    /**
     * Execute skill code in sandbox
     * @param {string} code - The skill code to execute
     * @param {string} skillName - Name of the skill
     * @param {string} action - Action to execute
     * @param {object} params - Parameters for the action
     * @returns {Promise<{success: boolean, result?: any, error?: string, duration: number}>}
     */
    execute(code: any, skillName: any, action: any, params?: any): Promise<{
        success: boolean;
        result: any;
        duration: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        duration: number;
        result?: undefined;
    }>;
    /**
     * Test a skill in sandbox without side effects
     * @param {string} code - The skill code
     * @param {string} skillName - Name of the skill
     * @param {Array<{action: string, params: object, expected?: any}>} testCases - Test cases
     */
    test(code: any, skillName: any, testCases?: any): Promise<{
        passed: boolean;
        results: any[];
    }>;
    /**
     * Validate that code can be parsed and has expected structure
     */
    validateStructure(code: any, skillName: any): {
        valid: boolean;
        error: string;
    } | {
        valid: boolean;
        error?: undefined;
    };
    /**
     * Normalize ESM skill code into vm.Script-compatible code.
     */
    normalizeCodeForVm(code: any): any;
}
export default SkillSandbox;
//# sourceMappingURL=skill-sandbox.d.ts.map