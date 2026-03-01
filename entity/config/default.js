/**
 * Entity Configuration - Default Settings
 *
 * Override by creating config/local.js with your settings.
 * Environment variables take precedence over both.
 */

export default {
  // Entity identity
  entity: {
    name: 'Entity',
    personality: 'curious, direct, thoughtful',
  },

  // User information (set during onboarding)
  user: {
    name: '',
    callName: '',
  },

  // Deployment configuration
  deployment: {
    type: 'manual',  // 'local' | 'docker' | 'manual'
  },

  // Mind filesystem location
  mind: {
    path: './mind',
    indexPath: './mind/.index.db',
    maxStreamEntries: 100,
    gitDebounceMs: 500,
    fileWatchDebounceMs: 100,
  },

  // LLM Configuration (model-agnostic)
  llm: {
    api: 'anthropic-messages',    // 'openai-completions' | 'anthropic-messages'
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-5-20250514',
    maxTokens: 8192,
    temperature: 0.7,
    promptCaching: true,
    retryAttempts: 3,
    retryDelayMs: 1000,
    timeoutMs: 120000,
    maxJsonRepairAttempts: 1,
  },

  // Embedding Configuration (for vector search)
  embedding: {
    enabled: false,
    provider: 'openai',  // 'openai' | 'local'

    // OpenAI Embeddings
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 100,
    },

    // Local sentence-transformers server
    local: {
      serverUrl: 'http://localhost:8080',
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
    },

    // Hybrid search settings
    hybridSearch: {
      vectorWeight: 0.6,
      ftsWeight: 0.4,
      minScore: 0.3,
    },
  },

  // Cognitive Engine Settings
  cognitive: {
    reflectionInterval: 10,
    maxThoughtsInContext: 20,
    maxRelevantMemories: 5,
    emotionalDecayRate: 0.1,
    emotionalMomentum: 0.3,
    circuitBreakerThreshold: 0.95,
    circuitBreakerCycles: 5,
  },

  // Action Gateway & Execution
  actions: {
    autonomy: 'balanced',  // 'conservative' | 'balanced' | 'full_trust'
    shell: {
      workingDir: './entity-workspace',
      timeout: 30000,
      maxOutputBytes: 1024 * 1024,
      user: null,
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
      },
    },
    browser: {
      headless: true,
      timeout: 60000,
      allowedDomains: [],
      viewportWidth: 1280,
      viewportHeight: 720,
      screenshotDir: './entity-workspace/temp/screenshots',
    },
    files: {
      allowedPaths: [
        './entity-workspace',
        './mind',
      ],
      blockedPaths: [
        './mind/security',
      ],
      maxFileSizeBytes: 10 * 1024 * 1024,
    },
    blockedPatterns: [
      'rm -rf /',
      '> /etc/',
      'chmod 777',
      'eval(',
    ],
    approvalTimeout: 300000,
  },

  // Interface Layer
  interface: {
    httpPort: 3000,
    wsPort: 3001,
    host: '127.0.0.1',
    enableCli: true,
    corsOrigins: ['http://localhost:3000'],
    apiKey: null,
  },

  // Heartbeat (autonomous cycles)
  heartbeat: {
    enabled: true,
    schedule: '*/30 * * * *',
    prompt: 'It has been 30 minutes. Check my goals, reflect on recent events, and decide if there is anything I should be working on.',
  },

  // Logging
  logging: {
    level: 'info',
    colorize: true,
    timestamps: true,
    logFile: null,
  },

  // Security
  security: {
    auditLogPath: './mind/security/audit.log',
    actionLogPath: './mind/security/action_log.json',
    tokenUsagePath: './mind/security/token_usage.jsonl',
    checksumsPath: './mind/security/checksums.json',
  },

  // Observability
  observability: {
    enabled: true,
    eventsPath: './mind/security/events.jsonl',
    metricsPath: './mind/security/metrics.jsonl',
    flushIntervalMs: 5000,
    windowMinutes: 60,
    redactKeys: [
      'authorization',
      'apiKey',
      'api_key',
      'token',
      'password',
      'secret',
    ],
  },
};
