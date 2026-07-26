---
id: null
slug: 21-fix-opencode-stream-and-git
title: "Fix OpenCode runner real-time stream and git-status artifacts"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix OpenCode runner real-time stream and git-status artifacts

## Description

`OpenCodeRunner` buffers stdout/stderr until process exit, then packs them into `StageOutput.logs`. Spec `16-runner-opencode` AC2 requires real-time reporting to the task/run stream; AC3 requires converting exit code **and git status changes** into normalized `StageOutput`. Neither live streaming nor git status capture exists today.

Parent verify: `ms-20260725T230442Z` / `16-runner-opencode` score **7/10**. Evidence: `src/services/opencode-runner.ts`.

## Acceptance Criteria

- AC1: While OpenCode is running a stage, stdout/stderr chunks are forwarded in near real-time to an optional progress callback / harness run log sink (not only after exit). Document the callback hook on `HarnessRunner` execute options or OpenCode-specific options if the shared interface already has a log channel.
- AC2: On process exit, `StageOutput` still includes full captured logs and correct status from exit code / explicit status (existing behavior preserved).
- AC3: After a successful or failed OpenCode stage that may mutate the repo, capture `git status --porcelain` (or equivalent) under `repoPath` and attach it to `StageOutput` (e.g. `artifacts` and/or structured field in `rawResult`) so callers can see changed files.
- AC4: If the directory is not a git repo or `git` is unavailable, record a clear log line and omit git artifacts without failing an otherwise successful stage solely for that reason.
- AC5: Unit tests cover chunk forwarding (mock spawn with delayed data events) and git-status attachment (mock or temp repo).
- AC6: `npm run typecheck` and `npm run build` pass.

## Notes

- Prefer extending existing `StageOutput` / execute options over inventing a parallel event bus.
- Keep OpenCode CLI argv behavior otherwise unchanged unless required for streaming.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (bundled PR #10 open). Not merged to develop/master yet.
