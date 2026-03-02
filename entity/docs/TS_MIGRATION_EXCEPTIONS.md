# TypeScript Migration Exceptions (Release N)

This release ships TypeScript cutover with dist-first runtime and explicit temporary exceptions that are tracked for follow-up cleanup.

## Temporary Project-Level Exceptions

1. `tsconfig.scripts.json`
- `strict: false`
- Reason: utility/soak/test-adjacent scripts still contain legacy dynamic patterns.

2. `tsconfig.tests.json`
- `noCheck: true`
- Reason: Node test runner migration compiles/runs cleanly, but full static checking currently surfaces cross-project include issues and legacy test typing debt.

3. `dashboard/tsconfig.json`
- `strict: false`
- Reason: dashboard migration is fully converted and typechecked at current settings, but not yet fully strict across all page/layout prop contracts.

## Guardrails Added

1. `npm run check:ts-migration`
- blocks `@ts-ignore`
- requires `TODO(ts-migration):` on every `@ts-expect-error`

2. `npm run check:js-allowlist`
- enforces that only compatibility shims remain as JS:
  - `src/index.js`
  - `src/cli/index.js`

## Planned Cleanup (Release N+1)

1. Remove compatibility JS shims in `src/`.
2. Move scripts/tests/dashboard configs to strict settings.
3. Replace or remove temporary `@ts-expect-error TODO(ts-migration):` markers.
