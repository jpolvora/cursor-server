---
slug: 13-runner-cursor-sdk
title: "Cursor SDK Runner Adapter"
status: "plan refined ok"
complexity: standard
shared_understanding: confirmed
refineRound: 1
---

## 0. Summary & Business Rules

**Objective:** Add a production-ready `CursorSdkRunner` (`HarnessRunner` id `cursor-sdk`) that maps harness stages to local `@cursor/sdk` runs with stage-specific agent roles/prompts, normalized `StageOutput`, timeout + dispose guarantees, and automatic `runnerRegistry` registration.

**Business rules:**
- Local SDK runtime only (`cwd: repoPath`, `settingSources: []`); no cloud runtime.
- Prefer reusing `runTask` / `agent-runner` dispose patterns over duplicating `Agent.create` lifecycle.
- Keep existing `LocalCursorRunner` (`cursor-local`) as registry default unless options explicitly select `cursor-sdk`.
- Supported stages: `spec`, `implement`, `build`, `test`, `review` (same as `LocalCursorRunner`; `deploy` remains unsupported → `status: 'error'`).
- Secrets (`CURSOR_API_KEY`) from env/config only; never log keys.

**Security mitigations:**
- No hardcoded absolute repo paths; callers pass `repoPath` (orchestrator resolves `{REPOS_ROOT}/{repo}`).
- Timeout bound prevents hung agent processes from blocking the pipeline indefinitely (orchestrator progress bound; best-effort).
- Always dispose agents (`finally` / `[Symbol.asyncDispose]`) even on timeout/error via `runTask` path.

---

## 1. Definition of Ready & Scope

### Resolved assumptions
1. Specs 11 (HarnessRunner interface) and 12 (stage orchestration) already landed; this work only adds the `cursor-sdk` adapter + registration + tests.
2. `CursorSdkRunner` is a sibling of `LocalCursorRunner`, not a replacement; default runner stays `cursor-local`.
3. Stage→role defaults (overridable via `input.options.agent`):

| Stage | Default `AgentId` | Prompt posture |
|-------|-------------------|----------------|
| `spec` | `planner` | Plan-only; no file edits |
| `implement` | `implementer` | Implement-focused (`plan+implementer` only if `options.agent` set) |
| `build` | `default` | Stage prompt: run/verify build; report pass/fail |
| `test` | `default` | Stage prompt: run/verify tests; report pass/fail |
| `review` | `planner` | Review-only; produce findings, no implement |

**Agent resolution rule (locked):**
- If `options.agent` is present (non-empty after trim) → `resolveAgent(options.agent)`.
- Else → `defaultAgentForStage(stage)` (do **not** fall through to `resolveAgent(undefined)` → `default` for all stages; that is `LocalCursorRunner` behavior and the differentiator for `cursor-sdk`).

4. Timeout: `options.timeoutMs` (number) or default **600_000** (10m). On timeout → `StageOutput.status: 'error'` with diagnostic log. Dispose remains inside `runTask` finally when that promise settles (best-effort; no SDK abort in v1).
5. Artifact extraction v1: collect non-empty `result.result` and, when present, `result.plan?.result` strings into `artifacts[]`; do not parse filesystem diffs yet.
6. Error normalization:
   - thrown / startup failure (`CursorAgentError` wrapped by `runTask`) → `status: 'error'`
   - timeout → `status: 'error'`
   - completed `RunTaskResult` with SDK run status `error` | `cancelled` | other non-success → `status: 'failed'`
   - SDK run status `finished` (plus defensive `completed` | `success`) → `status: 'success'`

**Evidence:** `@cursor/sdk` `RunResult.status` is `finished` | `error` | `cancelled`. Do **not** change `LocalCursorRunner` mapping in this PR (surgical scope); only `CursorSdkRunner` uses the correct success predicate.

### Acceptance Criteria (measurable)
- **AC1:** For each supported stage, `executeStage` selects stage role/prompt (and model from options/config) and invokes local agent execution via `runTask`.
- **AC2:** Successful/failed runs return `StageOutput` with `stage`, `status`, `durationMs`, `logs`, optional `artifacts`, optional `rawResult`/`error`.
- **AC3:** Exceptions and timeouts still dispose the agent (via `runTask` finally when it settles) and return `failed` or `error` with diagnostic logs (no throw out of `executeStage`).

