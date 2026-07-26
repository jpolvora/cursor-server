---
slug: 15-hermes-integration
step: 6
status: clean
reviewedAt: "2026-07-25T23:45:00Z"
base: master
---

# Code Review — 15-hermes-integration

## Scope (in-scope diff)

| Path | Change |
|------|--------|
| `src/services/hermes-runner.ts` | New HermesRunner + injectable CLI/HTTP exec + StageOutput normalize |
| `src/services/hermes-runner.test.ts` | New unit tests (mock exec; no live Hermes) |
| `src/services/harness-runner.ts` | Unchanged ctor builtins (hermes registered from hermes-runner side-effect) |
| `src/services/harness-runner.test.ts` | Assert `hermes` on singleton; side-effect import |
| `src/routes/harness.ts` | Side-effect import to ensure registration |
| `src/services/stage-orchestrator.ts` | Side-effect import to ensure registration |

## AC cross-check

| AC | Verdict |
|----|---------|
| AC1 `id: hermes` + dispatch via CLI/RPC | **Pass** — registered; default exec CLI or `HERMES_API_URL` HTTP |
| AC2 skills / subagent hints | **Pass** — `options.skills` / stage defaults passed to exec; logged |
| AC3 normalized StageOutput | **Pass** — success/failed/error + logs/artifacts/durationMs |

## Findings

None (Critical / Warning / Nit retained).

### Discarded hypotheses

| Hypothesis | Why discarded |
|------------|---------------|
| Circular import / missing registration | Side-effect register after harness-runner init; tests + routes import hermes-runner; observed `runnerRegistry.get('hermes')` green |
| Promise.race timer leak | `clearTimeout` in `finally`; timeout test completes in ~20ms |
| Secrets in tests | No API key stubs in hermes tests; `scan-secrets --all` OK |

## MEMORY pattern sweep

- Promise.race timer leak → **protected**
- scan-secrets long fake keys → **N/A** (no key stubs)

## Fable judge (pre-ship)

| Check | Result |
|-------|--------|
| Claims vs diff | HermesRunner + tests + side-effect registration match plan; no OOS src churn |
| Re-verify | `npm run typecheck` pass; hermes + harness runner tests 40/40; `scan-secrets --all` OK |
| Frauds | None observed |
| Verdict | **VERIFIED** |

## Recommendation

Advance (auto) — no fix substep.
