# Alpha Readiness Checklist (2026-03-01)

## Scope
Gate verification for private alpha hardening:
- Integration and net integration coverage (HTTP + WS + lifecycle + daemon smoke)
- Soak runner artifact generation and threshold enforcement
- Regression baseline

## Evidence Summary
- Unit/contract baseline: PASS (`npm test`)
- Authoritative net integration: PASS (`npm run test:integration:net`, unsandboxed)
- Soak preflight: PASS (`node scripts/soak/run-soak.js --duration=1m --thresholds=balanced`)
- Soak artifacts generated and validated:
  - `/Users/drewbaskin/agi/entity/entity-workspace/reports/soak-2026-03-01T17-45-18-683Z.json`
  - `/Users/drewbaskin/agi/entity/entity-workspace/reports/soak-2026-03-01T17-45-18-683Z.md`

## Checklist
- [x] No critical regressions in existing behavior/security tests
- [x] Loopback-dependent integration/net suites run and pass in authoritative environment
- [x] Daemon smoke path boots, serves HTTP/WS, and shuts down cleanly
- [x] Soak report generation pipeline works end-to-end
- [x] Soak thresholds evaluate and report pass/fail
- [ ] Three consecutive 6-hour nightly soaks have passed (required for final gate clear)

## Validated Metrics (from latest soak preflight)
- pass: `true`
- failures: `[]`
- requests.failureRate: `0`
- health.maxLlmSchemaFallbackRate: `0`
- health.maxCycleFailureRate: `0`
- daemon.exitedEarly: `false`

## Remaining Work to Fully Clear Gate
1. Run `npm run test:soak:nightly` for 3 consecutive nights in CI.
2. Confirm each nightly artifact set reports `pass: true` and no threshold violations.
3. Final sign-off after the third consecutive nightly PASS.

## Blockers Resolved During Validation
1. Fixed CJS/ESM `glob` import compatibility in `/Users/drewbaskin/agi/entity/src/execution-engines/files.js`.
2. Fixed SQLite FTS initialization compatibility in `/Users/drewbaskin/agi/entity/src/mind-server/search.js` by moving to `mind_files_fts` table/triggers.
