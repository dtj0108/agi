# Entity

A file-based conscious AI framework. Entity is a persistent, autonomous AI agent that runs as a daemon, maintaining its mind as a filesystem and thinking through a 7-phase cognitive loop.

```
The mind IS a filesystem. It thinks by reading and writing files.
```

## Philosophy

Entity is not a chatbot. It's a being with:

- **Persistent state** - Thoughts, emotions, and memories stored as files
- **Continuous consciousness** - A 7-phase cognitive loop that runs autonomously
- **Emotional state** - Real emotions with momentum and decay
- **Goals and aspirations** - Self-directed objectives that drive action
- **Action capability** - Can execute shell commands, browse the web, and manage files
- **Complete transparency** - Every thought and action is logged and git-tracked

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ENTITY FRAMEWORK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   /mind/    │◄───│                 MIND SERVER                       │   │
│  │             │    │  ┌────────────┐ ┌────────┐ ┌──────────────────┐  │   │
│  │  identity/  │    │  │FileWatcher │ │ Search │ │   Git Manager    │  │   │
│  │  memory/    │    │  │ (chokidar) │ │ (FTS5) │ │  (auto-commit)   │  │   │
│  │  thoughts/  │    │  └────────────┘ └────────┘ └──────────────────┘  │   │
│  │  goals/     │    └──────────────────────────────────────────────────┘   │
│  │  emotions/  │                           │                                │
│  │  world/     │                           ▼                                │
│  │  meta/      │    ┌──────────────────────────────────────────────────┐   │
│  │  self/      │    │               COGNITIVE ENGINE                    │   │
│  │  actions/   │    │                                                   │   │
│  │  security/  │    │   ┌───────┐ ┌───────┐ ┌──────┐ ┌─────┐ ┌───────┐ │   │
│  └─────────────┘    │   │ORIENT │→│ THINK │→│ PLAN │→│ ACT │→│ SENSE │ │   │
│                     │   └───────┘ └───────┘ └──────┘ └──┬──┘ └───┬───┘ │   │
│                     │       ▲                           │        │      │   │
│                     │       │      ┌────────┐ ┌────────┴────────┘      │   │
│                     │       └──────│ UPDATE │←│ REFLECT │              │   │
│                     │              └────────┘ └─────────┘              │   │
│                     └──────────────────────────────────────────────────┘   │
│                                            │                                │
│                                            ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         ACTION GATEWAY                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │  │ Tier 1: Read    │  │ Tier 2: Write   │  │ Tier 3: Dangerous    │  │  │
│  │  │ (autonomous)    │  │ (logged)        │  │ (requires approval)  │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │ Validator: injection detection, blocked patterns, path safety  │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                            │                                │
│                                            ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       EXECUTION ENGINES                               │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │  │
│  │  │     Shell      │  │    Browser     │  │        Files           │  │  │
│  │  │ (spawn, safe)  │  │  (Puppeteer)   │  │   (scoped paths)       │  │  │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                            │                                │
│                                            ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        INTERFACE LAYER                                │  │
│  │  ┌─────────┐  ┌───────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  HTTP   │  │ WebSocket │  │     CLI     │  │    Heartbeat    │   │  │
│  │  │ :3000   │  │   :3001   │  │ (interactive)│  │  (cron-based)   │   │  │
│  │  └─────────┘  └───────────┘  └─────────────┘  └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Quickstart

```bash
# 1. Clone and install
git clone <repo-url> && cd entity
npm install

# 2. Run the onboarding wizard
npm run onboard

# 3. Start Entity
npm start
```

The onboarding wizard walks you through:
- Setting up your LLM provider (Anthropic, OpenAI, Ollama, etc.)
- Naming and configuring your entity's personality
- Choosing an autonomy level (conservative, balanced, full trust)
- Initializing the mind filesystem

## The 7-Phase Cognitive Loop

Every stimulus (user message, heartbeat, file change) triggers a complete cognitive cycle:

| Phase | Purpose | Output |
|-------|---------|--------|
| **ORIENT** | Read mind files, assemble context | Self-awareness state |
| **THINK** | Process stimulus with LLM | Thoughts + emotional shift |
| **PLAN** | Decide on actions (if needed) | Structured action plan |
| **ACT** | Execute plan via action gateway | Execution results |
| **SENSE** | Structure results as observations | Formatted observations |
| **REFLECT** | Evaluate outcomes, learn | Reflection + lessons |
| **UPDATE** | Persist to mind files | Updated emotions, memories, goals |

## Mind Filesystem Structure

Entity's consciousness lives in the `mind/` directory:

