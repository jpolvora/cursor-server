# Delivery Report — Fix OpenCode stream and git-status artifacts

## Completed

- **`src/services/harness-runner.ts`** — `StageLogSink` type and `resolveStageLogSink()`; documented `onLog` on `StageInput.options`.
- **`src/services/opencode-runner.ts`** — Real-time chunk forwarding in `execOpenCodeCli`; `captureGitStatusPorcelain()`; git status merged into `artifacts` and `rawResult.gitStatusPorcelain`.
- **`src/services/opencode-runner.test.ts`** — 18 tests including mock delayed `onLog`, injectable spawn streaming, temp-repo git attach, non-repo skip.

## Verification

- `npm run typecheck` — passed
- `npm run build` — passed
- `node --test dist/services/opencode-runner.test.js` — 18/18 passed

## AC Coverage

| AC | Status | Evidence |
|----|--------|----------|
| AC1: Real-time chunk forwarding | ✅ | `forwardStreamChunk` + `onLog` on `OpenCodeExecRequest` / `StageInput.options` |
| AC2: Full logs + exit status preserved | ✅ | Buffers accumulated; `normalizeOpenCodeResult` unchanged semantics |
| AC3: Git status attachment | ✅ | `captureGitStatusPorcelain` → `gitStatusPorcelain` in rawResult + `git-status:` artifact |
| AC4: Graceful non-git skip | ✅ | Log line `Git status skipped: …`; stage still succeeds |
| AC5: Unit tests | ✅ | Streaming + git tests in `opencode-runner.test.ts` |
| AC6: typecheck/build | ✅ | Both pass |

## Benchmark

Total time: ~15m (implement + verify + ship)
