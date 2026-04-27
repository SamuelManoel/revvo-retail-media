---
name: Project Overview
description: Visão geral do projeto Revvo Smart Price Backend — stack, arquitetura, testes
type: project
---

Revvo Smart Price Backend: Next.js 16 App Router + Prisma + Supabase Storage + PostgreSQL multi-tenant.

## Stack
- Next.js 16 (App Router, breaking changes vs versões anteriores)
- Prisma 7 com adapter pg/mariadb
- PostgreSQL: schema público para entidades principais + schemas por loja (tenant_<uuid>) para produtos
- Supabase Storage para mídias (imagens/vídeos)
- JWT com `jose`: dois sistemas separados — sessão web (cookie, 8h) e terminal Bearer (30 dias)
- bcryptjs para hash de senhas

## Arquitetura principal
- `src/lib/auth.ts` — sessão web (createSession, getSession, destroySession)
- `src/lib/terminal-auth.ts` — autenticação de terminais (generateActivationCode, generateTerminalToken, verifyTerminalToken, getTerminalFromRequest)
- `src/lib/license.ts` — verificação e controle de slots de licença
- `src/lib/revoke-license.ts` — revogação atômica de terminal
- `src/lib/tenant-db.ts` — operações de produtos por schema PostgreSQL por loja
- `src/middleware.ts` — proteção de rotas e controle master-only
- `src/app/api/` — routes Next.js App Router

## Multi-tenancy
- Empresa Master: slug `revvo` (configurável via env MASTER_COMPANY_SLUG)
- Schema de produtos por loja: `tenant_<storeId sem hífens>`
- Isolamento server-side; cliente nunca informa companyId

## Testes automatizados (Vitest)
- Framework: Vitest 4.x + @vitest/coverage-v8
- Scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Config: `vitest.config.ts` na raiz, setup em `src/__tests__/setup.ts`
- **156 testes, 11 arquivos** — todos passando
- Padrão de mock: sempre usar `vi.hoisted()` para variáveis referenciadas em `vi.mock()` factories
- Mock do `pg.Pool`: usar classe (`class { query = mockFn }`)

### Arquivos de teste
- `src/lib/__tests__/terminal-auth.test.ts` — generateActivationCode, verifyTerminalToken, getTerminalFromRequest
- `src/lib/__tests__/license.test.ts` — checkLicenseAvailable, incrementLicenseUsed, decrementLicenseUsed
- `src/lib/__tests__/revoke-license.test.ts` — revokeTerminalLicense (transação atômica)
- `src/lib/__tests__/tenant-db.test.ts` — getTenantSchema, listProducts, getProductByEan, upsertProduct, deleteProduct
- `src/lib/__tests__/auth.test.ts` — createSession, getSession, destroySession
- `src/app/api/auth/__tests__/login.test.ts` — POST /api/auth/login
- `src/app/api/terminal/__tests__/activate.test.ts` — POST /api/terminal/activate
- `src/app/api/terminal/__tests__/auth.test.ts` — POST /api/terminal/auth
- `src/app/api/admin/terminals/__tests__/revoke.test.ts` — POST /api/admin/terminals/[id]/revoke
- `src/app/api/stores/__tests__/products.test.ts` — GET/POST/DELETE /api/stores/[id]/products
- `src/middleware.test.ts` — proteção de rotas, master-only, redirecionamentos

**Why:** Testes foram criados cobrindo as regras de negócio do BUSINESS_RULES.md.
**How to apply:** Rodar `npm test` antes de merges. Usar `vi.hoisted()` sempre que um mock de fábrica precisar referenciar variáveis externas.
