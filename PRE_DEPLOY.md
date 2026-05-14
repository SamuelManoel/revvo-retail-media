# Pré-deploy — Revvo Smart Price Backend

Checklist executado automaticamente toda vez que o usuário disser que vai fazer deploy.
Se qualquer etapa falhar, o deploy **não** deve seguir até a falha ser corrigida.

## Ordem de execução

1. **`npx prisma validate`** — sanidade do schema/migrations.
2. **`npx prisma generate`** — gera o client (a Next.js build precisa dele).
3. **`npx tsc --noEmit`** — type check completo (pega regressão de tipos do Prisma novo).
4. **`npm run lint`** — ESLint.
5. **`npm test`** — Vitest (unit tests).
6. **`npm run build`** — Next.js production build (último passo, mais caro).

Comando one-liner equivalente:

```bash
npx prisma validate && \
  npx prisma generate && \
  npx tsc --noEmit && \
  npm run lint && \
  npm test && \
  npm run build
```

## Pontos de atenção específicos do projeto

- **Migrations pendentes**: confira `prisma/migrations/` vs `_prisma_migrations` no banco antes de deploy.
  Migration nova mais recente: `20260514000000_terminal_media_enter_animation`.
- **Shadow DB**: `prisma migrate dev` falha por causa da migration
  `20260419000000_remove_product_storeintegration`. Em prod use `prisma migrate deploy`,
  que não usa shadow DB.
- **Prisma client gerado em `src/generated/prisma/`** — verifique que rodou `prisma generate`
  depois de qualquer mudança no schema (ex.: campo `enterAnimation` em `TerminalMedia`).
- **Variáveis de ambiente** (production):
  - `DATABASE_URL`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - secrets de JWT/auth conforme `lib/auth.ts` e `lib/terminal-auth.ts`.
- **App mobile**: se alguma mudança alterou contrato do `GET /api/terminal/content/current`
  (ex.: novo campo `enterAnimation`), confirme que o app já está com versão compatível
  (campo opcional → app antigo segue funcionando com `'none'`).

## Histórico de execuções

Logs ficam no terminal — não persistimos resultado aqui pra não inflar o repo.
