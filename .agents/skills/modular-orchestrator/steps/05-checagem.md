# Step 5 — Checagem (Verificação & Score)

## Objetivo
Verificar a corretude lógica e física da implementação versus o plano original, atribuindo uma nota de aderência de qualidade e fornecendo gates interativos de aceitação.

## Contexto & Entradas
- **filesTouched**: Lista de arquivos alterados em `context.filesTouched`.
- **planningFile**: Planejamento original.
- **state**: Estado do workflow.

## Instruções para o Subagente (Verifier)
1. **Verificação de Compilação & Testes**:
   - Execute the test/typecheck suite (`npm run typecheck`, `npm run build`).
   - Valide se todos os arquivos em `filesTouched` existem fisicamente no disco e se contêm código válido.
2. **Cálculo da Nota de Aderência**:
   - Compare o código desenvolvido contra os critérios de aceitação da Spec.
   - Atribua um score de 0 a 100 de aderência ao plano.
3. **Decisão Interativa**:
   - Exiba a nota e o relatório detalhado de aderência.
   - Apresente um gate `AskQuestion` perguntando:
     ```
     [Aprovação] Deseja aprovar a execução do Step 4?
     1. Sim, aprovar e prosseguir (nota >= 80)
     2. Não, repetir a execução do Step 4 com outro modelo LLM
     3. Não, repetir a execução do Step 4 com o mesmo modelo
     4. Cancelar / Pausar
     ```
   - Caso o usuário escolha (2) ou (3), execute o rollback usando a tag `mod-wf/{workflow-id}/before-step-4` e redispatche o Step 4.
   - Registre o status em `context.verificationScore` e marque o step como `success` se aprovado.
