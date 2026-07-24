---
name: fable-domain
description: >
  Generates and manages domain adapters for specialized agent workflows (DevOps, Data Analysis, Research, Ops).
  Defines binding minimum evidence sets, domain authority, observation rules, and fraud definitions.
upstream: jpolvora/workflow-skills — improvements must be submitted upstream to https://github.com/jpolvora/workflow-skills
version: 1.0
invocation_names:
  - fable-domain
  - /fable-domain
---

# Fable Domain (`fable-domain`)

Domain adapters customize what counts as **evidence**, who holds **authority**, what **verification by observation** means, and what **frauds** look like for non-standard task domains.

An adapter alters domain nouns and evidence requirements, but **never changes the core 7-step loop**.

---

## Domain Adapter Architecture

Each domain adapter must reside under `references/` or a domain directory and conform to [`references/TEMPLATE.md`](references/TEMPLATE.md):

1. **Domain Identity:** Target field (e.g., DevOps, Data Analysis, Research, Marketing).
2. **Authority & Primary Sources:** What files/logs/documents MUST be opened before making decisions.
3. **Binding Minimum Evidence Set:** Non-negotiable mandatory reads before Step 3 (Decide).
4. **Verification By Observation:** Domain-specific execution commands or state checks.
5. **Domain Frauds:** Specific dishonesty or shortcut patterns unique to this field.

---

## Generating New Domain Adapters

To create a new adapter bundle:

```
/fable-domain create <domain-name>
```

1. **Interview / Identify:** Identify target domain, primary tools, and common failure traps.
2. **Draft Adapter:** Use `references/TEMPLATE.md` as schema.
3. **Define Binding Evidence:** List 2–4 mandatory primary sources (e.g. IaC state file, cloud logs, raw dataset headers).
4. **Define Domain Frauds:** List 3 domain-specific false completion patterns.
5. **Save Adapter:** Save to `.agents/skills/fable-domain/references/<domain-name>.md`.

---

## Available Reference Adapters

- [`devops.md`](references/devops.md): Infrastructure as Code (Terraform, Docker, K8s, CI/CD pipelines, live state checks).
- [`research.md`](references/research.md): Primary document research, literature synthesis, citation verification.
- [`TEMPLATE.md`](references/TEMPLATE.md): Standard schema for crafting custom domain adapters.

Language: en-us only.
