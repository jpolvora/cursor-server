---
name: modular-orchestrator
description: Coordinates execution subagents step-by-step through a stateful FSM using modular step files, shared memory, and askQuestion gates. Use when orchestrating complex user story delivery, running multi-step tasks with agent transitions, or managing iterative agent loops with model swapping.
---

# Modular Orchestrator

## Quick start

To start a new workflow using the modular orchestrator:
1. Initialize a workflow state under `.cursor/plans/{slug}/{workflow-id}.state.json` using the `state_template.json` structure.
2. Load the modular orchestrator skill to run step-by-step.

## Workflows

1. **Bootstrap & Init**: Prepare state tracking, baseline commit, and check existing active workflows.
2. **Execute Step N**:
   - Resolve context and load step definition `steps/{N}-{step-name}.md`.
   - Dispatch task to step-specific subagent with target LLM.
   - Run verification and capture outputs.
3. **Transition Gate**:
   - Collect step logs and write workflow traps/pitfalls.
   - Present transition menu: Next, Repeat, Previous (Back), Change LLM, or Cancel.
   - Switch LLM if requested, transition state, and dispatch next step.

## Advanced features

See [REFERENCE.md](REFERENCE.md) for FSM details, state JSON schema, git rollback mechanics, and learning logs.
