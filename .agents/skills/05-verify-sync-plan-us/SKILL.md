---
name: verify-sync-plan-us
description: Dado um número de US (issue do GitHub), um caminho `*.spec.md` local, ou ambos, confronta critérios/plano com o código no estado atual, gera tabela por feature e extras; grava tudo em `.cursor/plans/{slug}.plan.report.md` sem alterar o `*.plan.md` original.
version: 1.3
disable-model-invocation: true
---

# Verificar implementação vs plano / US (US xxxx)

Esta skill **não implementa código** e **não altera o plano original** (`*.plan.md` usado como referência): ela **audita** a aderência entre (A) a especificação (`*.spec.md` — fonte canônica), (B) opcionalmente a issue no GitHub quando o spec referencia `id` de issue (`source: github`), (C) o plano Markdown local em `.cursor/plans/` (se existir) e (D) o repositório no estado atual (working tree), e em seguida **cria ou sobrescreve** um ficheiro de relatório separado (ver abaixo).

Use quando o usuário pedir para **conferir se a implementação bate com o plano original**, **gerar relatório de aderência da US/spec**, ou invocar explicitamente esta skill com número da US ou `*.spec.md` (ex.: `verify-sync-plan-us 1474`, `verify-sync-plan-us relatorios.spec.md`).

## Entrada

Aceita **uma** das formas (em ordem de prioridade):

| Entrada | Exemplo | Comportamento |
|---------|---------|---------------|
| **`*.spec.md`** | `relatorios.spec.md` | Lê ACs/descrição do spec; `slug` do frontmatter ou basename |
| **Número da US** | `1474` | Procura `.cursor/plans/us-1474/us-1474.spec.md`; se ausente, busca a issue no GitHub (`gh issue view`) e/ou usa plano local |
| **Via workflow** | dispatch Step 6 | Usa `specPath` de `state.md` → `## Artifacts.specSnapshot` |

## Ficheiro de saída (obrigatório)

- **Caminho padrão (convenção flat):** `.cursor/plans/us-{XXXX}.plan.report.md`
- **Caminho alternativo (convenção pasta por US):** `.cursor/plans/us-{XXXX}/us-{XXXX}.plan.report.md` — usado quando o plano de referência escolhido está nessa convenção (ver **§2) Localizar o plano Markdown local → Path de saída condicional**).
- **`{XXXX}`** = id numérico da issue (ex.: US `1474` → `us-1474.plan.report.md`).
- **Hífen duplo** (`--`) antes de `plan.report.md` é intencional, para distinguir de `us-1474-plan.md` e de ficheiros `*.plan.md`.
- **Não** criar `us-{XXXX}-plan.md` como substituto do plano; o único artefacto escrito por esta skill é o **`.report.md`**.
- Se o relatório já existir para essa US, **substitua-o** por uma versão nova (mesmo nome), datada no corpo do documento.

## Pré-requisitos

1. **Spec ou número da US** — pelo menos um deve ser informado (ver **Entrada**). Se nenhum, **pare e pergunte**.
2. GitHub CLI (`gh`) autenticado (opcional — só necessário se spec ausente e precisar buscar a issue):
   - `gh auth status` deve indicar sessão válida contra o remote `origin`.
   - Escopo mínimo de leitura de issues.

Se `gh` não estiver autenticado ou a issue não existir, execute a auditoria **só contra o spec local + plano local + código** e registre no relatório que a fonte GitHub não foi consultada.

---

## Fluxo de execução (ordem obrigatória)

### 1) Carregar especificação (`*.spec.md` — prioridade)

- Resolva `specPath` conforme **Entrada**.
- Leia frontmatter (`id`, `slug`, `title`, `source`) e seções **Descrição**, **Critérios de Aceite**, **Tasks filhas** (formato: skill [`spec-format`](../spec-format/SKILL.md)).
- Derive `{slug}` e `{XXXX}` (`id` da issue quando presente no frontmatter).

**Se spec ausente e só houver número da US:** busque a issue no GitHub (§1b abaixo) ou use o snapshot `us-{id}.issue.json` + `github-issue-to-spec.py` se existir no workflow.

### 1b) Buscar a issue no GitHub (opcional / fallback)

Só quando o spec local não existir ou estiver incompleto (sem ACs) e houver `id` de issue:

- Use o GitHub CLI para obter a issue (detalhe + comentários úteis):

  `gh issue view {id} --repo <owner>/<repo> --json number,title,state,body,labels,comments`

- Persistência mental/arquivo de trabalho: extraia pelo menos:
  - `title`, `state` (confirmar que a issue descreve a feature esperada)
  - `body` (Markdown → texto) — descrição + critérios de aceite embutidos
  - `labels` e `comments` opcionais, quando trouxerem ACs adicionais.

**Implementação prática:** `gh issue view` (saída `--json`) autenticado contra o remote `origin`; opcionalmente materialize `us-{id}.issue.json` (audit-only) e derive o spec via [`github-issue-to-spec.py`](../../us-workflow/scripts/github-issue-to-spec.py).

