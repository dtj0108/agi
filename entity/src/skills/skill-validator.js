/**
 * Skill Validator
 *
 * AST-based static analysis to detect forbidden patterns in Entity-authored skills.
 * Ensures generated code doesn't contain dangerous constructs before execution.
 */

import * as acorn from 'acorn';

// Forbidden patterns that indicate potentially dangerous code
const FORBIDDEN_IDENTIFIERS = new Set([
  'require',
  'eval',
  'Function',
  'child_process',
  'spawn',
  'exec',
  'execSync',
  'execFile',
  'fork',
  '__dirname',
  '__filename',
  'globalThis',
  'global',
  'Buffer',
]);

const FORBIDDEN_MEMBER_EXPRESSIONS = [
  { object: 'process', property: 'env' },
  { object: 'process', property: 'exit' },
  { object: 'process', property: 'kill' },
  { object: 'process', property: 'binding' },
  { object: 'process', property: 'dlopen' },
  { object: 'process', property: 'mainModule' },
  { object: 'fs', property: null },  // Block all fs access
  { object: 'child_process', property: null },
  { object: 'net', property: null },
  { object: 'dgram', property: null },
  { object: 'cluster', property: null },
  { object: 'worker_threads', property: null },
  { object: 'vm', property: null },
];

// Regex patterns for quick pre-screening
const FORBIDDEN_PATTERNS = [
  /\brequire\s*\(/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /import\s*\(/,  // Dynamic import
  /child_process/,
  /\bfs\./,
  /process\.env/,
  /process\.exit/,
  /process\.kill/,
  /__dirname/,
  /__filename/,
  /\bglobalThis\b/,
  /\bglobal\./,
];

export class SkillValidator {
  constructor(options = {}) {
    this.options = {
      allowFetch: true,
      allowConsole: true,
      maxCodeLength: 50000,  // 50KB max
      ...options,
    };
  }

  /**
   * Validate skill code for safety
   * @param {string} code - The JavaScript code to validate
   * @returns {{ safe: boolean, reason?: string, warnings: string[] }}
   */
  validate(code) {
    const warnings = [];

    // Step 1: Basic sanity checks
    if (!code || typeof code !== 'string') {
      return { safe: false, reason: 'Code must be a non-empty string' };
    }

    if (code.length > this.options.maxCodeLength) {
      return { safe: false, reason: `Code exceeds maximum length of ${this.options.maxCodeLength} characters` };
    }

    // Step 2: Quick regex pre-screening
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        return { safe: false, reason: `Code contains forbidden pattern: ${pattern.source}` };
      }
    }

    // Step 3: Parse AST
    let ast;
    try {
      ast = acorn.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowAwaitOutsideFunction: true,
      });
    } catch (err) {
      return { safe: false, reason: `Failed to parse code: ${err.message}` };
    }

    // Step 4: Walk AST and check for forbidden constructs
    const astResult = this.walkAST(ast);
    if (!astResult.safe) {
      return astResult;
    }

    // Step 5: Check for suspicious patterns
    const suspiciousResult = this.checkSuspiciousPatterns(code);
    if (suspiciousResult.warnings.length > 0) {
      warnings.push(...suspiciousResult.warnings);
    }

    return { safe: true, warnings };
  }

  /**
   * Walk AST and check for forbidden constructs
   */
  walkAST(node, result = { safe: true, warnings: [] }) {
    if (!node || !result.safe) return result;

    switch (node.type) {
      case 'Identifier':
        if (FORBIDDEN_IDENTIFIERS.has(node.name)) {
          result.safe = false;
          result.reason = `Forbidden identifier: ${node.name}`;
        }
        break;

      case 'CallExpression':
        // Check for eval() and Function()
        if (node.callee.type === 'Identifier') {
          if (node.callee.name === 'eval') {
            result.safe = false;
            result.reason = 'Use of eval() is forbidden';
          } else if (node.callee.name === 'Function') {
            result.safe = false;
            result.reason = 'Use of Function constructor is forbidden';
          }
        }
        // Check for dynamic import()
        if (node.callee.type === 'Import') {
          result.safe = false;
          result.reason = 'Dynamic import() is forbidden';
        }
        break;

      case 'MemberExpression':
        this.checkMemberExpression(node, result);
        break;

      case 'ImportDeclaration':
        // Only allow specific imports
        const source = node.source.value;
        if (!this.isAllowedImport(source)) {
          result.safe = false;
          result.reason = `Import from '${source}' is not allowed`;
        }
        break;

      case 'NewExpression':
        // Check for new Function()
        if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
          result.safe = false;
          result.reason = 'Use of new Function() is forbidden';
        }
        break;

      case 'WithStatement':
        result.safe = false;
        result.reason = 'Use of "with" statement is forbidden';
        break;
    }

    // Recursively check child nodes
    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
        continue;
      }
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object') {
            this.walkAST(item, result);
          }
        }
      } else if (child && typeof child === 'object') {
        this.walkAST(child, result);
      }
    }

    return result;
  }

  /**
   * Check member expressions for forbidden access patterns
   */
  checkMemberExpression(node, result) {
    const objectName = node.object.type === 'Identifier' ? node.object.name : null;
    const propertyName = node.property.type === 'Identifier' ? node.property.name :
                        (node.property.type === 'Literal' ? node.property.value : null);

    for (const forbidden of FORBIDDEN_MEMBER_EXPRESSIONS) {
      if (objectName === forbidden.object) {
        if (forbidden.property === null || propertyName === forbidden.property) {
          result.safe = false;
          result.reason = `Access to ${objectName}.${propertyName || '*'} is forbidden`;
          return;
        }
      }
    }

    // Check for process access
    if (objectName === 'process') {
      result.safe = false;
      result.reason = `Access to process.${propertyName} is forbidden`;
    }
  }

  /**
   * Check if an import source is allowed
   */
  isAllowedImport(source) {
    // Only allow importing from the base-skill module
    const allowedImports = [
      '../../base-skill.js',
      '../base-skill.js',
      './base-skill.js',
    ];

    // Relative imports within the skill directory are ok
    if (source.startsWith('./') && !source.includes('..')) {
      return true;
    }

    return allowedImports.includes(source);
  }

  /**
   * Check for suspicious patterns that warrant warnings
   */
  checkSuspiciousPatterns(code) {
    const warnings = [];

    // Warn about while(true) or for(;;)
    if (/while\s*\(\s*true\s*\)/.test(code) || /for\s*\(\s*;\s*;\s*\)/.test(code)) {
      warnings.push('Code contains potential infinite loop');
    }

    // Warn about very long strings (could be obfuscation)
    if (/"[^"]{1000,}"/.test(code) || /'[^']{1000,}'/.test(code)) {
      warnings.push('Code contains very long string literals');
    }

    // Warn about encoded strings
    if (/\\x[0-9a-fA-F]{2}/.test(code) || /\\u[0-9a-fA-F]{4}/.test(code)) {
      warnings.push('Code contains encoded character sequences');
    }

    // Warn about prototype manipulation
    if (/__proto__|prototype\s*=/.test(code)) {
      warnings.push('Code appears to manipulate prototypes');
    }

    return { warnings };
  }

  /**
   * Validate a complete skill (manifest + code)
   */
  validateSkill(manifest, code) {
    const errors = [];
    const warnings = [];

    // Validate manifest
    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Manifest must have a valid name');
    } else if (!/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
      errors.push('Skill name must be lowercase alphanumeric with hyphens');
    }

    if (!manifest.description || typeof manifest.description !== 'string') {
      errors.push('Manifest must have a description');
    }

    if (!Array.isArray(manifest.actions) || manifest.actions.length === 0) {
      errors.push('Manifest must have at least one action');
    } else {
      for (const action of manifest.actions) {
        if (!action.name || typeof action.name !== 'string') {
          errors.push('Each action must have a name');
        }
        if (action.tier !== 4) {
          warnings.push(`Action "${action.name}" should have tier 4 for authored skills`);
        }
      }
    }

    // Validate code
    const codeResult = this.validate(code);
    if (!codeResult.safe) {
      errors.push(`Code validation failed: ${codeResult.reason}`);
    }
    warnings.push(...codeResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default SkillValidator;
