/**
 * Configuration Loader
 *
 * Loads config from:
 * 1. config/default.js (base)
 * 2. config/local.js (overrides, if exists)
 * 3. Environment variables (highest priority)
 */
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] !== null &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            key in target &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
/**
 * Load and merge configuration
 */
export async function loadConfig() {
    // Load default config
    const defaultConfigPath = join(projectRoot, 'config', 'default.js');
    const { default: defaultConfig } = await import(defaultConfigPath);
    let config = { ...defaultConfig };
    // Try to load local overrides
    const localConfigPath = join(projectRoot, 'config', 'local.js');
    if (existsSync(localConfigPath)) {
        const { default: localConfig } = await import(localConfigPath);
        config = deepMerge(config, localConfig);
    }
    // Apply environment variable overrides
    if (process.env.ENTITY_LLM_API_KEY) {
        config.llm.apiKey = process.env.ENTITY_LLM_API_KEY;
    }
    if (process.env.ENTITY_MIND_PATH) {
        config.mind.path = process.env.ENTITY_MIND_PATH;
    }
    if (process.env.ENTITY_MIND_INDEX_PATH) {
        config.mind.indexPath = process.env.ENTITY_MIND_INDEX_PATH;
    }
    if (process.env.ANTHROPIC_API_KEY && !config.llm.apiKey) {
        config.llm.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.OPENAI_API_KEY && config.llm.api === 'openai-completions' && !config.llm.apiKey) {
        config.llm.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.ENTITY_HTTP_PORT) {
        config.interface.httpPort = parseInt(process.env.ENTITY_HTTP_PORT, 10);
    }
    if (process.env.ENTITY_WS_PORT) {
        config.interface.wsPort = parseInt(process.env.ENTITY_WS_PORT, 10);
    }
    if (process.env.ENTITY_INTERFACE_HOST) {
        config.interface.host = process.env.ENTITY_INTERFACE_HOST;
    }
    if (process.env.ENTITY_INTERFACE_API_KEY) {
        config.interface.apiKey = process.env.ENTITY_INTERFACE_API_KEY;
    }
    if (process.env.ENTITY_ENABLE_CLI) {
        config.interface.enableCli = process.env.ENTITY_ENABLE_CLI === 'true';
    }
    if (process.env.ENTITY_ACTIONS_AUTONOMY) {
        const autonomy = process.env.ENTITY_ACTIONS_AUTONOMY;
        if (autonomy === 'conservative' || autonomy === 'balanced' || autonomy === 'full_trust') {
            config.actions.autonomy = autonomy;
        }
    }
    if (process.env.ENTITY_AUTONOMY_MODE) {
        const mode = process.env.ENTITY_AUTONOMY_MODE;
        if (mode === 'manual' || mode === 'heartbeat' || mode === 'go') {
            config.autonomy = config.autonomy || {};
            config.autonomy.mode = mode;
        }
    }
    if (process.env.ENTITY_AUTONOMY_GO_MIN_DELAY_MS) {
        const parsed = parseInt(process.env.ENTITY_AUTONOMY_GO_MIN_DELAY_MS, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
            config.autonomy = config.autonomy || {};
            config.autonomy.go = config.autonomy.go || {};
            config.autonomy.go.minDelayMs = parsed;
        }
    }
    if (process.env.ENTITY_AUTONOMY_GO_MAX_CONSECUTIVE_ERRORS) {
        const parsed = parseInt(process.env.ENTITY_AUTONOMY_GO_MAX_CONSECUTIVE_ERRORS, 10);
        if (Number.isFinite(parsed) && parsed >= 1) {
            config.autonomy = config.autonomy || {};
            config.autonomy.go = config.autonomy.go || {};
            config.autonomy.go.maxConsecutiveErrors = parsed;
        }
    }
    if (process.env.ENTITY_LOG_LEVEL) {
        config.logging.level = process.env.ENTITY_LOG_LEVEL;
    }
    if (process.env.ENTITY_OBSERVABILITY_ENABLED) {
        config.observability.enabled = process.env.ENTITY_OBSERVABILITY_ENABLED === 'true';
    }
    if (process.env.ENTITY_OBSERVABILITY_WINDOW_MINUTES) {
        config.observability.windowMinutes = parseInt(process.env.ENTITY_OBSERVABILITY_WINDOW_MINUTES, 10);
    }
    if (process.env.ENTITY_OBSERVABILITY_EVENTS_PATH) {
        config.observability.eventsPath = process.env.ENTITY_OBSERVABILITY_EVENTS_PATH;
    }
    if (process.env.ENTITY_OBSERVABILITY_METRICS_PATH) {
        config.observability.metricsPath = process.env.ENTITY_OBSERVABILITY_METRICS_PATH;
    }
    if (process.env.ENTITY_SECURITY_AUDIT_LOG_PATH) {
        config.security.auditLogPath = process.env.ENTITY_SECURITY_AUDIT_LOG_PATH;
    }
    if (process.env.ENTITY_SECURITY_ACTION_LOG_PATH) {
        config.security.actionLogPath = process.env.ENTITY_SECURITY_ACTION_LOG_PATH;
    }
    if (process.env.ENTITY_SECURITY_TOKEN_USAGE_PATH) {
        config.security.tokenUsagePath = process.env.ENTITY_SECURITY_TOKEN_USAGE_PATH;
    }
    if (process.env.ENTITY_SECURITY_CHECKSUMS_PATH) {
        config.security.checksumsPath = process.env.ENTITY_SECURITY_CHECKSUMS_PATH;
    }
    if (process.env.ENTITY_LLM_MODEL) {
        config.llm.model = process.env.ENTITY_LLM_MODEL;
    }
    if (process.env.ENTITY_LLM_API) {
        config.llm.api = process.env.ENTITY_LLM_API;
    }
    if (process.env.ENTITY_LLM_BASE_URL) {
        config.llm.baseUrl = process.env.ENTITY_LLM_BASE_URL;
    }
    if (process.env.ENTITY_LLM_CREDENTIAL_SOURCE) {
        const source = process.env.ENTITY_LLM_CREDENTIAL_SOURCE;
        if (source === 'config' || source === 'auth_store' || source === 'auto') {
            config.llm.credentialSource = source;
        }
    }
    if (process.env.ENTITY_LLM_MAX_JSON_REPAIR_ATTEMPTS) {
        config.llm.maxJsonRepairAttempts = parseInt(process.env.ENTITY_LLM_MAX_JSON_REPAIR_ATTEMPTS, 10);
    }
    if (process.env.ENTITY_AUTH_MODE) {
        const mode = process.env.ENTITY_AUTH_MODE;
        if (mode === 'api_key' || mode === 'oauth' || mode === 'hybrid') {
            config.auth = config.auth || {};
            config.auth.mode = mode;
        }
    }
    if (process.env.ENTITY_AUTH_OAUTH_ISSUER) {
        config.auth = config.auth || {};
        config.auth.oauth = config.auth.oauth || {};
        config.auth.oauth.issuer = process.env.ENTITY_AUTH_OAUTH_ISSUER;
    }
    if (process.env.ENTITY_AUTH_OAUTH_CLIENT_ID) {
        config.auth = config.auth || {};
        config.auth.oauth = config.auth.oauth || {};
        config.auth.oauth.clientId = process.env.ENTITY_AUTH_OAUTH_CLIENT_ID;
    }
    if (process.env.ENTITY_AUTH_OAUTH_SCOPES) {
        const scopes = process.env.ENTITY_AUTH_OAUTH_SCOPES
            .split(/[,\s]+/)
            .map((scope) => scope.trim())
            .filter(Boolean);
        if (scopes.length > 0) {
            config.auth = config.auth || {};
            config.auth.oauth = config.auth.oauth || {};
            config.auth.oauth.scopes = scopes;
        }
    }
    if (process.env.ENTITY_AUTH_OAUTH_FLOW) {
        const flow = process.env.ENTITY_AUTH_OAUTH_FLOW;
        if (flow === 'auto' || flow === 'browser' || flow === 'device_code') {
            config.auth = config.auth || {};
            config.auth.oauth = config.auth.oauth || {};
            config.auth.oauth.flow = flow;
        }
    }
    if (process.env.ENTITY_AUTH_STORAGE_MODE) {
        const mode = process.env.ENTITY_AUTH_STORAGE_MODE;
        if (mode === 'keychain_fallback_file') {
            config.auth = config.auth || {};
            config.auth.storage = config.auth.storage || {};
            config.auth.storage.mode = mode;
        }
    }
    if (process.env.ENTITY_AUTH_STORAGE_FILE_PATH) {
        config.auth = config.auth || {};
        config.auth.storage = config.auth.storage || {};
        config.auth.storage.filePath = process.env.ENTITY_AUTH_STORAGE_FILE_PATH;
    }
    // Embedding configuration overrides
    if (process.env.ENTITY_EMBEDDING_ENABLED) {
        config.embedding.enabled = process.env.ENTITY_EMBEDDING_ENABLED === 'true';
    }
    if (process.env.ENTITY_EMBEDDING_PROVIDER) {
        config.embedding.provider = process.env.ENTITY_EMBEDDING_PROVIDER;
    }
    if (process.env.ENTITY_EMBEDDING_OPENAI_API_KEY) {
        config.embedding.openai.apiKey = process.env.ENTITY_EMBEDDING_OPENAI_API_KEY;
    }
    if (process.env.OPENAI_API_KEY && !config.embedding.openai.apiKey) {
        config.embedding.openai.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.ENTITY_EMBEDDING_OPENAI_MODEL) {
        config.embedding.openai.model = process.env.ENTITY_EMBEDDING_OPENAI_MODEL;
    }
    if (process.env.ENTITY_EMBEDDING_LOCAL_URL) {
        config.embedding.local.serverUrl = process.env.ENTITY_EMBEDDING_LOCAL_URL;
    }
    if (process.env.ENTITY_EMBEDDING_LOCAL_MODEL) {
        config.embedding.local.model = process.env.ENTITY_EMBEDDING_LOCAL_MODEL;
    }
    // Resolve relative paths to absolute
    config.mind.path = resolve(projectRoot, config.mind.path);
    config.mind.indexPath = resolve(projectRoot, config.mind.indexPath);
    config.actions.shell.workingDir = resolve(projectRoot, config.actions.shell.workingDir);
    config.actions.browser.screenshotDir = resolve(projectRoot, config.actions.browser.screenshotDir);
    config.actions.files.allowedPaths = config.actions.files.allowedPaths.map((p) => resolve(projectRoot, p));
    config.actions.files.blockedPaths = config.actions.files.blockedPaths.map((p) => resolve(projectRoot, p));
    config.security.auditLogPath = resolve(projectRoot, config.security.auditLogPath);
    config.security.actionLogPath = resolve(projectRoot, config.security.actionLogPath);
    config.security.tokenUsagePath = resolve(projectRoot, config.security.tokenUsagePath);
    config.security.checksumsPath = resolve(projectRoot, config.security.checksumsPath);
    config.observability.eventsPath = resolve(projectRoot, config.observability.eventsPath);
    config.observability.metricsPath = resolve(projectRoot, config.observability.metricsPath);
    if (config.auth?.storage?.filePath) {
        config.auth.storage.filePath = resolve(projectRoot, config.auth.storage.filePath);
    }
    if (config.logging.logFile) {
        config.logging.logFile = resolve(projectRoot, config.logging.logFile);
    }
    // Store project root for reference
    config.projectRoot = projectRoot;
    return config;
}
// Singleton config instance
let configInstance = null;
export async function getConfig() {
    if (!configInstance) {
        configInstance = await loadConfig();
    }
    return configInstance;
}
export { projectRoot };
//# sourceMappingURL=config.js.map