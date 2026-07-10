# Step 1 — Planejamento

## Objetivo
Analisar o arquivo de especificação (`specFile`) e criar um plano de execução detalhado, organizando a especificação em tarefas objetivas formatadas para subagentes.

## Contexto & Entradas
- **specFile**: Caminho absoluto para a especificação de entrada.
- **state**: Acesso somente leitura ao estado compartilhado do workflow.

## Instruções para o Subagente (Planner)
1. **Leitura da Spec**: Leia o arquivo especificado em `context.specFile`.
2. **Análise de Invariantes**: Identifique regras de negócio críticas, banco de dados, APIs e componentes de UI envolvidos.
3. **Detecção de Riscos & Memória**: Consulte `localMemory.trapsAndPitfalls` no estado para evitar repetir erros de execuções passadas deste workflow.
4. **Criação do Plano**:
   - Crie o arquivo `{spec_name}.plan.md` no mesmo diretório do arquivo de especificação.
   - Organize o plano em seções: Objetivo Geral, Mudanças Propostas por Componente (Backend/Frontend), Plano de Verificação (Testes e Critérios de Aceitação).
5. **Atualização do Estado**:
   - Salve o caminho do plano gerado em `context.planningFile`.
   - Registre o status do step como `success`.
