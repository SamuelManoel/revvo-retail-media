---
name: Documentar features automaticamente
description: Toda nova feature solicitada deve ser documentada em DOCUMENTATION.md junto com a implementação
type: feedback
---

Toda vez que o usuário pedir uma nova feature, documentar automaticamente no `DOCUMENTATION.md` junto com a implementação. Não esperar o usuário pedir documentação separadamente.

**Why:** O usuário pediu explicitamente: "toda nova feature que eu pedi crie já documentando também" (2026-04-24).

**How to apply:**
- Ao implementar qualquer feature nova (endpoint, regra de negócio, módulo de lib), adicionar na seção relevante do `DOCUMENTATION.md`:
  - Na seção **Business Rules**: nova regra ou atualização da existente
  - Na seção **Endpoints & API**: novo endpoint com Body, Response e exemplos
  - Na seção **Testing**: nova entrada na tabela de arquivos de teste (se testes forem criados)
  - Na seção **Architecture and Flow**: se a feature alterar fluxos ou componentes
  - Marcar itens do **Todo List** como `[x]` quando concluídos, com a data
- Se criar testes junto com a feature, atualizar também a contagem de testes na seção Testing
