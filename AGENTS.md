# AGENTS.md

Guidance for AI agents working in **cursor-server**.

## Project purpose

**cursor-server** is an HTTP API that executes agent tasks against **local repository directories** on a home-lab host. Remote IDE clients (home or company laptops on Tailscale) delegate work by sending prompts or specs; this server is where that work actually runs.

Primary use cases (planned / in progress):

1. **Remote task execution** — client sends a prompt + repo identifier; server runs an agent in that repo's working tree.
2. **Scheduled automation** — cron jobs for recurring agent work (reviews, triage, repo hygiene).
3. **Continuous review loops** — deliver / deploy / exec review workflows so remote clients stay in sync with repo changes.
4. **Spec-driven pipeline** — hosted spec editor/environment; fully qualified, detailed specs drive implement → build → test → deploy → review through a specialized harness.
5. **Pluggable harnesses** — same spec pipeline runnable by Cursor SDK agents, [Hermes Agent](https://github.com/NousResearch/hermes-agent), OpenCode, or future runners.

Requirements and endpoint design are not finalized. Prefer small, reviewable increments; confirm major features with the owner before building.

## Deployment context

- **Host**: home lab server (Umbrel, Docker Compose stack, or bare Node).
- **Access**: Tailscale tailnet — clients on home/company laptops reach the API over VPN; avoid assuming public-internet exposure.
- **Data**: repo clones live under `REPOS_ROOT` (volume-mounted in container deployments).
- **Packaging**: Docker Compose is the intended production path; manifest not yet in repo.

When adding deployment artifacts, favor Compose over bespoke scripts; keep Umbrel compatibility (standard Compose, clear env vars, persistent volumes).

## Architecture (current)

```text
src/
  index.ts              # Hono app entry, wires routes + scheduler
  config.ts             # Env validation (zod)
  routes/
    health.ts           # GET /health
    tasks.ts            # POST /tasks
  services/
    agent-runner.ts     # @cursor/sdk local Agent.create + send + wait
  jobs/
    scheduler.ts        # node-cron registration (jobs added later)
```

### Runtime choice

Use **local** Cursor SDK runtime for all task execution unless explicitly designing a cloud feature:

```typescript
local: { cwd: repoPath, settingSources: [] }
```

- `settingSources: []` — do not inherit ambient Cursor IDE settings from the server environment unless intentionally changed.
- Always dispose agents (`await using` or `finally` + `[Symbol.asyncDispose]()`).
- Distinguish `CursorAgentError` (startup) from `result.status === "error"` (run failed after start).

### Repository layout on disk

Clients refer to repos by **name**, not absolute path. The server resolves:

```text
{REPOS_ROOT}/{repo}
```

Default `REPOS_ROOT` is `./repos`. Do not hardcode absolute paths in routes.

## Conventions

- **TypeScript**, ESM (`"type": "module"`), Node 20+.
- **Hono** for HTTP; keep handlers thin — business logic in `services/`.
- **Zod** for request and env validation.
- Match existing style: minimal scope, no over-abstraction, no comments unless logic is non-obvious.
- Do not commit secrets (`.env`, API keys).

## SDK patterns to follow

| Pattern | When |
|---------|------|
| `Agent.prompt(...)` | True one-shots with no follow-up |
| `Agent.create()` + `agent.send()` + `run.wait()` | Streaming, multi-turn, or service lifecycle |
| `Agent.resume()` | Cross-process continuation (scheduled jobs, webhooks) |

Log `agentId` and `run.id` after `send()` in production paths.

## Roadmap (design intent)

Documented here so agents understand direction without treating it as shipped code.

### Hermes integration

Plan to integrate [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) as an orchestration layer alongside Cursor SDK runs. Hermes brings scheduled automations, subagent delegation, persistent memory/skills, and bundled skills for coding agents (including OpenCode). It may coordinate multi-step workflows or hand off stage-specific work. Exact boundary (Hermes vs Cursor SDK per pipeline stage) TBD.

### Spec editor & qualified-spec harness

Flagship feature: a **served spec editor/environment** where authors produce **fully qualified, complete specifications** (not vague prompts). A harness executes each spec through fixed stages:

```text
spec (qualified) → implement → build → test → deploy → review
```

Each stage should be observable (logs, artifacts, pass/fail), resumable, and tied back to spec sections. The spec format and UI are not defined yet — design for machine-actionable structure (IDs, acceptance criteria, dependencies between items).

### Pluggable harness abstraction

Do not hard-couple pipeline logic to `@cursor/sdk`. Introduce a runner interface when implementing the harness so executors can include:

| Runner | Role (planned) |
|--------|----------------|
| **Cursor SDK** | Local agent runs against repo `cwd` (current default) |
| **Hermes Agent** | Orchestration, scheduling, memory/skills, delegation to coding agents |
| **OpenCode** | Autonomous coding agent CLI (Hermes can orchestrate via bundled skill) |

New runners plug in behind the same spec → stage → outcome contract.

## Planned areas (not implemented)

Treat these as design placeholders — confirm with the owner before building:

- Docker Compose stack + Umbrel-friendly packaging
- Tailscale-oriented bind/config defaults and docs
- Authentication / API keys for clients calling this server
- Async job queue (fire-and-forget tasks, status polling, webhooks)
- Run history and persistence
- Repo registration and validation (ensure path exists, is a git repo)
- Streaming task output to clients (SSE / WebSocket)
- Scheduled review jobs (PR diff review, branch sync checks)
- MCP server configuration per task or per repo
- Spec schema, editor UI, and stage orchestration service
- Hermes and OpenCode harness adapters
- Multi-tenant isolation if multiple clients share one host

## Testing changes

```bash
npm run typecheck
npm run dev
curl http://localhost:3000/health
```

For task endpoints, a real `CURSOR_API_KEY` and a clone under `repos/` are required.

## What not to do

- Do not switch to cloud runtime without an explicit requirement (this server is local-first / homelab-first).
- Do not add large frameworks or ORMs for the initial API surface.
- Do not implement roadmap items (Docker, spec editor, Hermes) without explicit owner go-ahead — but **do** keep README/AGENTS roadmap sections updated when vision changes.

---

## Skills index (progressive disclosure)

**How to use:** Read this hub first. Load a linked skill **only** when the task matches its trigger — never paste skill bodies into AGENTS.md. User instructions override skills; skills override default agent behavior.

```text
AGENTS.md (hub)
  ├── Layer 0 — every response (unless user opts out)
  ├── Layer 1 — task-triggered
  ├── Layer 2 — on-demand / explicit invoke
  ├── Agents — orchestrators (.agents/*.md)
  └── Project docs — README, MEMORY, CHANGELOG
```

### Layer 0 — Auto-load

| Skill | Path | When |
|-------|------|------|
| **using-superpowers** | [`.agents/skills/using-superpowers/SKILL.md`](.agents/skills/using-superpowers/SKILL.md) | Start of session — how to find and invoke skills |
| **senior-developer** | [`.agents/skills/senior-developer/SKILL.md`](.agents/skills/senior-developer/SKILL.md) | Every implementation task (TypeScript/Hono/SDK guardrails) |
| **gabarito** | [`.agents/skills/gabarito/SKILL.md`](.agents/skills/gabarito/SKILL.md) | Operational discipline (accountability, clarification) |
| **karpathy-guidelines** | [`.agents/skills/karpathy-guidelines/SKILL.md`](.agents/skills/karpathy-guidelines/SKILL.md) | Surgical diffs, avoid over-engineering |
| **caveman** | [`.agents/skills/caveman/SKILL.md`](.agents/skills/caveman/SKILL.md) | Compressed responses unless user says `normal mode` |

Opt-out in-thread: `skip senior-developer`, `stop caveman`, etc.

### Layer 1 — Task-triggered

| Task | Skill | Path |
|------|-------|------|
| Library / SDK docs | **context7-mcp** | [`.agents/skills/context7-mcp/SKILL.md`](.agents/skills/context7-mcp/SKILL.md) |
| Task complete — changelog | **changelog** | [`.agents/skills/changelog/SKILL.md`](.agents/skills/changelog/SKILL.md) |
| Task complete — learnings | **learning** | [`.agents/skills/learning/SKILL.md`](.agents/skills/learning/SKILL.md) → `MEMORY.md` |
| Create/review spec file | **spec-format** | [`.agents/skills/spec-format/SKILL.md`](.agents/skills/spec-format/SKILL.md) |
| Write qualified spec | **write-spec** | [`.agents/skills/write-spec/SKILL.md`](.agents/skills/write-spec/SKILL.md) |
| Challenge plan + update docs | **grill-with-docs** | [`.agents/skills/grill-with-docs/SKILL.md`](.agents/skills/grill-with-docs/SKILL.md) |

### Layer 2 — On-demand (explicit invoke)

| Intent | Skill | Path |
|--------|-------|------|
| Branch / PR review | **code-review** | [`.agents/skills/code-review/SKILL.md`](.agents/skills/code-review/SKILL.md) |
| Fix open PR review threads | **solve-pr** | [`.agents/skills/solve-pr/SKILL.md`](.agents/skills/solve-pr/SKILL.md) |
| Ship: verify → commit → PR → merge loop | **ship-pr** | [`.agents/skills/ship-pr/SKILL.md`](.agents/skills/ship-pr/SKILL.md) |
| Goal-driven PR convergence | **goal-fix-pr** | [`.agents/skills/09-goal-fix-pr/SKILL.md`](.agents/skills/09-goal-fix-pr/SKILL.md) |
| OWASP / security audit | **security-review** | [`.agents/skills/security-review/SKILL.md`](.agents/skills/security-review/SKILL.md) |
| TS route/service security | **typescript-security-review** | [`.agents/skills/typescript-security-review/SKILL.md`](.agents/skills/typescript-security-review/SKILL.md) |
| Layer / architecture audit | **tdd-sdd-ddd-reviewer** | [`.agents/skills/tdd-sdd-ddd-reviewer/SKILL.md`](.agents/skills/tdd-sdd-ddd-reviewer/SKILL.md) |
| Module-area audit (`routes`, `services`, …) | **domain-review** | [`.agents/skills/domain-review/SKILL.md`](.agents/skills/domain-review/SKILL.md) |
| Rotate all modules | **multi-domain-review** | [`.agents/skills/multi-domain-review/SKILL.md`](.agents/skills/multi-domain-review/SKILL.md) |
| Grade plan execution | **verify-plan** | [`.agents/skills/verify-plan/SKILL.md`](.agents/skills/verify-plan/SKILL.md) |
| Session handoff | **handoff** | [`.agents/skills/handoff/SKILL.md`](.agents/skills/handoff/SKILL.md) |
| Multi-step FSM orchestration | **modular-orchestrator** | [`.agents/skills/modular-orchestrator/SKILL.md`](.agents/skills/modular-orchestrator/SKILL.md) |
| Author a new skill | **write-a-skill** | [`.agents/skills/write-a-skill/SKILL.md`](.agents/skills/write-a-skill/SKILL.md) |
| Audit harness links/routing | **check-harness** | [`.agents/check-harness.md`](.agents/check-harness.md) |

### US workflow skills (Steps 1–11)

Consumed by [`.agents/us-workflow/us-workflow.md`](.agents/us-workflow/us-workflow.md). Stack commands: [`.agents/us-workflow/stack.md`](.agents/us-workflow/stack.md).

| Step | Skill `name:` | Path |
|------|---------------|------|
| 1 Plan | `plan-us` | [`.agents/skills/01-plan-us/SKILL.md`](.agents/skills/01-plan-us/SKILL.md) |
| 2 Refine | `refine` | [`.agents/skills/02-refine/SKILL.md`](.agents/skills/02-refine/SKILL.md) |
| 3 DAG | `plan-exec-dag` | [`.agents/skills/03-plan-exec-dag/SKILL.md`](.agents/skills/03-plan-exec-dag/SKILL.md) |
| 5/10 Implement | `implement-plan` | [`.agents/skills/04-implement-plan/SKILL.md`](.agents/skills/04-implement-plan/SKILL.md) |
| 6 Verify vs plan | `verify-sync-plan-us` | [`.agents/skills/05-verify-sync-plan-us/SKILL.md`](.agents/skills/05-verify-sync-plan-us/SKILL.md) |
| 9 Review | `us-code-review` | [`.agents/skills/06-code-review/SKILL.md`](.agents/skills/06-code-review/SKILL.md) |
| 11 Integration | `integration-validation` | [`.agents/skills/07-integration-validation/SKILL.md`](.agents/skills/07-integration-validation/SKILL.md) |

Invoke orchestrator: `/us-workflow` or `@us-workflow` → [`.agents/us-workflow/us-workflow.md`](.agents/us-workflow/us-workflow.md). Human docs: [`.agents/us-workflow/README.md`](.agents/us-workflow/README.md).

### Agents (orchestrators)

| Agent | Path | Role |
|-------|------|------|
| **us-workflow** | [`.agents/us-workflow/us-workflow.md`](.agents/us-workflow/us-workflow.md) | End-to-end US delivery FSM |
| **check-harness** | [`.agents/check-harness.md`](.agents/check-harness.md) | Harness audit (links, routing, redundancy) |

### Project docs (Layer 3)

| Doc | Path | Use |
|-----|------|-----|
| README | [`README.md`](README.md) | API, setup, env vars |
| Memory | [`MEMORY.md`](MEMORY.md) | Cross-session learnings (when present) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) | Historical record of shipped work |

