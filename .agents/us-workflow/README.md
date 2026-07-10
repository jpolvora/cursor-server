# US Delivery Workflow — Guia rápido

> **Human audience.** Orchestrator FSM lives in [`us-workflow.md`](us-workflow.md) v8.4 — English agent contract; do not use it for onboarding. Use this README + FAQ + diagrams.
>
> **v8.4:** English-only orchestrator output (gates, board, banners). Native tools (`Task`, `AskQuestion`, `Shell`, MCP). Steps delegate skills `01`–`07`.

Pipeline end-to-end for delivering a User Story in **cursor-server** using **orchestrator + subagents** with clean context, shared state, and confirmation gates.

> **v8.1:** **7 fases (F0–F6)** sobre steps internos 0–12; **Authorization Ladder** (gates enforced + hard stops HS-1..5); **Refinement FSM**; **Worktree Fallback**; **State Hygiene** obrigatório (+ `validate_state.py`); steps 4/8 são **sub-gates de modelo**; `state.md` registra memória local por workflow e `MEMORY.md` concentra padrões compartilhados.

| Documento | Público | Conteúdo |
|-----------|---------|----------|
| **Este README** | Humanos + agentes | Visão geral, fases, steps, gates, happy path |
| [`docs/faq.md`](docs/faq.md) | Humanos + clientes | FAQ na ordem de execução — o que cada step faz, input/output, dúvidas frequentes |
| [`us-workflow.md`](us-workflow.md) | **Agent (FSM)** | v8.5 — English; no plan-dir commits until Step 12; `{slug}.result.md` delivery |
| [`stack.md`](stack.md) | Orquestrador + subagentes | Stack .NET 10 + React/Vite — comandos build/test/lint, paths, regras e diff scope |
| [`DIAGRAM.md`](DIAGRAM.md) | Referência visual | Fluxogramas Mermaid |

**Entrada no projeto:** [`AGENTS.md`](../../AGENTS.md).

---

## Fases (visão v8.1)

| Fase | Nome | Steps | Executor |
|------|------|-------|----------|
| **F0** | Bootstrap | 0 | Orquestrador |
| **F1** | Especificação | 1, 2, 3 | Subagente (Planner) |
| **F2** | Implementação | 4†, 5 | Subagente (Coder) |
| **F3** | Verificação + 1º commit | 6, 7 | Subagente (Verifier) + Orquestrador + shell |
| **F4** | Review + correções | 8†, 9, 10 | Subagente (Reviewer + Coder) |
| **F5** | Integração pré-PR | 11 | Subagente (Verifier) + browser opcional |
| **F6** | Fechamento | 12 | Orquestrador + shell |

† Steps **4 e 8** não são mais steps do board — são **sub-gates de modelo** (F1→F2 e F3→F4), nunca entram em `completedSteps`.

### Happy path (v8.1)

```text
/us-workflow 2416
  → F0: bootstrap, issue GitHub (gh), state, gate → F1
  → F1: plan (1) → refinement FSM se blocking (2) → DAG (3) → model sub-gate → F2
  → F2: implementa DAG na branch (worktree se estável, senão branch-direct) → verify files/build → gate → F3
  → F3: report readonly (6) → gate COMMIT explícito G2 (7) → model sub-gate → F4
  → F4: review diff escopado (9) → gate → fix subagente Coder (10) → gate COMMIT G2 → F5
  → F5: plano integração → gate → bateria (+ browser se aprovado) → F6
  → F6: §Doc → cleanup → consentimento de push (opcional) → completed
```

Pausa em qualquer gate → "Pausar workflow" → estado salvo; retomar com `/us-workflow 2416`.

---

## Como iniciar

```text
@[us-workflow] 2338
@[us-workflow] dry-run 2338
@[us-workflow] auto 2338
@[us-workflow] automatico dry-run 2338
@[us-workflow] auto skip-integration 2338
@[us-workflow] auto skip-tests skip-integration 2338
@[us-workflow] us-2375.plan.md
@[us-workflow] soft-delete em fornecedores
```

Estado persistente: `.cursor/plans/us-{id}/{workflow-id}.state.md` (campos `dryRun`, `autoMode`, `skipIntegration`, `skipTests`). **Tudo** do workflow vive sob `.cursor/plans/us-{id}/` — nada é gravado em `.agents/`.

