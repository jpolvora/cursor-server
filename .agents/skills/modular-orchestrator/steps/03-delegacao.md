# Step 3 — Delegação de Agentes e Quebra de Tarefas (DAG)

## Objetivo
Analisar o plano refinado e decompor a implementação em tarefas independentes organizadas por agente executor, possibilitando execução paralela através de um grafo acíclico dirigido (DAG).

## Contexto & Entradas
- **refinementFile**: Plano refinado do Step 2 (`context.refinementFile`).
- **state**: Estado do workflow.

## Instruções para o Subagente (Coordinator)
1. **Quebra de Tarefas**:
   - Identifique tarefas acopladas e tarefas independentes.
   - Agrupe-as por área/tipo de agente (ex: `BackendAgent` para migrações e services C#, `FrontendAgent` para componentes React, `VerifierAgent` para testes).
2. **Definição do DAG**:
   - Crie um arquivo JSON `{spec_name}.exec.dag.json` estruturando as dependências.
   - Exemplo de estrutura:
     ```json
     {
       "levels": [
         {
           "level": 1,
           "tasks": [
             { "id": "T1", "agent": "BackendAgent", "description": "Criar migration e model", "dependsOn": [] }
           ]
         },
         {
           "level": 2,
           "tasks": [
             { "id": "T2", "agent": "BackendAgent", "description": "Implementar service", "dependsOn": ["T1"] },
             { "id": "T3", "agent": "FrontendAgent", "description": "Criar componente de UI", "dependsOn": [] }
           ]
         }
       ]
     }
     ```
3. **Consolidação**:
   - Salve o caminho do JSON em `context.delegationFile`.
   - Registre o status do step como `success`.