Se a issue não existir ou não for acessível, documente o erro e siga apenas com plano local + código **sem** afirmar aderência ao texto oficial do GitHub.

### 2) Localizar o plano Markdown local

Busque em **duas convenções de path** (ambas válidas — o repositório usa as duas):

1. **Pasta por US** (convenção `plan-us`/`us-workflow`): `.cursor/plans/us-{XXXX}/us-{XXXX}.plan.md` — verifique primeiro este caminho exato.
2. **Arquivo plano nativo do Cursor** (convenção "flat", usada por planos criados fora do fluxo `plan-us`, ex. via `CreatePlan`): `.cursor/plans/*{XXXX}*.plan.md` diretamente na raiz de `.cursor/plans/` — ex. `us1474_*.plan.md`, `us_1474_*.plan.md`, `*1474*.plan.md`.

Use `Glob` / `Grep` no workspace com o padrão numérico da US em **ambos** os locais antes de decidir.

**Regras (plano de referência = só leitura):**

- **0 arquivos (em nenhuma das duas convenções):** não crie `*.plan.md`. No relatório, declare que nenhum plano local foi encontrado e baseie a análise nos ACs/descrição da issue no GitHub + código.
- **1 arquivo:** use-o apenas como **entrada** (leitura); registe o caminho no relatório em **Plano de referência**.
- **>1 arquivo (inclusive combinando as duas convenções):** escolha o mais recente por data de modificação **ou** o que o título/overview alinharem melhor ao título da US; liste os demais no relatório como candidatos não escolhidos. Nenhum deles deve ser editado.

**Path de saída condicional (segue a convenção do plano escolhido):** se o plano de referência escolhido estiver na convenção **pasta por US** (item 1 acima), grave o relatório em `.cursor/plans/us-{XXXX}/us-{XXXX}.plan.report.md` (mesma pasta do plano) em vez do path flat padrão; se estiver na convenção **flat** (item 2) ou nenhum plano for encontrado, use o path flat padrão `.cursor/plans/us-{XXXX}.plan.report.md` (inalterado).

### 3) Ler o plano e extrair itens verificáveis

Do Markdown local, extraia:

- Itens do YAML `todos:` (`id`, `content`, `status`) se existirem.
- Passos numerados, ACs, tabelas “Critério | Status”, checklist `[ ]`, e caminhos de arquivo citados.

Monte uma **lista canônica de verificações** (uma linha por verificação) priorizando:

1. Critérios de aceite do **`*.spec.md`** (fonte canônica).
2. Critérios de aceite da issue no GitHub (se consultada como fallback).
3. Itens explícitos do plano local (passos / ACs / todos).

Agrupe verificações relacionadas em **features** nomeáveis (uma linha por feature na tabela-resumo final). Uma *feature* é um comportamento ou entregável testável (ex.: “CRUD Plano de Contas”, “Seed idempotente da planilha”, “Filtro por status na listagem”), não um ficheiro isolado.

### 4) Verificar o código e a configuração no estado atual

Para cada verificação, use evidência objetiva:

- `Grep` / `Read` on paths from the plan (e.g. `src/routes/`, `src/services/`, `src/jobs/`, `src/config.ts`).
- Confirm cited tests, Zod schemas, route registration, and SDK disposal patterns when agent code is touched.

Classifique cada verificação internamente (OK / Parcial / ausente); depois **mapeie para a coluna Situação da tabela-resumo** (passo 5):

| Classificação interna | Uso na tabela-resumo |
|-----------------------|----------------------|
| Entrega conforme plano/AC | **Implementada** |
| Ausente ou só esboço | **Falta implementar** |
| Entrega existe mas diverge (outro fluxo, outro endpoint, outro UX, escopo parcial sem equivalência) | **Implementada de forma diferente** — obrigatório explicar *como* difere na coluna Detalhe |

Identifique também **features adicionais**: comportamentos ou superfícies relevantes **presentes no código** que **não** constem nos ACs da issue no GitHub nem no plano local (escopo extra, refino não documentado, task técnica absorvida). Listar-nas na secção obrigatória “Features adicionais ao plano original”.

### 5) Relatório final obrigatório (chat + ficheiro `us-{XXXX}.plan.report.md`)

No **fim** da execução, o resultado principal deve ser **uma tabela** (Markdown) com **cada feature** do escopo planejado/ACs, no seguinte formato fixo:

| Feature (nome curto) | Situação | Detalhe / evidência |
|----------------------|----------|---------------------|
| … | **Implementada** \| **Falta implementar** \| **Implementada de forma diferente** | Para *Implementada*: ficheiros ou símbolos-chave. Para *Falta*: o que falta. Para *Diferente*: plano pedia X, código fez Y. |

**Coluna opcional "Qualidade" (só quando explicitamente solicitado por quem invoca, ex. `us-workflow` Step 6):** adicione uma 4ª coluna **Qualidade** com um dos valores **Excelente** (seguiu o design/DDD corretamente, clean code) | **Regular** (funcional mas com espaço para refactor menor) | **Insuficiente** (parcial, com bug, ou viola rule do projeto) — preenchida apenas para linhas com Situação **Implementada** ou **Implementada de forma diferente**. Quando não solicitada explicitamente, **omita** esta coluna (mantenha a tabela de 3 colunas padrão).

