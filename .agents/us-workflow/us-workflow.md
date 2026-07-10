---
name: us-workflow
description: >-
  E2E US orchestrator FSM (F0–F6, steps 0–12). Agent contract only — not human docs.
  Invoke: /us-workflow | @[us-workflow]. Entry: GitHub issue | *.spec.md.
  Flags: dry-run, auto, skip-integration, skip-tests. Delegates via Task tool.
disable-model-invocation: true
version: 8.5
---

## Audience & load

| Audience | Doc |
|----------|-----|
| **Orchestrator (this file)** | FSM + tool bindings + asserts |
| **Humans** | [`README.md`](README.md), [`docs/faq.md`](docs/faq.md), [`DIAGRAM.md`](DIAGRAM.md) |

**Load:** current step + linked protocols only. Stack → [`stack.md`](stack.md) (steps 5,7,9–11). Hub → [`AGENTS.md`](../../AGENTS.md). Step 2 → [`02-refine`](../skills/02-refine/SKILL.md).

## Language

**All skill content and all user-facing output: English.** No PT/PT-BR in instructions, gates, banners, or Progress Board.

## Native tool contract

Side effect = native harness tool. Never narrate undone work.

| Intent | Tool | Rule |
|--------|------|------|
| Step work | **`Task`** | `subagent_type`: `generalPurpose` \| `shell`; `description`: `US-WF step {N} — {Label}`; `readonly: true` step 6 only; **no `resume`** across steps; step 5 DAG ≤3 parallel Tasks |
| User gate | **`AskQuestion`** | ≥2 options; recommended = first; cancelled → HS-1. `autoMode` → auto-gate index 0, no AskQuestion |
| git/build/scripts | **`Shell`** | `gh`, `git`, `dotnet`, `npm`, `python .agents/us-workflow/scripts/*`; cite real output in asserts |
| `state.md` | **`Read`** + **`Write`** / **`StrReplace`** | truth source; hygiene before board |
| Search | **`Grep`** / **`Glob`** | `MEMORY.md` index; `.cursor/plans/*/*.state.md` resume |
| Browser §6 (11) | **`CallMcpTool`** `cursor-ide-browser` | only if `!autoMode && !dryRun && !skipIntegration` and gate approved; `GetMcpTools` first |
| State check | **`Shell`** | `python .agents/us-workflow/scripts/validate_state.py {workflow-id}` (optional) |
| Code in `src/` | **`Task`** Coder skill | orchestrator **never** edits — hard stop |

Subagents: use native tools for evidence; end with parseable `step-output` block.

User output: post-tool summaries + Progress Board + banners only.

---

# US Delivery Workflow — Orchestrator

Deterministic FSM; step content delegated to skills via **`Task`**.

## Invariants

| Topic | Rule |
|-------|------|
| Scope | PR/review/merge out of scope until after Step 12. No auto push. |
| Auth | G1+ needs gate. AskQuestion cancelled → HS-1. Commit → G2 + explicit menu (HS-2). |
| Isolation | Fresh `Task`/step; `Shell` tag `uswf/{id}/before-step-{N}`; worktree via `Shell` (5/10/11) or branch-direct. |
| State | Hygiene `Write`/`StrReplace` → asserts → board. Fail → HS-5. |
| Memory | `state.md` short-term (`## Workflow memory`, `## Accumulated decisions`, `## Doc consolidation log`). Root `MEMORY.md` = generalizable patterns. |
| `dryRun` | No `Write` `src/`, no commit/push/worktree/browser/MEMORY `Shell`/`Write`. Prefix `[DRY-RUN]`. |
| `autoMode` | No AskQuestion; auto-gate option 0. Prefix `[AUTO]`. HS-3/4/5 pause. No browser MCP. |
| `skipIntegration` | Skip Step 11 → `skippedSteps`+`completedSteps`, log, Step 12. |
| `skipTests` | Skip test suites in stack.md; build required. `verification.tests: skipped`. |
| Banners | `autoMode` or `dryRun` → Step Output Banner every step. |
| Revert | Workflow manifest + checkpoint only — no global `reset --hard` / `restore .`. |
| Checkpoints | Local tag `uswf/{workflow-id}/before-step-{N}` every boundary. |
| **Workflow artifacts** | **Never `git commit` `.cursor/plans/` files during Steps 0–11.** Code commits (7/10/11 fix) stage `src/`/`web/`/`tests/` only. Delivery commit at Step 12: `{slug}.plan.md` + `{slug}.result.md` only. |
| **Pause** | **Pause workflow** keeps **all** artifacts on disk (`state.md`, plans, reports, exec, dag) — no cleanup, no delete. `status: active`. |

