---
id: null
slug: 43-agents-plan-first-gate
title: "AGENTS.md — plan-first gate before multi-file implementation"
source: local
specDate: 2026-07-26
status: done
version: 0.1.0
---

# Specification — AGENTS.md plan-first gate

## Description

Agents often jump straight into multi-file edits on a free-text prompt, skipping planning, specs, and installed workflow skills. Root `AGENTS.md` already autoloads Layer 0 (`ws-caveman`, `ws-gabarito`, `ws-karpathy-guidelines`) and names delivery/completion skills, but it does not state a clear **planning-first default** for non-trivial work.

Add a portable rule under root `AGENTS.md` § How to use (and align Precedence if needed): for every prompted task that involves several files or modifications, do **not** start implementing automatically. Prefer workflows, specs, and planning first. Confirm the plan (and whether to add/update specs, run `ws-spec-index`, `ws-sync-spec`, `ws-spec-to-pr` / lite, `ws-fable-method`) with the user before coding, unless the user gave an explicit implement/ship command.

Single-file or trivial fixes may proceed without ceremony when scope is clearly tiny. Explicit commands (`/ws-spec-to-pr`, "just implement", "skip planning", etc.) override the gate.

Out of scope: changing managed skill bodies under `.agents/skills/` (except consumer-owned `shared/` data if a pointer is required); inventing a new always-on model-invoked skill that duplicates this gate; IDE-vendor rule folders (`.cursor/rules`).

## Acceptance Criteria

- AC1: Root `AGENTS.md` § How to use includes an explicit **plan-first** gate: multi-file / multi-modification tasks pause for planning confirmation before implementation starts.
- AC2: The gate names the default preference order: workflows and specs/planning before implementation, and lists confirmable options including add/update specs, `ws-spec-index`, `ws-sync-spec`, `ws-spec-to-pr` (and/or lite), `ws-fable-method`, plus Layer 0 skills already required (`ws-caveman`, `ws-gabarito`, `ws-karpathy-guidelines`).
- AC3: The gate states that an **explicit** user command to implement or to run a named workflow overrides the pause (workflows still run as invoked; free-text multi-file prompts do not auto-implement).
- AC4: Trivial / single-file scope is called out as allowed to skip the planning pause without violating the gate.
- AC5: No new always-on model-invoked skill is added for this policy; single source of truth remains root `AGENTS.md` (portable across agent hosts). If a skill is later desired, it must be a separate approved decision with clear invocation mode.
- AC6: After the `AGENTS.md` edit lands, `ws-sync-spec` / index hygiene is considered only if a matching `.agents/specs/*.spec.md` or `index.PRD` entry is promoted; this local plan spec is the delivery artifact until promote is requested.

## Notes

- Canonical path: `.agents/plans/43-agents-plan-first-gate/step-00-43-agents-plan-first-gate.spec.md`
- Related MEMORY: `ws-spec-index alwaysApply vs vibe coding` — keep gates in root `AGENTS.md`, not vendor rule folders.
- **Skill decision (ws-write-a-skill):** confirmed — **no new skill**; SoT is root `AGENTS.md` only.
- Implemented: root `AGENTS.md` § How to use item 3 (plan-first gate) + Precedence item 1 pointer.
- Optional follow-up: mirror under `.agents/specs/` via `ws-local-spec-provider --mirror` and/or `/ws-spec-index promote` when owner wants Inbox/Planned visibility.

### [2026-07-26] Revision: plan-first gate landed in AGENTS.md (Prompt: "2 — apply gate text")
