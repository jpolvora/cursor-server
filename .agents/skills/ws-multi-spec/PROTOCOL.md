# `ws-multi-spec` — Protocol & Master Loop FSM

Master loop specification for smart multi-spec batch delivery.

## Master Loop Phases (1–6)

```mermaid
flowchart TD
  P1[1 Entry / Resume] --> P2[2 Scan & Init Queue]
  P2 --> P3[3 Select Next Spec]
  P3 -->|End of Queue| P6[6 Final Report]
  P3 -->|Item Selected| Probe{Already Implemented?}
  Probe -->|Yes| P5[5 Record Outcome - Skipped]
  Probe -->|No| FlowDetect{Smart Flow Auto-Detection}
  FlowDetect -->|Low Complexity| DispatchLite[Dispatch ws-spec-to-pr-lite Worker]
  FlowDetect -->|High Complexity| DispatchFull[Dispatch ws-spec-to-pr Worker]
  DispatchLite --> WorkerOutcome
  DispatchFull --> WorkerOutcome
  WorkerOutcome{Worker Result} -->|Success| ConvergeGate{PR merged + threads 0 + checks green?}
  WorkerOutcome -->|Failure| PauseGate[Pause Gate: Resume / Skip / Abort]
  ConvergeGate -->|No| RunGoalFixPr[Dispatch ws-goal-fix-pr + merge via SCM provider]
  RunGoalFixPr --> ConvergeGate
  ConvergeGate -->|Yes| P5[5 Record Outcome - Merged & Shipped]
  PauseGate -->|Resume| FlowDetect
  PauseGate -->|Skip| P5
  PauseGate -->|Abort| P6
  P5 --> P3
```

### Phase 1: Entry / Resume
- Parse raw arguments:
  - Existing state file (`{plansDir}/ws-multi-spec/*.state.md`) → load state, skip scan, continue at first non-terminal item (unmerged PR rows re-enter Phase 4b convergence gate).
  - Explicit spec list (`*.spec.md` paths) → construct new run queue with items marked `pending`.
  - No arguments → proceed to Phase 2 (Blank-list scan).

### Phase 2: Scan & Init Queue
- Resolve `{specsDir}` from `config.json` → `plans.specsDir` (default `.agents/specs`).
- `Glob` `{specsDir}/**/*.spec.md` (excluding non-spec files).
- Present `user-gate` multi-select gate to the user with sorted spec paths.
- Generate `runId` (`ms-{YYYYMMDDTHHMMSSZ}`).
- Write initial run state file at `{plansDir}/ws-multi-spec/{runId}.state.md`.

### Phase 3: Select Next Spec & Flow Auto-Detection
- Find the next item with `status: pending` or `status: in_progress`.
- If no more pending items remain → proceed to Phase 6 (Final Report).
- Run the already-implemented probe (see [`STATE.md`](STATE.md)).

#### Smart Flow Auto-Detection Logic
Evaluate the target `*.spec.md` file:
1. **Explicit Frontmatter**: Check frontmatter `complexity:` or `flow:` field if present (`lite` / `fast` / `standard` / `full`).
2. **Threshold Scan**:
   - Count sections / requirements / tasks / files in spec.
   - If implementation tasks ≤ 3 AND estimated files ≤ 6 AND layers ≤ 2 (matching `config.json.dagThresholds` limits) → select **`ws-spec-to-pr-lite`**.
   - Otherwise → select **`ws-spec-to-pr`** (full standard orchestrator).
3. Log selected `flowMode` (`lite` or `standard`) into the item state row.

### Phase 4: Dispatch Worker
- Mark state item `status: in_progress`, `flowMode: {lite|standard}`. Update state file `updatedAt`.
- Dispatch subagent via `dispatch-agent`:
  - `description: "ws-multi-spec worker [{flowMode}] — {slug}"`
  - Command: if `flowMode == lite`: `/ws-spec-to-pr-lite full auto {specPath}` else: `/ws-spec-to-pr full auto {specPath}` (pass `dryRun` if set).
- Await completion or worker exit `step-output`.

### Phase 4b: Delivery Convergence & PR Merge Verification
- Read worker `step-output` and query SCM provider (`gh` CLI / ADO API):
  1. Check if PR was created (`prNumber` / `prUrl`).
  2. Verify PR thread status: `activeThreads == 0` (via `list-threads`).
  3. Verify required CI / automated code-review checks are green.
  4. Verify PR is merged (`merged: true`).
- If worker exited after PR creation without completing thread resolution or merge:
  - Master dispatches [`ws-goal-fix-pr`](../ws-goal-fix-pr/SKILL.md) for `<prNumber>` to wait 30s for code-review actions, poll checks, and resolve review threads until `activeThreads == 0`.
  - Once threads are 0 and checks green, merge PR via SCM provider [`ws-ship-pr`](../ws-ship-pr/SKILL.md) merge step.
- **Strict Block:** Master orchestrator MUST NOT dispatch the next spec worker until the current spec PR is fully merged (`merged: true`, `activeThreads == 0`).
- If convergence fails (max iterations, checks red, escalation): mark item `status: failed` and present Phase 5 `user-gate` failure menu.

### Phase 5: Record Outcome
- Update state item:
  - On full merge convergence: set `status: shipped`, `merged: true`, `activeThreads: 0`, `prNumber`, `prUrl`, `updatedAt`.
  - On failure or unresolvable PR state: mark item `status: failed`, present `user-gate` failure menu:
    - **Resume (Recommended):** Re-dispatch worker or convergence gate for same spec.
    - **Skip:** Mark item `status: skipped`, record `reason`, proceed to next item.
    - **Abort run:** Mark run state `status: paused`, exit loop to Phase 6.

### Phase 6: Final Report
- Summarize run metrics (total items, shipped & merged, skipped, failed, flow mode breakdown).
- Set overall run state `status: completed` (or `status: paused` if aborted).
- Present summary report to the user.

## Dependency Matrix

| Need | Source |
|------|--------|
| Per-spec Standard FSM | [`../ws-spec-to-pr/SKILL.md`](../ws-spec-to-pr/SKILL.md) |
| Per-spec Lite FSM | [`../ws-spec-to-pr-lite/SKILL.md`](../ws-spec-to-pr-lite/SKILL.md) |
| PR Delivery & Checklist | [`../ws-ship-pr/SKILL.md`](../ws-ship-pr/SKILL.md) |
| Thread Convergence Loop | [`../ws-goal-fix-pr/SKILL.md`](../ws-goal-fix-pr/SKILL.md) |
| State schema & probe | [`STATE.md`](STATE.md) |
| Usage examples | [`EXAMPLES.md`](EXAMPLES.md) |
