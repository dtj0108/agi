# Entity Instructions (Start + Daily Use)

This file is the exact operational guide for running Entity from this repo.

## 1. Prerequisites

- macOS or Linux
- Node.js 20+
- Git
- One LLM API key (Anthropic/OpenAI/OpenRouter) unless using Ollama/local provider
- Optional: OIDC issuer + client ID if using local OAuth login instead of API key

## 2. First-Time Setup

From this directory:

```bash
cd /Users/drewbaskin/agi/entity
npm install
npm run build
npm run onboard
```

The onboarding wizard will:

- ask user/profile/personality questions
- ask LLM provider + API key
- optionally configure local OAuth (OIDC issuer/client ID) for OpenAI-compatible auth
- set security autonomy level (`actions.autonomy`)
- create `mind/`
- create `config/local.js`
- optionally install a background daemon service (recommended for local machine use)

## 3. Start Entity

## Foreground (recommended while testing)

```bash
cd /Users/drewbaskin/agi/entity
npm run start:dev
```

## Dist runtime (production/daemon-compatible)

```bash
npm run build
npm start
```

## Background/daemon

Use CLI command from repo:

```bash
cd /Users/drewbaskin/agi/entity
node dist/cli/index.js start
```

If daemon service was installed, this uses `launchctl` (macOS) or `systemctl --user` (Linux).  
If no service is installed, it falls back to detached process + PID/log files.

## 4. Stop / Status / Core Commands

```bash
cd /Users/drewbaskin/agi/entity
node dist/cli/index.js status
node dist/cli/index.js stop
node dist/cli/index.js chat
node dist/cli/index.js logs
node dist/cli/index.js doctor
node dist/cli/index.js login
node dist/cli/index.js auth-status
node dist/cli/index.js logout
```

If you globally linked the CLI (`npm link`), these become:

```bash
entity start
entity stop
entity status
entity chat
entity login
entity auth-status
```

## OAuth Login (Local-Only)

Entity supports local OAuth callbacks on localhost (Codex-style local flow):

```bash
cd /Users/drewbaskin/agi/entity
node dist/cli/index.js login --issuer https://auth.example.com --client-id your-client-id
node dist/cli/index.js auth-status
```

Note: OpenAI-style OAuth requires a valid provider/client registration. If OAuth is unavailable, API key configuration remains first-class.

Headless/device-code mode:

```bash
node dist/cli/index.js login --device-code --issuer https://auth.example.com --client-id your-client-id
```

## 5. Dashboard + API

When running, HTTP is on `127.0.0.1:3000` by default.

- Dashboard: `http://127.0.0.1:3000/dashboard`
- Health: `http://127.0.0.1:3000/health`
- Status: `http://127.0.0.1:3000/status`

## Go Mode Controls

`go` mode = continuous autonomous loop (`runCycle -> delay -> runCycle`).

- Start go mode:

```bash
curl -X POST http://127.0.0.1:3000/go
```

- Stop go mode (switch to manual):

```bash
curl -X POST http://127.0.0.1:3000/stop
```

- Pause all cycle processing:

```bash
curl -X POST http://127.0.0.1:3000/pause
```

- Resume:

```bash
curl -X POST http://127.0.0.1:3000/resume
```

## 6. Runtime Modes (What They Mean)

- `manual`: no automatic autonomous cycles
- `heartbeat`: cron-scheduled cycles only
- `go`: continuous autonomous cycles with failure guardrails

Configured in `config/default.js` + optional `config/local.js`:

```js
autonomy: {
  mode: 'go',
  go: {
    minDelayMs: 2000,
    maxConsecutiveErrors: 3,
  },
}
```

## 7. macOS (New Mac mini) Recommended Flow

1. Install Node + Git.
2. Clone repo and run onboarding:

```bash
cd /Users/drewbaskin/agi/entity
npm install
npm run onboard
```

3. In onboarding choose:
- Deployment: `local`
- Install background service: `yes`

4. Verify:

```bash
node dist/cli/index.js status
```

5. Start/stop later with:

```bash
node dist/cli/index.js start
node dist/cli/index.js stop
```

## 8. Logs + Files to Know

- Generated config: `/Users/drewbaskin/agi/entity/config/local.js`
- Mind state: `/Users/drewbaskin/agi/entity/mind/`

Potential log locations (depends on daemon install path used):

- `~/.entity/logs/stdout.log`
- `~/.entity/logs/stderr.log`
- `/Users/drewbaskin/agi/entity/logs/entity.log`
- `/Users/drewbaskin/agi/entity/logs/entity-error.log`

## 9. Troubleshooting

- `Mind directory not found`:
  - run `npm run onboard`
- `dist/index.js missing`:
  - run `npm run build`
- `entity: command not found`:
  - use `node dist/cli/index.js <command>` from repo root
- daemon not starting:
  - check status: `node dist/cli/index.js status`
  - check logs in paths above
  - macOS service check:
    - `launchctl list | grep com.entity.daemon`

## 10. Runtime Entry Points

The runtime is dist-first. Use `npm start` / `node dist/index.js` for the daemon and `node dist/cli/index.js <command>` for the CLI. The former `src/index.js` and `src/cli/index.js` compatibility shims have been removed.
