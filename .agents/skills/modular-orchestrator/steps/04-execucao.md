# Step 4 — Execução (Codificação do DAG)

## Objetivo
Implementar as modificações físicas de código descritas no DAG de tarefas, utilizando isolamento por worktree quando aplicável, e listando os arquivos modificados.

## Contexto & Entradas
- **delegationFile**: Arquivo DAG de tarefas (`context.delegationFile`).
- **state**: Acesso completo ao estado e git checkpoints.

## Instruções para o Subagente (Coder)
1. **Isolamento de Branch**:
   - Use uma git worktree se estiver em ambiente suportado (Linux/Mac ou caminhos curtos no Windows) para evitar bagunçar a branch principal de desenvolvimento.
   - Caso contrário, execute diretamente na branch de trabalho do workflow (`state.branch`).
2. **Execução das Tarefas**:
   - Processe as tarefas do DAG respeitando a ordem de níveis (`levels`).
   - Implement following project guidelines (TypeScript/Hono for cursor-server; tests when framework exists).
3. **Tracking de Modificações**:
   - Registre todos os arquivos alterados, criados ou deletados.
4. **Atualização do Estado**:
   - Preencha o objeto `context.filesTouched` com as listas de arquivos:
     ```json
     {
       "modified": ["caminho/do/arquivo1.cs"],
       "created": ["caminho/do/arquivo2.tsx"],
       "deleted": []
     }
     ```
   - Registre o status do step como `success`.
