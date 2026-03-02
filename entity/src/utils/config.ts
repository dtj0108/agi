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
import type { EntityConfig, DeepPartial } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const projectRoot = join(__dirname, '..', '..');

/**
 * Extended config type that includes runtime additions
 */
export interface RuntimeConfig extends EntityConfig {
  projectRoot: string;
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key as keyof T];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      key in target &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as DeepPartial<Record<string, unknown>>
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Load and merge configuration
 */
export async function loadConfig(): Promise<RuntimeConfig> {
  // Load default config
  const defaultConfigPath = join(projectRoot, 'config', 'default.js');
  const { default: defaultConfig } = (await import(defaultConfigPath)) as {
    default: EntityConfig;
  };

  let config: EntityConfig = { ...defaultConfig };

  // Try to load local overrides
  const localConfigPath = join(projectRoot, 'config', 'local.js');
  if (existsSync(localConfigPath)) {
    const { default: localConfig } = (await import(localConfigPath)) as {
      default: DeepPartial<EntityConfig>;
    };
    config = deepMerge(config, localConfig);
  }

  // Apply environment variable overrides
  applyEnvironmentOverrides(config);

  // Resolve relative paths to absolute
  resolveConfigPaths(config);

  // Return with project root added
  return {
    ...config,
    projectRoot,
  };
}

/**
 * Apply environment variable overrides to config
 */
function applyEnvironmentOverrides(config: EntityConfig): void {
  const env = process.env;

  // LLM configuration
  if (env.ENTITY_LLM_API_KEY) {
    config.llm.apiKey = env.ENTITY_LLM_API_KEY;
  }
  if (env.ANTHROPIC_API_KEY && !config.llm.apiKey) {
    config.llm.apiKey = env.ANTHROPIC_API_KEY;
  }
  if (env.OPENAI_API_KEY && config.llm.api === 'openai-completions' && !config.llm.apiKey) {
    config.llm.apiKey = env.OPENAI_API_KEY;
  }
  if (env.ENTITY_LLM_MODEL) {
    config.llm.model = env.ENTITY_LLM_MODEL;
  }
  if (env.ENTITY_LLM_API) {
    config.llm.api = env.ENTITY_LLM_API as 'anthropic-messages' | 'openai-completions';
  }
  if (env.ENTITY_LLM_BASE_URL) {
    config.llm.baseUrl = env.ENTITY_LLM_BASE_URL;
  }
  if (env.ENTITY_LLM_MAX_JSON_REPAIR_ATTEMPTS) {
    config.llm.maxJsonRepairAttempts = parseInt(env.ENTITY_LLM_MAX_JSON_REPAIR_ATTEMPTS, 10);
  }

  // Mind configuration
  if (env.ENTITY_MIND_PATH) {
    config.mind.path = env.ENTITY_MIND_PATH;
  }
  if (env.ENTITY_MIND_INDEX_PATH) {
    config.mind.indexPath = env.ENTITY_MIND_INDEX_PATH;
  }

  // Interface configuration
  if (env.ENTITY_HTTP_PORT) {
    config.interface.httpPort = parseInt(env.ENTITY_HTTP_PORT, 10);
  }
  if (env.ENTITY_WS_PORT) {
    config.interface.wsPort = parseInt(env.ENTITY_WS_PORT, 10);
  }
  if (env.ENTITY_INTERFACE_HOST) {
    config.interface.host = env.ENTITY_INTERFACE_HOST;
  }
  if (env.ENTITY_INTERFACE_API_KEY) {
    config.interface.apiKey = env.ENTITY_INTERFACE_API_KEY;
  }
  if (env.ENTITY_ENABLE_CLI) {
    config.interface.enableCli = env.ENTITY_ENABLE_CLI === 'true';
  }
  if (env.ENTITY_ACTIONS_AUTONOMY) {
    const autonomy = env.ENTITY_ACTIONS_AUTONOMY;
    if (autonomy === 'conservative' || autonomy === 'balanced' || autonomy === 'full_trust') {
      config.actions.autonomy = autonomy;
    }
  }

  // Logging configuration
  if (env.ENTITY_LOG_LEVEL) {
    config.logging.level = env.ENTITY_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
  }

  // Observability configuration
  if (env.ENTITY_OBSERVABILITY_ENABLED) {
    config.observability.enabled = env.ENTITY_OBSERVABILITY_ENABLED === 'true';
  }
  if (env.ENTITY_OBSERVABILITY_WINDOW_MINUTES) {
    config.observability.windowMinutes = parseInt(env.ENTITY_OBSERVABILITY_WINDOW_MINUTES, 10);
  }
  if (env.ENTITY_OBSERVABILITY_EVENTS_PATH) {
    config.observability.eventsPath = env.ENTITY_OBSERVABILITY_EVENTS_PATH;
  }
  if (env.ENTITY_OBSERVABILITY_METRICS_PATH) {
    config.observability.metricsPath = env.ENTITY_OBSERVABILITY_METRICS_PATH;
  }

  // Security configuration
  if (env.ENTITY_SECURITY_AUDIT_LOG_PATH) {
    config.security.auditLogPath = env.ENTITY_SECURITY_AUDIT_LOG_PATH;
  }
  if (env.ENTITY_SECURITY_ACTION_LOG_PATH) {
    config.security.actionLogPath = env.ENTITY_SECURITY_ACTION_LOG_PATH;
  }
  if (env.ENTITY_SECURITY_TOKEN_USAGE_PATH) {
    config.security.tokenUsagePath = env.ENTITY_SECURITY_TOKEN_USAGE_PATH;
  }
  if (env.ENTITY_SECURITY_CHECKSUMS_PATH) {
    config.security.checksumsPath = env.ENTITY_SECURITY_CHECKSUMS_PATH;
  }

  // Embedding configuration
  if (env.ENTITY_EMBEDDING_ENABLED) {
    config.embedding.enabled = env.ENTITY_EMBEDDING_ENABLED === 'true';
  }
  if (env.ENTITY_EMBEDDING_PROVIDER) {
    config.embedding.provider = env.ENTITY_EMBEDDING_PROVIDER as 'openai' | 'local';
  }
  if (env.ENTITY_EMBEDDING_OPENAI_API_KEY) {
    config.embedding.openai.apiKey = env.ENTITY_EMBEDDING_OPENAI_API_KEY;
  }
  if (env.OPENAI_API_KEY && !config.embedding.openai.apiKey) {
    config.embedding.openai.apiKey = env.OPENAI_API_KEY;
  }
  if (env.ENTITY_EMBEDDING_OPENAI_MODEL) {
    config.embedding.openai.model = env.ENTITY_EMBEDDING_OPENAI_MODEL;
  }
  if (env.ENTITY_EMBEDDING_LOCAL_URL) {
    config.embedding.local.serverUrl = env.ENTITY_EMBEDDING_LOCAL_URL;
  }
  if (env.ENTITY_EMBEDDING_LOCAL_MODEL) {
    config.embedding.local.model = env.ENTITY_EMBEDDING_LOCAL_MODEL;
  }
}

