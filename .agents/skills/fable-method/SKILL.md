---
name: fable-method
description: >
  Step-by-step problem-solving loop with triviality & fit gates (classify ask, define done,
  gather evidence from primary sources, decide, act surgically, verify by observation, report outcome-first).
  Use when invoked via /fable-method or when approaching complex/trap-prone tasks without full spec-to-pr ceremony.
upstream: jpolvora/workflow-skills — improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.0
invocation_names:
  - fable-method
  - /fable-method
---

# Fable Method (`fable-method`)

A structured problem-solving loop designed to maximize accuracy, prevent silent failures, and catch traps. Quality lives in structure, evidence, and honesty—not in model scale alone.

Follow this loop literally. The steps structure your execution; do not output step headers or step numbers to the user unless explicitly requested.

## Subcommands

```
/fable-method <task>       Full 7-step loop (default)
/fable-method plan <task>  Steps 0–3 only: Classify, Define Done, Gather Evidence, deliver plan, stop
/fable-method audit        Audit finished work against the loop using fable-judge
/fable-method report       Format output outcome-first with honest caveats
```

---

## Pre-Execution Gates

### 1. Triviality Gate (Run First)
A task is **trivial** only if **ALL** of the following are true:
- Touches exactly **1 file**
- Modifies **< 10 lines** of code
- Adds **no new behavior** or architecture changes
- Solution is already known without searching or inspecting external docs

**If trivial:** Make the change, verify with one direct command or check, and report in 1–2 sentences.
**If non-trivial or unsure:** Run the full loop.

### 2. Fit Gate (Run Next)
Locate where the ground truth lives before touching anything:
- **In reachable sources** (files, repo, docs, logs): Run the 7-step loop (default).
- **In an unlearned technique**: Spend Step 2 lookup budget first, then run the loop.
- **Only in your own inference**: State this explicitly. Flag answer as low-confidence. Do not dress guesses as rigorous findings.
- **In a specialized recurring domain**: Use or generate a domain adapter via `fable-domain`.

---

## The 7-Step Loop

```
 ask ─► 0 Classify ─► 1 Define Done ─► 2 Evidence ─► 3 Decide ─► 4 Act ─► 5 Verify ─► 6 Report
        (Shape)      (Named check)    (Primary)    (1 Rec)     (Surgical) (Observed)  (Honest)
```

### Step 0 — Classify the Ask

Determine the shape of the ask to select the correct deliverable:

| Shape | Signal | Deliverable |
|---|---|---|
| **Question / Assessment** | "why is...", "what do you think of...", user asks for analysis | Findings and one recommendation. Change no code/files. |
| **Task** | "fix", "build", "change", "add feature" | The completed, verified change. |
| **Plan-First** | Ambiguous scope, destructive/irreversible actions, or explicit request for a plan | Detailed plan with named verifications. **STOP and wait for user approval.** |

**Tie-breakers:**
1. If plan-first signals exist (ambiguity or destructive action), plan-first wins over task.
2. Unsure between task and plan-first? Default to **plan-first**.

### Step 1 — Define Done

State in 1–2 sentences what "done" looks like and how it will be verified **before starting work**:
- **Task:** Name a concrete observation (e.g., test X passes, build command succeeds, log line matches Y).
- **Question / Assessment:** Every finding cites a specific file, line number, or command output.
- **Plan-First:** Plan artifact created with named verifications for each step.

### Step 2 — Gather Evidence

1. **Orient First:** Enumerate directory structure and glob files before reading specific paths. Do not guess file locations from memory.
2. **Primary Sources Beat Recall:** Read actual files, code, and live outputs. For library APIs, read official docs or installed source; if relying on memory, label it explicitly.
3. **Parallelize Independent Lookups:** Batch independent file reads, doc fetches, and searches into one tool call.
4. **Search Narrow, Do Not Re-read:** Locate target sections with grep/search; do not re-fetch files already in context.
5. **Lookup Budget:** Stagger searches in maximum 2 lookup rounds. If missing after 2 rounds, stop and state missing context.

### Step 3 — Decide

Commit to **one primary recommendation**.
- Do not hedge with multiple contradictory options without picking one as recommended.
- Define a surgical blast radius (minimum necessary files to touch).

### Step 4 — Act

- Apply surgical edits matching the decision in Step 3.
- Do not perform drive-by refactoring, reformatting, or style changes outside the target scope.
- Max retries: If execution fails 3 times on verification, **STOP** and report findings/blockers.

### Step 5 — Verify

- Verification must be **observed by execution or diffing**, never assumed.
- Re-run test/build/script commands and inspect live stdout/stderr.
- Verify `git diff` matches intended scope and introduces no unintended side effects.

### Step 6 — Report

Deliver output in **Outcome-First** structure:
1. **Outcome:** What succeeded or failed in the first paragraph.
2. **Evidence & Observations:** Command outputs, diff summaries, file links.
3. **Honest Caveats:** List any low-confidence inferences, unverified edge cases, or skipped steps.

---

## Language & Harness Constraints

- **Language:** en-us only.
- **Config & Paths:** Use `{plansDir}` (default `.agents/plans`), `{sharedDir}`, `{skillsRoot}`. Parameterize via `shared/config.json`.