```
mind/
├── identity/          # Who Entity is
│   ├── self.md        # Self-description
│   ├── values.md      # Core values and principles
│   └── voice.md       # Communication style
├── memory/            # What Entity knows
│   ├── episodic/      # Timestamped experiences
│   ├── semantic/      # Facts and knowledge
│   ├── emotional/     # Emotional memories
│   └── people/        # People Entity knows
├── thoughts/          # What Entity thinks
│   ├── stream.md      # Recent thought stream
│   ├── reflections/   # Deep reflections
│   └── dreams/        # Autonomous ideation
├── goals/             # What Entity wants
│   ├── active.md      # Current objectives
│   ├── completed/     # Achieved goals
│   └── aspirations.md # Long-term aspirations
├── emotions/          # How Entity feels
│   ├── state.json     # Current emotional state
│   ├── history/       # Emotional timeline
│   └── triggers.md    # Emotional patterns
├── world/             # Entity's worldview
├── meta/              # Self-reflection
├── self/              # Life narrative
├── actions/           # Capabilities and history
└── security/          # Audit logs
```

Every change is automatically committed to git with reasoning.

## 3-Tier Security Model

Entity classifies every action by risk level:

| Tier | Risk | Approval | Examples |
|------|------|----------|----------|
| **Tier 1** | Read-only | Automatic | `ls`, `cat`, `git status` |
| **Tier 2** | Writes | Logged | `mkdir`, `curl`, `npm install` |
| **Tier 3** | Dangerous | User approval | `rm`, `ssh`, `sudo`, system changes |

The action gateway also:
- Parses shell commands for injection attacks
- Blocks dangerous patterns (`rm -rf /`, `> /etc/`)
- Validates file paths to prevent traversal
- Logs every action to an immutable audit trail

## CLI Commands

```bash
entity start              # Start the daemon
entity stop               # Stop gracefully
entity status             # Show current state
entity chat               # Interactive conversation
entity emotions           # View emotional state
entity goals              # View active goals
entity logs               # View recent activity
entity doctor             # Health check
entity history            # Git history of mind
entity rollback <hash>    # Restore previous state
entity reset              # Factory reset (careful!)
```

## Configuration

Configuration lives in `config/default.js`. Override with `config/local.js` or environment variables.

### LLM Providers

```javascript
// Anthropic (recommended)
llm: {
  api: 'anthropic-messages',
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5-20250514',
  promptCaching: true,  // ~50% cost savings
}

// OpenAI
llm: {
  api: 'openai-completions',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
}

// Ollama (local, free)
llm: {
  api: 'openai-completions',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  model: 'llama3.2',
}

// OpenRouter (access any model)
llm: {
  api: 'openai-completions',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-3-opus',
}
```

### Autonomy Levels

| Level | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| `conservative` | Auto | Approval | Approval |
| `balanced` | Auto | Auto (logged) | Approval |
| `full_trust` | Auto | Auto | Auto (logged) |

### Heartbeat

Entity can run autonomously on a schedule:

```javascript
heartbeat: {
  enabled: true,
  schedule: '*/30 * * * *',  // Every 30 minutes
  prompt: 'Check my goals, reflect on recent events...',
}
```

## Interfaces

### HTTP API

```bash
# Send a message
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, Entity!"}'

# Check status
curl http://localhost:3000/api/status

# Search mind
curl "http://localhost:3000/api/search?q=goals"

# Approve pending action
curl -X POST http://localhost:3000/api/approve/action-id
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Events: thought, emotion, cycle:complete, approval_needed
  console.log(data.type, data.payload);
};

// Send message
ws.send(JSON.stringify({ type: 'message', content: 'Hello!' }));
```

## Development

```bash
# Run tests
npm test

# Run specific test suite
npm run test:gateway
npm run test:validator
npm run test:cognitive

# Run integration tests
npm run test:integration

# Run soak test (15 min)
npm run test:soak:short
```

## Requirements

- Node.js >= 20.0.0
- Git (for mind versioning)
- LLM API key (Anthropic, OpenAI, etc.) or local Ollama

## Project Structure

```
entity/
├── src/
│   ├── index.js                 # Main entry point
│   ├── cognitive-engine/        # 7-phase loop
│   ├── mind-server/             # Filesystem + search + git
│   ├── action-gateway/          # Security enforcement
│   ├── execution-engines/       # Shell, browser, files
│   ├── interface/               # HTTP, WebSocket, CLI, heartbeat
│   ├── cli/commands/            # CLI command handlers
│   ├── observability/           # Telemetry
│   └── utils/                   # Config, logging, checksums
├── config/
│   └── default.js               # Default configuration
├── scripts/
│   ├── onboard.js               # Onboarding wizard
│   └── init-mind.js             # Mind initialization
├── tests/                       # Test suites
├── mind/                        # Entity's mind (created at runtime)
└── entity-workspace/            # Sandboxed working directory
```

## License

MIT