/**
 * Resolve relative paths to absolute paths
 */
function resolveConfigPaths(config: EntityConfig): void {
  config.mind.path = resolve(projectRoot, config.mind.path);
  config.mind.indexPath = resolve(projectRoot, config.mind.indexPath);
  config.actions.shell.workingDir = resolve(projectRoot, config.actions.shell.workingDir);
  config.actions.browser.screenshotDir = resolve(projectRoot, config.actions.browser.screenshotDir);
  config.actions.files.allowedPaths = config.actions.files.allowedPaths.map((p) =>
    resolve(projectRoot, p)
  );
  config.actions.files.blockedPaths = config.actions.files.blockedPaths.map((p) =>
    resolve(projectRoot, p)
  );
  config.security.auditLogPath = resolve(projectRoot, config.security.auditLogPath);
  config.security.actionLogPath = resolve(projectRoot, config.security.actionLogPath);
  config.security.tokenUsagePath = resolve(projectRoot, config.security.tokenUsagePath);
  config.security.checksumsPath = resolve(projectRoot, config.security.checksumsPath);
  config.observability.eventsPath = resolve(projectRoot, config.observability.eventsPath);
  config.observability.metricsPath = resolve(projectRoot, config.observability.metricsPath);

  if (config.logging.logFile) {
    config.logging.logFile = resolve(projectRoot, config.logging.logFile);
  }
}

// Singleton config instance
let configInstance: RuntimeConfig | null = null;

/**
 * Get the singleton config instance
 */
export async function getConfig(): Promise<RuntimeConfig> {
  if (!configInstance) {
    configInstance = await loadConfig();
  }
  return configInstance;
}

/**
 * Reset config instance (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
