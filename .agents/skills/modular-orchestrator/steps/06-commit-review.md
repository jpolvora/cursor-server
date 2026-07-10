# Step 6 — Commit e Review

## Objetivo
Realizar o commit dos arquivos alterados, rodar um code review sistemático do diff versus a branch principal (main/master) e aplicar correções interativas antes do fechamento.

## Contexto & Entradas
- **state**: Acesso completo ao estado, lista de arquivos e histórico de commits.

## Instruções para o Subagente (Reviewer)
1. **Commit Inicial**:
   - Execute o commit dos arquivos listados em `context.filesTouched` com uma mensagem padronizada `feat(us-{id}): ...` ou `fix(us-{id}): ...`.
   - Registre o SHA do commit em `context.commits`.
2. **Code Review do Diff**:
   - Obtenha o diff completo dos commits deste workflow contra a branch de origem (ex: `git diff origin/main...HEAD`).
   - Analyze the diff for vulnerabilities, clean-code violations, SDK misuse, and missing input validation.
3. **Mapeamento de Criticas**:
   - Formate os achados em uma tabela com colunas: "Arquivo", "Linha", "Crítica/Sugestão", "Gravidade (Urgente / Importante / Melhoria)".
4. **Gate de Correção**:
   - Exiba a tabela e apresente o gate `AskQuestion`:
     ```
     [Code Review] Como deseja prosseguir com as observações do Code Review?
     1. Aceitar e finalizar o workflow (sem correções adicionais)
     2. Aplicar correções sugeridas (abre subloop de edição de arquivos e novo commit)
     3. Voltar e refazer a implementação a partir do Step 4
     ```
   - Se escolher (2): faça as alterações cirúrgicas necessárias, gere um novo commit com prefixo `fix(review): ...` e adicione ao histórico.
   - Ao finalizar, registre a finalização com sucesso do workflow.
