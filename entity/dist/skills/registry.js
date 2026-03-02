/**
 * Skills Registry
 *
 * Discovers, loads, and manages skill instances.
 * Supports both built-in skills and self-authored skills from the mind.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { SkillValidator } from './skill-validator.js';
export class SkillsRegistry extends EventEmitter {
    authoredSkills;
    config;
    loadErrors;
    mindPath;
    mindServer;
    skills;
    validator;
    constructor(config = {}, mindServer = null) {
        super();
        this.skills = new Map();
        this.authoredSkills = new Map(); // Separate map for self-authored skills
        this.config = config;
        this.loadErrors = [];
        this.mindServer = mindServer;
        this.mindPath = null;
        this.validator = new SkillValidator();
        // Set up hot-reload listeners if mind server is available
        if (mindServer) {
            this.setupHotReload();
        }
    }
    /**
     * Set up hot-reload for authored skills
     */
    setupHotReload() {
        // Listen for skill-specific events from MindServer
        this.mindServer.on('skill:authored', async (event) => {
            console.log(`[Skills] Hot-loading authored skill: ${event.name}`);
            try {
                await this.loadAuthoredSkill(event.path);
                this.emit('skill:loaded', { name: event.name, type: 'authored' });
            }
            catch (err) {
                console.error(`[Skills] Failed to hot-load ${event.name}:`, err.message);
                this.emit('skill:error', { name: event.name, error: err.message });
            }
        });
        // Listen for file changes in authored skills directory
        this.mindServer.on('file:changed', async (event) => {
            if (event.relativePath?.startsWith('actions/skills/authored/')) {
                const skillDir = dirname(event.path);
                const skillName = skillDir.split('/').pop();
                // Only reload if manifest or index changed
                if (event.path.endsWith('manifest.json') || event.path.endsWith('index.js')) {
                    console.log(`[Skills] Detected change in authored skill: ${skillName}`);
                    try {
                        await this.reloadAuthoredSkill(skillName, skillDir);
                    }
                    catch (err) {
                        console.error(`[Skills] Failed to reload ${skillName}:`, err.message);
                    }
                }
            }
        });
    }
    /**
     * Load all built-in skills from a directory
     */
    async loadBuiltIn(builtInPath) {
        if (!existsSync(builtInPath)) {
            console.log(`[Skills] Built-in path does not exist: ${builtInPath}`);
            return;
        }
        const dirs = readdirSync(builtInPath, { withFileTypes: true })
            .filter((d) => d.isDirectory());
        for (const dir of dirs) {
            try {
                await this.loadSkill(join(builtInPath, dir.name));
            }
            catch (err) {
                console.error(`[Skills] Failed to load ${dir.name}:`, err.message);
                this.loadErrors.push({ skill: dir.name, error: err.message });
            }
        }
    }
    /**
     * Load user-installed skills from a directory
     */
    async loadUserSkills(userPath) {
        if (!existsSync(userPath)) {
            return;
        }
        const dirs = readdirSync(userPath, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .filter((d) => !d.name.startsWith('.'));
        for (const dir of dirs) {
            try {
                await this.loadSkill(join(userPath, dir.name));
            }
            catch (err) {
                console.error(`[Skills] Failed to load user skill ${dir.name}:`, err.message);
                this.loadErrors.push({ skill: dir.name, error: err.message });
            }
        }
    }
    /**
     * Load self-authored skills from the mind directory
     */
    async loadAuthoredSkills(mindPath) {
        this.mindPath = mindPath;
        const authoredPath = join(mindPath, 'actions/skills/authored');
        if (!existsSync(authoredPath)) {
            return;
        }
        const dirs = readdirSync(authoredPath, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .filter((d) => !d.name.startsWith('.'));
        for (const dir of dirs) {
            try {
                await this.loadAuthoredSkill(join(authoredPath, dir.name));
            }
            catch (err) {
                console.error(`[Skills] Failed to load authored skill ${dir.name}:`, err.message);
                this.loadErrors.push({ skill: dir.name, error: err.message, authored: true });
            }
        }
    }
    /**
     * Load a single self-authored skill
     */
    async loadAuthoredSkill(skillPath) {
        const manifestPath = join(skillPath, 'manifest.json');
        const metaPath = join(skillPath, '.meta.json');
        if (!existsSync(manifestPath)) {
            throw new Error(`No manifest.json found in ${skillPath}`);
        }
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        const skillName = manifest.name;
        if (!skillName) {
            throw new Error('Skill manifest must have a name');
        }
        // Check if skill is approved (meta.json must exist and have approved: true)
        let meta = null;
        if (existsSync(metaPath)) {
            meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
            if (!meta.approved) {
                console.log(`[Skills] Skipping unapproved authored skill: ${skillName}`);
                return null;
            }
        }
        else {
            console.log(`[Skills] Skipping authored skill without meta: ${skillName}`);
            return null;
        }
        // Load the implementation
        const indexPath = join(skillPath, 'index.js');
        if (!existsSync(indexPath)) {
            throw new Error(`No index.js found in ${skillPath}`);
        }
        const code = readFileSync(indexPath, 'utf-8');
        const validation = this.validator.validateSkill(manifest, code);
        if (!validation.valid) {
            throw new Error(`Authored skill validation failed for ${skillName}: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            console.warn(`[Skills] Authored skill warnings (${skillName}): ${validation.warnings.join('; ')}`);
        }
        if (meta?.codeHash) {
            const actualHash = createHash('sha256').update(code).digest('hex');
            if (actualHash !== meta.codeHash) {
                console.error(`[Skills] Skipping tampered authored skill "${skillName}" (hash mismatch)`);
                this.emit('skill:error', {
                    name: skillName,
                    reason: 'hash_mismatch',
                });
                return null;
            }
        }
        else {
            console.warn(`[Skills] Loading legacy authored skill without code hash: ${skillName}`);
        }
        // Use file URL for dynamic import
        const moduleUrl = pathToFileURL(indexPath).href;
        // Clear module cache to allow hot-reload
        // Note: This is a workaround; in production, consider using a proper module loader
        const cacheBuster = `?t=${Date.now()}`;
        const { default: SkillClass } = await import(moduleUrl + cacheBuster);
        // Get skill config (authored skills may have config too)
        const skillConfig = this.config.skills?.[skillName] || {};
        // Instantiate the skill
        const instance = new SkillClass(manifest, skillConfig);
        // Mark as authored
        instance._authored = true;
        // Register it in the authored skills map
        this.authoredSkills.set(skillName, instance);
        console.log(`[Skills] Loaded authored: ${skillName} v${manifest.version || '1.0.0'}`);
        return instance;
    }
    /**
     * Reload a self-authored skill
     */
    async reloadAuthoredSkill(name, skillPath) {
        if (this.authoredSkills.has(name)) {
            this.authoredSkills.delete(name);
        }
        return this.loadAuthoredSkill(skillPath);
    }
    /**
     * Load a single skill from a directory
     */
    async loadSkill(skillPath) {
        const manifestPath = join(skillPath, 'manifest.json');
        if (!existsSync(manifestPath)) {
            throw new Error(`No manifest.json found in ${skillPath}`);
        }
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        const skillName = manifest.name;
        if (!skillName) {
            throw new Error('Skill manifest must have a name');
        }
        // Get skill-specific config
        const skillConfig = this.config.skills?.[skillName] || {};
        // Check if skill is disabled
        if (skillConfig.enabled === false) {
            console.log(`[Skills] Skipping disabled skill: ${skillName}`);
            return null;
        }
        // Load the implementation
        const indexPath = join(skillPath, 'index.js');
        if (!existsSync(indexPath)) {
            throw new Error(`No index.js found in ${skillPath}`);
        }
        // Use file URL for dynamic import on all platforms
        const moduleUrl = pathToFileURL(indexPath).href;
        const { default: SkillClass } = await import(moduleUrl);
        // Instantiate the skill
        const instance = new SkillClass(manifest, skillConfig);
        // Register it
        this.skills.set(skillName, instance);
        console.log(`[Skills] Loaded: ${skillName} v${manifest.version || '1.0.0'}`);
        return instance;
    }
    /**
     * Get a skill by name (checks both built-in and authored)
     */
    get(name) {
        return this.skills.get(name) || this.authoredSkills.get(name);
    }
    /**
     * Check if a skill exists (checks both built-in and authored)
     */
    has(name) {
        return this.skills.has(name) || this.authoredSkills.has(name);
    }
    /**
     * Check if a skill is self-authored
     */
    isAuthored(name) {
        return this.authoredSkills.has(name);
    }
    /**
     * List all loaded skills (both built-in and authored)
     */
    list() {
        const builtIn = Array.from(this.skills.values()).map((skill) => skill.getMetadata());
        const authored = Array.from(this.authoredSkills.values()).map((skill) => ({
            ...skill.getMetadata(),
            _authored: true,
        }));
        return [...builtIn, ...authored];
    }
    /**
     * List only built-in skills
     */
    listBuiltIn() {
        return Array.from(this.skills.values()).map((skill) => skill.getMetadata());
    }
    /**
     * List only self-authored skills
     */
    listAuthored() {
        return Array.from(this.authoredSkills.values()).map((skill) => ({
            ...skill.getMetadata(),
            _authored: true,
        }));
    }
    /**
     * List skill names only (both built-in and authored)
     */
    names() {
        return [...Array.from(this.skills.keys()), ...Array.from(this.authoredSkills.keys())];
    }
    /**
     * Get skills formatted for LLM context
     */
    getContextForLLM() {
        const skills = this.listBuiltIn();
        if (skills.length === 0) {
            return '';
        }
        return skills.map((s) => {
            const actions = s.actions.map((a) => `    - ${a.name}: ${a.description || 'No description'} (Tier ${a.tier || 2})`).join('\n');
            return `- **${s.name}**: ${s.description}\n${actions}`;
        }).join('\n\n');
    }
    /**
     * Get self-authored skills formatted for LLM context
     */
    getAuthoredContextForLLM() {
        const skills = this.listAuthored();
        if (skills.length === 0) {
            return '';
        }
        return skills.map((s) => {
            const actions = s.actions.map((a) => `    - ${a.name}: ${a.description || 'No description'} (Tier 4 - requires approval)`).join('\n');
            return `- **${s.name}** (self-authored): ${s.description}\n${actions}`;
        }).join('\n\n');
    }
    /**
     * Reload a specific skill
     */
    async reloadSkill(name, skillPath) {
        if (this.skills.has(name)) {
            this.skills.delete(name);
        }
        return this.loadSkill(skillPath);
    }
    /**
     * Get load errors
     */
    getLoadErrors() {
        return this.loadErrors;
    }
}
//# sourceMappingURL=registry.js.map