Ao iniciar em **modo normal**, o workflow verifica se já existe estado ativo em `.cursor/plans/*/*.state.md`. Se existir, apresenta menu para checar e continuar, iniciar um novo workflow ou cancelar.

### Modo automático (`auto` / `automatico`)

Pipeline **sem menus interativos**: o orquestrador escolhe sempre a **opção recomendada** de cada gate e dispara o próximo step no mesmo turno.

- **Retoma** apenas workflow **`autoMode: true` ativo da mesma US** (continua de `currentStep`).
- **Ignora** outros workflows ativos (qualquer US/modo) — inicia fluxo novo se não houver auto ativo para aquela US.
- **Combina com dry-run** → simulação completa sem commits nem edição de código; **browser sempre pulado** no Step 11.
- **Hard stop** em falhas irrecuperáveis (3 retries, build/test esgotado) — pausa e avisa; reinvocar `auto US {id}` retoma.

Prefixo nas mensagens: `[AUTO]` (e `[DRY-RUN]` se aplicável).

Em **auto** e/ou **dry-run**, cada step exibe banners obrigatórios no chat:

```text
**Iniciando step 5 Implementação (DAG)**
…
**Fim do step 5 Implementação (DAG)**
```

### Dry-run (simulação)

Simula o fluxo completo (gates, planos, exec, verify, review, **validação integração**) **sem**:

- commits ou push
- edição de `src/` (steps 5, 10 e correções do 11)
- automação browser / seed de dados
- worktrees
- alterações em `MEMORY.md` (raiz)

Útil para validar plano e DAG antes de implementar. Detalhes em [`us-workflow.md`](us-workflow.md).

### Flags de skip (`skip-integration` / `skip-tests`)

Flags independentes, combináveis com `auto` e `dry-run`, em qualquer ordem:

- **`skip-integration`** (ou `pular-integracao`) → `skipIntegration: true`: pula o **Step 11 por completo** — não gera plano de testes de integração, não executa bateria nem browser. Marca `11` em `skippedSteps`/`completedSteps`, registra no `## Gate history` e avança direto ao Step 12. Em **auto**, é a forma de pular toda a parte de integração/browser.
- **`skip-tests`** (ou `pular-testes`) → `skipTests: true`: pula a **execução das suites de teste** registradas em [`stack.md`](stack.md) no **Build & Test Validation Protocol** (Steps 7 e 10) e no §3 do Step 11. O **build continua rodando** (comandos de build em `stack.md`) — commit nunca acontece com build quebrado. `verification.tests: skipped`; avisa o usuário uma vez.

---

## Steps enumerados

Cada step termina com **consolidação de documentação** (§Doc), **checkpoint git** (`before-step-{N+1}`) e **Transition Gate** com navegação **next / repeat / previous / pause**. Steps 4 e 8 integram troca de modelo no gate (sem turno separado). Todas as decisões do usuário são **menus de opções** (`AskQuestion`), não texto livre.

| # | Nome | Quem executa | Objetivo |
|---|------|--------------|----------|
| **0** | Bootstrap | Orquestrador | State, snapshot da issue, contexto MEMORY |
| **1** | Planejar | Subagente | `us-{id}.plan.md` (plano detalhado .NET 10 + React) |
| **2** | Refinement | Subagente | Grilling conduct — uma pergunta/rodada, codebase antes de escalar, gate de entendimento compartilhado |
| **3** | Exec + DAG | Subagente | `*.plan.exec.md` + `*.exec.dag.json` + memory-conflict |
| **4†** | **Coder readiness** | **Sub-gate F1→F2** | Troca para modelo Coder embutida no gate (não é step do board) |
| **5** | Implementar | Subagente(s) Coder | Código por level do DAG (paralelo até 3) + learning |
| **6** | Verificar | Subagente (readonly) | `us-{id}.plan.report.md` (tabela de qualidade da implementação vs plano) |
| **7** | Decidir + commit | Orquestrador + subagente + shell | Gate G2; pode disparar validação/correção antes do commit e depois commitar ou voltar ao Step 5 |
| **8†** | **Review readiness** | **Sub-gate F3→F4** | Troca para modelo de review embutida no gate (não é step do board) |
| **9** | Code review | Subagente | Critical / Warning (diff vs master) |
| **10** | Fix + fechar | Subagente + shell | 2º commit + `us-{id}.report.md` + learning |
| **11** | **Validação integração** | Subagente + browser + shell | Bateria de testes (gerar plano, exibir p/ revisão, pular/executar) |
| **12** | Cleanup | Orquestrador + shell | §Doc final, limpeza temporários, consentimento de push |