### Not routed (deprecated / other stack)

| Skill | Path | Note |
|-------|------|------|
| matrix-view-patterns | [`.agents/skills/matrix-view-patterns/SKILL.md`](.agents/skills/matrix-view-patterns/SKILL.md) | No frontend in this repo |
| dotnet-security-performance-review | [`.agents/skills/dotnet-security-performance-review/SKILL.md`](.agents/skills/dotnet-security-performance-review/SKILL.md) | Use **typescript-security-review** |
| fix-pr-azure (08-fix-pr) | [`.agents/skills/08-fix-pr/SKILL.md`](.agents/skills/08-fix-pr/SKILL.md) | Use **solve-pr** (GitHub) |
| supabase / postgres-best-practices | `.agents/skills/supabase*/` | Reference only — not cursor-server stack |

Future UI (spec editor): optional [`.agents/skills/mobile-first-design/SKILL.md`](.agents/skills/mobile-first-design/SKILL.md), [`.agents/skills/taste-skill/SKILL.md`](.agents/skills/taste-skill/SKILL.md).

---

## Task router

| User intent | Load first | Then |
|-------------|------------|------|
| Implement feature / fix bug | senior-developer + karpathy | code-review before done |
| Plan a GitHub issue / spec | spec-format → plan-us | refine → plan-exec-dag |
| Full US delivery | us-workflow | skills per step (table above) |
| Review my branch | code-review | security-review if auth/API touched |
| Fix PR comments | solve-pr | code-review loop |
| Ship to main | ship-pr | goal-fix-pr |
| Audit harness | check-harness | (approval gate before edits) |
| Cursor SDK question | context7-mcp or Cursor SDK skill | AGENTS.md § SDK patterns |

---

## Verification

Before claiming done on code changes:

```bash
npm run typecheck
npm run build
curl http://localhost:3000/health   # when server running
```

Task endpoint smoke requires `CURSOR_API_KEY` and a clone under `repos/`. Cite command output in senior-developer **code review proof**.

---

## Precedence

1. User explicit instructions (this file, direct requests)
2. Invoked skills
3. Default agent behavior

Karpathy wins on diff size; senior-developer wins on architecture.
