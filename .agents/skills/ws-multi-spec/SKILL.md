---


name: ws-multi-spec
version: 0.0.91
description: >-
  Sequential smart multi-spec batch delivery orchestrator. Evaluates spec complexity to dispatch ws-spec-to-pr or ws-spec-to-pr-lite workers.
  Invoke: /ws-multi-spec | @[ws-multi-spec].
  Entry: state file | list of specs | blank (scan default specsDir).
---

## Audience & load

| Audience | Doc |
|----------|-----|
| **Master Orchestrator (this file)** | Loop FSM + tool bindings + intelligence flow auto-detection |
| **Protocol & State** | [`PROTOCOL.md`](PROTOCOL.md) · [`STATE.md`](STATE.md) |
| **Examples & Evals** | [`EXAMPLES.md`](EXAMPLES.md) · [`evals/evals.json`](evals/evals.json) |

**Always-on load:** this file + [`PROTOCOL.md`](PROTOCOL.md). **On demand:** [`STATE.md`](STATE.md) · [`EXAMPLES.md`](EXAMPLES.md) · [`../ws-spec-to-pr/SKILL.md`](../ws-spec-to-pr/SKILL.md) · [`../ws-spec-to-pr-lite/SKILL.md`](../ws-spec-to-pr-lite/SKILL.md) · [`../ws-ship-pr/SKILL.md`](../ws-ship-pr/SKILL.md) · [`../ws-goal-fix-pr/SKILL.md`](../ws-goal-fix-pr/SKILL.md) · [`../shared/tools.md`](../shared/tools.md). Language: **en-us** only.

## Native tool contract

Canonical aliases: [`../shared/tools.md`](../shared/tools.md). Params: `{sharedDir}/config.json`. Never narrate undone work. Master orchestrator never edits code directly — dispatches `ws-spec-to-pr` or `ws-spec-to-pr-lite` workers via `dispatch-agent`.

| Intent | Alias | Rule |
|--------|-------|------|
| Worker dispatch | `dispatch-agent` | `generalPurpose` or subagent; `description: "ws-multi-spec worker [{flowMode}] — {slug}"`; sequential execution |
| User gate | `user-gate` / `user-gate-auto` | Selection gate for blank scan; failure pause gate (Resume, Skip, Abort) |
| SCM / state probe | `Shell` | SCM query & file probes; parse worker `step-output` |
| State persistence | `write-to-file` | Update `{plansDir}/ws-multi-spec/{runId}.state.md` |

# `ws-multi-spec` — Smart Multi-Spec Orchestrator

Sequential multi-spec batch delivery orchestrator with **smart complexity & flow auto-detection**.

## Goals

1. Batch process a list or directory of specs sequentially.
2. **Smart Flow Auto-Detection**: Evaluate spec complexity to select `ws-spec-to-pr` (full) or `ws-spec-to-pr-lite` (fast).
3. Probe before execution to skip already-implemented specs.
4. Unified state management across specs in `{plansDir}/ws-multi-spec/{runId}.state.md`.
5. Pause on worker failure with clear recovery options (Resume, Skip, Abort).

## Invariants

| Topic | Rule |
|-------|------|
| Sequential | Exactly one spec worker active at a time |
| Flow Auto-Detect | `ws-spec-to-pr-lite` when ≤3 steps / ≤6 files / ≤2 layers / frontmatter `complexity: low`; `ws-spec-to-pr` otherwise |
| Merge & Convergence | Worker or master MUST run `ws-ship-pr` + `ws-goal-fix-pr` until `activeThreads == 0`, required CI checks pass, and PR is merged (`merged: true`) before item is terminal |
| Next-Spec Block | Master orchestrator MUST NOT dispatch the next spec until prior spec PR is fully merged with 0 active review threads |
| Isolation | Fresh worker context per spec; no shared scratch across specs |
| Pause on fail | No silent continue on worker failure; gate required |
| Skip done | Probe already-implemented items before dispatching |
| Dry-run | Forward `dryRun` to worker; state records simulated outcome with `[DRY-RUN]` label |

## Triggers

```
/ws-multi-spec
/ws-multi-spec .agents/specs/13-runner.spec.md .agents/specs/14-editor.spec.md
/ws-multi-spec .agents/plans/ws-multi-spec/ms-20260725T220000Z.state.md
```
