# Plan: OpenCode Runner Adapter

## Goal
Implement `OpenCodeRunner` — a `HarnessRunner` adapter (`id: 'opencode'`) that spawns OpenCode CLI to execute `implement`, `build`, or `test` stages inside the local target repo working tree.

## Files to create/modify

| File | Action | Purpose |
|------|--------|---------|
| `src/services/opencode-runner.ts` | Create | OpenCodeRunner class, CLI exec, result normalization, registry registration |
| `src/services/opencode-runner.test.ts` | Create | Tests for OpenCodeRunner, normalizeOpenCodeResult, registry registration |

## Implementation steps

1. **Create `src/services/opencode-runner.ts`:**
   - Define `OpenCodeExecRequest` / `OpenCodeExecResult` / `OpenCodeExecFn` types
   - `normalizeOpenCodeResult()` — mirrors `normalizeHermesResult` pattern
   - `execOpenCodeCli()` — spawn `opencode` (or `OPENCODE_BIN`) with `--model`/`--engine` options
   - `createDefaultOpenCodeExec()` factory
   - `OpenCodeRunner` class — implements `HarnessRunner` with `id: 'opencode'`, supports `implement`/`build`/`test` stages
   - Register via `runnerRegistry.register(new OpenCodeRunner())` at module bottom

2. **Create `src/services/opencode-runner.test.ts`:**
   - Test registry registration (matches hermes-runner.test.ts pattern)
   - Test `normalizeOpenCodeResult` for success/failure/explicit status
   - Test `executeStage` dispatch, unsupported stage error, throw handling, timeout, health

## Acceptance criteria mapping

| AC | Verification |
|----|-------------|
| AC1: `OpenCodeRunner` Implementation | Typecheck + tests: runner registered with id `'opencode'`, `executeStage()` resolves via registry |
| AC2: Output Streaming & Log Capture | `execOpenCodeCli` uses stdio pipes; `normalizeOpenCodeResult` pushes stdout/stderr to logs |
| AC3: Result & Artifact Normalization | Exit code → StageOutput status mapping; artifacts from stdout; error from stderr |