### Out of scope
- Changing HTTP routes / `POST /tasks` contract.
- Making `cursor-sdk` the registry default.
- Hermes / OpenCode runners.
- Streaming SSE, async job queue, run persistence beyond existing stage-store.
- Cloud SDK runtime.
- Docs-only README churn beyond a one-line mention if required by implement step later (prefer code+tests only this PR).
- `deploy` stage support.
- Fixing `LocalCursorRunner` success-status predicate (`completed`/`success` vs SDK `finished`).
- Adding SDK abort/cancel API or new env vars.

---

## 2. Technical Design & Architecture

**Stack:** Node 20 + TypeScript ESM + Hono; layers from `config.json`: services (primary), agents (role allowlist reuse). No frontend / DB.

### Layer edits

| Layer | Path | Change |
|-------|------|--------|
| services | `src/services/harness-runner.ts` | Add `CursorSdkRunner`, stage role/prompt helpers, timeout wrap, register in `RunnerRegistry` ctor |
| services (tests) | `src/services/harness-runner.test.ts` | Registry + `CursorSdkRunner` unit tests (mock `runTask`); update list-length assertions |
| agents | `src/agents.ts` | **No change** (reuse `resolveAgent` / existing roles) |
| agent-runner | `src/services/agent-runner.ts` | **No change** (dispose already in `runAgentPhase`; no abort hook for v1) |
| stage-orchestrator | `src/services/stage-orchestrator.ts` | **No change** required; selects runner via `runnerId` already |

### Design

```text
StageOrchestrator
  → runnerRegistry.getOrDefault(runnerId)
  → CursorSdkRunner.executeStage(StageInput)
       1. validate supportedStages
       2. map stage → default AgentId (+ resolveAgent override when options.agent set)
       3. wrap prompt with stage-specific instructions
       4. Promise.race(runTask(...), timeout)  // best-effort; no SDK abort
       5. map RunTaskResult → StageOutput (logs, artifacts, status)
       6. catch → status error/failed + logs (never rethrow)
```

**Reuse:** Call existing `runTask(config, { prompt, repoPath, agent, model })` so `Agent.create` + `send` + `wait` + `finally` dispose stay single-sourced (invariant `disposeAgentsAlways`).

**Stage prompt wrapper (thin):** prepend 2–5 lines of stage intent to `input.prompt` before `runTask`; let `promptForAgent` inside `agent-runner` apply planner/implementer framing.

**Timeout (locked v1):**
- Default `DEFAULT_STAGE_TIMEOUT_MS = 600_000`.
- Override: if `typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0`, use it.
- `Promise.race` around `runTask`. If timeout wins, return `error` StageOutput with log like `Stage timed out after ${timeoutMs}ms`.
- **Floating promise hygiene:** when timeout wins, attach `.catch(() => {})` (or equivalent) to the still-running `runTask` promise so a later rejection does not become an unhandledRejection. Document that the in-flight agent may continue until `runTask` completes dispose on its own path (best-effort bound for orchestrator progress).
- No changes to `agent-runner.ts`; no SDK abort API.

**Registry:** In `RunnerRegistry` constructor after `LocalCursorRunner`:

```typescript
this.register(new CursorSdkRunner());
```

Do **not** call `setDefault('cursor-sdk')`. Default remains `cursor-local`.

**File placement (locked):** Keep `CursorSdkRunner` + helpers in `harness-runner.ts` (currently ~148 lines). Extract to `cursor-sdk-runner.ts` only if **new** lines for this feature exceed ~150 and the file becomes hard to navigate. Prefer same file for v1.

**Testability:** Constructor-inject optional `runTaskFn` defaulting to `runTask` (minimal surface, no new framework). Export small pure helpers as needed: `defaultAgentForStage`, `wrapStagePrompt`, `normalizeRunStatusToStageStatus` (or private module-level functions tested via runner behavior).

**Config merge:** Mirror `LocalCursorRunner`: if `options.config` is an object, `Object.assign({}, loadConfig(), options.config)`; else `loadConfig()`.

### Invariant checks (`config.json.invariants`)
- `localSdkRuntimeOnly` ✓
- `thinRoutesNoBusinessLogic` ✓ (no route edits)
- `noHardcodedRepoAbsolutePaths` ✓
- `secretsFromEnvOnly` ✓
- `disposeAgentsAlways` ✓ (via `runTask`)
- `settingSourcesEmptyUnlessIntentional` ✓ (via `runTask`)
- `commitPlanFilesOnlyAtStep8` ✓ (plan artifacts not committed now)

### Fable domain
`fable.enabled` + `autoDetectDomain`: no IaC/K8s/migration/data-script signals for this adapter. No `fable-domain` binding appended.

### MEMORY applied
- **Docs implement scope creep guard (Medium):** Ship only `harness-runner.ts` + `harness-runner.test.ts`. Diff-audit before Step 8; no OOS `src/` or README churn.

