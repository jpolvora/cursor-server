---
slug: 13-runner-cursor-sdk
step: 3
title: "Execution plan — Cursor SDK Runner Adapter"
execMode: sequential
planPath: .agents/plans/13-runner-cursor-sdk/step-02-13-runner-cursor-sdk.plan.refined.md
dagPath: .agents/plans/13-runner-cursor-sdk/step-03-13-runner-cursor-sdk.exec.dag.json
status: ready
---

# Step 3 — Execution plan & DAG

## Size detection vs `dagThresholds`

| Metric | Counted from plan | Threshold | Within? |
|--------|-------------------|-----------|---------|
| Implementation steps | **2** (A–C collapsed into one same-file implement unit; D = tests). Step E is verify-only (commands, no product files). | maxImplementationSteps: **3** | YES |
| Expected files | **2** (`src/services/harness-runner.ts`, `src/services/harness-runner.test.ts`) | maxExpectedFiles: **6** | YES |
| Layers | **1** (services) | maxLayers: **2** | YES |

**Decision:** `execMode: sequential` — all metrics within `dagThresholds`. No parallel worktree split; run T1 → T2 → T3 in order in one session.

Source plan: `.agents/plans/13-runner-cursor-sdk/step-02-13-runner-cursor-sdk.plan.refined.md` (prefer over step-01).

## Layer map

| Layer | Files | Tasks |
|-------|-------|-------|
| services | `src/services/harness-runner.ts`, `src/services/harness-runner.test.ts` | T1 → T2 → T3 |

No routes, agents, agent-runner, or stage-orchestrator edits.

## Sequential order

```text
T1 (harness-runner.ts) → T2 (harness-runner.test.ts) → T3 (verify commands)
```

Machine DAG (`exec.dag.json`) records `execMode: sequential` with empty `tasks` / `levels` (threshold skip). Ordered tasks below guide Step 4.

## Tasks

### T1 — Stage helpers + `CursorSdkRunner` + registry
- **dependsOn:** none
- **files:** `src/services/harness-runner.ts`
- **ACs:** AC1, AC2, AC3
- **Maps plan:** Steps A, B, C
- **Coder prompt:** In `src/services/harness-runner.ts` only: add pure helpers `defaultAgentForStage`, `wrapStagePrompt`, `normalizeRunStatusToStageStatus` (SDK `finished` → success; `error`/`cancelled`/other → failed), `resolveTimeoutMs` (default `600_000`; finite positive `options.timeoutMs` override), `resolveStageAgent` (prefer non-empty `options.agent` else stage default). Implement `CursorSdkRunner` (`id: 'cursor-sdk'`, same `supportedStages` as local, optional ctor `runTaskFn`). `executeStage`: validate stage → resolve agent → wrap prompt → config merge like local → `Promise.race(runTask, timeout)` with floating-promise `.catch` when timeout wins → map `StageOutput` (artifacts from non-empty `result.result` / `result.plan?.result`); never throw; timeout/throw → `status: 'error'`. Register `new CursorSdkRunner()` in `RunnerRegistry` ctor; do **not** `setDefault('cursor-sdk')`. No edits to `agent-runner.ts`, routes, or `LocalCursorRunner` success predicate. No commit. Local runtime only via `runTask`.

### T2 — Unit tests for registry + `CursorSdkRunner`
- **dependsOn:** T1
- **files:** `src/services/harness-runner.test.ts`
- **ACs:** AC1, AC2, AC3 (table §5 of refined plan)
- **Maps plan:** Step D
- **Coder prompt:** Extend `src/services/harness-runner.test.ts` with mocked `runTaskFn`: registry has `cursor-sdk`; default still `cursor-local`; update list-length assertions for 2 built-ins; stage default agents/prompts (`spec`/`review`→planner, `implement`→implementer, `build`/`test`→default); `options.agent` override; `finished`→success + artifacts; SDK `error`/`cancelled`→failed; throw→error; timeout→error + no unhandledRejection; `deploy`→error; healthCheck; model pass-through. No real `CURSOR_API_KEY`. No commit.

### T3 — Verification
- **dependsOn:** T2
- **files:** none (commands only)
- **ACs:** Pre-PR checklist §7
- **Maps plan:** Step E
- **Coder prompt:** Run `npm run typecheck`, `npm run build`, `npm run test`, `npm run scan-secrets`. Confirm diff limited to `harness-runner.ts` + `harness-runner.test.ts` (MEMORY scope-creep guard). Do not stage `.agents/plans/`. No commit.

## Plan step → task map

| Plan step | Task(s) |
|-----------|---------|
| Step A — Stage mapping helpers | T1 |
| Step B — `CursorSdkRunner` class | T1 |
| Step C — Registry registration | T1 |
| Step D — Unit tests | T2 |
| Step E — Verification | T3 |

## Invariants (do not violate)

- `localSdkRuntimeOnly`, `disposeAgentsAlways` (via `runTask`), `settingSourcesEmptyUnlessIntentional`
- `thinRoutesNoBusinessLogic`, `noHardcodedRepoAbsolutePaths`, `secretsFromEnvOnly`
- Surgical scope: no `LocalCursorRunner` success-predicate fix; no default-runner swap
- MEMORY: ship only harness-runner + tests

## Handoff

- Human-readable: `.agents/plans/13-runner-cursor-sdk/step-03-13-runner-cursor-sdk.plan.exec.md`
- Machine DAG: `.agents/plans/13-runner-cursor-sdk/step-03-13-runner-cursor-sdk.exec.dag.json` (sequential stub)
- Next skill: `ws-implement-tasks` with `execMode: sequential`
- Orchestrator: set state `execMode: sequential`
