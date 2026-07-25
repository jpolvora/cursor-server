---
slug: 15-hermes-integration
workflowId: 15-hermes-integration-20260725T233404Z
workflowType: lite
status: shipped
completedAt: "2026-07-25T23:50:00Z"
---

# Result — 15-hermes-integration

## Summary

Delivered `HermesRunner` (`HarnessRunner` id `hermes`) with injectable CLI/HTTP exec stub, StageOutput normalization, skill hints via `options.skills`, and singleton registry registration (side-effect import to avoid circular TDZ). Default runner remains `cursor-local`.

## Acceptance Criteria

| AC | Status | Evidence |
|----|--------|----------|
| AC1 HermesRunner + `id: hermes` | ✅ | `src/services/hermes-runner.ts`; `runnerRegistry.get('hermes')` tests |
| AC2 Skills / delegation hints | ✅ | `resolveHermesSkills` + exec request/logs |
| AC3 Normalized StageOutput | ✅ | `normalizeHermesResult` + executeStage success/fail/error/timeout tests |

## Files

**Created:** `src/services/hermes-runner.ts`, `src/services/hermes-runner.test.ts`  
**Modified:** `src/services/harness-runner.test.ts`, `src/routes/harness.ts`, `src/services/stage-orchestrator.ts`

## Verification

- `npm run typecheck` — pass
- `npm run build` — pass
- `node --test dist/services/hermes-runner.test.js dist/services/harness-runner.test.js` — 40/40
- `npm run scan-secrets` / `--all` — OK
- Fable judge — **VERIFIED** (review artifact)

## Benchmark

| Phase | Elapsed (approx) |
|-------|------------------|
| Step 0 Spec | 45s |
| Step 1 Plan | 90s |
| Step 2 Implement | 300s |
| Step 3 Review | 120s |
| Step 4 Ship | (in progress) |
| **Total time** | **~10m** (through review) |

## Prepare to PR

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test coverage | ✅ | hermes-runner.test.ts + registry asserts |
| 2 | Build | ✅ | `npm run build` |
| 3 | Tests | ✅ | typecheck + runner unit tests 40/40 |
| 4 | Security / leak scan | ✅ | `scan-secrets --all` OK |
| 5 | Consumer prepare | ✅ | AGENTS verification cmds run; no extra prepare hooks |
| 6 | Board shown; ready | ✅ | autoMode ship |