---

## 3. Step-by-Step Plan

### Step A — Stage mapping helpers (services)
- **Action:** Add pure functions in `harness-runner.ts`: `defaultAgentForStage(stage)`, `wrapStagePrompt(stage, prompt)`, `normalizeRunStatusToStageStatus(runStatus)`, `resolveTimeoutMs(options)`, `resolveStageAgent(stage, options)`.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** Types use existing `HarnessStage` / `AgentId`; no new deps. Success predicate includes SDK `finished`.

### Step B — `CursorSdkRunner` class
- **Action:** Implement `HarnessRunner` with `id = 'cursor-sdk'`, `name = 'Cursor SDK Runner'`, same `supportedStages` as local. Optional ctor `runTaskFn`. `executeStage`: validate → resolve agent → wrap prompt → load config → race `runTask` vs timeout (with floating-promise catch) → map `StageOutput`. Catch-all returns `error` with logs.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** Never throws from `executeStage`; dispose remains inside `runTask`; no `agent-runner.ts` edits.

### Step C — Registry registration
- **Action:** `new CursorSdkRunner()` in `RunnerRegistry` constructor; default remains `cursor-local`.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** `runnerRegistry.get('cursor-sdk')` defined; `getOrDefault()` / `getDefaultId()` still `cursor-local`.

### Step D — Unit tests
- **Action:** Extend `harness-runner.test.ts` with mocked `runTaskFn`:
  - registry has `cursor-sdk`; default still `cursor-local`
  - update existing `list().length` assertion(s) that assumed only 1 built-in runner (ctor now registers 2 → after custom register, length 3)
  - each supported stage picks expected default agent / wrapped prompt
  - `options.agent` overrides stage default
  - success (`finished`) maps artifacts + `success`
  - SDK `error` / `cancelled` → `failed`
  - thrown error → `error` + logs
  - timeout → `error` + diagnostic; no unhandled rejection from late `runTask`
  - unsupported `deploy` → `error`
  - healthCheck mirrors key presence pattern
  - model from `options.model` or config default passed through
- **Files:** `src/services/harness-runner.test.ts`
- **Checks:** `npm run test` green without real API key.

### Step E — Verification
- **Action:** `npm run typecheck`, `npm run build`, `npm run test`, `npm run scan-secrets`.
- **Files:** none (commands only)
- **Checks:** All pass; diff limited to harness-runner (+ test).

---

## 4. Permissions, Tenancy & i18n

| Area | Status |
|------|--------|
| RBAC | N/A (no auth change this PR; future API-key auth remains Planned) |
| Tenancy | N/A (single-host `REPOS_ROOT`) |
| i18n | N/A (API-only; no frontend) |

---

## 5. Test Coverage

| AC | Test case | Method / describe |
|----|-----------|-------------------|
| AC1 | Registry exposes `cursor-sdk` after construct | `RunnerRegistry` / `should register cursor-sdk by default` |
| AC1 | Default remains `cursor-local` | `…/should keep cursor-local as default` |
| AC1 | `spec` uses planner role + plan-oriented wrap | `CursorSdkRunner` / `should use planner for spec stage` |
| AC1 | `implement` uses implementer (override via options.agent) | `…/should use implementer for implement stage` |
| AC1 | `build`/`test`/`review` map to defaults in table §1 | `…/should map build test review default agents` |
| AC1 | Model from `options.model` or config default passed to runTask | `…/should pass model through to runTask` |
| AC2 | Success (`finished`) → `status: success`, `durationMs`, logs, artifacts from result text | `…/should normalize successful StageOutput` |
| AC2 | Non-success SDK status → `failed` with rawResult | `…/should map SDK error status to failed` |
| AC3 | Thrown Error → `status: error`, error message in logs/error | `…/should return error StageOutput on throw` |
| AC3 | Timeout → `status: error`, log mentions timeout | `…/should return error on timeout` |
| AC3 | Unsupported stage `deploy` → `error` (no throw) | `…/should reject unsupported deploy stage` |
| — | healthCheck returns healthy boolean + key details | `…/should report healthy status` |
| — | Existing registry list-length tests updated for 2 built-ins | `RunnerRegistry` / list length |

**Verification commands:** `npm run typecheck` · `npm run build` · `npm run test` · `npm run scan-secrets`.

---

## 6. Invariants (Do Not Violate)

