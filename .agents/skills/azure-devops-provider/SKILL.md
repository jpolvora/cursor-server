---
name: azure-devops-provider
description: Azure DevOps provider for spec-to-pr — work item→spec, PAT auth, PR create/threads/merge via az CLI and/or REST plus provider scripts. Use when providers.active or providers.scm is azure-devops, or when invoking /azure-devops-provider standalone.
version: 0.0.82
disable-model-invocation: true
---

# azure-devops-provider

Azure DevOps inbound (`fetch-to-spec`) and SCM (`create-pr`, threads, merge). Pipeline skills load this when `providers.active` / `providers.scm` is `azure-devops`; they link here instead of embedding `az` / REST recipes.

Resolve `org` / `project` from `{sharedDir}/config.json` (`issueTrackers.azureDevOps`) — [`config-resolution.md`](../shared/config-resolution.md). Never hardcode org/project.

## Invocation

### Standalone Mode

```
/azure-devops-provider <intent> [args...]
```

Examples: `fetch-to-spec ADO 123` · `validate-auth` · `create-pr --head develop --base main` · `list-threads 42` · `merge-pr 42`.

### Workflow Mode

Orch entry / `ws-fix-pr` / `ws-goal-fix-pr` / `ws-ship-pr` pass intent + args when `providers.active` or `providers.scm` is `azure-devops`; gates follow the parent.

| Parameter | Default | Notes |
|-----------|---------|-------|
| `<intent>` | required | Contract table below |
| ids | per intent | Work item / PR / thread ids |
| `dry-run` | false | Simulate when caller supports it |

## Prerequisites

- Prefer Azure CLI (`az`) + DevOps extension for PR create/merge.
- PAT: `issueTrackers.azureDevOps.patEnvVar` (default `ADO_PAT`) → `ADO_PAT` → `AZURE_DEVOPS_PAT`. Never commit tokens.
- Config: `issueTrackers.azureDevOps` with `org` / `project`, and/or `providers.*` = `azure-devops`.
- Legacy fallback only: if tracker fields missing, scripts may read `.agents/skills/azure-devops/azure-devops.config.json` when that path exists — do not recreate that layout for new consumers.

Auth/config failure → **STOP**. No silent provider fallback.

## Intent contract

| Intent | Input | Output | Implementation |
|--------|-------|--------|----------------|
| `fetch-to-spec` | `ADO {id}`, `WI {id}`, `{org}/{project}#{id}`, or URL | `{us-dir}/step-00-us-{id}.spec.md` (+ optional JSON) | `ado-workitem-to-spec.py` |
| `validate-auth` | none | Pass/fail + fixes | Org/project + PAT; optional WIT smoke |
| `create-pr` | head, base, title/body | PR URL + id | `az repos pr create` and/or REST |
| `list-threads` | PR id | Thread list | `fix_pr_azure_context.py collect` |
| `resolve-thread` | thread id (+ PR id, comment) | Resolved (or dry-run) | `fix_pr_azure_context.py resolve-thread` |
| `merge-pr` | PR id | Merged | Wait policies then `az repos pr update --status completed` |

**Branch rule:** never delete `project.workingBranch` (default `develop`) after merge.

**Procedures:** load [`INTENTS.md`](INTENTS.md) for the intent being run.

## Canonical scripts

| Script | Path |
|--------|------|
| Work item → spec | `.agents/skills/azure-devops-provider/scripts/ado-workitem-to-spec.py` |
| PR/thread collect + resolve | `.agents/skills/azure-devops-provider/scripts/fix_pr_azure_context.py` |

Optional: `issueTrackers.azureDevOps.workItemToSpecScript` must still resolve to the converter. Orch/fix-pr shims may forward here.

## Config keys

| Key | Role |
|-----|------|
| `providers.active` / `providers.scm` | `azure-devops` → this skill |
| `issueTrackers.azureDevOps` | enabled, org, project, patEnvVar, apiBase, optional script |
| `project.workingBranch` / `baseBranch` / `gitRemote` | create/merge defaults |
| `plans.dir` | `{us-dir}` root |

**PAT order:** `patEnvVar` → `ADO_PAT` → `AZURE_DEVOPS_PAT` → legacy `.secret` only as fallback.

Legacy: absent `providers.*` → select when tracker enabled or entry is explicitly ADO-shaped.

## Dependencies

[spec-to-pr](../spec-to-pr/SKILL.md) · [ws-ship-pr](../ws-ship-pr/SKILL.md) · [ws-fix-pr](../ws-fix-pr/SKILL.md) · [ws-goal-fix-pr](../ws-goal-fix-pr/SKILL.md) · [spec-format](../spec-format/SKILL.md)
