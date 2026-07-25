---
slug: 15-hermes-integration
title: "Hermes Agent Orchestration & Subagent Delegation"
status: "plan to be refined"
complexity: standard
---

## 0. Summary & Business Rules

**Objective:** Add `HermesRunner` (`HarnessRunner` id `hermes`) that dispatches stage execution to a local/containerized Hermes Agent via an injectable CLI/RPC client, normalizes responses into `StageOutput`, and registers automatically in `runnerRegistry`.

**Business rules:**
- Local-first: default transport is CLI subprocess (`HERMES_BIN` / `hermes`) or optional HTTP API (`HERMES_API_URL`); no live Hermes required in CI (injectable `HermesExecFn`).
- Match `CursorSdkRunner` patterns: constructor inject, timeout race + `finally` clearTimeout, never rethrow from `executeStage`.
- Keep `cursor-local` as registry default; do not set `hermes` as default.
- Supported stages: `spec`, `implement`, `build`, `test`, `review` (same as Cursor runners; `deploy` → `error`).
- Secrets from env only (`HERMES_*`); never log tokens.

**Security mitigations:**
- No hardcoded absolute repo paths; callers pass `repoPath`.
- Timeout bound (`options.timeoutMs` or 600_000) prevents hung CLI/RPC from blocking the pipeline.
- Child process / client errors map to `StageOutput.status: 'error'` with diagnostic logs only.

---

## 1. Definition of Ready & Scope

### Resolved assumptions
1. Specs 11–13 (HarnessRunner, orchestration, CursorSdkRunner) already landed; this work only adds Hermes adapter + registration + tests.
2. Hermes has no `--mode rpc`; adapter targets CLI spawn and/or OpenAI-compatible HTTP API as transports behind one `HermesExecFn` interface.
3. AC2 (skills/subagents): v1 passes skill hints via `options.skills` (string[]) and/or stage defaults; default exec includes them in the Hermes prompt/env; response may echo `skillsLoaded[]` into logs. Full Hermes skill-runtime ownership stays inside Hermes (we do not reimplement skill loading in cursor-server).
4. Timeout / dispose: race around exec; always `clearTimeout` in `finally` (MEMORY: Promise.race timer leak).
5. Error normalization: thrown → `error`; non-zero exit / failed status → `failed`; success → `success`.

### Acceptance Criteria (measurable)
- **AC1:** `runnerRegistry.get('hermes')` returns `HermesRunner`; `executeStage` calls injected/default Hermes exec with stage + repoPath + prompt.
- **AC2:** When `options.skills` (or stage defaults) present, exec request includes skills; logs report skills requested/loaded.
- **AC3:** Successful/failed/error paths return `StageOutput` with `stage`, `status`, `durationMs`, `logs`, optional `artifacts`/`error`/`rawResult`.

### Out of scope
- Making Hermes the default runner.
- Live Hermes binary in CI / Docker packaging of Hermes.
- Full TUI gateway JSON-RPC session protocol (v1 stub; injectable client allows future swap).
- OpenCode runner; auth; streaming SSE; cron scheduling inside cursor-server.
- Changing HTTP routes beyond existing registry listing.
- `deploy` stage support.

---

## 2. Technical Design & Architecture

**Stack:** Node 20 + TypeScript ESM + Hono; services layer primary.

### Layer edits

| Layer | Path | Change |
|-------|------|--------|
| services | `src/services/hermes-runner.ts` | **New** `HermesRunner`, `HermesExecFn`, default CLI/HTTP exec stub, normalize helpers |
| services | `src/services/harness-runner.ts` | Import + `register(new HermesRunner())` in `RunnerRegistry` ctor |
| services (tests) | `src/services/hermes-runner.test.ts` | **New** unit tests with mock exec |
| services (tests) | `src/services/harness-runner.test.ts` | Expect `hermes` registered; adjust list-length asserts |

### Design

```text
StageOrchestrator
  → runnerRegistry.getOrDefault('hermes')
  → HermesRunner.executeStage(StageInput)
       1. validate supportedStages
       2. resolve skills + timeoutMs + wrap stage prompt
       3. Promise.race(hermesExec(request), timeout) + finally clearTimeout
       4. map HermesExecResult → StageOutput (logs, artifacts, skills)
       5. catch → status error + logs (never rethrow)
```

**Default exec (`createDefaultHermesExec`):**
- If `HERMES_API_URL` set → `POST {url}/v1/chat/completions` (or `/v1/runs`) with stage prompt + cwd hint; map response text → stdout.
- Else spawn `HERMES_BIN || 'hermes'` with args `['--cwd', repoPath, prompt]` (or chat-style); capture stdout/stderr/exitCode.
- Binary missing / network fail → throw or return exitCode≠0 for normalize path.

**Registry:** After Cursor runners:

```typescript
this.register(new HermesRunner());
```

**Fable domain:** No IaC/K8s/migration signals; no `fable-domain` binding.

### Invariant checks
- `localSdkRuntimeOnly` ✓ (Hermes is alternate local/container exec, not Cursor cloud)
- `thinRoutesNoBusinessLogic` ✓
- `noHardcodedRepoAbsolutePaths` ✓
- `secretsFromEnvOnly` ✓
- `disposeAgentsAlways` N/A for CLI stub (no Cursor agent); timeout still cleared
- `commitPlanFilesOnlyAtStep8` ✓

---

## 3. Step-by-Step Plan

1. **Add `hermes-runner.ts`** — types, default exec, `HermesRunner`, normalize → verify: typecheck
2. **Register in `RunnerRegistry`** — `id: 'hermes'` → verify: `runnerRegistry.get('hermes')`
3. **Unit tests** — mock exec success/fail/timeout/skills/unsupported → verify: `npm test` hermes suite
4. **Fix registry test counts** — list length + hermes presence → verify: harness-runner tests green
5. **Verify** — `npm run typecheck` + `npm run build` + targeted tests → verify: exit 0

---

## 4. Permissions, Tenancy & i18n

N/A (no auth, tenancy, or i18n in this adapter).

---

## 5. Test Coverage

| AC | Test |
|----|------|
| AC1 | `runnerRegistry.get('hermes')` defined; mock exec receives stage/repoPath/prompt |
| AC2 | `options.skills` appear in exec request and logs |
| AC3 | success → `status: success` + logs/artifacts; throw → `error`; timeout → `error`; unsupported stage → `error` |

---

## 6. Invariants (Do Not Violate)

- Do not commit secrets or long fake API keys in tests (MEMORY: use short placeholders).
- Always `clearTimeout` in `finally` around Promise.race (MEMORY: timer leak).
- Do not change default runner away from `cursor-local`.
- Do not implement OpenCode / live Hermes packaging.

---

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (services only + tests)
- [ ] `hermes` registered; default still `cursor-local`
- [ ] Tests pass without live Hermes binary
- [ ] typecheck + build + scan-secrets green
- [ ] index.PRD status updated at ship

---

## 8. Open Questions

None blocking (autoMode). Deferred: full TUI gateway JSON-RPC session lifecycle vs HTTP `/v1/runs` as production default once Hermes is installed on the host.