### Step 11 — validação de integração (resumo)

Antes de executar os testes de integração e abrir a PR (manual), o workflow:

1. Roda o **Integration Validation Protocol** e elabora o plano de testes `us-{id}.integration-test.plan.md`.
2. Exibe o plano (ou resumo) ao usuário e pergunta se deseja continuar ou pular (pulado em **auto**).
3. Se **Aprovar e executar** (modo normal): build, testes, seed, API/permissões — **browser só se não for auto nem dry-run**.
4. Em **`auto` ou `dry-run`:** **§6 browser sempre pulado** — relatório marca UI ACs como `⏭ pulado`; validar UI manualmente antes da PR.
5. **Pular validação:** avança direto ao Step 12.
6. Falhas: correções → revalida (até 3 iterações).

### Regra de ouro

Após confirmar no Transition Gate, o orquestrador **dispara o próximo step no mesmo turno**. Steps 4 e 8 embutem a troca de modelo no gate de avanço (Step 3→5 e Step 7→9).

---

## Checkpoints git

Tags locais **nunca pushed**:

```text
uswf/{workflow-id}/before-step-1   # baseline (Step 0)
uswf/{workflow-id}/before-step-2   # antes do Step 1 mutar
…
uswf/{workflow-id}/before-step-13  # após Step 12
```

- Criadas após cada step completar; espelhadas em `state.md` → `checkpoints[]`.
- **Backward Navigation** e **Repetir Step N** usam o **Checkpoint Revert Algorithm** ancorado na tag alvo.
- Removidas no Step 12 (ou full reset); commits vão no push, tags não.

---

## Gates — navegação next / repeat / previous / skip

### Transition Gate (após cada step)

| Ação | Opção no menu |
|------|----------------|
| **Next** | Avançar para Step N+1 |
| **Repeat** | Repetir Step N (revert parcial se já houve `files_touched`) |
| **Previous** | Voltar para Step anterior — sub-menu por fase (Planejamento / Implementação / Review / Validação) |
| **Pause** | Pausar / cancelar sem reverter / cancelar e reverter tudo |

**Step 11 — skip:** **Pular validação** no gate de confirmação do plano de testes (avança direto ao Step 12).

**Step 2 — refinement:** uma pergunta por rodada; **Encerrar refinamento e avançar** aplica defaults e leva ao gate **Shared Understanding**; Step 3 só após **Confirmo entendimento compartilhado**.

### Backward Navigation (Previous)

Volta a **qualquer step já concluído** (1–3, 5–7, 9–11), não só repetir o atual:

1. Escolher fase → step alvo `M`
2. Preview: *Será desfeito* (Steps M–N) vs *Será preservado*
3. Confirmar → Checkpoint Revert + redispatch imediato do Step M

Atalho: Step 7 **Refazer implementação com outro modelo Coder** = voltar ao Step 5.

---

## Protocolos internos (us-workflow.md)

