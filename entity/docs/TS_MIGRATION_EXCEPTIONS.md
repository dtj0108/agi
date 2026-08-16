# TypeScript Migration Exceptions

All temporary exceptions from the TypeScript cutover (Release N) have been cleaned up:

1. Compatibility JS shims (`src/index.js`, `src/cli/index.js`) — removed. The runtime is dist-first: `node dist/index.js` for the daemon, `node dist/cli/index.js` for the CLI.
2. `tsconfig.scripts.json`, `tsconfig.tests.json`, and `dashboard/tsconfig.json` — now fully strict (inheriting `tsconfig.base.json` settings; `noCheck` removed from the tests project).
3. All `@ts-expect-error TODO(ts-migration):` markers — resolved with real types.

## Guardrails (still enforced in CI)

1. `npm run check:ts-migration`
- blocks `@ts-ignore`
- requires `TODO(ts-migration):` on every `@ts-expect-error`

2. `npm run check:js-allowlist`
- enforces that no plain JS remains in `src/`, `scripts/`, `tests/`, or `dashboard/src/`
