---






name: ws-spec-to-pr-lite
version: 0.0.97
description: >-
  Spec-to-PR lite delivery orchestrator FSM. Fast sequential spec → plan → implement → review → ship → fix-pr.
  Invoke: /ws-spec-to-pr-lite | @[ws-spec-to-pr-lite]. Entry: GitHub issue | Azure DevOps work item | *.spec.md | plain text.
  Flags: dry-run, auto, skip-tests, full. Flags combine freely (e.g. full + auto + dry-run).
  Inline execution in main session. Dual-mode compatible with ws-spec-to-pr (shared skills, shared/config.json, shared/gates.md).
---

# Spec-to-PR Lite — Orchestrator

Sequential spec→ship using the **same** pipeline skills as [`ws-spec-to-pr`](../ws-spec-to-pr/SKILL.md). Dual-mode: [`gates.md`](../shared/gates.md) · [`config-resolution.md`](../shared/config-resolution.md) · [`setup.md`](../shared/setup.md). Do **not** use [`STEP-DISPATCH.md`](../ws-spec-to-pr/STEP-DISPATCH.md) for lite step numbers (standard 0–9 only).

## Invariants

| Topic | Rule |
|-------|------|
| Entry | Same matrix as standard (`setup.md`) — GitHub, ADO, local-spec, free-text |
| Type | `workflowType: lite` — never cross-resume with `standard` |
| Exec | Inline in main session (no subagent dispatch) |
| State | `python .agents/skills/ws-spec-to-pr-lite/scripts/update_state.py` each step; measured `--elapsed` required; missing telemetry = hygiene fail |
| Artifacts | `step-00` spec · `step-01` plan · `step-08` result (shared names with standard) |
| Commits | Code in implement/review-fix; plan+result at Step 4 G2-delivery |
| Ship / Fix-PR | Step 4 combined gate + `ws-ship-pr` (`workflowMode`, `stopBeforeFixPr`); Step 5 `ws-goal-fix-pr` / `ws-fix-pr` |
| Worktree | Branch-direct default; worktree when `plans.useWorktrees=true` |
| Fable | When `config.json.fable.enabled`: domain@1, judge@3, verify before PR@4 |

Skips interview, DAG, check-implementation, Testing vs standard.

## Steps 0–5

| Step | Label | Skill | Notes |
|------|-------|-------|-------|
| 0 | Spec | providers / `ws-write-spec` | Soft clarify if AC empty |
| 1 | Planning | `ws-write-plan` | No interview/DAG |
| 2 | Implementation | `ws-implement-tasks` build | Build+tests unless `skipTests` |
| 3 | Code Review | `ws-code-review` (+ fix if Critical/Warning) | Artifact `step-06-{slug}.review.md` |
| 4 | Ship | orch + `ws-ship-pr` | Combined delivery+ship gate |
| 5 | Fix-PR | `ws-goal-fix-pr` / `ws-fix-pr` | After PR; merge only when checks green |

**Transitions** ([`gates.md`](../shared/gates.md)): Advance (Recommended) · More options… (Previous / Repeat / Refine→Replay / Commit / Undo / Pause / Cancel). Banner: model + Pause→host→Resume. No phase soft tips.

### Step details (done when)

- **0:** `step-00-{slug}.spec.md` via [`setup.md`](../shared/setup.md) § Shared entry → gate Advance.
- **1:** `step-01-{slug}.plan.md` → Advance.
- **2:** build mode + verification → Advance.
- **3:** review file; optional fix substep (`mode=fix`) or logged skip → Advance.
- **4:** checklist `[x]`; write `step-08-{slug}.result.md` with Benchmark Total time; combined ship gate; `ws-ship-pr` inline (`workflowType: lite`); auto-run [`ws-spec-index`](../ws-spec-index/SKILL.md) `sync` → Advance when PR/skip done.
- **5:** ≥300s settle; loop until `activeThreads == 0`; `merge-pr` via scm; never delete `project.workingBranch`.

## Auto-gate defaults (`autoMode` → index 0)

| Context | Index 0 |
|---------|---------|
| Transitions | Advance |
| Step 3 fix | Apply fixes (if findings) |
| Step 4 (`fullMode`) | Commit plan+result, create PR |
| Step 4 (not full) | Skip delivery + skip shipping |
| Step 5 | Run ws-goal-fix-pr loop |

## Inline prefix

```markdown
# Inline — Step {STEP} — {Label}
Read state: `{us-dir}/{workflow-id}.state.md`
Skill: {SKILL.md path} — read full.
Orch: ws-spec-to-pr-lite · model {currentModel} · {modeFlags} · workflowType: lite · workflowMode: true
Enhancing skills (mandatory): ws-karpathy-guidelines, ws-caveman, ws-self-learning, ws-gabarito
Read: state workflow memory + decisions; MEMORY.md index; `config.json.rules.stackFile`.
Config/SCM: `.agents/skills/shared/config-resolution.md`
Anchor: uswf/{workflow-id}/before-step-{STEP} @ {sha} · CWD: {repo-root}
Role: fresh; no resume. files_touched required. model: {currentModel}.
Rules: no `{plansDir}/` in git-add except Step 4 G2-delivery; needs_user: ≥2 choices, recommended first.
End with ```step-output(...)```
```

## Triggers

```
@[ws-spec-to-pr-lite] [auto|dry-run|skip-tests|full] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md | "feature description"]
/ws-spec-to-pr-lite [flags] [US {issue_id} | {org}/{project}#{id} | {name}.spec.md | "feature description"]
```

For interview, DAG, check-implementation, or Testing: use `/ws-spec-to-pr`.
