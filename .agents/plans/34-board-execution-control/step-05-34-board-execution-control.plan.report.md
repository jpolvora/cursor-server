---
us: "34-board-execution-control"
reportDate: 2026-07-26
score: 7
sourcePlans: []
evalSource: step-00-34-board-execution-control.spec.md
githubSource: gh
---

# Implementation Report - 34-board-execution-control

**Generated on:** 2026-07-26
**Score:** 7/10
**Evaluation source:** `.agents/specs/34-board-execution-control.spec.md`
**Reference Plan:** (no plan artifact; spec-only FULL verify)

## Result by Feature (Plan & ACs)

| Feature | Situation | Detail / Evidence |
|---------|-----------|-------------------|
| AC1 Start API + confirm; 409 if active | **Implemented** (API) / **Not implemented** (UI) | Route `src/routes/board.ts:500-533`; `confirm: true` schema `board.ts:76-81`; service `board-execution.ts:182-205`; test `board-execution.test.ts:104-110`. **UI:** Start disabled, no confirmation dialog `ui.ts:436-438` |
| AC2 Start ensures clone, exports spec, enqueues task | **Implemented** | `startCard` `board-execution.ts:210-254`; agents `spec-to-pr` / `spec-to-pr-lite` `board-execution.ts:67-69`; test `board-execution.test.ts:112-129` |
| AC3 move 409 while active; sync-only lane updates | **Implemented** | Move lock `board.ts:475-477`; event sync `board-execution.ts:91-114`; test `board-execution.test.ts:279-298` |
| AC4 status sync maps lanes + step_label | **Implemented** | `mapProgressHint` `board-step-sync.ts:37-104`; sync hooks `board-execution.ts:91-99`; tests `board-step-sync.test.ts`, `board-execution.test.ts:258-277` |
| AC5 Pause keeps active_run_id, lane paused | **Implemented** (API) / **Not implemented** (UI) | `pauseCard` `board-execution.ts:257-297`; route `board.ts:535-554`; test `board-execution.test.ts:153-174`. **UI Pause disabled** `ui.ts:437` |
| AC6 Resume without duplicate active_run_id | **Implemented** (API) / **Not implemented** (UI) | `resumeCard` `board-execution.ts:299-341`; route `board.ts:556-575`; start-resume `board-execution.ts:189-201`. **No UI Resume menu item** |
| AC7 Finish confirm; cancel; clear run; done | **Implemented** (API) / **Not implemented** (UI) | `finishCard` `board-execution.ts:343-368`; route `board.ts:577-602`; test `board-execution.test.ts:202-224`. **UI Finish disabled** `ui.ts:438` |
| AC8 Failed runs visible as blocked / failed pill | **Implemented differently** | Backend maps failed → `blocked` `board-step-sync.ts:45-47`; test `board-execution.test.ts:258-277`. UI shows generic `"run active"` badge only (`ui.ts:477-481`) — no distinct failed pill |
| AC9 `GET /board/cards/:id/status` | **Implemented** | Route `board.ts:604-623`; `getCardStatus` `board-execution.ts:370-401`; test `board-execution.test.ts:226-256` |
| AC10 Safe error messaging (no token leak) | **Implemented** | Shared `resolveSecretRef` + `sanitizeCloneError`; start/clone paths return safe 400/500 |
| AC11 route/unit tests + build | **Implemented** | 8 execution tests pass; typecheck + build OK. Gaps: HTTP resume route untested; lite workflow start not asserted; start-on-paused HTTP path untested |

## Additional Features Beyond Original Plan

| Feature / Extra Behavior | Location in Code | Note |
|--------------------------|------------------|------|
| Start-on-paused resume via same endpoint | `board-execution.ts:189-201` | Returns `resumed: true` |
| Tenant-scoped execution | `board.ts:510-511` | Matches board ACL |

## Gaps and Next Steps

1. **Wire UI execution menu** (`src/routes/ui.ts`): enable Start/Pause/Finish; add Resume; Start dialog with `workflow`, `flags`, `model`, and `confirm: true`.
2. **Failed-run UX**: distinct status pill when task status is `error`/`failed` (use `GET /board/cards/:id/status` or enrich list payload).
3. **Tests**: HTTP route tests for `/resume`; assert `spec-to-pr-lite` agent on lite start; UI smoke for execution actions once wired.
4. README claims Start/Pause/Finish on `/ui/board` — align docs or ship UI wiring.
