# Step 2 — Refinamento (Grilling & Brainstorm)

## Objetivo
Refinar o plano gerado no Step 1 através de uma entrevista interativa com o usuário, eliminando ambiguidade de requisitos, gaps técnicos e definindo a árvore de decisão do design de código.

## Contexto & Entradas
- **planningFile**: Plano gerado no Step 1 (`context.planningFile`).
- **state**: Acesso completo ao estado e à memória do workflow.

## Instruções para o Subagente (Planner/Refiner)
1. **Auditoria de Gaps**:
   - Compare o plano contra o codebase real e as regras de domínio.
   - Identifique pontos cegos (ex: autorizações necessárias, migrações de banco, design de responsividade de tela).
2. **Loop de Refinamento (Grilling)**:
   - Formulando **apenas uma pergunta por rodada**. Não agrupe perguntas.
   - Exiba a pergunta no formato `AskQuestion` com opções claras de respostas + a opção global `"Encerrar refinamento e avançar"`.
   - Para cada resposta recebida do usuário, registre a decisão em `## Accumulated decisions` (ou dentro do JSON do estado) e execute uma nova auditoria.
3. **Fechamento e Saída**:
   - O loop se encerra quando não houver mais gaps ou o usuário selecionar `"Encerrar refinamento e avançar"`.
   - Crie o arquivo `{spec_name}.plan.refined.md` contendo todas as decisões consolidadas.
   - Atualize `context.refinementFile` no estado com o caminho do arquivo gerado e marque o step como `success`.