1. **localSdkRuntimeOnly** — no cloud `Agent.create` path.
2. **disposeAgentsAlways** — do not bypass `runTask` dispose; no orphaned agents on error/timeout path in our code.
3. **settingSourcesEmptyUnlessIntentional** — keep `settingSources: []`.
4. **thinRoutesNoBusinessLogic** — no route/handler logic for this feature.
5. **noHardcodedRepoAbsolutePaths** — use caller `repoPath` only.
6. **secretsFromEnvOnly** — never embed or log `CURSOR_API_KEY`.
7. **commitPlanFilesOnlyAtStep8** — do not git-add `{plansDir}/` this step.
8. **Surgical scope** — do not refactor `LocalCursorRunner`, orchestrator, or agent allowlist unless required for compile.
9. **MEMORY** — avoid docs/src scope creep (prior trap); ship only harness-runner + tests.

---

## 7. Pre-PR Checklist

- [x] Layer boundaries respected (services only; routes untouched).
- [x] Domain entities/mappings N/A (no DB).
- [x] Schema migrations N/A.
- [x] Authorization checks N/A this PR.
- [x] i18n keys N/A.
- [x] Test cases cover AC1–AC3 (table §5).
- [x] `cursor-sdk` registered; default remains `cursor-local`.
- [x] `npm run typecheck` && `npm run build` && `npm run test` && `npm run scan-secrets` pass.
- [x] Diff audit: no OOS `src/` or unrelated README churn.

---

## 8. Open Questions

1. **Timeout cancel semantics:** **Resolved** — Promise.race + StageOutput `error` for v1 (best-effort; no SDK abort). Floating-promise `.catch` when timeout wins.
2. **Default timeout value:** **Resolved** — constant `600_000` ms + `options.timeoutMs` override; no new env var.
3. **`implement` default role:** **Resolved** — `implementer` (single phase); callers pass `options.agent: 'plan+implementer'` when needed.
4. **Should `cursor-sdk` become default?** **Resolved** — No; keep `cursor-local` as default (OOS to change).
5. **File split:** **Resolved** — Keep class in `harness-runner.ts` unless new lines for this feature exceed ~150 and file becomes unwieldy; then extract.

**Blocked tasks:** none. Shared understanding confirmed (autoMode). Ready for task breakdown (Step 3).

---

## Interview registry

| id | class | section | gap | recommendation | status | resolution | dependsOn |
|----|-------|---------|-----|----------------|--------|------------|-----------|
| G1 | blocking | §8.1 | Timeout: race-only vs SDK abort | Promise.race + error; best-effort; no abort | resolved | Locked autoMode: race + StageOutput error; document best-effort; attach catch on losing runTask promise | — |
| G2 | blocking | §8.2 | Default timeout / env var | 600_000 + options.timeoutMs; no env | resolved | Locked autoMode: constant 600_000; parse finite positive timeoutMs only | G1 |
| G3 | blocking | §8.3 | implement default role | implementer | resolved | Locked autoMode: implementer; override via options.agent | — |
| G4 | blocking | §8.4 | cursor-sdk as default? | Keep cursor-local | resolved | Locked autoMode: register but do not setDefault | — |
| G5 | non-blocking | §8.5 | File split threshold | Keep in harness-runner.ts unless >~150 new lines | resolved | Locked autoMode: same file; extract only if unwieldy | — |
| G6 | blocking | §2 / AC2 | SDK success status is `finished`, not `completed`/`success` | Map finished→success in CursorSdkRunner only | resolved | Evidence from cursor-sdk skill/error-handling; LocalCursorRunner left unchanged (surgical) | — |
| G7 | blocking | §5 / tests | Registry list().length assumes 1 built-in | Update tests for 2 built-ins after register | resolved | Step D explicitly updates list-length assertions | G4 |
| G8 | non-blocking | §1 | Agent override vs stage default | Prefer options.agent when set; else stage default | resolved | Codified resolveStageAgent rule in §1 | G3 |
| G9 | non-blocking | §2 | Timeout floating rejection | Catch late runTask rejection after race loss | resolved | Folded into Timeout design §2 | G1 |
| G10 | non-blocking | §1 | Artifacts for plan+implementer | Include plan.result + result when non-empty | resolved | Artifact rule §1.5 | — |
| G11 | non-blocking | §0–8 | Soft-deletion / concurrency / rate limits | N/A for this adapter | resolved | No DB/list/rate-limit surface; single-host sync executeStage | — |
| G12 | non-blocking | MEMORY | Scope creep into docs/src | Diff-audit; harness-runner + tests only | resolved | Applied Medium MEMORY solution into §2/§6/§7 | — |

**blocking_open:** 0  
**shared_understanding:** confirmed  
**round:** 1  
**outcome:** End refinement and advance
