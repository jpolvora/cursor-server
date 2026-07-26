---
id: null
slug: 20-fix-hermes-cli-and-health
title: "Fix Hermes CLI dispatch argv and healthCheck honesty"
source: local
specDate: 2026-07-25
complexity: low
---

# Specification — Fix Hermes CLI dispatch argv and healthCheck honesty

## Description

`HermesRunner` ships and registers as `hermes`, but the default CLI spawn uses invent argv (`hermes --cwd <path> [--skills …] <prompt>`). Real Hermes Agent expects non-interactive runs as `hermes chat -q "<prompt>"` with optional `-s` / `--skills`, and uses process `cwd` (or documented worktree flags) rather than a fake `--cwd` chat flag. `healthCheck()` always returns `healthy: true` even when the binary is missing, which hides broken deployments.

Parent verify: `ms-20260725T230442Z` / `15-hermes-integration` score **7/10**. Evidence: `src/services/hermes-runner.ts` (`execHermesCli`, `healthCheck`).

## Acceptance Criteria

- AC1: Default CLI dispatch (when `HERMES_API_URL` is unset) invokes `hermes chat` with `-q` / `--query` set to the stage prompt; optional skills use `-s` / `--skills` (comma-separated or repeated) per upstream Hermes CLI docs.
- AC2: Working directory for the spawn is `request.repoPath` (spawn `cwd`); do not pass a non-existent `--cwd` flag to `hermes chat`.
- AC3: `HERMES_BIN` override still selects the binary path; existing unit tests that inject `HermesExecFn` continue to pass without requiring a live Hermes install.
- AC4: `healthCheck()` returns `healthy: false` (with clear `details`) when neither `HERMES_API_URL` nor a resolvable Hermes CLI binary is available; returns `healthy: true` only when URL is set or `which`/`where`/spawn probe succeeds.
- AC5: Unit tests cover argv shape for chat one-shot + skills, and healthCheck false when binary missing (mocked).
- AC6: `npm run typecheck` and `npm run build` pass.

## Notes

- Do not expand scope into mid-run progress streaming (separate if needed); this fix is argv + health honesty only.
- Upstream reference: [Hermes CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli) (`hermes chat -q "…"`).

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #10 open). Not merged to develop/master yet.