| Protocolo | Usado em | Função |
|-----------|----------|--------|
| **Authorization Ladder** | todos | Gates enforced G0–G3 + hard stops HS-1..5 (nenhum commit/push sem gate) |
| **Transition Discipline** | transições | Regra única: normal dispara após o gate; auto dispara no mesmo turno |
| **Refinement FSM** | 2 | Audit → Resolve → Escalate → Exit; registry persistido; blocking/non-blocking |
| **Worktree Fallback** | 5, 10, 11 | branch-direct no Windows/path longo + verificação pós-step |
| **State Hygiene** | todos | Sync obrigatório do state pós-step + asserts (`validate_state.py`) |
| Memory consultation | **início de todo step** | Ler primeiro `## Workflow memory`, `## Accumulated decisions` e `## Doc consolidation log` do `state.md`, depois `MEMORY.md` (raiz) só no escopo relevante — reaproveitar patterns e evitar repetir erros já vistos no workflow |
| Context loading | 1, 2, 5 | Docs, rules, glossário de domínio |
| Specification | 0 (fetch/resolve), 1–2/6/11 (read) | Entrada: **US id** ou **`*.spec.md`**. Modo GitHub: `gh issue view {n}` → `*.issue.json` → `github-issue-to-spec.py` → **`{slug}.spec.md`** (canônico). Skills downstream leem **spec**, não a issue direto |
| Memory-conflict | 2, 3 | Script Python vs `MEMORY.md` (raiz) |
| Integration validation | 11 | Plano + execução browser/API/seed |
| Step checkpoint | 0–12 | Tags git `uswf/{id}/before-step-{N}` |
| Step dispatch | 1–11 | Subagent dedicado + tag âncora + worktree step-scoped (5/10/11) |
| Checkpoint revert | reset / previous / repeat | Revert escopado via `## Step file log` |
| Learning (escrita) | **ao fim de cada step + sweep final no Step 12** | Persistir incrementalmente em `MEMORY.md` aprendizados técnicos genéricos aprovados pelo gate de escrita |

Scripts locais: `.agents/us-workflow/scripts/check_memory_conflict.py`, `.agents/us-workflow/scripts/validate_state.py`

---

## Consolidação de documentação (§Doc)

Ao fim de **cada** step (0–11), o orquestrador executa o checklist §Doc antes do gate pós-etapa. Registro em `state.md` → `## Workflow memory` e `## Doc consolidation log`, com consolidação incremental em `MEMORY.md` quando o aprendizado já passar no gate de escrita. O Step 12 faz o sweep final e a limpeza.

---

## Paralelização (DAG)

- Step 3 gera `us-{id}.exec.dag.json` com `levels` e `parallelGroup`.
- Step 5 executa **level a level**; dentro do level, até **3** subagentes `generalPurpose` em paralelo.
- **Isolamento:** um worktree git **por step de código** (5, 10, 11) — não por tarefa DAG. Ver **Step Dispatch & Isolation Protocol** em `us-workflow.md`.

Exemplo de levels: `[T1] → [T2, T3] → [T4]`

## Isolamento por step (resumo)

| Step | Subagent | Worktree | Tag âncora |
|------|----------|----------|------------|
| 1–3, 6, 9 | `generalPurpose` | — (repo root) | `before-step-{N}` |
| 5, 10, 11 | `generalPurpose` | `.cursor/plans/us-{id}/worktrees/step-{N}/` | `before-step-{N}` |
| 7, 12 (shell) | `shell` | — | — |
| Todos | **fresh Task** — nunca `resume` entre steps | máx. 1 worktree ativo | checkpoint local |

---

## Artefatos principais

Tudo sob a pasta de trabalho `.cursor/plans/{slug}/` (uma por feature/US). `MEMORY.md` é compartilhado na raiz.

| Artefato | Caminho |
|----------|---------|
| Estado | `.cursor/plans/{slug}/{workflow-id}.state.md` |
| **Spec (canônico)** | `.cursor/plans/{slug}/{slug}.spec.md` |
| Issue GitHub (auditoria, opcional) | `.cursor/plans/{slug}/{slug}.issue.json` |
| Plano | `.cursor/plans/{slug}/{slug}.plan.md` |
| Exec | `.cursor/plans/{slug}/{slug}.plan.exec.md` |
| DAG | `.cursor/plans/{slug}/{slug}.exec.dag.json` |
| Verificação | `.cursor/plans/{slug}/{slug}.plan.report.md` |
| Entrega | `.cursor/plans/{slug}/{slug}.report.md` |
| Plano testes integração | `.cursor/plans/{slug}/{slug}.integration-test.plan.md` |
| Relatório testes integração | `.cursor/plans/{slug}/{slug}.integration-test.report.md` |
| Worktrees (git-ignored) | `.cursor/plans/{slug}/worktrees/step-{N}/` |
| Baseline (git-ignored) | `.cursor/plans/{slug}/{workflow-id}.baseline/` |
| Memória técnica (raiz, compartilhada) | `MEMORY.md` |

---

## Fora do escopo

- Abrir/atualizar Pull Request ([`solve-pr`](../skills/solve-pr/SKILL.md) é manual) — **após Step 12**
- Push sem consentimento explícito no gate do **Step 12** (após validação integração no Step 11)
