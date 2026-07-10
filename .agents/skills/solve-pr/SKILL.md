---
name: solve-pr
description: Skill agêntica para buscar threads abertas da PR (GitHub), corrigir issues de code review com gate cooperativo, validar, commit, resolver threads e push — loop code-review → fix → commit → code-review.
---

# Skill `solve-pr` — correção cooperativa de PR (IDE)

Runtime **IDE** complementar ao **Auto-Fix CI** (`--auto-fix` / `auto-fix.yml`). Ambos seguem o contrato compartilhado [`COOPERATIVE_FIX.md`](COOPERATIVE_FIX.md) — mesmos gates e formato de resposta, **sem acoplamento de código**.

| | Auto-Fix CI | solve-pr (IDE) |
|---|-------------|----------------|
| Gatilho | `workflow_run` / `--auto-fix` | `/solve-pr` manual |
| Correção | Subagente JSON + replacements | Agente IDE (edição direta) |
| Threads | Bot (`PlatformProvider`) | **Todas** as threads abertas (GraphQL) |
| Push | Após resolução OK | Após resolução OK |

## Loop cooperativo

```
code review → developer fix → commit → resolve threads → push → code review → …
```

`solve-pr` lista **todas** as review threads não resolvidas da PR — bot, humano ou outro reviewer.

---

## Pré-requisitos

- Repositório GitHub; branch da PR checked out.
- Token com escrita: `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` (preferido) ou `GITHUB_TOKEN` / `GH_TOKEN`.

---

## Fluxo (gate cooperativo)

### 0. Verificar branch e sincronizar (obrigatório antes de editar)

Evita corrigir threads, commitar e resolver em cima de código desatualizado ou na branch errada.

1. **Confirmar qual branch a PR usa** (head da PR):

```bash
gh pr view <PR_ID> --json headRefName,baseRefName,state
```

2. **Confirmar branch local e remote de push**:

```bash
git branch --show-current
git remote -v
git status
```

- A branch checked out deve ser **`headRefName`** da PR (ex.: `develop`).
- Se o usuário definiu um remote oficial (ex.: `origin` → GitHub), use esse remote no pull/push; não assuma `github` se foi renomeado.

3. **Atualizar a branch local** antes de investigar ou editar:

```bash
git fetch <remote>
git pull <remote> <headRefName>
```

Exemplo: `git pull origin develop`.

4. **Gate:** só prossiga se:
   - a branch local coincide com o head da PR;
   - `git pull` terminou sem conflitos (se houver merge em andamento ou conflitos, **pare** e resolva/alinhe com o usuário antes do passo 1);
   - `git status` não indica divergência inesperada que o usuário não aprovou.

Se a PR estiver **fechada/merged**, informe o usuário e não inicie correções.

> **Modo plano-only:** se o usuário pedir análise/plano sem commit, ainda execute o passo 0 — threads e código local devem refletir o head remoto da PR.

**0b. Auto-Fix CI em execução (se `gh` disponível)**

Antes de editar, verifique se o loop cooperativo CI está ativo e **informe o usuário** na resposta:

```bash
command -v gh
gh pr checks <PR_ID>
gh run list --workflow=agentic-code-review.yml --status in_progress --json status,conclusion,createdAt,url
gh run list --workflow=agentic-auto-fix.yml --status in_progress --json status,conclusion,createdAt,url
```

Workflows: [`agentic-code-review.yml`](../../../.github/workflows/agentic-code-review.yml) dispara [`agentic-auto-fix.yml`](../../../.github/workflows/agentic-auto-fix.yml) (job `auto-fix`).

| Situação | Ação |
|----------|------|
| `gh` indisponível | Seguir sem bloquear; mencionar que o status Auto-Fix não foi verificado |
| Review ou Auto-Fix `in_progress` | Informar usuário (URL do run, horário); recomendar aguardar ou confirmar antes de editar/commitar |
| Nenhum run ativo | Informar brevemente e prosseguir |

Não bloqueie automaticamente — deixe o usuário decidir aguardar ou continuar.

### 1. Recuperar threads abertas

```bash
node .agents/skills/solve-pr/scripts/fetch_threads.cjs <PR_ID>
# JSON para parsing:
node .agents/skills/solve-pr/scripts/fetch_threads.cjs <PR_ID> --json
```

Saída inclui `threadId`, `filePath`, `lineNumber`, `summary` — qualquer thread aberta na PR.

### 2. Investigar e corrigir (paridade com Auto-Fix)

Para **cada thread** listada:

1. Leia arquivo completo + testes/callers relacionados (`read`, `grep`).
2. Aplique correção **cirúrgica** (ver [`AUTO_FIX.md`](AUTO_FIX.md) e Karpathy guidelines).
3. **Não** resolva thread sem alteração comprovada na linha ancorada.
4. Opcional: use mentalmente o contrato JSON (`replacements` + `explanation`) mesmo editando direto.

### 3. Validar

```bash
npm test
```

### 4. Commit local (sem push)

```bash
git add <arquivos>
git commit -m "fix(#<PR_ID>): auto-fix issues from review threads [<THREAD_ID1>, <THREAD_ID2>, ...]"
```

### 5. Resolver threads (gate obrigatório)

Para **cada thread corrigida**, reply + resolve com marcador canônico:

```bash
node .agents/skills/solve-pr/scripts/resolve_thread.cjs <THREAD_ID> "Causa raiz e o que foi corrigido."
```

O script inclui `<!-- resolution-reply -->` (paridade com `src/provider/github.ts`).

> **Gate:** se **qualquer** resolução tentada falhar → **não** faça push. Informe o usuário quais `threadId` falharam.

### 6. Push (somente após resoluções OK)

```bash
git push origin HEAD
```

### 7. Aguardar próxima rodada de code review

Se novas threads aparecerem, reinicie do **passo 0** (branch + pull) e depois do passo 1.

---

## Comportamento cooperativo com code review

- Use o **comentário da thread** como spec da correção (severity, analysis, suggested fix).
- Respostas de resolução usam `<!-- resolution-reply -->` para a próxima rodada reconhecer histórico.
- Não re-levante issues já resolvidas sem nova evidência (mesma política do reviewer).

---

## O que não fazer

- Não investigar nem editar antes do **passo 0** (branch da PR + `git pull`).
- Não push antes de resolver threads tentadas.
- Não refatorar código adjacente à issue.
- Não criar `implementation_plan.md` obrigatório — plano mental ou notas curtas bastam.
