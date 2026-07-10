---
name: write-spec
description: >
  Draft, brainstorm, grill, and refine a technical feature specification.
  Use when user wants to create, refine, or write a spec, or starts with a high-level feature description.
version: 1.0
disable-model-invocation: true
---

# Write Spec (write-spec)

Esta skill orquestra a criação, brainstorm, grilling e refino de uma especificação técnica local de US/feature antes de qualquer planejamento de implementação ou codificação. O artefato final é salvo em `specs/[slug].spec.md` na raiz do repositório.

## Diretrizes de Execução (Grilling Conduct)

Atue de acordo com o protocolo **Grilling Conduct** (baseado em Matt Pocock):

1. **Captura Inicial e Rascunho**: Receba a descrição da feature do usuário e elabore um rascunho estruturado seguindo o formato canônico.
2. **Varredura de Gaps (Auditoria)**: Identifique lacunas fundamentais no rascunho. Priorize a árvore de design:
   - **Escopo**: O que entra/não entra.
   - **Domínio**: Entidades, agregados, estados e invariantes de negócio.
   - **Segurança / Multi-Tenancy**: Permissões necessárias, isolamento de dados por inquilino.
   - **API / UI / Comportamento**: Assinaturas de endpoints, códigos HTTP, chaves de i18n, estados da tela.
   - **Edge Cases**: Limites, concorrência, tratamento de erros, rollbacks.
3. **Entrevista Iterativa (Uma por rodada)**: Apresente as dúvidas/gaps de forma sequencial ao usuário.
   - **Apenas uma pergunta por vez**. Nunca envie múltiplas perguntas acumuladas.
   - **Recomendação primeiro**: Sempre forneça uma recomendação clara e fundamentada como primeira opção.
4. **Sem Código**: Não implemente código de produção nem elabore planos de execução (`*.plan.md`) nesta fase. Foque exclusivamente em clarificar a especificação (`*.spec.md`).
5. **Persistência**: Ao final do processo (entendimento compartilhado), escreva a especificação em `specs/[slug-unique-for-the-feature].spec.md`. Se o diretório `specs/` na raiz não existir, crie-o.

## Formato Canônico `*.spec.md`

Adira rigorosamente ao formato canônico definido na skill `spec-format`:

```yaml
---
id: null              # null para especificações locais
slug: slug-unico-da-feature
title: "Título da Feature"
source: local
specDate: YYYY-MM-DD  # Data atual
---
```

```markdown
# Especificação — {title}

## Descrição

(Descrição detalhada das necessidades de negócio e fluxos da feature)

## Critérios de Aceite

- AC1: ...
- AC2: ...

## Notas

(Contexto técnico, restrições, chaves i18n propostas, links úteis ou referências a outras specs)
```

## Gatilhos de Invocação
- Comando: `/write-spec`, `@[write-spec]`
- Palavras-chave: "write spec", "criar spec", "escrever spec", "iniciar spec", "escrever especificação"
