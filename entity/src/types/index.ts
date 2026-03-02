/**
 * Entity Framework Type Definitions
 *
 * Core types and interfaces for the Entity conscious AI framework.
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface EntityConfig {
  entity: {
    name: string;
    personality: string;
  };
  user: {
    name: string;
    callName: string;
  };
  deployment: {
    type: 'local' | 'docker' | 'manual';
  };
  mind: MindConfig;
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  cognitive: CognitiveConfig;
  actions: ActionConfig;
  interface: InterfaceConfig;
  auth: AuthConfig;
  autonomy: AutonomyConfig;
  heartbeat: HeartbeatConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  observability: ObservabilityConfig;
}

export interface MindConfig {
  path: string;
  indexPath: string;
  maxStreamEntries: number;
  gitDebounceMs: number;
  fileWatchDebounceMs: number;
}

export interface LLMConfig {
  api: 'anthropic-messages' | 'openai-completions';
  baseUrl: string;
  apiKey: string;
  credentialSource: 'config' | 'auth_store' | 'auto';
  model: string;
  maxTokens: number;
  temperature: number;
  promptCaching: boolean;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  maxJsonRepairAttempts: number;
}

export interface EmbeddingConfig {
  enabled: boolean;
  provider: 'openai' | 'local';
  openai: {
    baseUrl: string;
    apiKey: string;
    model: string;
    dimensions: number;
    batchSize: number;
  };
  local: {
    serverUrl: string;
    model: string;
    dimensions: number;
  };
  hybridSearch: {
    vectorWeight: number;
    ftsWeight: number;
    minScore: number;
  };
}

export interface CognitiveConfig {
  reflectionInterval: number;
  maxThoughtsInContext: number;
  maxRelevantMemories: number;
  emotionalDecayRate: number;
  emotionalMomentum: number;
  circuitBreakerThreshold: number;
  circuitBreakerCycles: number;
}

export type AutonomyLevel = 'conservative' | 'balanced' | 'full_trust';
export type AutonomyMode = 'manual' | 'heartbeat' | 'go';
export type AuthMode = 'api_key' | 'oauth' | 'hybrid';
export type AuthFlow = 'auto' | 'browser' | 'device_code';

export interface ActionConfig {
  autonomy: AutonomyLevel;
  shell: ShellConfig;
  browser: BrowserConfig;
  files: FilesConfig;
  blockedPatterns: string[];
  approvalTimeout: number;
}

export interface AutonomyConfig {
  mode: AutonomyMode;
  go: {
    minDelayMs: number;
    maxConsecutiveErrors: number;
  };
}

export interface ShellConfig {
  workingDir: string;
  timeout: number;
  maxOutputBytes: number;
  user: string | null;
  env: Record<string, string>;
}

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  allowedDomains: string[];
  viewportWidth: number;
  viewportHeight: number;
  screenshotDir: string;
}

export interface FilesConfig {
  allowedPaths: string[];
  blockedPaths: string[];
  maxFileSizeBytes: number;
}

export interface InterfaceConfig {
  httpPort: number;
  wsPort: number;
  host: string;
  enableCli: boolean;
  corsOrigins: string[];
  apiKey: string | null;
}

export interface AuthConfig {
  mode: AuthMode;
  oauth: {
    provider: 'oidc';
    issuer: string;
    clientId: string;
    scopes: string[];
    flow: AuthFlow;
    callbackHost: string;
    callbackPort: number;
    callbackPortRange: number;
    extraAuthorizeParams?: Record<string, string>;
  };
  storage: {
    mode: 'keychain_fallback_file';
    filePath: string;
  };
}

export interface HeartbeatConfig {
  enabled: boolean;
  schedule: string;
  prompt: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  colorize: boolean;
  timestamps: boolean;
  logFile: string | null;
}

export interface SecurityConfig {
  auditLogPath: string;
  actionLogPath: string;
  tokenUsagePath: string;
  checksumsPath: string;
}

export interface ObservabilityConfig {
  enabled: boolean;
  eventsPath: string;
  metricsPath: string;
  flushIntervalMs: number;
  windowMinutes: number;
  redactKeys: string[];
}

// ============================================================================
// Cognitive Engine Types
// ============================================================================

export type StimulusType =
  | 'user_message'
  | 'heartbeat'
  | 'file_change'
  | 'approval_result'
  | 'system';

export interface Stimulus {
  type: StimulusType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface CycleResult {
  cycleId: string;
  stimulus: Stimulus;
  phases: PhaseResults;
  userResponse: string | null;
  emotionalState: EmotionalState;
  thoughts: string[];
  totalDuration: number;
  error?: string;
}

export interface PhaseResults {
  orient?: OrientResult;
  think?: ThinkResult;
  plan?: PlanResult;
  act?: ActResult;
  sense?: SenseResult;
  reflect?: ReflectResult;
  update?: UpdateResult;
}

export interface OrientResult {
  context: OrientContext;
  duration: number;
}

export interface OrientContext {
  identity: string;
  values: string;
  voice: string;
  goals: string;
  emotionalState: EmotionalState;
  recentThoughts: string[];
  relevantMemories: string[];
  worldContext: string;
}

export interface ThinkResult {
  thoughts: string;
  needsAction: boolean;
  userResponse: string | null;
  emotionalShift: EmotionalShift;
  actionIntent: string | null;
  duration: number;
}

export interface PlanResult {
  plan: Plan | null;
  duration: number;
}

export interface ActResult {
  results: ActionStepResult[];
  duration: number;
}

export interface SenseResult {
  observations: Observation[];
  duration: number;
}

export interface ReflectResult {
  reflection: string;
  emotionalUpdate: EmotionalShift;
  goalUpdate: GoalUpdate | null;
  skillLearned: SkillLearned | null;
  valueAlignment: number;
  lessonsLearned: string[];
  duration: number;
}

export interface UpdateResult {
  updated: string[];
  duration: number;
}

// ============================================================================
// Emotional Types
// ============================================================================

export interface EmotionalState {
  primary: string;
  intensity: number;
  secondary: string | null;
  secondaryIntensity: number;
  momentum: 'stable' | 'increasing' | 'decreasing';
  source?: string;
  updatedAt?: string;
}

export interface EmotionalDelta {
  emotion: string;
  delta: number;
}

export interface EmotionalShift {
  primary: EmotionalDelta;
  secondary: EmotionalDelta | null;
}

// ============================================================================
// Plan Types
// ============================================================================

export type ToolType = 'shell' | 'browser' | 'file' | 'config';

export interface Plan {
  planId: string;
  goal: string;
  steps: PlanStep[];
  rollback: string | null;
  emotionalContext: string;
  needsApproval?: boolean;
}

export interface PlanStep {
  tool: ToolType;
  action: string;
  params: Record<string, unknown>;
  intent: string;
  stepIndex?: number;
  tier?: ActionTier;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionTier = 1 | 2 | 3;

export interface Action {
  actionId: string;
  tool: ToolType;
  action: string;
  params: Record<string, unknown>;
  intent: string;
  tier: ActionTier;
  planId?: string;
  stepIndex?: number;
}

export interface ActionStepResult {
  stepIndex: number;
  tool: ToolType;
  action: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  tier: ActionTier;
  approved?: boolean;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  output?: string;
  error?: string;
  tier: ActionTier;
  approved?: boolean;
}

export interface ApprovalRequest {
  approvalId: string;
  approvalType: 'action' | 'plan';
  action?: Action;
  plan?: Plan;
  message: string;
  timestamp: string;
  timeout: number;
}

export interface PendingApproval {
  actionId: string;
  action: Action;
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: number;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface Observation {
  type: 'shell_output' | 'browser_content' | 'file_content' | 'error';
  source: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EpisodicMemory {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  details: string;
  emotionalContext: EmotionalState;
  tags: string[];
}

export interface GoalUpdate {
  goalId: string;
  progress: number;
  notes: string;
}

export interface SkillLearned {
  name: string;
  description: string;
  examples: string[];
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  path: string;
  content: string;
  score: number;
  highlights?: string[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: 'fts' | 'vector' | 'hybrid';
  filters?: Record<string, string>;
}

// ============================================================================
// Mind Server Types
// ============================================================================

export interface MindFileEvent {
  type: 'added' | 'changed' | 'removed';
  path: string;
  content?: string;
  timestamp: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// ============================================================================
// Interface Types
// ============================================================================

export interface MessageRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MessageResponse {
  response: string | null;
  emotions: EmotionalState;
  thoughts: string[];
  cycleId: string;
}

export interface StatusResponse {
  name: string;
  cycleCount: number;
  currentPhase: string | null;
  lastCycleAt: string | null;
  emotionalState: EmotionalState;
  paused: boolean;
  uptime: number;
  health: HealthMetrics;
}

export interface HealthMetrics {
  cyclesLast60m: number;
  errorsLast60m: number;
  avgCycleDurationMs: number;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export type WSClientMessageType =
  | 'message'
  | 'approve'
  | 'deny'
  | 'subscribe'
  | 'ping';

export type WSServerMessageType =
  | 'connected'
  | 'response'
  | 'thought'
  | 'emotion'
  | 'cycle_start'
  | 'cycle_complete'
  | 'approval_needed'
  | 'approval_result'
  | 'notification'
  | 'pong'
  | 'error';

export interface WSClientMessage {
  type: WSClientMessageType;
  content?: string;
  metadata?: Record<string, unknown>;
  actionId?: string;
  approvalId?: string;
  planId?: string;
  events?: string[];
}

export interface WSServerMessage {
  type: WSServerMessageType;
  [key: string]: unknown;
}

export interface WSThoughtMessage extends WSServerMessage {
  type: 'thought';
  content: string;
  phase: string;
  cycleId: string;
  timestamp: string;
}

export interface WSEmotionMessage extends WSServerMessage {
  type: 'emotion';
  state: EmotionalState;
}

export interface WSApprovalNeededMessage extends WSServerMessage {
  type: 'approval_needed';
  approvalType: 'action' | 'plan';
  approvalId: string;
  actionId?: string;
  planId?: string;
  action?: Action;
  plan?: Plan;
  message: string;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TelemetryMetric {
  name: string;
  value: number;
  timestamp: string;
  labels: Record<string, string>;
}

export interface TelemetryError {
  component: string;
  message: string;
  stack?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: unknown;
}

export interface ShellValidationResult {
  safe: boolean;
  command: string;
  reason?: string;
  blockedPatterns?: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
