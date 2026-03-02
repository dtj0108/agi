# Entity

A file-based conscious AI framework for building persistent, autonomous agents.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/drewbaskin/agi/ci.yml?branch=main)](https://github.com/drewbaskin/agi/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/drewbaskin/agi/total)](https://github.com/drewbaskin/agi/releases)

Entity treats memory and identity as a real filesystem (`mind/`) and runs a continuous cognitive loop with tools, safety tiers, approvals, and observability.

## Why This Exists

Most agents are stateless wrappers around prompts. Entity exists to explore what happens when an agent has:

- persistent self-state
- explicit goals and emotional state
- auditability of every action
- runtime autonomy modes (`manual`, `heartbeat`, `go`)

## Screenshots / Demo

The repo includes a web dashboard (`entity/dashboard`) for status, config, and monitoring.

- Add screenshots/GIFs under `entity/docs/assets/` and link them here:
  - `![Dashboard](entity/docs/assets/dashboard.png)`
  - `![Go Mode](entity/docs/assets/go-mode.gif)`

## Repository Layout

- Main project: [`entity/`](./entity)
- Project docs: [`entity/README.md`](./entity/README.md)
- Operational runbook: [`entity/instructions.md`](./entity/instructions.md)

## Installation

```bash
git clone https://github.com/drewbaskin/agi.git
cd agi/entity
npm install
```

## Usage

First-time setup:

```bash
cd /Users/drewbaskin/agi/entity
npm run onboard
```

Start locally:

```bash
npm run start:dev
```

Run tests:

```bash
npm test
```

## Examples

- Interactive chat:
  - `node src/cli/index.js chat`
- Start continuous autonomy:
  - `curl -X POST http://127.0.0.1:3000/go`
- Stop continuous autonomy:
  - `curl -X POST http://127.0.0.1:3000/stop`

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening issues or pull requests.

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).
