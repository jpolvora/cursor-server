# Modular Orchestrator — Reference Manual

## State Management (`.state.json`)

The state of a workflow instance is tracked in `.cursor/plans/{slug}/{workflow-id}.state.json`. It coordinates context, step execution status, target LLMs, file logs, and workflow-local memory.

### Schema

```json
{
  "workflowId": "string (UUID or timestamp)",
  "slug": "string (e.g. us-1234 or feature-name)",
  "status": "active | completed | cancelled",
  "currentStep": 1,
  "completedSteps": [0],
  "baselineCommit": "string (git SHA)",
  "stepLlms": {
    "1": "gemini-3.5-thinking",
    "2": "gemini-3.5-flash",
    "3": "gemini-3.5-flash",
    "4": "gemini-3.5-coder",
    "5": "gemini-3.5-thinking",
    "6": "gemini-3.5-coder"
  },
  "stepHistory": [
    {
      "step": 1,
      "llm": "gemini-3.5-thinking",
      "startedAt": "string (ISO UTC)",
      "endedAt": "string (ISO UTC)",
      "status": "success | failed",
      "action": "advance | repeat | back | cancel"
    }
  ],
  "context": {
    "specFile": "string (absolute path)",
    "planningFile": "string (absolute path)",
    "refinementFile": "string (absolute path)",
    "delegationFile": "string (absolute path)",
    "filesTouched": {
      "modified": ["string"],
      "created": ["string"],
      "deleted": ["string"]
    },
    "verificationScore": 0,
    "commits": ["string (git SHAs)"]
  },
  "localMemory": {
    "trapsAndPitfalls": [
      {
        "step": 1,
        "description": "string",
        "workaround": "string",
        "detectedAt": "string (ISO UTC)"
      }
    ]
  },
  "checkpoints": [
    {
      "step": 1,
      "tag": "mod-wf/{workflow-id}/before-step-1",
      "sha": "string"
    }
  ]
}
```

---

## FSM Transition Gates

Every step ends with an `AskQuestion` gate presenting the following transition choices:

```
[Ação] Selecione a ação para o próximo passo no workflow:
1. Avançar para o Step N (recomendado)
2. Repetir o Step N-1
3. Voltar para um Step anterior...
4. Alterar o Modelo LLM do próximo Step
5. Cancelar / Pausar o workflow
```

### 1. Next (Avançar)
- Creates git tag checkpoint `mod-wf/{workflow-id}/before-step-{N+1}` at current `HEAD`.
- Advances `currentStep` to `N`.
- Triggers step execution with the registered LLM for Step `N`.

### 2. Repeat (Repetir)
- Reverts local git changes of the current step to the tag `mod-wf/{workflow-id}/before-step-{N}`.
- Dispatches the current step again.

### 3. Previous / Back (Voltar)
- Asks the user which target step `M` they wish to rollback to.
- Rolls back code changes to checkpoint `mod-wf/{workflow-id}/before-step-{M}`.
- Clears progress in `completedSteps` and history for steps $\ge M$.
- Sets `currentStep` to `M` and redispatches.

### 4. Change LLM (Alterar Modelo)
- Prompts user to select the preferred LLM (Thinking, Coder, Flash, etc.) for the target step.
- Saves choice in `stepLlms` within the state JSON.
- Returns to the transition gate.

### 5. Cancel / Pause (Cancelar / Pausar)
- Sets status to `cancelled`.
- Cleans up worktrees if active.
- Saves final state.

---

## Traps & Pitfalls Propagation

1. **Detection**: When a step encounters a bug, test failure, build error, or logic gap, the executing subagent records it under `localMemory.trapsAndPitfalls`.
2. **Context Feeding**: Before starting *any* step, the orchestrator reads `localMemory.trapsAndPitfalls` and prepends these to the agent instruction context.
3. **Generalization**: On workflow completion (Step 6), generalizable pitfalls are appended to the root `MEMORY.md`.
