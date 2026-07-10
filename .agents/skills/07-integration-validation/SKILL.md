---
name: integration-validation
description: Plans and runs pre-PR integration validation for cursor-server (typecheck, build, health/tasks API smoke) and produces pass/fail report per AC.
version: 1.2
disable-model-invocation: true
---

# integration-validation — cursor-server

Final deterministic validation before PR — after unit/type checks, before delivery.

**Standalone** — callable outside `us-workflow`. Browser MCP not applicable unless a future admin UI exists.

## Input

- `*.plan.md` (required)
- `*.spec.md` or `specPath` for ACs (recommended)
- US number (optional) to resolve spec via `gh`

## Step 1 — Generate test plan artifact

Read plan, ACs from `*.spec.md`, and prior verification reports. Write `*.integration-test.plan.md` with:

1. **Prerequisites** — Node 20+, `.env` with `CURSOR_API_KEY`, clone under `repos/` if testing `/tasks`, server URL (`http://localhost:${PORT:-3000}`)
2. **Environment** — env vars touched by the feature; how to start `npm run dev`
3. **Automated checks** — `npm run typecheck`, `npm run build`; success criteria
4. **API smoke** — endpoints (method, path, body, expected status/JSON shape); include `/health` baseline
5. **Security** — no secret leakage in responses/logs; safe `repo` path resolution; auth behavior if feature adds it
6. **SDK behavior** — if agent runs touched: local runtime, disposal, error distinction (document manual steps if no key in CI)
7. **Evidence** — command output, curl transcripts to capture
8. **Exit criteria** — all AC-mapped items pass; open defects logged with severity

## Step 2 — Execute (non-interactive first)

1. Clean working tree or warn caller
2. Run typecheck + build (§3)
3. Start dev server if API smoke needed; run curl checks (§4–5)
4. Write `*.integration-test.report.md`: pass/fail per AC item

## Output

- `*.integration-test.plan.md`
- `*.integration-test.report.md`

Under `{us-dir}` when invoked by workflow (e.g. `.cursor/plans/us-{id}/`).

## References

- [`spec-format`](../spec-format/SKILL.md)
- [`senior-developer`](../senior-developer/SKILL.md) + [`TESTING.md`](../senior-developer/TESTING.md)
- [`stack.md`](../../us-workflow/stack.md)

## Conduct

- **Do not fix code** — report gaps; `implement-plan` fix mode or user fixes.
- Max **3 validation iterations** before escalating to human.

## Triggers

- `@[integration-validation] us-1234.plan.md`
- `us-workflow` Step 11