Legacy aliases: `/us-delivery-workflow`, `@[us-delivery-workflow]`.

## Allowed deps

| Resource | Path |
|----------|------|
| Orchestrator | `us-workflow.md` |
| Stack | `stack.md` |
| Scripts | `check_memory_conflict.py`, `validate_state.py`, `github-issue-to-spec.py` |
| GitHub | `gh` CLI only |
| State | `.cursor/plans/{slug}/{workflow-id}.state.md` |
| Skills | `01-plan-us`→1 · `02-refine`→2 · `03-plan-exec-dag`→3 · `04-implement-plan`→5 build, 10/11 fix · `05-verify-sync-plan-us`→6 · `06-code-review`→9 · `07-integration-validation`→11 |
| Spec | `spec-format` |

Filesystem paths use numeric prefix; skill `name:` unprefixed. Post-12 PR: [`code-review`](../skills/code-review/SKILL.md) / [`solve-pr`](../skills/solve-pr/SKILL.md).

### Work dir `{us-dir}` = `.cursor/plans/{slug}/`

| Entry | `slug` |
|-------|--------|
| Issue `{id}` | `us-{id}` |
| `*.spec.md` | basename or frontmatter `slug:` |

State: `{us-dir}/{workflow-id}.state.md` · Canonical spec: `{us-dir}/{slug}.spec.md`.

Artifacts: `{slug}.issue.json`, `.plan.md`, `.plan.exec.md`, `.exec.dag.json`, `.plan.report.md`, `.report.md`, `.integration-test.plan.md`, `.integration-test.report.md`, **`.result.md`** (Step 12 delivery summary — committable).

**Committable workflow artifacts (Step 12 only):** `{slug}.plan.md`, `{slug}.result.md`. All other plan-dir files stay uncommitted unless user explicitly asks otherwise.

Git-ignored: `worktrees/step-{N}/`, `{workflow-id}.baseline/`, `{workflow-id}.archive/`. Never write state under `.agents/`.

---

## Phases F0–F6 ↔ steps 0–12

```mermaid
flowchart LR
  F0[F0 Bootstrap] --> F1[F1 Specification]
  F1 --> F2[F2 Implementation]
  F2 --> F3[F3 Verify + 1st Commit]
  F3 --> F4[F4 Review + Fix]
  F4 --> F5[F5 Integration]
  F5 --> F6[F6 Closure]
```

| Phase | Steps | Executor |
|-------|-------|----------|
| F0 | 0 | Orchestrator |
| F1 | 1,2,3 | Planner subagent |
| F2 | 4†,5 | Coder subagent |
| F3 | 6,7 | Verifier + orch + shell |
| F4 | 8†,9,10 | Reviewer + Coder |
| F5 | 11 | Verifier + optional browser |
| F6 | 12 | Orchestrator + shell |

† Steps **4,8** = model sub-gates — never in `completedSteps`; log `model-gate` in `## Gate history`.

| `completedSteps` | Phase done |
|------------------|------------|
| 0 | F0 |
| 1–3 | F1 |
| 5 | F2 |
| 6–7 | F3 |
| 9–10 | F4 |
| 11 | F5 |
| 12 | F6 |

## Step index (canonical labels)

