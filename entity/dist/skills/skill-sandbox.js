/**
 * Skill Sandbox
 *
 * Provides isolated execution environment for Entity-authored skills
 * using Node.js vm module with restricted context.
 */
import vm from 'vm';
import { EventEmitter } from 'events';
import { BaseSkill } from './base-skill.js';
// Safe globals that can be exposed to sandboxed code
const SAFE_GLOBALS = {
    // Primitives
    undefined,
    NaN,
    Infinity,
    // Constructors
    Object,
    Array,
    String,
    Number,
    Boolean,
    Symbol,
    BigInt,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    URIError,
    EvalError,
    // Functions
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    // JSON
    JSON,
    // Math
    Math,
    // Promise
    Promise,
    // URL
    URL,
    URLSearchParams,
    // Text encoding
    TextEncoder,
    TextDecoder,
    // Timing (with wrappers)
    // setTimeout and setInterval are added with safeguards below
};
export class SkillSandbox extends EventEmitter {
    activeTimers;
    executionCount;
    options;
    constructor(options = {}) {
        super();
        this.options = {
            timeout: 5000, // 5 second timeout
            memoryLimit: 50, // 50MB (not strictly enforced in vm, but tracked)
            allowFetch: true,
            allowConsole: true,
            maxTimers: 10, // Maximum concurrent timers
            ...options,
        };
        this.activeTimers = new Set();
        this.executionCount = 0;
    }
    /**
     * Create a sandboxed context for skill execution
     */
    createContext(skillName) {
        const sandbox = this;
        const timers = new Set();
        let timerCount = 0;
        // Create safe console
        const safeConsole = this.options.allowConsole ? {
            log: (...args) => sandbox.emit('console', 'log', skillName, args),
            warn: (...args) => sandbox.emit('console', 'warn', skillName, args),
            error: (...args) => sandbox.emit('console', 'error', skillName, args),
            info: (...args) => sandbox.emit('console', 'info', skillName, args),
            debug: (...args) => sandbox.emit('console', 'debug', skillName, args),
        } : {
            log: () => { },
            warn: () => { },
            error: () => { },
            info: () => { },
            debug: () => { },
        };
        // Create safe fetch wrapper
        const safeFetch = this.options.allowFetch
            ? async (url, options = {}) => {
                // Validate URL
                try {
                    const parsedUrl = new URL(url);
                    // Block localhost and private IPs
                    const hostname = parsedUrl.hostname;
                    if (hostname === 'localhost' ||
                        hostname === '127.0.0.1' ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('10.') ||
                        hostname.startsWith('172.') ||
                        hostname === '0.0.0.0') {
                        throw new Error('Access to local/private networks is forbidden');
                    }
                }
                catch (err) {
                    if (err.message.includes('forbidden'))
                        throw err;
                    throw new Error(`Invalid URL: ${url}`);
                }
                // Limit request options
                const safeOptions = {
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    body: options.body,
                };
                // Add timeout to fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                try {
                    const response = await fetch(url, {
                        ...safeOptions,
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    // Return simplified response
                    return {
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        text: () => response.text(),
                        json: () => response.json(),
                    };
                }
                catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                }
            }
            : () => {
                throw new Error('fetch is not available in this sandbox');
            };
        // Create safe setTimeout wrapper
        const safeSetTimeout = (fn, delay) => {
            if (timerCount >= this.options.maxTimers) {
                throw new Error('Maximum number of timers exceeded');
            }
            timerCount++;
            const id = setTimeout(() => {
                timerCount--;
                timers.delete(id);
                try {
                    fn();
                }
                catch (err) {
                    sandbox.emit('error', skillName, err);
                }
            }, Math.min(delay, this.options.timeout));
            timers.add(id);
            return id;
        };
        const safeClearTimeout = (id) => {
            if (timers.has(id)) {
                clearTimeout(id);
                timers.delete(id);
                timerCount--;
            }
        };
        // Create the context object
        const context = {
            ...SAFE_GLOBALS,
            console: safeConsole,
            fetch: safeFetch,
            setTimeout: safeSetTimeout,
            clearTimeout: safeClearTimeout,
            // Skill-specific storage (scoped to this execution)
            __skillStorage: new Map(),
            __skillName: skillName,
            BaseSkill,
            // Cleanup function to clear all timers
            __cleanup: () => {
                for (const id of timers) {
                    clearTimeout(id);
                }
                timers.clear();
                timerCount = 0;
            },
        };
        // Create VM context
        return vm.createContext(context, {
            name: `skill:${skillName}`,
            codeGeneration: {
                strings: false, // Disable eval() and Function() from strings
                wasm: false, // Disable WebAssembly
            },
        });
    }
    /**
     * Execute skill code in sandbox
     * @param {string} code - The skill code to execute
     * @param {string} skillName - Name of the skill
     * @param {string} action - Action to execute
     * @param {object} params - Parameters for the action
     * @returns {Promise<{success: boolean, result?: any, error?: string, duration: number}>}
     */
    async execute(code, skillName, action, params = {}) {
        const startTime = Date.now();
        const context = this.createContext(skillName);
        try {
            this.executionCount++;
            const vmCode = this.normalizeCodeForVm(code);
            // Wrap the code to return the skill class and execute it
            const wrappedCode = `
        ${vmCode}

        // Find the default export class
        const SkillClass = typeof exports !== 'undefined' && exports.default
          ? exports.default
          : (typeof module !== 'undefined' && module.exports)
            ? module.exports
            : null;

        // Execute the action
        (async () => {
          if (!SkillClass) {
            throw new Error('Skill must export a default class');
          }

          const manifest = { name: __skillName, actions: [] };
          const config = {};
          const skill = new SkillClass(manifest, config);

          if (typeof skill.execute !== 'function') {
            throw new Error('Skill must implement execute() method');
          }

          return await skill.execute('${action}', ${JSON.stringify(params)});
        })();
      `;
            // Create a module-like environment
            context.exports = {};
            context.module = { exports: context.exports };
            // Compile and run the script
            const script = new vm.Script(wrappedCode, {
                filename: `${skillName}/index.js`,
            });
            const resultPromise = script.runInContext(context, {
                timeout: this.options.timeout,
                breakOnSigint: true,
            });
            // Await the result with timeout
            const result = await Promise.race([
                resultPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), this.options.timeout)),
            ]);
            return {
                success: true,
                result,
                duration: Date.now() - startTime,
            };
        }
        catch (err) {
            return {
                success: false,
                error: err.message,
                duration: Date.now() - startTime,
            };
        }
        finally {
            // Cleanup timers
            if (context.__cleanup) {
                context.__cleanup();
            }
        }
    }
    /**
     * Test a skill in sandbox without side effects
     * @param {string} code - The skill code
     * @param {string} skillName - Name of the skill
     * @param {Array<{action: string, params: object, expected?: any}>} testCases - Test cases
     */
    async test(code, skillName, testCases = []) {
        const results = [];
        for (const testCase of testCases) {
            const result = await this.execute(code, skillName, testCase.action, testCase.params);
            const passed = result.success &&
                (testCase.expected === undefined ||
                    JSON.stringify(result.result) === JSON.stringify(testCase.expected));
            results.push({
                action: testCase.action,
                params: testCase.params,
                passed,
                result: result.result,
                error: result.error,
                duration: result.duration,
            });
        }
        return {
            passed: results.every((r) => r.passed),
            results,
        };
    }
    /**
     * Validate that code can be parsed and has expected structure
     */
    validateStructure(code, skillName) {
        try {
            // Try to parse transformed code that strips ESM syntax.
            const vmCode = this.normalizeCodeForVm(code);
            new vm.Script(vmCode, {
                filename: `${skillName}/index.js`,
            });
            // Check for required patterns
            if (!code.includes('extends BaseSkill')) {
                return { valid: false, error: 'Skill must extend BaseSkill' };
            }
            if (!code.includes('execute(')) {
                return { valid: false, error: 'Skill must implement execute() method' };
            }
            if (!code.includes('export default')) {
                return { valid: false, error: 'Skill must have a default export' };
            }
            return { valid: true };
        }
        catch (err) {
            return { valid: false, error: `Parse error: ${err.message}` };
        }
    }
    /**
     * Normalize ESM skill code into vm.Script-compatible code.
     */
    normalizeCodeForVm(code) {
        let transformed = code;
        let exportName = null;
        // Remove static imports; sandbox provides BaseSkill directly.
        transformed = transformed.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
        // Convert "export default class Name" to a plain class.
        transformed = transformed.replace(/export\s+default\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/, (_, className) => {
            exportName = className;
            return `class ${className}`;
        });
        // Convert "export default Name;" forms.
        transformed = transformed.replace(/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;/g, (_, name) => {
            exportName = exportName || name;
            return '';
        });
        if (!/module\.exports\s*=/.test(transformed)) {
            if (exportName) {
                transformed += `\nmodule.exports = ${exportName};\n`;
            }
            else {
                transformed += '\nmodule.exports = exports.default || module.exports;\n';
            }
        }
        return transformed;
    }
}
export default SkillSandbox;
//# sourceMappingURL=skill-sandbox.js.map