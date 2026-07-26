---
id: null
slug: 30-fix-cursor-runner-timeout-cancel
title: "Fix Cursor SDK harness runner timeout cancellation"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix Cursor SDK harness runner timeout cancellation

## Description

`LocalCursorRunner` / Cursor SDK harness path uses a timeout race but does not cancel the in-flight `runPromise` when the timeout wins, leaving work running and risking leaks (related MEMORY: Promise.race timer hygiene). Verify for `13-runner-cursor-sdk` scored **8/10** with this gap.

Parent verify: `.agents/plans/13-runner-cursor-sdk/step-05-13-runner-cursor-sdk.plan.report.md`. Evidence: `src/services/harness-runner.ts` timeout path.

## Acceptance Criteria

- AC1: When stage execution exceeds the configured timeout, the runner returns a failed/error `StageOutput` with a clear timeout message **and** attempts to cancel/dispose the in-flight Cursor agent run (AbortSignal, `agent` dispose, or documented SDK cancel API — use whatever `@cursor/sdk` supports; cite in Notes if only best-effort kill).
- AC2: Timeout timers are always cleared in `finally` (no leaked long timers on reject paths) — align with MEMORY Promise.race guidance.
- AC3: Losing run promise must not cause unhandledRejection (attach `.catch(() => {})` or equivalent when timeout wins).
- AC4: Unit test simulates a hung run + short timeout and asserts terminal StageOutput + cleanup; `npm run typecheck` / `npm run build` pass.

## Notes

- Read current Cursor SDK skill / package types before inventing cancel APIs.
- Apply the same pattern to Hermes/OpenCode runners if they share a helper — keep diff surgical.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #19 open). Not merged to develop/master yet.
