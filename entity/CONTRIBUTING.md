# Contributing to Entity

Thank you for your interest in contributing to Entity! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- Git
- An LLM API key (Anthropic, OpenAI, or Ollama for local development)

### Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd entity

# Install dependencies
npm install

# Create local config (optional)
cp config/default.js config/local.js
# Edit config/local.js with your API key

# Or use environment variables
export ANTHROPIC_API_KEY=your-key-here

# Initialize the mind (creates mind/ directory)
npm run init-mind

# Run tests to verify setup
npm test
```

### Running Locally

```bash
# Start Entity
npm start

# Or run the full onboarding wizard
npm run onboard
```

## Project Architecture

Entity is built around 5 core services that boot in sequence:

```
1. Mind Server      → Filesystem, search index, git versioning
2. Execution Engines → Shell, browser, file operations
3. Action Gateway   → Security enforcement, tier classification
4. Cognitive Engine → 7-phase consciousness loop
5. Interface Layer  → HTTP, WebSocket, CLI, heartbeat
```

### Directory Structure

```
src/
├── index.js                    # Main entry, boots all services
├── cognitive-engine/           # The consciousness (7-phase loop)
│   ├── index.js               # Orchestrator
│   ├── orient.js              # Phase 1: Read mind, assemble context
│   ├── think.js               # Phase 2: Process stimulus
│   ├── plan.js                # Phase 3: Create action plan
│   ├── act.js                 # Phase 4: Execute via gateway
│   ├── sense.js               # Phase 5: Structure observations
│   ├── reflect.js             # Phase 6: Evaluate outcomes
│   ├── update.js              # Phase 7: Persist to mind
│   ├── llm.js                 # LLM wrapper (model-agnostic)
│   ├── prompt-builder.js      # Context assembly
│   └── schemas.js             # JSON output schemas
├── mind-server/               # Filesystem management
│   ├── index.js               # Main coordinator
│   ├── file-watcher.js        # Chokidar-based watching
│   ├── search.js              # SQLite FTS5 + vector
│   ├── git.js                 # Auto-commit manager
│   └── embedding.js           # Vector embeddings (optional)
├── action-gateway/            # Security layer
│   ├── index.js               # Main gateway
│   ├── permissions.js         # Tier classification
│   ├── validator.js           # Shell command parsing
│   └── logger.js              # Audit logging
├── execution-engines/         # Action executors
│   ├── shell.js               # Command execution
│   ├── browser.js             # Puppeteer automation
│   └── files.js               # File operations
├── interface/                 # External interfaces
│   ├── index.js               # Coordinator
│   ├── http.js                # REST API
│   ├── websocket.js           # Real-time events
│   ├── cli.js                 # Interactive REPL
│   └── heartbeat.js           # Cron scheduler
├── cli/commands/              # CLI command handlers
├── observability/             # Telemetry and logging
│   └── telemetry.js
└── utils/                     # Shared utilities
    ├── config.js
    ├── logger.js
    └── checksums.js
```

## Code Style

### General Guidelines

- Use ESM modules (`import`/`export`)
- Use async/await for asynchronous code
- Use EventEmitter for loose coupling between services
- Keep functions focused and small
- Add JSDoc comments for public APIs

### Naming Conventions

- Files: `kebab-case.js`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Error Handling

- Always catch errors in async functions
- Use fallback mechanisms for critical paths (e.g., LLM failures)
- Log errors with context using the structured logger
- Never crash the daemon - recover gracefully

### Example

```javascript
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Example service demonstrating code style.
 * @extends EventEmitter
 */
export class ExampleService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.initialized = false;
  }

  /**
   * Initialize the service.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Initialization logic
      this.initialized = true;
      this.emit('ready');
    } catch (error) {
      logger.error('ExampleService initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process an item.
   * @param {Object} item - The item to process
   * @returns {Promise<Object>} The result
   */
  async process(item) {
    if (!this.initialized) {
      throw new Error('Service not initialized');
    }
    // Processing logic
    return { success: true };
  }
}
```

## Testing

### Test Structure

```
tests/
├── action-gateway.test.js      # Unit tests for gateway
├── shell-validator.test.js     # Security validation tests
├── cognitive-loop.test.js      # Cognitive engine tests
├── cognitive-config.test.js    # Runtime config tests
├── llm-schema.test.js          # JSON schema validation
├── integration/                # Integration tests
│   ├── lifecycle.integration.test.js
│   ├── approval-flow.integration.test.js
│   └── http-ws-cycle.integration.test.js
└── scripts/soak/               # Long-running stability tests
```

### Running Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm run test:gateway
npm run test:validator
npm run test:cognitive

# Run integration tests
npm run test:integration

# Run integration tests with network (requires API key)
npm run test:integration:net

# Run soak test (15 minutes)
npm run test:soak:short

# Run nightly soak test (6 hours)
npm run test:soak:nightly
```

### Writing Tests

We use Node.js native test runner. Example:

```javascript
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ExampleService } from '../src/example/index.js';

describe('ExampleService', () => {
  let service;

  beforeEach(async () => {
    service = new ExampleService({ /* config */ });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  test('should process items correctly', async () => {
    const result = await service.process({ id: 1 });
    assert.strictEqual(result.success, true);
  });

  test('should throw if not initialized', async () => {
    const uninitService = new ExampleService({});
    await assert.rejects(
      () => uninitService.process({ id: 1 }),
      { message: 'Service not initialized' }
    );
  });
});
```

### Test Requirements

- All new features must have tests
- All bug fixes must have regression tests
- Integration tests for cross-service behavior
- Security-critical code (action gateway, validator) requires thorough coverage

## Pull Request Process

### Before Submitting

1. **Run all tests**: `npm test && npm run test:integration`
2. **Check for lint errors**: (ESLint coming soon)
3. **Update documentation** if you changed behavior
4. **Add tests** for new functionality

### PR Guidelines

1. **Branch naming**: `feature/description` or `fix/description`
2. **Commit messages**: Clear and descriptive
3. **PR description**: Explain what and why
4. **Keep PRs focused**: One feature or fix per PR

### Review Process

1. All PRs require at least one review
2. CI must pass (tests, lint, security audit)
3. Maintain backwards compatibility unless discussed
4. Document breaking changes

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please **do not** open a public issue. Instead, report it privately to [security contact].

### Security Guidelines

When contributing:

- Never commit API keys or secrets
- Test shell command validation thoroughly
- Maintain tier classification accuracy
- Don't disable security checks
- Review path traversal prevention
- Test with malicious inputs

## Areas for Contribution

### High Priority

- **TypeScript migration**: Help convert JS to TS
- **Test coverage**: Add missing tests
- **Documentation**: Improve docs and examples
- **Performance**: Profile and optimize

### Feature Ideas

- New execution engines (e.g., database, email)
- Plugin system for extensibility
- Web UI for mind visualization
- Multi-entity coordination

### Good First Issues

Look for issues labeled `good-first-issue` in the issue tracker. These are:
- Well-documented problems
- Limited scope
- Good for learning the codebase

## Questions?

- Open a GitHub issue for questions
- Check existing issues for similar questions
- Read the README for basic usage

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