**Regras da tabela:**

- **Uma linha por feature** (agrupe ACs miúdos na mesma feature quando forem o mesmo entregável).
- A coluna **Situação** só pode usar os três valores acima (não usar “OK/Parcial” na tabela-resumo; traduza para uma das três situações; se estiver incompleto, use **Falta implementar** e detalhe o gap em **Detalhe**).
- Inclua features do plano que foram **canceladas / fora de escopo** como linha com Situação **Falta implementar** ou nota “Fora de escopo (data)” em **Detalhe**, conforme evidência — não apagar do relatório.

Em seguida, **obrigatoriamente**, uma segunda tabela ou lista:

#### Features adicionais ao plano original

Comportamentos ou entregas **relevantes** no código **não** pedidos pelo plano nem pelos ACs da issue. Se não houver nenhuma, escrever explicitamente: *“Nenhuma feature adicional identificada.”*

| Feature / comportamento extra | Onde no código (ficheiro / área) | Nota |
|-------------------------------|----------------------------------|--------|
| … | … | … |

Opcionalmente, após as duas tabelas: bullets curtos de **riscos** (segurança, permissões, multi-tenant) se aplicável.

**Ordem de apresentação no chat:** tabela-resumo por feature → features adicionais → (opcional) riscos — **o mesmo conteúdo** deve ser gravado no ficheiro do passo 6.

### 6) Gravar relatório em ficheiro separado (obrigatório)

Crie ou sobrescreva **exclusivamente** no path determinado pelo **Path de saída condicional** (§2):

- `.cursor/plans/us-{XXXX}.plan.report.md` (convenção flat), **ou**
- `.cursor/plans/us-{XXXX}/us-{XXXX}.plan.report.md` (convenção pasta por US)

**Proibido:** editar, acrescentar secções ou alterar YAML de qualquer `*.plan.md` usado como referência no passo 2.

**Conteúdo mínimo do `.report.md`:**

1. **Frontmatter YAML** (opcional mas recomendado):

```yaml
---
us: XXXX
reportDate: AAAA-MM-DD
sourcePlans: []   # lista de caminhos relativos aos .plan.md lidos, ou []
githubSource: gh | none
---
```

2. **Corpo** — copiar para o ficheiro o mesmo bloco exigido no chat (tabelas + gaps), com título principal sugerido:

```markdown
# Relatório de implementação — US XXXX

**Gerado em:** AAAA-MM-DD
**Issue:** [#XXXX](https://github.com/{owner}/{repo}/issues/XXXX) — Estado no GitHub: {State}
**Plano de referência (somente leitura):** `caminho/relativo/plano.plan.md` | *nenhum encontrado*
**Fonte GitHub:** lida via `gh` | *não consultada (motivo)*

## Resultado por feature (plano + ACs)

(tabela obrigatória — igual ao passo 5)

## Features adicionais ao plano original

(tabela ou frase *Nenhuma feature adicional identificada.*)

## Gaps e próximos passos

- …
```

3. **Datas:** use a data corrente do ambiente (campo “Today” da sessão) em `reportDate` e no corpo.

---

## Regras de conduta

- **Imutabilidade do plano original:** ficheiros `*.plan.md` identificados como plano da US são **apenas leitura**. Qualquer saída estruturada vai para `us-{XXXX}.plan.report.md`.
- **Relatório:** o fecho da skill é sempre a **tabela por feature** (três situações) + **features adicionais** (ou frase explícita de ausência), no chat **e** no ficheiro `.report.md`; não substituir por apenas narrativa.
- **Precisão:** não marque **Implementada** sem caminho de arquivo ou símbolo (classe/método) que sustente.
- **Escopo:** não refatore o app; leitura do código e dos planos; **escrita** apenas em `.cursor/plans/us-{XXXX}.plan.report.md`.
- **Segredo:** nunca copie tokens de autenticação (`gh auth token`) para dentro de Markdown.
- **Coerência com plan-us:** where the plan cited cursor-server guardrails (thin routes, Zod validation, local SDK runtime, agent disposal, `REPOS_ROOT` resolution), repeat in the evidence column when verifying those items.

---

## Referências cruzadas

- **Busca e autenticação GitHub:** `gh` CLI (`gh issue view`); script [`github-issue-to-spec.py`](../../us-workflow/scripts/github-issue-to-spec.py)
- **Formato esperado do plano original:** [`01-plan-us`](../01-plan-us/SKILL.md)
- **Exemplo de verificação só com plano local (legado):** `.cursor/plans/verificação_us_1815_e90590cc.plan.md`

---

## Gatilhos sugeridos para o usuário

- “Gera o relatório da US 1474 (`us-1474.plan.report.md`)”
- “A US 1815 está de acordo com o GitHub e o plano?”
- `@[verify-sync-plan-us] 1474`
