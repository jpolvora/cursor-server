---
name: plan-us
description: "Elaborates a detailed implementation plan for a User Story (GitHub issue or local *.spec.md) for cursor-server. Adapts to the TypeScript/Hono/@cursor/sdk stack and project architecture."
version: 2.1
disable-model-invocation: true
---

# Plan User Story Skill — cursor-server

Orchestrates a **detailed, step-by-step implementation plan** for a User Story (GitHub issue or local `*.spec.md`), aligned with cursor-server conventions, security (OWASP), verification, and local business rules.

Act as **Software Architect and Senior Developer**, generating blueprints ready for coding.

---

## Usage

When invoked with a US number (e.g. `@[/plan-us] 1234`), execute the flow below, substituting `XXXX` with the US number.

> If the US number is missing, **stop and ask** before continuing.

---

## Execution Flow

### 0. Stack recognition (cursor-server)

**Fixed stack:** Node 20+, TypeScript (ESM), Hono, Zod, `@cursor/sdk`, node-cron.

Confirm:
- `package.json` with `@cursor/sdk`, `hono`, `zod`
- `src/index.ts`, `src/config.ts`, `src/routes/`, `src/services/`, `src/jobs/`

Load [`AGENTS.md`](../../../AGENTS.md) and [`stack.md`](../../us-workflow/stack.md) § Code Paths — do not invent new layers.

### 1. Retrieve and analyze the US

- GitHub issue via `gh` (remote `origin`):

```bash
gh issue view XXXX --json number,title,body,state,labels,assignees,comments,url \
  > .cursor/plans/us-XXXX/us-XXXX.issue.json
```

- Optionally convert to canonical `*.spec.md` via [`github-issue-to-spec.py`](../../us-workflow/scripts/github-issue-to-spec.py).
- Or read existing `.cursor/plans/us-XXXX/us-XXXX.spec.md`.
- Map business rules; check [`README.md`](../../../README.md) and [`AGENTS.md`](../../../AGENTS.md) for constraints.

### 2. Load local context

- [`AGENTS.md`](../../../AGENTS.md) — harness hub and SDK patterns
- [`senior-developer/SKILL.md`](../senior-developer/SKILL.md) + [`TESTING.md`](../senior-developer/TESTING.md)
- [`stack.md`](../../us-workflow/stack.md) — commands and invariants

### 3. Find equivalent examples

Search the repo for similar routes, services, or jobs and follow the same patterns.

### 4. Produce the detailed plan

Structured Markdown blueprint for implementers.

---

## Plan format

### 0. Summary and business rules
- US title, number, objective
- Business rules and expected behavior
- Security analysis: secret leaks, path traversal on `repo` param, auth gaps, SSRF — mitigations using project patterns

### 1. Definition of Ready and scope
- Resolved ambiguities (stop if blocking questions remain)
- Measurable acceptance criteria
- In scope / out of scope

### 2. Technical design

List exact files by layer:

- **`src/routes/`** — HTTP handlers (thin)
- **`src/services/`** — business logic, SDK calls
- **`src/jobs/`** — cron jobs when applicable
- **`src/config.ts`** — new env vars (Zod schema)
- **`src/index.ts`** — wiring when new routes/jobs register

### 3. Step-by-step implementation

For each step: **Action**, **Files**, **Guardrails**, **Security** (input validation, env secrets).

Suggested grouping:
1. Config / types
2. Service layer
3. Routes + wiring
4. Jobs (if any)
5. Verification (`npm run typecheck`, `npm run build`, manual API smoke)

### 4. Permissions and deployment
- New env vars and defaults
- Tailscale/homelab deployment notes if relevant
- `REPOS_ROOT` behavior when touching repo resolution

### 5. Test coverage (AC mapping)
- Map each AC to verification steps
- Note future automated tests when a test runner is added

### 6. Critical constraints (do not violate)
- Local SDK runtime only unless explicitly requested
- Agent disposal always
- Thin routes; no ORM/framework sprawl
- No roadmap features without owner approval (see AGENTS.md § Planned areas)
- Secrets from env only

### 7. Pre-PR checklist
- [ ] Layer separation respected
- [ ] Zod validation on new inputs/env
- [ ] `npm run typecheck` and `npm run build` pass
- [ ] README/AGENTS updated if API or env changed
- [ ] No secrets committed

### 8. Open questions
- Ambiguities needing user clarification before coding

---

## Conduct

- **Be exhaustive** — a developer should implement from the plan alone.
- **Do not code the feature** — deliver the plan artifact and wait for feedback.
