---
us: "34-board-execution-control"
reportDate: 2026-07-26
score: 9
sourcePlans: []
evalSource: step-00-34-board-execution-control.spec.md
githubSource: gh
---

# Implementation Report - 34-board-execution-control

**Generated on:** 2026-07-26 (re-verify after PR #31 merge)
**Score:** 9/10
**Evaluation source:** `.agents/specs/34-board-execution-control.spec.md`
**Reference Plan:** (no plan artifact; spec-only FULL verify)

## Result by Feature (Plan & ACs)

| Feature | Situation | Detail / Evidence |
|---------|-----------|-------------------|
| AC1 Start API + confirm; 409 if active | **Implemented** | API: `board.ts:500-533`, `confirm: true` schema `board.ts:76-81`. UI: Start modal + `confirm: true` payload `ui.ts:291-315,667-751` (merged PR #31) |
| AC2 Start ensures clone, exports spec, enqueues task | **Implemented** | `startCard` `board-execution.ts:210-254`; test `board-execution.test.ts:112-129` |
| AC3 move 409 while active; sync-only lane updates | **Implemented** | Move lock `board.ts:475-477`; sync `board-execution.ts:91-114`; test `board-execution.test.ts:279-298` |
| AC4 status sync maps lanes + step_label | **Implemented** | `mapProgressHint` `board-step-sync.ts:37-104`; tests `board-step-sync.test.ts`, `board-execution.test.ts:258-277` |
| AC5 Pause keeps active_run_id, lane paused | **Implemented** | API `board-execution.ts:257-297`; UI `pauseCardRun` `ui.ts:693-703`, menu `ui.ts:521` |
| AC6 Resume without duplicate active_run_id | **Implemented** | API `board-execution.ts:299-341`; UI `resumeCardRun` `ui.ts:706-716`, menu `ui.ts:520` |
| AC7 Finish confirm; cancel; clear run; done | **Implemented** | API `board-execution.ts:343-368`; UI confirm + `finishCardRun` `ui.ts:719-731`, menu `ui.ts:522` |
| AC8 Failed runs visible as blocked / failed pill | **Implemented** | Backend `blocked` lane `board-step-sync.ts:45-47`; UI `badge failed` when `lane === "blocked"` `ui.ts:564-566` |
| AC9 `GET /board/cards/:id/status` | **Implemented** | Route `board.ts:604-623`; test `board-execution.test.ts:226-256` |
| AC10 Safe error messaging (no token leak) | **Implemented** | `resolveSecretRef` + `sanitizeCloneError` on clone/start paths |
| AC11 route/unit tests + build | **Implemented** | Execution + UI smoke tests pass; minor gaps: HTTP `/resume` route test, lite start assertion |

## Additional Features Beyond Original Plan

| Feature / Extra Behavior | Location in Code | Note |
|--------------------------|------------------|------|
| Start modal with workflow/flags/model | `ui.ts:291-315,738-751` | PR #31 |
| Contextual menu disable + tooltips | `ui.ts:519-522` | Start/Resume/Pause/Finish gated by run state |

## Gaps and Next Steps

- Add HTTP route test for `POST /board/cards/:id/resume`.
- Assert `spec-to-pr-lite` agent on lite workflow start in tests.
- Optional: poll `GET /board/cards/:id/status` for failed task status when lane is not yet `blocked`.