| N | Label | Task? | `subagent_type` | Worktree | RO |
|---|-------|-------|-----------------|----------|-----|
| 0 | Workflow Initialization | — | — | — | — |
| 1 | Planning and Brainstorm | ✓ | GP | — | — |
| 2 | Refinement | ✓ | GP | — | — |
| 3 | Execution Plan and DAG | ✓ | GP | — | — |
| 4† | Coder Readiness | — | — | — | — |
| 5 | Implementation (DAG) | ✓ | GP | step-5‡ | — |
| 6 | Verification and Report | ✓ | GP | — | ✓ |
| 7 | Decision and First Commit | ✓ | GP+shell | — | — |
| 8† | Review Readiness | — | — | — | — |
| 9 | Code Review | ✓ | GP | — | — |
| 10 | Fixes, Second Commit and Report | ✓ | GP+shell | step-10‡ | — |
| 11 | Integration Validation and Pre-PR | ✓ | GP+shell | step-11‡ | — |
| 12 | Consolidation and Final Cleanup | ✓ | shell | cleanup | — |

‡ [Worktree Fallback](#worktree-fallback). GP = `generalPurpose`. Fixed labels for board/banners.

---

## Protocols

### Authorization Ladder

| Level | Ops | Gate |
|-------|-----|------|
| G0 | Read, RO reports | — |
| G1 | Edit WT, plans, impl (no commit) | Transition gate |
| G2-code | `git commit` **code only** (`src/`, `web/`, `tests/`) | Step 7 / 10 / 11 fix |
| G2-delivery | `git commit` **`{slug}.plan.md` + `{slug}.result.md` only** | Step 12 delivery gate |
| G3 | `git push`, PR | Step 12 consent; PR manual |

```text
HS-1: AskQuestion cancelled → STOP; re-present gate. Never infer "yes".
HS-2: Commit without explicit gate menu selection → STOP.
HS-2a: `git add` or commit any `.cursor/plans/` path during Steps 0–11 → STOP (workflow artifacts forbidden until Step 12 delivery commit).
HS-3: Mutating step success + empty files_touched → FAILED.
HS-4: Step 5/10/11 success without expected files on state.branch → FAILED.
HS-5: State Hygiene failed → STOP before Progress Board.
```
Auto: HS-3/4/5 apply; HS-1/2 N/A.

### Transition Discipline

**Normal:** N done → Hygiene → checkpoint `before-step-{N+1}` → Board → summary → Transition Gate → then dispatch N+1 (resume "continue" same turn OK).

**Auto:** auto-gate + dispatch N+1 same turn.

**Forbidden:** mutating step or commit without gate.

### Refinement FSM (Step 2)

2a/2b/2d → `02-refine`. Orch: 2c Escalate, 2e Shared Understanding, redispatch.

| State | Owner | Output |
|-------|-------|--------|
| 2a Audit | refine | `gap_registry[]` by design-tree |
| 2b Resolve | refine | Close with evidence; codebase before escalate |
| 2c Escalate | orch | AskQuestion — **one** question; max 3 rounds; always **End refinement and advance** |
| 2d Exit | refine | §8 empty or `assumed-default`; `shared_understanding: pending` |
| 2e Shared Understanding | orch | **I confirm shared understanding — advance to Step 3** / **Continue refinement** |

Rules: multiple `needs_user` → one by design-tree priority. **End refinement** → log `assumed-default`, gate 2e (not Step 3). Block Step 3 if `refine.shared_understanding !== confirmed`.

### Worktree Fallback

```text
dryRun → no worktree
win32 OR path>180 OR git worktree add fails → branch-direct (log ## Gate history)
else → step-worktree
```

branch-direct: edits on `state.branch`; subagent `wip(us-{id}): step-{N}` or dirty WT. Post-step 5/10/11: files exist, expected diff, build/tests per stack.md.

### State Hygiene

After step N, before board. `Read` → `Write`/`StrReplace` → `Glob` asserts. Fail → HS-5.

```yaml
- Append ## Step outputs ### Step N
- Merge files_touched → ## Step file log ### Step N
- Recompute workflowManifest; update completedSteps, stepStatus, currentStep
- Append stepDispatches; commits[] if commit
- Assert created paths exist; currentStep = next gate
- Step 2: ## Refinement registry
```

### Model Readiness Sub-gates

Log: `model-gate | F1→F2|F3→F4 | current | recommended | choice | ISO`.

F1→F2 (after 3): **Confirm switch to Coder model and advance** (rec) / **Continue with current model** / repeat / back / pause.

F3→F4 (after 7): same; recommended = Reviewer/thinking. Tags `before-step-5`, `before-step-9` at transitions.

### Step Dispatch & Isolation

Orchestrator calls **`Task`** — never inline step impl.

```yaml
Task:
  subagent_type: generalPurpose | shell
  description: "US-WF step {N} — {Label}"
  readonly: true   # step 6 only
  run_in_background: false   # step 5: ≤3 parallel, same worktree, no file overlap
  # resume: FORBIDDEN across steps
```

Anchor (`Shell` tag): `uswf/{workflow-id}/before-step-{N} @ {sha}`. Worktree 5/10/11 via `Shell`: `worktree add` → merge → `worktree remove` → `branch -d`. Max 1 active. Audit: `Write` `stepDispatches[]`. No per-DAG-task worktree.

### Memory Consultation

Every step start: read state `## Workflow memory`, `## Accumulated decisions`, `## Doc consolidation log`; grep `MEMORY.md` index for scope; optional `check_memory_conflict.py` (2,3,5,9,10); log in `step-output.learning`.

### Specification Protocol

[`spec-format`](../skills/spec-format/SKILL.md). Downstream reads `{us-dir}/{slug}.spec.md` — never GitHub API or `*.issue.json`.

| Input | Mode |
|-------|------|
| `{n}` or `US {n}` | github → `slug=us-{n}` |
| `*.spec.md` | local-spec |

```bash
gh issue view {id} --json number,title,body,state,labels,assignees,comments,url > {us-dir}/{slug}.issue.json
python .agents/us-workflow/scripts/github-issue-to-spec.py --input ... --output {us-dir}/{slug}.spec.md
```

No authenticated `gh` → STOP (no inline REST). Read-many via `## Artifacts.specSnapshot`.

### Build & Test Validation (7, 10)

Before G2-code commit: [stack.md](stack.md) → build (+ tests unless skip) → Coder fix loop. Stage **only** `src/`, `web/`, `tests/` paths — never `.cursor/plans/`. `skipTests`: `verification.tests: skipped`.

### Integration Validation (11)

`07-integration-validation` via **`Task`**.

| Flag | Effect |
|------|--------|
| `skipIntegration` | no Task; Write skip → step 12 |
| `autoMode` \| `dryRun` | Task without browser; §6 skipped in report |
| normal + gate | `CallMcpTool` cursor-ide-browser |

Gates (normal): **Approve and run test battery** (rec) / **Run without browser** / **Adjust test plan** / **Skip validation** / **Pause workflow**.

Failure (max 3): **Apply fixes and revalidate** (rec) / **Accept with reservations** / **Re-run without fixes** / **Pause**. Fix: G2-code commit only (`src/`/`web/`/`tests/`).

### Workflow Artifact Commit Protocol

| When | Allowed in commit |
|------|-------------------|
| Steps 0–11 | **Code only** under `src/`, `web/`, `tests/` at Steps 7, 10, 11 fix |
| Steps 0–11 | **Forbidden:** `.cursor/plans/**`, `*.plan.exec.md`, `*.exec.dag.json`, `*.report.md`, `*.plan.report.md`, `*.integration-test.*`, `*.state.md`, `*.issue.json` |
| Step 12 | **`{slug}.plan.md`** (checkmarks updated) + **`{slug}.result.md`** — delivery commit via G2-delivery gate |
| Pause | No commit required; **no delete** of any workflow file |

Orchestrator `git add` must be path-scoped — never `git add .` on steps 7/10/11.

### Delivery Result Protocol (Step 12 — before delivery commit)

1. **`Read`** sources: `{slug}.spec.md`, `{slug}.plan.md`, `{slug}.plan.report.md`, `{slug}.report.md`, integration report if exists, `## Open items` in state.
2. **`Write`** `{us-dir}/{slug}.result.md` — brief English summary:

```markdown
# {slug} — Delivery Result

## Expected
<!-- from spec ACs + plan scope (1–3 short paragraphs max) -->

## Done
<!-- from verify report + delivery report + completed DAG tasks (factual, brief) -->

## Next steps
<!-- open items, reservations, manual follow-ups before PR -->

## References
- Spec: {specPath}
- Plan: {slug}.plan.md
- Verify: {slug}.plan.report.md
- Delivery: {slug}.report.md
```

3. **Update plan checkmarks:** in `{slug}.plan.md`, mark completed tasks/ACs/checklist items `[x]` per verify report, `completedTasks`, and `completedSteps` ≥5. Use `StrReplace`/`Write`; preserve plan structure.
4. Register `resultSnapshot` in state `## Artifacts`.
5. **G2-delivery gate** → `Shell` stage only `{slug}.plan.md` + `{slug}.result.md` → `git commit -m "docs({slug}): delivery plan and result"`.
6. Log `step-12-delivery-commit | {sha}` in `## Gate history` and `commits[]`.

`dryRun`: write/simulate result + plan edits; no real commit.

### Optional Artifact Cleanup Protocol (Step 12 — after delivery commit)

**Only when workflow completes (`status: completed`) and user explicitly chooses cleanup** — never on **Pause workflow**.

**Gate 1 option "Yes — consolidate…" or dedicated cleanup ask:**
- **Delete temporary artifacts** (rec if user wants lean repo) — `{slug}.plan.exec.md`, `.exec.dag.json`, `.issue.json`, `.plan.report.md`, `.integration-test.*.md`, worktrees, baseline, archive, checkpoint tags
- **Keep all artifacts on disk** (rec if user may re-open or audit) — no delete

**Pause / `status: active`:** skip cleanup entirely; all files remain for resume.

### Learning Protocol

`MEMORY.md` = generalizable technical patterns only. Per-step learning → state; promote if generalizable, technical, non-duplicate, concise. Sections: Patterns, Traps, Review Patterns + Index. Step 12 sweep. `dryRun`: never edit MEMORY.

### Step Output Banner

When `autoMode` or `dryRun`, before and after each step:

```markdown
[AUTO] [DRY-RUN] **Starting step {N} {Label}**
[AUTO] **Finished step {N} {Label}**
```

Step 5: one pair per whole step. Print **Finished** on hard stop too.

### Automatic Mode

Parse: `auto` + combinable `dry-run`, `skip-integration`, `skip-tests`, US/spec entry. Also accept legacy `automatico`/`automático` as `auto` flag aliases in input parsing only.

Resume: active `autoMode` same US → continue `currentStep`; else new `workflow-id`, ignore other actives.

| Context | Auto choice (index 0) |
|---------|----------------------|
| Transition 0–6, 9–10 | **Advance to Step N+1** |
| Model sub-gate | **Continue with current model** |
| Step 2 needs_user | first option; early → **End refinement and advance** → 2e |
| Step 2e | **I confirm shared understanding — advance to Step 3** |
| Step 7 | **Approve, validate build/tests and commit code** |
| Step 11 skipIntegration | skip step |
| Step 11 plan | **Approve and run test battery without browser** |
| Step 11 failure | **Apply fixes and revalidate** |
| Step 12 delivery | **Commit plan and result** |
| Step 12 cleanup | **Keep all artifacts on disk** (default safe) or delete temps per gate |
| Step 12 §Doc | **Nothing to update / Skip** |
| Step 12 push | **Do not push now** |

Log `auto-gate | step {N} | {choice} | ISO`. Disabled: backward/repeat/pause menus; Step 3 without shared understanding.

### Checkpoints

Tag `uswf/{workflow-id}/before-step-{N}` = HEAD before step N first mutation. `before-step-1` = `baselineCommit`. Mirror in `checkpoints[]`. Delete on Step 12/reset. Dry-run: log intent only.

### Progress Board

Render: bootstrap/resume; after each step (post-hygiene, pre-gate); pause; `/status`; Step 12 final.

```markdown
## Progress — US {us} (`{workflowId}`)
**Status:** … | **Phase:** {Fx} | **Step:** {N} — {label} | **Branch:** `{branch}` | **Mode:** …

### Pipeline — Phases
- [x] F0 Bootstrap · [ ] F2 Implementation ← **next** …

### Steps (0–12, omit 4/8)
- [x] 0 · [x] 1 · … · [ ] 5 ← **next** …

### Refinement _(Step 2 active only)_
Round {r}/3 · blocking: {n}

### Step 5 DAG _(if applicable)_
- [x] T1 — …
```

Suffixes: `← next` · `⏭ skipped` · `↻ repeating` · `⏮ reopened`. Auto/dry-run: Finished banner → compact board → auto-advance.

### Safe Revert

Revert = workflow manifest to checkpoint M. Doubt → list paths, do not revert.

**Forbidden:** global `reset --hard`, `checkout -- .`, `restore .`, `clean -fd`, `stash` mask, paths outside manifest, push `uswf/*` tags.

Bootstrap: `baselineCommit`, `preExistingDirty[]` (`Shell` `git status --porcelain`), backup overlap `{workflow-id}.baseline/`.

**Checkpoint Revert (M):** resolve SHA → build `revertSet` from step log ≥M → `reset --mixed` → per-path restore → remove worktrees ≥M → truncate state <M → verify `preExistingDirty`. Preview: **Will be undone** vs **Will be preserved**. Full reset M=1 + new workflow-id. Backward nav: chosen M + redispatch. Repeat N: M=N if partial.

### Backward Navigation

Gate **Go back to earlier step** or Step 7 shortcut M=5. Targets: Task steps 1–3,5–7,9–11 in `completedSteps`. Sub-menu by phase (≤4): Planning / Implementation / Review / Validation → confirm → algorithm → redispatch M. Log `backward-nav | from | to | ISO`. Disabled in auto.

---

## State & dispatch

### `state.md` YAML

```yaml
workflowId, slug, us, specSource, specPath
startedAt, endedAt, status: active|completed|cancelled|failed
currentStep, dryRun, autoMode, skipIntegration, skipTests
branch, baselineCommit, preExistingDirty: []
checkpoints, workflowManifest, commits: [{sha, step, message}]
completedSteps, stepStatus, skippedSteps, completedTasks, stepDispatches
refineRound, currentModel, recommendedModel
```

Sections: Workflow baseline, manifest, Step file log, Refinement registry, Context, Artifacts, Step outputs, Workflow memory, Accumulated decisions, Doc consolidation log, Open items, Gate history.

### Resume / reset

**Auto:** skip Active Resume; use auto resume policy.

**Normal:** `Glob` active states → AskQuestion: **Check and continue active workflow** (rec) / **Undo all and restart** / **Start new workflow anyway** / **Cancel for now**.

**Full reset:** Checkpoint Revert M=1 → gate **Start again** (new workflow-id) / **Exit**.

### Base Prompt Prefix (`Task` body)

```markdown
# Subagent — Step {STEP} — {Label}
Read state: `.cursor/plans/{slug}/{workflow-id}.state.md`
Skill: {SKILL.md path} — read full; primary step content.
Orch mechanics: us-workflow.md § Step {STEP}
Anchor: uswf/{workflow-id}/before-step-{STEP} @ {sha}
CWD: {repo-root | worktree}
Role: {generalPurpose | shell} — fresh; no resume.
LLM: align with {currentModel}.
Read: state workflow memory sections; MEMORY.md index (scope); stack.md.
dryRun: no commits/push/worktree/edits. autoMode: needs_user → first option in payload.
Never git-add `.cursor/plans/` except Step 12 G2-delivery ({slug}.plan.md + {slug}.result.md).
Report files_touched — required for revert.
needs_user: multiple-choice, ≥2 options, recommended first — no free text.
End with ```step-output block (status, step, artifacts, files_touched, verification, refine, summary, evidence, decisions, doc_consolidation, needs_user, errors, retry_hint, learning)
```

### Transition Gates

Post-step: hygiene → checkpoint (`Shell` tag) → board → gate.

| Mode | Tool |
|------|------|
| auto | auto-gate table → immediate `Task`/`Shell` |
| normal | **AskQuestion** 4 options → `Task` same turn after answer |

**AskQuestion (normal):**
- **Advance to Step N+1** (rec)
- **Repeat Step N** — revert M=N if partial → `Task`
- **Go back to earlier step** → [Backward Navigation](#backward-navigation)
- **Pause or cancel workflow** → **Pause workflow** (rec on uncertainty — **keeps all artifacts**, `status: active`) / Cancel without revert / Cancel and revert all

Step 11: **Skip validation**. Step 2: gate 2e before Step 3.

---

## Step instructions

| Step | Action | Artifact |
|------|--------|----------|
| 0 | Parse flags+entry; auto resume policy or Active Resume; Spec Protocol; baseline+`before-step-1`; board; gate→1 | `completedSteps: [0]` |
| 1 | `Task` `01-plan-us` + specPath | `{slug}.plan.md` |
| 2 | `Task` `02-refine`; FSM 2c/2e; block Step 3 until 2e confirmed | plan in-place |
| 3 | `Task` `03-plan-exec-dag`; memory-conflict first | `.plan.exec.md`, `.exec.dag.json` |
| 4† | Model sub-gate F1→F2 in post-3 gate | not in completedSteps |
| 5 | `Task` `04-implement-plan` mode build; worktree; DAG ≤3/level; HS-3/4 | verification |
| 6 | `Task` `05-verify-sync-plan-us` readonly | `.plan.report.md` |
| 7 | AskQuestion G2-code → Shell build/test → `git commit` code only `feat(us-{id}): US {id} implementation` | step-7-commit; no `.cursor/plans/` |
| 8† | Model sub-gate F3→F4 post-7 | not in completedSteps |
| 9 | `Task` `06-code-review`; scoped diff stack.md; detect only | score ≥6 or "No feedback" |
| 10 | `Task` `04-implement-plan` mode fix; G2-code only; `.report.md` on disk uncommitted | HS-3/4 |
| 11 | skipIntegration→Write skip; else `Task` integration-validation; browser if gated | reports on disk uncommitted |
| 12 | [Delivery Result Protocol](#delivery-result-protocol-step-12--before-delivery-commit) → G2-delivery commit → optional [cleanup](#optional-artifact-cleanup-protocol-step-12--after-delivery-commit) | `{slug}.result.md`, `status: completed` |

Post-mutating step: merge files_touched → Step file log; backup preExistingDirty; checkpoint `before-step-{N+1}`.

### Step 12 gates & cleanup

**Order:** Delivery Result Protocol (result.md + plan checkmarks) → **G2-delivery commit** → Gate 1 → optional cleanup → §Doc → push consent.

**Gate delivery (G2-delivery):**
- **Commit plan and result** (rec) — stage `{slug}.plan.md` + `{slug}.result.md` only
- **Skip delivery commit** — leave plan/result uncommitted (warn)

**Gate 1:**
- **Yes — consolidate documentation and clean temporaries** (rec) — MEMORY sweep + **optional delete** temp artifacts ([cleanup protocol](#optional-artifact-cleanup-protocol-step-12--after-delivery-commit))
- **Consolidate documentation only** — no file delete
- **Skip and finish without consolidating**

**Gate 2 §Doc (if consolidating):**
- **Update now** — gate-approved pending MEMORY + Index
- **Nothing to update / Skip**

**Cleanup:** only after user opts in at Gate 1; **never** if they paused earlier. `Shell` delete list: `.plan.exec.md`, `.exec.dag.json`, worktrees, tags, etc. — **never** `{slug}.plan.md`, `{slug}.result.md`, `{workflow-id}.state.md` while `status: active`.

Push consent default **Do not push now** — PR manual; tags never pushed.

---

## Error policy

Retry: max 3; backoff 0s→30s→60s. Revert: Checkpoint Algorithm only. Conduct: 4/8 no Task; orch never implements code; fresh Task/step; max 1 worktree; G2-code steps 7/10/11; G2-delivery step 12; HS-2a blocks plan-dir commits mid-workflow.

## Triggers

```
@[us-workflow] [auto|dry-run|skip-integration|skip-tests] {us_id|*.spec.md}
/us-workflow [flags] US {issue_id} | {name}.spec.md
/status | progress | where am I? → Progress Board only
go back | change plan | back to step X → Backward Nav (not in auto)
```

Combinable flags. Example: `/us-workflow auto skip-tests skip-integration US 1234`
