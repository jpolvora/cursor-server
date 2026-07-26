---
us: "14-spec-editor"
reviewDate: 2026-07-25
base: uswf/14-spec-editor-20260725T230627Z/before-step-6
reviewer: Cursor Grok 4.5 (fresh)
fable:
  enabled: true
  autoAudit: true
  verdict: VERIFIED WITH CAVEATS
  postFixNote: "W1 fixed; W2 accepted concurrent check-harness dirty (keep ws-fix-pr CI docs)"
---


# Code Review — 14-spec-editor (Step 6)

**Scope:** `src/routes/ui.ts`, `ui.test.ts`, `specs.ts`, `specs.test.ts`, `harness.ts`, `harness.test.ts`, `src/services/spec-schema.ts`, `spec-schema.test.ts`, `src/index.ts`, `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`

**Ignored:** unrelated dirty trees (13-runner, ws-multi-spec, managed skills, `dist/`).

## Summary

Feature code for AC1–AC3 is sound: path-confined IO, public UI / authed APIs, harness repo-name resolve, focused tests present. Findings are documentation integrity (shipped-status contradiction + README OOS CI churn), not runtime defects in the editor paths.

| Severity | Count |
|----------|------:|
| Critical | 0 |
| Warning | 2 |
| Suggestion (Nit) | 2 |

---

## Critical

No feedback.

---

## Warning

### W1 — AGENTS.md still lists landed editor/schema as “not implemented” (docs sync)

- **path:** `AGENTS.md` (Planned areas; Spec editor roadmap blurb; What not to do)
- **score:** 7/10
- **Evidence Read:** Architecture tree correctly adds `ui.ts` / `specs.ts` / `spec-schema.ts`. Planned areas still: “Spec schema, editor UI, and stage orchestration service”. Roadmap: “The spec format and UI are not defined yet”. What not to do: “Do not implement roadmap items (spec editor, …)”.
- **Failure Scenario:** Later agents treat Phase 3 MVP as unfinished and re-implement or block on false “not built” status (MEMORY: Packaging status doc sync → Warning).
- **Missing Protection:** Same-turn docs sync when marking `index.PRD` item 14 `[x]`.
- **Discards:** Not a Nit; MEMORY elevates shipped-status contradictions to Warning.
- **Sibling occurrences:** `README.md` Roadmap **Spec harness** row still reads as future-only while Status lists `GET /ui/spec-editor`.
- **MEMORY pattern:** Packaging status doc sync.

```suggestion
Update Planned areas / roadmap / What-not-to-do to reflect MVP editor + schema + orchestration landed; leave Hermes/OpenCode/auth as remaining open items. Align README Spec harness row with Status.
```

### W2 — README CI section co-mingled with feature diff (scope creep / ship hygiene)

- **path:** `README.md` (CI — Agentic Code Review)
- **score:** 5/10
- **Evidence Read:** Diff vs before-step-6 adds `/ui/spec-editor` (in scope) **and** CI hygiene (drop missing `auto-fix.yml` row; `solve-pr` → `ws-fix-pr` / `github-provider`). State lists `README.md` in `preExistingDirty`; CHANGELOG 19:05 records `/check-harness` as author of CI edits.
- **Failure Scenario:** Reviewer mis-attributes harness CI docs to this feature, or Step 8 “restores baseline” and reintroduces stale `solve-pr` path (MEMORY: Agentic review CI uses stale solve-pr path).
- **Missing Protection:** Explicit OOS attribution at review; do not revert harness-correct CI docs when shipping 14-spec-editor.
- **Discards:** Not Critical. Not fixed by restoring baseline (that would regress known CI doc trap). Treated as **accepted concurrent dirty** for ship.
- **Sibling occurrences:** none in other scoped files.
- **MEMORY pattern:** Docs implement scope creep guard + Agentic review CI stale solve-pr path.

```suggestion
Keep check-harness CI wording; attribute OOS to preExistingDirty; feature-owned README hunks are Status + `/ui/spec-editor` endpoint + Spec harness roadmap sync only.
```

---

## Suggestion

### S1 — `STACK.md` still “frontend: none”

- **path:** `.agents/skills/shared/STACK.md` (noted in step-05; optional)
- **score:** 2/10
- **Note:** Served HTML editor is not a framework; non-blocking. Out of minimal review fix unless owner wants companion refresh.

### S2 — route test temp dirs not removed

- **path:** `src/routes/specs.test.ts:11-15`
- **score:** 2/10
- **Note:** `mkdtempSync` under OS tmp left behind; harness tests same pattern. Prefer `after`/`finally` `fs.rmSync` in a follow-up, not blocking.

---

## MEMORY pattern sweep

| Pattern | Result |
|---------|--------|
| Promise.race timeout timer leak | N/A — no `Promise.race` in scoped files |
| Packaging status doc sync | **Hit → W1** |
| Docs implement scope creep guard | **Hit → W2** |

## Invariants (`config.json`)

| Invariant | Result |
|-----------|--------|
| `localSdkRuntimeOnly` | OK — UI uses HTTP only |
| `thinRoutesNoBusinessLogic` | OK — IO in `spec-schema` |
| `noHardcodedRepoAbsolutePaths` | OK — `REPOS_ROOT` + `validateRepoPath` |
| `secretsFromEnvOnly` | OK — API key from user field / sessionStorage |
| `disposeAgentsAlways` | N/A — no SDK in UI path |
| `settingSourcesEmptyUnlessIntentional` | N/A |

## Fable-judge (enabled + autoAudit)

**Verdict: VERIFIED WITH CAVEATS**

| Fraud | Result |
|-------|--------|
| Weakened Checks | None — new tests add coverage; no assertion removal observed in scoped test diffs |
| False Completion | None for code ACs (step-05 evidence); docs claims overstated “clean” relative to AGENTS Planned areas |
| Scope Creep | **Detected (docs)** — README CI co-mingled with feature; attributed to `preExistingDirty` / check-harness → W2 accepted |
| Unauthorized Action | None — no push/deploy |

Caveats: W1/W2 must be fixed before ship hygiene is clean; runtime feature claims match ground-truth source.

---

## Apply fixes?

**autoMode=true** → applied W1; W2 accepted (keep harness CI docs); wrote `step-06-14-spec-editor.fix.report.md`; typecheck/build/21 tests green.
