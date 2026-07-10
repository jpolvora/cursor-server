---
name: plan-exec-dag
description: Breaks an implementation plan (*.plan.md) into atomic tasks with files, acceptance criteria, and coderPrompt, organized in topological DAG levels for safe parallel execution.
version: 1.1
disable-model-invocation: true
---

# plan-exec-dag — cursor-server

Transforms a `*.plan.md` (ideally post-`refine`) into atomic tasks + dependency DAG for [`implement-plan`](../04-implement-plan/SKILL.md).

## Input

Path to `*.plan.md`. If missing, ask.

## Steps

1. Read the plan — focus on step-by-step implementation and AC matrix.
2. Break into atomic tasks (`T1`, `T2`, …), each with:
   - `id`, `title`, `files` (exact paths, no wildcards)
   - `dependsOn`, `acceptance`, `coderPrompt`
   - Reference real repo files (e.g. `src/services/agent-runner.ts`, `src/routes/tasks.ts`)
3. Build topological **levels** — max 3 concurrent tasks per level; **no file overlap** within a level.
4. Do not assign worktrees — executor handles isolation.

## Output

### `*.plan.exec.md`
Human-readable task list + level table.

### `*.exec.dag.json` example

```json
{
  "targetModel": "coder",
  "tasks": [
    {
      "id": "T1",
      "parallelGroup": null,
      "dependsOn": [],
      "files": ["src/services/task-queue.ts"],
      "acceptance": "Service exports enqueue function with Zod-validated input",
      "coderPrompt": "Create task-queue.ts following agent-runner.ts patterns: typed input, clear errors, no route logic.",
      "title": "Add task queue service stub"
    }
  ],
  "levels": [["T1"], ["T2"]]
}
```

File naming: `us-{id}.plan.exec.md` / `us-{id}.exec.dag.json` under `.cursor/plans/us-{id}/`, or basename of standalone plan.

## Conduct

- **Do not implement code** — decompose only.
- Follow [`senior-developer/SKILL.md`](../senior-developer/SKILL.md) for layer placement (`routes/` vs `services/` vs `jobs/`).
- If plan is too vague for precise `coderPrompt`, report gap — do not guess.

## Triggers

- `@[plan-exec-dag] path/to/plan.md`
- `us-workflow` Step 3
