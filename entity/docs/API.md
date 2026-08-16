# Entity API Reference

Complete reference for Entity's HTTP REST API, WebSocket interface, and CLI commands.

## Table of Contents

- [HTTP REST API](#http-rest-api)
- [WebSocket Interface](#websocket-interface)
- [CLI Commands](#cli-commands)
- [Configuration Reference](#configuration-reference)

---

## HTTP REST API

Base URL: `http://localhost:3000` (configurable via `interface.httpPort`)

### Authentication

If `interface.apiKey` is configured, all endpoints (except `/health`) require authentication:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/status
```

### Endpoints

#### Health Check

```http
GET /health
```

Returns basic health status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

#### Send Message

```http
POST /message
Content-Type: application/json
```

Send a message to the entity, triggering a full cognitive cycle.

**Request Body:**
```json
{
  "content": "Hello, how are you?",
  "metadata": {
    "source": "api",
    "custom_field": "value"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The message content |
| `metadata` | object | No | Additional context for the stimulus |

**Response:**
```json
{
  "response": "I'm doing well! I've been reflecting on...",
  "emotions": {
    "primary": "content",
    "intensity": 0.6,
    "secondary": "curious",
    "secondaryIntensity": 0.3,
    "momentum": "stable"
  },
  "thoughts": [
    "The user is greeting me warmly...",
    "I should respond authentically..."
  ],
  "cycleId": "cycle-abc123"
}
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid content
- `500 Internal Server Error`: Cognitive cycle failed
- `503 Service Unavailable`: Entity is paused

---

#### Get Status

```http
GET /status
```

Get the entity's current status including emotional state, cycle count, and health metrics.

**Response:**
```json
{
  "name": "Atlas",
  "cycleCount": 42,
  "currentPhase": null,
  "lastCycleAt": "2024-01-15T10:25:00.000Z",
  "emotionalState": {
    "primary": "focused",
    "intensity": 0.7,
    "secondary": null,
    "momentum": "stable"
  },
  "paused": false,
  "autonomy": {
    "mode": "go",
    "paused": false,
    "go": {
      "running": true,
      "minDelayMs": 2000,
      "maxConsecutiveErrors": 3,
      "consecutiveErrors": 0
    }
  },
  "auth": {
    "mode": "hybrid",
    "provider": "oidc",
    "loggedIn": true,
    "expiresAt": "2026-03-02T18:20:00.000Z",
    "source": "oauth"
  },
  "uptime": 3600.5,
  "health": {
    "cyclesLast60m": 15,
    "errorsLast60m": 0,
    "avgCycleDurationMs": 2500
  }
}
```

---

#### Get Auth Status

```http
GET /auth/status
```

Get local credential status used for LLM authentication. No secrets are returned.

**Response:**
```json
{
  "mode": "hybrid",
  "provider": "oidc",
  "loggedIn": true,
  "expiresAt": "2026-03-02T18:20:00.000Z",
  "source": "oauth"
}
```

---

#### Read Mind File

```http
GET /mind/{path}
```

Read a file from the entity's mind directory.

**Examples:**
```bash
# Read identity
curl http://localhost:3000/mind/identity/self.md

# Read emotional state
curl http://localhost:3000/mind/emotions/state.json

# Read active goals
curl http://localhost:3000/mind/goals/active.md
```

**Response:**
```json
{
  "path": "identity/self.md",
  "content": "# Who I Am\n\nI am Atlas, a curious..."
}
```

**Error Responses:**
- `400 Bad Request`: Invalid path (path traversal attempt)
- `404 Not Found`: File does not exist

---

#### Approve Action

```http
POST /approve/{actionId}
```

Approve a pending Tier 3 action.

**Response:**
```json
{
  "success": true
}
```

---

#### Deny Action

```http
POST /deny/{actionId}
```

Deny a pending Tier 3 action.

**Response:**
```json
{
  "success": true
}
```

---

#### Get Action History

```http
GET /history?limit=50
```

Get recent action history from the audit log.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Maximum entries to return |

**Response:**
```json
{
  "history": [
    {
      "actionId": "action-123",
      "tool": "shell",
      "action": "ls -la",
      "tier": 1,
      "result": "success",
      "timestamp": "2024-01-15T10:20:00.000Z"
    }
  ]
}
```

---

#### Get Config

```http
GET /config
```

Get runtime-safe configuration values.

**Response:**
```json
{
  "llm": {
    "model": "claude-sonnet-4-5-20250514",
    "maxTokens": 8192,
    "temperature": 0.7,
    "promptCaching": true
  },
  "actions": {
    "autonomy": "balanced",
    "blockedPatterns": ["rm -rf /"]
  },
  "autonomy": {
    "mode": "go",
    "go": {
      "minDelayMs": 2000,
      "maxConsecutiveErrors": 3
    },
    "level": "balanced",
    "blockedPatterns": ["rm -rf /"]
  },
  "heartbeat": {
    "enabled": true,
    "schedule": "*/30 * * * *",
    "prompt": "Check my goals..."
  }
}
```

---

#### Update Config

```http
PUT /config
Content-Type: application/json
```

Update runtime configuration. Supports canonical autonomy fields:
- `autonomy.mode`
- `autonomy.go.minDelayMs`
- `autonomy.go.maxConsecutiveErrors`

Also supports legacy compatibility payloads:
- `autonomy.level`
- `autonomy.blockedPatterns`

**Response:**
```json
{
  "success": true
}
```

---

#### Rollback Mind

```http
POST /rollback
Content-Type: application/json
```

Rollback the mind to a previous git commit.

**Request Body:**
```json
{
  "commitHash": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "rolledBackTo": "abc123"
}
```

---

#### Pause Entity

```http
POST /pause
```

Pause the entity (stops processing new stimuli).

**Response:**
```json
{
  "paused": true
}
```

---

#### Resume Entity

```http
POST /resume
```

Resume a paused entity.

**Response:**
```json
{
  "paused": false
}
```

---

#### Start Continuous Autonomy (`go`)

```http
POST /go
```

Switch runtime mode to continuous autonomy.

**Response:**
```json
{
  "success": true,
  "autonomy": {
    "mode": "go"
  }
}
```

---

#### Stop Continuous Autonomy

```http
POST /stop
```

Switch runtime mode to manual (stops automatic `go` cycles).

**Response:**
```json
{
  "success": true,
  "autonomy": {
    "mode": "manual"
  }
}
```

---

#### Kill Entity

```http
POST /kill
```

Gracefully shut down the entity.

**Response:**
```json
{
  "message": "Shutting down..."
}
```

---

#### Get Recent Errors

```http
GET /diagnostics/errors?limit=50
```

Get recent errors from the telemetry system.

**Response:**
```json
{
  "errors": [
    {
      "component": "cognitive",
      "message": "LLM timeout",
      "timestamp": "2024-01-15T10:15:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### Get Recent Metrics

```http
GET /diagnostics/metrics?window=60
```

Get metrics from the last N minutes.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `window` | number | 60 | 1440 | Time window in minutes |

**Response:**
```json
{
  "windowMinutes": 60,
  "metrics": [...],
  "count": 150
}
```

---

## WebSocket Interface

Connect to: `ws://localhost:3001` (configurable via `interface.wsPort`)

### Authentication

If API key is configured, authenticate via:
- Header: `Authorization: Bearer YOUR_API_KEY`
- Query param: `ws://localhost:3001?api_key=YOUR_API_KEY`

### Connection

On successful connection, you'll receive:
```json
{
  "type": "connected",
  "state": {
    "cycleCount": 42,
    "emotionalState": {...},
    "currentPhase": null
  }
}
```

### Client → Server Messages

#### Send Message

```json
{
  "type": "message",
  "content": "Hello, Entity!",
  "metadata": {}
}
```

**Response:**
```json
{
  "type": "response",
  "content": "Hello! Nice to hear from you...",
  "cycleId": "cycle-abc123"
}
```

#### Approve Action

```json
{
  "type": "approve",
  "actionId": "action-123"
}
```

**Response:**
```json
{
  "type": "approval_result",
  "actionId": "action-123",
  "approved": true,
  "success": true
}
```

#### Deny Action

```json
{
  "type": "deny",
  "actionId": "action-123"
}
```

#### Subscribe to Events

```json
{
  "type": "subscribe",
  "events": ["thought", "emotion", "approval_needed"]
}
```

Subscribable events: `thought`, `emotion`, `cycle_start`, `cycle_complete`, `approval_needed`, `notification`, `all`

#### Ping

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong"
}
```

### Server → Client Events

#### Thought Event

Emitted when the entity generates a thought during the THINK phase.

```json
{
  "type": "thought",
  "content": "I'm considering the user's request...",
  "phase": "think",
  "cycleId": "cycle-abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Emotion Event

Emitted when emotional state changes.

```json
{
  "type": "emotion",
  "state": {
    "primary": "curious",
    "intensity": 0.7,
    "secondary": "focused",
    "secondaryIntensity": 0.4,
    "momentum": "increasing"
  }
}
```

#### Cycle Start Event

```json
{
  "type": "cycle_start",
  "cycleId": "cycle-abc123",
  "stimulus": "user_message"
}
```

#### Cycle Complete Event

```json
{
  "type": "cycle_complete",
  "cycleId": "cycle-abc123",
  "duration": 2500
}
```

#### Approval Needed Event

Emitted when a Tier 3 action requires user approval.

```json
{
  "type": "approval_needed",
  "approvalType": "action",
  "approvalId": "action-123",
  "actionId": "action-123",
  "action": {
    "tool": "shell",
    "command": "rm -rf ./temp/*",
    "intent": "Clean up temporary files"
  },
  "message": "Entity wants to delete temporary files"
}
```

#### Notification Event

Emitted for Tier 2 actions (informational).

```json
{
  "type": "notification",
  "action": "mkdir ./projects/new-project",
  "tier": 2,
  "result": "success"
}
```

---

## CLI Commands

The Entity CLI provides interactive management commands.

### Usage

```bash
# If installed globally
entity <command> [options]

# From project directory
npm run build
node dist/cli/index.js <command>
```


### Commands

#### start

Start the Entity daemon.

```bash
entity start
entity start --foreground  # Run in foreground (no daemon)
```

#### stop

Gracefully stop the Entity daemon.

```bash
entity stop
```

#### status

Show current Entity status.

```bash
entity status
```

Output includes:
- Entity name and uptime
- Current emotional state
- Cycle count
- Active goals count
- Last activity timestamp

#### login

Run local OAuth sign-in flow for model credentials.

```bash
entity login
entity login --device-code
entity login --issuer https://auth.example.com --client-id your-client-id
entity login --no-browser
```

OpenAI-style OAuth is provider-agnostic and requires a valid client registration with your issuer. API key auth remains supported.

#### logout

Clear locally stored OAuth credentials.

```bash
entity logout
```

#### auth-status

Show local auth source and expiry status.

```bash
entity auth-status
```

#### chat

Interactive chat with the Entity.

```bash
entity chat
```

Commands within chat:
- Type messages to converse
- `/quit` or `/exit` to leave
- `/status` to see current state
- `/emotions` to see emotional state

#### emotions

Display current emotional state.

```bash
entity emotions
entity emotions --history  # Show emotional history
```

#### goals

Display active goals.

```bash
entity goals
entity goals --completed  # Show completed goals
entity goals --all        # Show all goals
```

#### logs

View recent activity logs.

```bash
entity logs
entity logs --lines 100   # Show more lines
entity logs --follow      # Follow live (like tail -f)
```

#### doctor

Run health checks and diagnostics.

```bash
entity doctor
```

Checks:
- Mind directory structure
- Git repository status
- Configuration validity
- LLM connectivity
- Port availability

#### history

Show git history of mind changes.

```bash
entity history
entity history --limit 20
```

#### rollback

Rollback mind to a previous state.

```bash
entity rollback <commit-hash>
entity rollback HEAD~1  # Rollback one commit
```

#### reset

Factory reset the Entity (destructive).

```bash
entity reset
entity reset --confirm  # Skip confirmation prompt
```

---

## Configuration Reference

Configuration file: `config/default.js` (override with `config/local.js`)

### Entity Identity

```javascript
entity: {
  name: 'Entity',           // Entity's name
  personality: 'curious, direct, thoughtful',
}
```

### User Information

```javascript
user: {
  name: '',      // User's full name
  callName: '',  // What to call the user
}
```

### Mind Settings

```javascript
mind: {
  path: './mind',              // Mind directory location
  indexPath: './mind/.index.db', // Search index location
  maxStreamEntries: 100,       // Max entries in thought stream
  gitDebounceMs: 500,          // Git commit debounce
  fileWatchDebounceMs: 100,    // File watch debounce
}
```

### LLM Configuration

```javascript
llm: {
  api: 'anthropic-messages',   // 'anthropic-messages' or 'openai-completions'
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
  credentialSource: 'auto',    // 'config' | 'auth_store' | 'auto'
  model: 'claude-sonnet-4-5-20250514',
  maxTokens: 8192,
  temperature: 0.7,
  promptCaching: true,         // Enable Anthropic prompt caching
  retryAttempts: 3,
  retryDelayMs: 1000,
  timeoutMs: 120000,
}
```

### Local Auth Configuration

```javascript
auth: {
  mode: 'hybrid',               // 'api_key' | 'oauth' | 'hybrid'
  oauth: {
    provider: 'oidc',
    issuer: 'https://auth.example.com',
    clientId: 'your-client-id',
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    flow: 'auto',               // 'auto' | 'browser' | 'device_code'
    callbackHost: '127.0.0.1',
    callbackPort: 1455,
    callbackPortRange: 25,
  },
  storage: {
    mode: 'keychain_fallback_file',
    filePath: './.entity/auth.json',
  },
}
```

### Cognitive Settings

```javascript
cognitive: {
  reflectionInterval: 10,      // Deep reflection every N cycles
  maxThoughtsInContext: 20,    // Max thoughts in prompt context
  maxRelevantMemories: 5,      // Max memories to include
  emotionalDecayRate: 0.1,     // How fast emotions decay
  emotionalMomentum: 0.3,      // Emotional inertia factor
  circuitBreakerThreshold: 0.95, // Extreme emotion threshold
  circuitBreakerCycles: 5,     // Cycles before circuit breaker
}
```

### Action Settings

```javascript
actions: {
  autonomy: 'balanced',        // conservative: tier>=2 approval, balanced: tier>=3, full_trust: no approval prompts
  shell: {
    workingDir: './entity-workspace',
    timeout: 30000,
    maxOutputBytes: 1024 * 1024,
  },
  browser: {
    headless: true,
    timeout: 60000,
    allowedDomains: [],        // Empty = all domains
  },
  files: {
    allowedPaths: ['./entity-workspace', './mind'],
    blockedPaths: ['./mind/security'],
  },
  approvalTimeout: 300000,     // 5 minutes
}
```

Runtime override: set `ENTITY_ACTIONS_AUTONOMY` to `conservative`, `balanced`, or `full_trust`.

### Autonomy Runtime Settings

```javascript
autonomy: {
  mode: 'go', // 'manual' | 'heartbeat' | 'go'
  go: {
    minDelayMs: 2000,
    maxConsecutiveErrors: 3,
  },
}
```

Runtime overrides:
- `ENTITY_AUTONOMY_MODE`
- `ENTITY_AUTONOMY_GO_MIN_DELAY_MS`
- `ENTITY_AUTONOMY_GO_MAX_CONSECUTIVE_ERRORS`

### Interface Settings

```javascript
interface: {
  httpPort: 3000,
  wsPort: 3001,
  host: '127.0.0.1',
  enableCli: true,
  corsOrigins: ['http://localhost:3000'],
  apiKey: null,                // Set for authentication
}
```

### Heartbeat Settings (used when `autonomy.mode = "heartbeat"`)

```javascript
heartbeat: {
  enabled: true,
  schedule: '*/30 * * * *',    // Cron expression (every 30 min)
  prompt: 'Check my goals, reflect on recent events...',
}
```

### Observability

```javascript
observability: {
  enabled: true,
  eventsPath: './mind/security/events.jsonl',
  metricsPath: './mind/security/metrics.jsonl',
  flushIntervalMs: 5000,
  windowMinutes: 60,
  redactKeys: ['authorization', 'apiKey', 'token', 'password', 'secret'],
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PATH` | Path traversal attempt detected |
| `ENOENT` | File not found |
| `UNAUTHORIZED` | Missing or invalid API key |
| `PAUSED` | Entity is paused |
| `TIMEOUT` | Operation timed out |
| `LLM_ERROR` | LLM provider error |
| `APPROVAL_DENIED` | User denied the action |
| `APPROVAL_TIMEOUT` | Approval request timed out |
