---

name: ws-senior-developer
description: >
  Guide engineering delivery for non-trivial changes, including plan confirmation,
  implementation constraints, and pre-ship proof. Use when explicitly invoked or
  configured as the optional rules.seniorDeveloper delivery gate.
version: 0.0.97
---

# ws-senior-developer

Use this optional, model-invoked delivery gate only when explicitly invoked or resolved
through `rules.seniorDeveloper`. It guides engineering work; it does not replace a
configured project policy or an installed workflow.

## 1. Route existing intent

If the request names a workflow command, dispatch it through that workflow without adding
a competing gate. If it explicitly requests implementation, use the installed implementation
capability under `{skillsRoot}` and apply this skill only as its requested delivery constraint.

**Done when:** the applicable workflow or implementation route is identified before review
or planning requirements are imposed.

## 2. Classify scope

Treat a trivial or single-file change as exempt from plan ceremony; apply only the focused
checks needed for its risk. For multi-file or multi-modification free-text work, continue
to context and planning.

**Done when:** the work is classified as exempt or non-trivial with a stated reason.

## 3. Load delivery context

For non-trivial work, read the configured project context, consumer root `AGENTS.md` when
present, applicable architecture constraints and `rules.*`, and `{sharedDir}/MEMORY.md`.
Consumer root policy owns policy decisions; do not copy it here or rewrite managed consumer
skills.

**Done when:** applicable constraints, policy sources, and MEMORY guidance are recorded.

## 4. Confirm the plan

Require a confirmed plan before multi-file or multi-modification free-text work. Use
`{plansDir}` for plan artifacts, and route applicable work to installed workflow,
specification, and specification-sync capabilities. Use `user-gate` when confirmation is
needed.

**Done when:** an approved plan identifies scope, verification, and any required handoffs.

## 5. Implement within constraints

Make the smallest change that satisfies the confirmed plan. Follow the loaded policy and
architecture constraints, preserve consumer-owned data, and report a blocker instead of
inventing unconfigured commands, dependencies, or policy.

**Done when:** implementation matches the approved scope or a concrete blocker is reported.

## 6. Produce pre-ship proof

Before branch or pull-request handoff, perform focused review and provide this Code review
proof checklist:

- [ ] Run non-empty configured build, test, and format aliases that apply.
- [ ] Run configured secrets checking and resolve or report findings.
- [ ] Assess relevant documentation and specification-index updates.
- [ ] Review the changed scope for correctness, regressions, and policy compliance.
- [ ] Report command evidence, outcomes, remaining risks, and blockers.

Use configured aliases such as `build-backend`, `test-backend`, and `lint-backend`; do not
hardcode consumer commands.

**Done when:** every applicable checklist item has evidence or an explicit blocker.
