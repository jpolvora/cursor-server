---
name: goal-fix-pr
description: Loop solve-pr até zerar threads abertas no GitHub — auto-aprova gates, commit/push e re-checa após 2 minutos.
disable-model-invocation: true
---

# goal-fix-pr

Criterion-driven loop sobre [`solve-pr`](../solve-pr/SKILL.md). Para quando **convergence** — zero threads abertas na PR — ou o usuário parar.

## Parse

```
/goal-fix-pr <PR-NUMBER> [dry-run] [max <n>]
```

| Token | Exemplo | Efeito |
|-------|---------|--------|
| `<PR-NUMBER>` | `15` | Número da PR no GitHub (`owner/repo` do remote) |
| `dry-run` | `/goal-fix-pr 15 dry-run` | Sem commit, push nem `resolve_thread` real |
| `max <n>` | `max 10` | Teto de iterações (default **20**) |

Malformed → mostrar usage acima.

Restate antes de agir: **PR number**, **success criteria**, **mode** (Drive + post-push heartbeat), **max iterations**, **dry-run**.

## Success criteria

**Convergence:** após `collect`, `len(activeThreads) == 0` em `context.json`.

Somente threads **ativas** não resolvidas retornadas por `fetch_threads.cjs --json` (`isResolved == false`).

## Pré-requisitos

- Repositório GitHub; `gh` disponível para metadados da PR.
- Token com escrita: `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` (preferido) ou `GITHUB_TOKEN` / `GH_TOKEN`.
- Branch local = head da PR antes de cada rodada ([`solve-pr` passo 0](../solve-pr/SKILL.md)).

## Automation overrides (solve-pr)

Esta skill **substitui** confirmações humanas do fluxo cooperativo. Ao executar sob `goal-fix-pr`:

| Gate solve-pr | Comportamento |
|---------------|---------------|
| Confirmação de plano / “executar?” | **Auto-sim.** Grave `plan-gate.md` e `plan-exec.md` em `runs/pr-<N>/`, prossiga sem `AskQuestion`. |
| Commit + resolve + push | **Auto** (salvo `dry-run`). Ordem: validar → commit local → `resolve_thread` → push. |
| Threads **Escalar** | **Pare** a iteração, reporte thread IDs e aguarde humano — não auto-aprovar ambiguidade de produto. |
| Auto-Fix CI `in_progress` | **Informe** o usuário; não bloqueie automaticamente (mesma regra do solve-pr). |

Todo o restante permanece: branch sync, análise por thread, correção cirúrgica, contrato [`COOPERATIVE_FIX.md`](../solve-pr/COOPERATIVE_FIX.md), guardrails [`senior-developer`](../../senior-developer/SKILL.md).

## Core loop

Copie e atualize a cada iteração:

```
Goal: solve-pr PR-<N> until convergence
Success: activeThreads == 0
Iteration: <n>/<max>
- [ ] branch sync (PR head)
- [ ] collect + count
- [ ] solve-pr round (se > 0)
- [ ] verify build/tests + code-review
- [ ] commit + resolve + push (se código)
- [ ] wait 2m + re-collect
```

### 1. Baseline (iteração 1)

```bash
mkdir -p .agents/skills/solve-pr/runs/pr-<PR-NUMBER>

gh pr view <PR-NUMBER> --json headRefName,baseRefName,state,url

node .agents/skills/solve-pr/scripts/fetch_threads.cjs <PR-NUMBER> --json \
  > .agents/skills/solve-pr/runs/pr-<PR-NUMBER>/context.json
```

Conte `activeThreads`. Se **0** → relatório final e **pare** (PR já convergiu).

Se `gh pr view` indicar PR **merged/closed**, pare e informe o usuário.

### 2. Act — rodada solve-pr

1. Carregue [`solve-pr/SKILL.md`](../solve-pr/SKILL.md) e execute **passos 0–7** para as threads ativas atuais, aplicando **Automation overrides** acima.
2. Uma rodada = sync branch → investigar/corrigir → validar → commit → resolve threads → push (ou simulação em dry-run).
3. Mensagem de commit (paridade solve-pr): `fix(#<PR-NUMBER>): auto-fix issues from review threads [<threadId>, ...]`.
4. Resolução de thread:

```bash
node .agents/skills/solve-pr/scripts/resolve_thread.cjs <THREAD_ID> "<causa raiz + fix; incluir Modelo LLM: <identificador>>"
```

Em **dry-run**, não invoque `resolve_thread.cjs` nem `git push`; simule no log.

5. Se classificação resultar só em **Escalar** → pare o goal e liste threads bloqueadas.

### 3. Verify (obrigatório)

Sem claim de progresso sem evidência fresca:

| Check | Evidência |
|-------|-----------|
| Build/tests | Output of `npm run typecheck` / `npm run build` |
| Auto-revisão | Status **"Sem feedback"** da skill [`code-review`](../code-review/SKILL.md) |
| Publicação | Hash do commit + confirmação de push (ou log dry-run) |
| Threads resolvidas | `resolve_thread.cjs` exit 0 (ou skip documentado em dry-run) |

Falha 3× idêntica na mesma verificação → pare e escale.

### 4. Post-push heartbeat (2 minutos)

Após commit/push **ou** rodada só com resolve sem código, arme **um** sleeper de 120s antes da próxima coleta — novos comentários de CI/reviewer podem chegar após o push.

Sentinel único por sessão: `AGENT_GOAL_WAKE_fixpr_<PR-NUMBER>`.

```bash
sleep 120
echo 'AGENT_GOAL_WAKE_fixpr_<PR-NUMBER> {"reason":"post-push","prompt":"Re-collect PR-<PR-NUMBER> and continue goal-fix-pr loop"}'
```

- `notify_on_output` com regex `^AGENT_GOAL_WAKE_fixpr_<PR-NUMBER>`.
- Rastreie PID; mate ao concluir ou ao usuário pedir stop.
- **Não** duplique sleepers — um por vez.

### 5. Re-collect e re-arm

No wake (ou imediatamente se dry-run sem push):

1. `fetch_threads.cjs --json` de novo → conte `activeThreads`.
2. **0** → **done** (convergence).
3. **> 0** e `n < max` → iteração `n+1` (volte ao passo 2; inclua branch sync).
4. **n ≥ max** → pare, reporte threads restantes, peça `max` maior ou intervenção humana.

## Modo

| Fase | Modo |
|------|------|
| Análise + correção + push | **Drive** |
| Espera pós-push | **Watch** (timer 2m) |

Iteração 1 roda **agora** após armar o primeiro sleeper (só após push real; em dry-run, re-coleta imediata sem espera).

## Stop

| Condição | Ação |
|----------|------|
| `activeThreads == 0` | Relatório final + mate sleeper |
| Usuário diz stop | Mate sleeper, resuma progresso |
| Thread **Escalar** | Pare, liste bloqueios |
| `n >= max` | Pare, liste threads ativas |
| Coleta GitHub falha | Pare — não improvise API |

## Relatório final

1. Iterações executadas e critério de parada.
2. Threads tratadas por rodada (corrigida / resolvida / escalada).
3. Links dos relatórios `.cursor/codereviews/PR-<N>-rodada-*.md` (se gerados).
4. Commits (hash + mensagem) e confirmação de push.
5. Contagem final `activeThreads` com evidência do último `collect`.
6. Modelo LLM usado nas resoluções.
7. URL da PR (`gh pr view --json url`).

## Dependências

| Recurso | Path |
|---------|------|
| Fluxo de correção | [`solve-pr/SKILL.md`](../solve-pr/SKILL.md) |
| Contrato cooperativo | [`solve-pr/COOPERATIVE_FIX.md`](../solve-pr/COOPERATIVE_FIX.md) |
| Coleta threads | `.agents/skills/solve-pr/scripts/fetch_threads.cjs` |
| Resolver thread | `.agents/skills/solve-pr/scripts/resolve_thread.cjs` |
| Code review | [`code-review/SKILL.md`](../code-review/SKILL.md) |
| Padrão goal/loop | Skill `goal` (sentinel + verify) |

Walkthroughs: [`examples.md`](examples.md).
