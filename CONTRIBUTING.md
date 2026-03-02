# Contributing

Thanks for contributing.

## Before You Start

- Read the project docs in [`entity/README.md`](./entity/README.md)
- Follow the operational guide in [`entity/instructions.md`](./entity/instructions.md)
- Search existing issues before creating a new one

## Reporting Bugs

Use the bug issue template and include:

- what you expected
- what happened
- exact repro steps
- environment details (OS, Node version)
- logs and stack traces (if available)

## Suggesting Features

Use the feature request template and include:

- problem statement
- proposed behavior
- alternatives considered
- impact/risk considerations

## Pull Requests

1. Create a branch from `main`.
2. Keep changes focused and atomic.
3. Add or update tests for behavior changes.
4. Run checks locally:
   - `cd entity && npm test`
5. Open a PR using the PR template.

## Commit Style

- Use clear, imperative commit messages.
- Prefer scoped messages, for example:
  - `interface: add /go and /stop endpoints`
  - `tests: add autonomy controller coverage`

## Code of Conduct

Participation in this project is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
