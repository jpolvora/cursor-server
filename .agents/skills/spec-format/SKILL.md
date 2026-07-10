---
name: spec-format
description: >-
  Create, review, or format local *.spec.md artifacts (US/feature spec) for cursor-server.
  Load when the user invokes /spec-format, @spec-format, or asks to create/review/format a spec.
disable-model-invocation: true
version: 1.0
---

# spec-format — canonical `*.spec.md` (cursor-server)

Skill para **criar**, **revisar** ou **formatar** especificações locais (`*.spec.md`) — artefato único e portável de uma feature/US. Substitui a leitura direta do GitHub nas skills downstream; todas leem o `*.spec.md` do diretório de trabalho.

> **Fonte canônica do formato `*.spec.md`.** Outras skills e o `us-workflow` **referenciam** esta skill — não duplicam frontmatter, seções ou regras de validação. Ver também [`AGENTS.md`](../../../AGENTS.md) § Skill loading.

> **Idioma:** respostas ao usuário em **pt-BR**.

## Gatilhos de invocação

| Gatilho | Exemplo |
|---------|---------|
| Comando | `/spec-format`, `@spec-format` |
| Criar | "criar spec", "gerar spec", "nova especificação" |
| Revisar | "revisar spec", "validar spec", "auditar spec" |
| Formatar | "formatar spec", "corrigir formato da spec" |

## Modos

| Modo | Quando | Saída |
|------|--------|-------|
| **criar** | Usuário descreve feature ou fornece issue do GitHub sem spec local | Arquivo `*.spec.md` novo no formato canônico |
| **revisar** | Spec existente com possíveis lacunas ou desvio do formato | Relatório de gaps + correções propostas (editar só com aprovação) |
| **formatar** | Spec com conteúdo válido mas frontmatter/seções fora do padrão | Spec reformatada in-place ou diff proposto |

Se o modo não for explícito, inferir pelo contexto ou perguntar.

## Nome do arquivo

| Origem | Padrão | Exemplo |
|--------|--------|---------|
| Issue GitHub `{id}` | `us-{id}.spec.md` em `.cursor/plans/us-{id}/` | `us-1474.spec.md` |
| Spec local (slug) | `{slug}.spec.md` em `.cursor/plans/{slug}/` | `relatorios-financeiros.spec.md` |

O **slug** do diretório de trabalho (`{us-dir}`) é:
- `us-{id}` quando a entrada é um número de issue do GitHub;
- o basename do arquivo (sem `.spec.md`) quando a entrada é um spec local — ex.: `minha-feature.spec.md` → pasta `.cursor/plans/minha-feature/`.

## Frontmatter YAML (obrigatório)

```yaml
---
id: 1474              # inteiro — número da issue no GitHub; null se spec puramente local
slug: us-1474         # identificador da pasta de trabalho (us-{id} ou nome do spec)
title: "Título da feature"
source: github        # github | local
issueState: open      # opcional — estado da issue quando source=github
issueUrl: "https://github.com/{org}/{repo}/issues/1474"  # opcional
specDate: 2026-07-02  # data de geração ou última atualização relevante
---
```

## Corpo (seções obrigatórias)

```markdown
# Especificação — {title}

## Descrição

(texto da descrição — corpo da issue do GitHub em Markdown quando aplicável)

## Critérios de Aceite

- AC1: …
- AC2: …

## Tasks filhas

(opcional — preenchido quando `source: github` e a issue tinha sub-tasks/checklist)

### Task #{id} — {título}

- **Estado:** …
- **Descrição:** …

## Notas

(links, dependências, contexto extra — opcional)
```

## Regras de validação

1. **Critérios de Aceite** devem ser enumeráveis e testáveis — uma linha por AC.
2. Quando `source: local`, o autor é responsável por ACs completos; não há fetch da issue.
3. O snapshot bruto `*.issue.json` (quando existir) é **somente auditoria** — skills downstream **não** leem `issue.json` diretamente; leem sempre `spec.md`.
4. Specs locais podem ser versionados em `.cursor/plans/specs/` ou em qualquer path — o `us-workflow` copia para `{us-dir}/` no Step 0 se necessário.

## Fluxo — modo revisar

1. Ler o `*.spec.md` informado (ou localizar em `{us-dir}/`).
2. Validar frontmatter, seções obrigatórias e qualidade dos ACs (enumeráveis, testáveis, sem ambiguidade).
3. Cruzar com [`docs/superpowers/specs/2026-05-27-matrix-saas-design.md`](../../../docs/superpowers/specs/2026-05-27-matrix-saas-design.md) quando houver paridade com legado.
4. Emitir relatório:

| Verificação | Status | Correção proposta |
|-------------|--------|-------------------|
| Frontmatter completo | OK / FAIL | … |
| Seção Descrição | OK / FAIL | … |
| ACs testáveis | OK / FAIL | … |

5. **Não editar** sem aprovação explícita do usuário (`aplicar correções`, `formatar`).

## Fluxo — modo criar

1. Coletar título, descrição e ACs (texto livre, issue do GitHub via `gh issue view {n}`, ou rascunho do usuário).
2. Se entrada for número de issue: usar `gh issue view {n}` + `.agents/us-workflow/scripts/github-issue-to-spec.py` (ver `us-workflow` → Specification Protocol).
3. Gerar arquivo no path canônico com frontmatter e seções completas.
4. Confirmar path final ao usuário.

## Consumidores downstream

`us-workflow`, `plan-us`, `refine`, `verify-sync-plan-us`, `integration-validation` leem **`{us-dir}/{slug}.spec.md`** — nunca a API do GitHub diretamente e nunca `*.issue.json`.

## Referências

- Roteamento harness: [`AGENTS.md`](../../../AGENTS.md)
- Arquitetura: [`docs/superpowers/specs/2026-05-27-matrix-saas-design.md`](../../../docs/superpowers/specs/2026-05-27-matrix-saas-design.md)
- Protocolo no workflow: [`.agents/us-workflow/us-workflow.md`](../../us-workflow/us-workflow.md) → Specification Protocol
