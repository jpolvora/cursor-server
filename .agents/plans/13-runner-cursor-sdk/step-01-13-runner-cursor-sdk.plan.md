---
slug: 13-runner-cursor-sdk
title: "Cursor SDK Runner Adapter"
status: "plan to be refined"
complexity: standard
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
- Timeout bound prevents hung agent processes from blocking the pipeline indefinitely.
- Always dispose agents (`finally` / `[Symbol.asyncDispose]`) even on timeout/error.

---

## 1. Definition of Ready & Scope

### Resolved assumptions
1. Specs 11 (HarnessRunner interface) and 12 (stage orchestration) already landed; this work only adds the `cursor-sdk` adapter + registration + tests.
2. `CursorSdkRunner` is a sibling of `LocalCursorRunner`, not a replacement; default runner stays `cursor-local`.
3. Stage→role defaults (overridable via `input.options.agent`):

| Stage | Default `AgentId` | Prompt posture |
|-------|-------------------|----------------|
| `spec` | `planner` | Plan-only; no file edits |
| `implement` | `implementer` | Implement-focused (`plan+implementer` if `options.agent` set) |
| `build` | `default` | Stage prompt: run/verify build; report pass/fail |
| `test` | `default` | Stage prompt: run/verify tests; report pass/fail |
| `review` | `planner` | Review-only; produce findings, no implement |

4. Timeout: `options.timeoutMs` (number) or default **600_000** (10m). On timeout → dispose path (via `runTask` finally) + `StageOutput.status: 'error'` with diagnostic log.
5. Artifact extraction v1: collect non-empty `result.result` / plan text strings into `artifacts[]`; do not parse filesystem diffs yet.
6. Error normalization: thrown/`CursorAgentError` → `status: 'error'`; completed run with SDK `status === 'error'` or non-success → `status: 'failed'`; success → `status: 'success'`.

### Acceptance Criteria (measurable)
- **AC1:** For each supported stage, `executeStage` selects stage role/prompt (and model from options/config) and invokes local agent execution.
- **AC2:** Successful/failed runs return `StageOutput` with `stage`, `status`, `durationMs`, `logs`, optional `artifacts`, optional `rawResult`/`error`.
- **AC3:** Exceptions and timeouts still dispose the agent and return `failed` or `error` with diagnostic logs (no throw out of `executeStage`).

### Out of scope
- Changing HTTP routes / `POST /tasks` contract.
- Making `cursor-sdk` the registry default.
- Hermes / OpenCode runners.
- Streaming SSE, async job queue, run persistence beyond existing stage-store.
- Cloud SDK runtime.
- Docs-only README churn beyond a one-line mention if required by implement step later (prefer code+tests only this PR).
- `deploy` stage support.

---

## 2. Technical Design & Architecture

**Stack:** Node 20 + TypeScript ESM + Hono; layers from `config.json`: services (primary), agents (role allowlist reuse). No frontend / DB.

### Layer edits

| Layer | Path | Change |
|-------|------|--------|
| services | `src/services/harness-runner.ts` | Add `CursorSdkRunner`, stage role/prompt helpers, timeout wrap, register in `RunnerRegistry` ctor |
| services (tests) | `src/services/harness-runner.test.ts` | Registry + `CursorSdkRunner` unit tests (mock `runTask`) |
| agents | `src/agents.ts` | **No change** (reuse `resolveAgent` / existing roles) |
| agent-runner | `src/services/agent-runner.ts` | **Prefer no change**; dispose already in `runAgentPhase`. Only touch if timeout requires an abort hook (see Open Questions) |
| stage-orchestrator | `src/services/stage-orchestrator.ts` | **No change** required; selects runner via `runnerId` already |

### Design

```text
StageOrchestrator
  → runnerRegistry.getOrDefault(runnerId)
  → CursorSdkRunner.executeStage(StageInput)
       1. validate supportedStages
       2. map stage → default AgentId (+ resolveAgent override)
       3. wrap prompt with stage-specific instructions
       4. Promise.race(runTask(...), timeout)
       5. map RunTaskResult → StageOutput (logs, artifacts, status)
       6. catch → status error/failed + logs (never rethrow)
```

**Reuse:** Call existing `runTask(config, { prompt, repoPath, agent, model })` so `Agent.create` + `send` + `wait` + `finally` dispose stay single-sourced (invariant `disposeAgentsAlways`).

**Stage prompt wrapper (thin):** prepend 2–5 lines of stage intent to `input.prompt` before `runTask`; let `promptForAgent` inside `agent-runner` apply planner/implementer framing.

**Timeout:** `Promise.race` around `runTask`. If timeout wins, return `error` StageOutput. Note: in-flight SDK agent may continue until `runTask` completes dispose on its own path; document as best-effort bound for orchestrator progress. Optional follow-up: cancel token if SDK adds it (OOS unless easy).

**Registry:** In `RunnerRegistry` constructor after `LocalCursorRunner`:

```typescript
this.register(new CursorSdkRunner());
```

Do **not** call `setDefault('cursor-sdk')`.

**Testability:** Export small pure helpers (`defaultAgentForStage`, `wrapStagePrompt`, `mapRunResultToStageOutput`) OR inject optional `runTaskFn` on constructor for unit tests without live `CURSOR_API_KEY`. Prefer constructor inject defaulting to `runTask` (minimal surface, no new framework).

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

---

## 3. Step-by-Step Plan

### Step A — Stage mapping helpers (services)
- **Action:** Add pure functions in `harness-runner.ts` (or adjacent private helpers): `defaultAgentForStage(stage)`, `wrapStagePrompt(stage, prompt)`, `normalizeStageStatus(runStatus)`.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** Types use existing `HarnessStage` / `AgentId`; no new deps.

### Step B — `CursorSdkRunner` class
- **Action:** Implement `HarnessRunner` with `id = 'cursor-sdk'`, `name = 'Cursor SDK Runner'`, same `supportedStages` as local. `executeStage`: validate → map role → wrap prompt → load config (mirror LocalCursorRunner options.config merge) → race `runTask` vs timeout → map `StageOutput`. Catch-all returns `error` with logs.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** Never throws from `executeStage`; dispose remains inside `runTask`.

### Step C — Registry registration
- **Action:** `new CursorSdkRunner()` in `RunnerRegistry` constructor; default remains `cursor-local`.
- **Files:** `src/services/harness-runner.ts`
- **Checks:** `runnerRegistry.get('cursor-sdk')` defined; `getOrDefault()` still `cursor-local`.

### Step D — Unit tests
- **Action:** Extend `harness-runner.test.ts` (and/or focused cases) with mocked `runTask`:
  - registry has `cursor-sdk`
  - each supported stage picks expected default agent / wrapped prompt
  - success maps artifacts + `success`
  - SDK failure status → `failed`
  - thrown error → `error` + logs
  - timeout → `error` + diagnostic
  - unsupported `deploy` → `error`
  - healthCheck mirrors key presence pattern
- **Files:** `src/services/harness-runner.test.ts`
- **Checks:** `npm run test` (or typecheck + node:test) green without real API key.

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
| AC1 | `spec` uses planner role + plan-oriented wrap | `CursorSdkRunner` / `should use planner for spec stage` |
| AC1 | `implement` uses implementer (override via options.agent) | `…/should use implementer for implement stage` |
| AC1 | `build`/`test`/`review` map to defaults in table §1 | `…/should map build test review default agents` |
| AC1 | Model from `options.model` or config default passed to runTask | `…/should pass model through to runTask` |
| AC2 | Success → `status: success`, `durationMs`, logs, artifacts from result text | `…/should normalize successful StageOutput` |
| AC2 | Non-success SDK status → `failed` with rawResult | `…/should map SDK error status to failed` |
| AC3 | Thrown Error → `status: error`, error message in logs/error | `…/should return error StageOutput on throw` |
| AC3 | Timeout → `status: error`, log mentions timeout | `…/should return error on timeout` |
| AC3 | Unsupported stage `deploy` → `error` (no throw) | `…/should reject unsupported deploy stage` |
| — | healthCheck returns healthy boolean + key details | `…/should report healthy status` |

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

- [ ] Layer boundaries respected (services only; routes untouched).
- [ ] Domain entities/mappings N/A (no DB).
- [ ] Schema migrations N/A.
- [ ] Authorization checks N/A this PR.
- [ ] i18n keys N/A.
- [ ] Test cases cover AC1–AC3 (table §5).
- [ ] `cursor-sdk` registered; default remains `cursor-local`.
- [ ] `npm run typecheck` && `npm run build` && `npm run test` && `npm run scan-secrets` pass.
- [ ] Diff audit: no OOS `src/` or unrelated README churn.

---

## 8. Open Questions

1. **Timeout cancel semantics:** Is Promise.race + StageOutput `error` enough for v1, or must we abort the in-flight SDK run? **Recommendation:** race + error for v1 (SDK cancel may not exist cleanly); document best-effort.
2. **Default timeout value:** 10 minutes OK, or align with a future env `CURSOR_STAGE_TIMEOUT_MS`? **Recommendation:** constant `600_000` + `options.timeoutMs` override; no new env unless owner wants it.
3. **`implement` default role:** `implementer` vs `plan+implementer`? **Recommendation:** `implementer` (single phase); callers pass `options.agent: 'plan+implementer'` when needed.
4. **Should `cursor-sdk` become default later?** Out of scope; leave `cursor-local` default to avoid breaking existing tests/orchestrator assumptions.
5. **File split:** Keep class in `harness-runner.ts` vs new `cursor-sdk-runner.ts`? **Recommendation:** same file if ≤~150 new lines; extract only if file becomes hard to navigate.

**Blocked tasks:** none for planning; ready for interview / task breakdown.
