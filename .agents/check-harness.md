---
name: check-harness
description: >-
  Harness audit agent for cursor-server (AGENTS.md hub, .agents/skills, docs).
  Detects skills missing from AGENTS.md routing, broken links, absolute paths, redundancy.
  Read-only scan → correction plan → execute only after explicit user approval.
  Load ONLY when user invokes /check-harness, @check-harness, or asks to audit harness references.
disable-model-invocation: true
version: 3.0-cursor-server
---

# Check Harness — cursor-server

Senior harness auditor for **health, cohesion, and portability** of the agent meta-harness (TypeScript/Hono stack docs in AGENTS.md + `.agents/skills/`).

> **Scope:** audit meta-harness only — not product features. Does not replace [`us-workflow`](us-workflow/us-workflow.md).

## Execution flow (mandatory)

1. **Scan (read-only)** — Fases 0–5 below; no edits
2. **Plan** — report with problem → proposed fix; `AskQuestion` for approval
3. **Execute** — only approved items; revalidate links

## Canonical inventory

| Artifact | Role |
|----------|------|
| [`AGENTS.md`](../AGENTS.md) | **Hub** — skills index, task router, verification |
| [`.agents/us-workflow/stack.md`](us-workflow/stack.md) | Build/test commands, paths |
| [`.agents/us-workflow/us-workflow.md`](us-workflow/us-workflow.md) | US pipeline orchestrator |
| [`.agents/skills/*/SKILL.md`](skills/) | Invocable skills |
| [`.agents/check-harness.md`](check-harness.md) | This file |

Progressive disclosure: `AGENTS.md` → skill on demand. **Do not** duplicate skill bodies in AGENTS.md.

## Phase 4 — Unrouted skills

Compare filesystem `SKILL.md` files vs AGENTS.md § Skills index. Report `unrouted_skills[]` as warnings.

## Redundancy (canonical sources)

| Theme | Canonical | Delegators |
|-------|-----------|------------|
| Routing | `AGENTS.md` | all skills |
| Engineering | `senior-developer/SKILL.md` | plan-us, code-review, implement-plan |
| Spec format | `spec-format/SKILL.md` | us-workflow, refine |
| Stack commands | `us-workflow/stack.md` | workflow steps |

## Rules

- Relative paths only — no `C:\` or `/home/...`
- Evidence for every finding (`Read`, `Grep`, `Glob`)
- No edits before user approves plan
- No product code changes in `src/` during audit

## Output language

English unless user requests otherwise.
