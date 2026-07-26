# Plan: Fix OpenCode stream and git-status artifacts

## Goal

Forward OpenCode stdout/stderr in near real-time via `StageInput.options.onLog`, preserve full logs on completion, and attach `git status --porcelain` to `StageOutput` after each stage.

## Files

| File | Action |
|------|--------|
| `src/services/harness-runner.ts` | Add `StageLogSink`, `resolveStageLogSink`, document `onLog` on options |
| `src/services/opencode-runner.ts` | Stream chunks via `onLog`; `captureGitStatusPorcelain`; merge into artifacts/rawResult |
| `src/services/opencode-runner.test.ts` | Tests for streaming, git attach, graceful skip |

## Steps

1. Extend harness options with `StageLogSink` / `resolveStageLogSink`.
2. Forward spawn stdout/stderr chunks in `execOpenCodeCli` while accumulating buffers.
3. Pass `onLog` from `executeStage` through `OpenCodeExecRequest`.
4. After exec, run `git status --porcelain`; attach to result or log skip reason.
5. Unit tests + `npm run typecheck` / `npm run build`.
