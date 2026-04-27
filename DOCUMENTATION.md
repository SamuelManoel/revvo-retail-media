:::info[__]
# <Icon icon="lucide:server"/> **Revvo Smart Price** — Backend API^ <br/> | Plataforma de gestão de terminais de consulta de preços e exibição de mídia em lojas

O **Revvo Smart Price** é uma API REST construída em Next.js 16 (App Router) com Prisma ORM e PostgreSQL via Supabase, responsável por orquestrar terminais físicos instalados em lojas varejistas. O sistema gerencia o ciclo de vida completo dos dispositivos — da criação e ativação ao controle de licenças e exibição de conteúdo —, além de prover um painel administrativo multi-empresa com isolamento de dados por tenant. A plataforma integra Supabase Storage para upload e servimento de mídias (imagens e vídeos), suporta catálogo de produtos com upsert por EAN e expõe endpoints dedicados para os dispositivos físicos consultarem preços e consumirem conteúdo de mídia em tempo real.
:::

---

## Business Rules

### Requirements Traceability Matrix

| RF x RN | RN/RSP-001 | RN/RSP-002 | RN/RSP-003 | RN/RSP-004 | RN/RSP-005 | RN/RSP-006 | RN/RSP-007 | RN/RSP-008 |
|---------|------------|------------|------------|------------|------------|------------|------------|------------|
| RF/RSP-001 Autenticação Web | X | X | | | | | | |
| RF/RSP-002 Gestão de Empresas | X | | | | | | | |
| RF/RSP-003 Gestão de Usuários | X | | | | | | | |
| RF/RSP-004 Gestão de Lojas | X | | | | | | | |
| RF/RSP-005 Gestão de Licenças | X | | X | | | | | |
| RF/RSP-006 Gestão de Terminais | X | | X | X | | | | |
| RF/RSP-007 Ativação de Terminais | | X | X | X | | | | |
| RF/RSP-008 Revogação de Terminais | | X | X | X | X | | | |
| RF/RSP-009 Gestão de Mídias | X | | | | | X | | |
| RF/RSP-010 Vínculo Terminal-Mídia | X | | | | | X | X | |
| RF/RSP-011 Gestão de Produtos | X | | | | | | | X |
| RF/RSP-012 Consulta pelo Terminal | | X | | | | | | X |
| RF/RSP-013 Integração de Catálogo | X | | | | | | | X |
| RF/RSP-014 Notificações | X | | | | | | | |
| RF/RSP-015 Configuração Global | | | | | | | | |

---

<div class="flex flex-col gap-4">

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-blue-800 p-1 rounded-full text-white text-xs">RN/RSP-001</div>
    <h3 class="text-lg font-semibold">🏢 Multi-tenancy e Isolamento de Dados</h3>
</div>

**Perfis de Acesso:**
- ✅ Usuário com empresa `slug = revvo-master` → acesso irrestrito a todos os tenants
- ✅ Usuário comum autenticado → acesso restrito exclusivamente à própria empresa
- ❌ Usuário comum informando `companyId` de outra empresa no body → servidor ignora e usa `session.companyId`
- ❌ Acesso a recurso de outra empresa → `403 Forbidden`

**Critérios/Validações:**
- O `companyId` é extraído do JWT de sessão, nunca do cliente
- Todas as queries de listagem aplicam `WHERE companyId = session.companyId` automaticamente
- Master pode especificar `companyId` explicitamente no body para criar recursos em qualquer empresa
- Empresa com `status = INATIVO` bloqueia login de todos os seus usuários com `403`

**Justificativa:** Garantir que dados de empresas clientes não se misturem, protegendo a privacidade e integridade dos dados em um ambiente SaaS multi-cliente.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-green-800 p-1 rounded-full text-white text-xs">RN/RSP-002</div>
    <h3 class="text-lg font-semibold">🔐 Autenticação Dupla — Web e Terminal</h3>
</div>

**Sistema Web (Cookie JWT):**
- ✅ Login válido → cookie `revvo_session` (httpOnly, secure, sameSite=lax) com validade de **8 horas**
- ✅ Logout → cookie deletado imediatamente
- ❌ Cookie ausente ou inválido → `401 Unauthorized`
- ❌ Usuário inativo ou empresa inativa → `403 Forbidden`

**Sistema Terminal (Bearer JWT):**
- ✅ Ativação bem-sucedida → Bearer JWT válido por **30 dias**
- ✅ Reautenticação → novo token gerado, token anterior invalidado no banco
- ❌ Token revogado no banco (`status = REVOKED`) → `401` mesmo que assinatura criptográfica seja válida
- ❌ Banco indisponível durante validação → acesso **negado** (fail-closed, nunca concedido)

**Critérios/Validações:**
- Secrets distintos: `JWT_SECRET` (web) e `TERMINAL_JWT_SECRET` (terminais), algoritmo HS256
- Validação do Bearer consulta `TerminalCredential` a cada requisição — não confia apenas na criptografia
- Token antigo é rejeitado após reautenticação, pois `credential.token !== token`

**Justificativa:** Dispositivos físicos operam em redes diferentes do painel web e precisam de tokens de longa duração. A verificação em banco garante revogação imediata sem esperar expiração do JWT.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-purple-800 p-1 rounded-full text-white text-xs">RN/RSP-003</div>
    <h3 class="text-lg font-semibold">🎫 Controle de Licenças por Loja</h3>
</div>

**Concessão de Slots:**
- ✅ Terminal ativado com licença válida → `quantityUsed += 1` (transação atômica)
- ✅ Terminal revogado ou deletado (se ativo) → `quantityUsed -= 1` (mínimo 0)
- ❌ Ativação com `quantityUsed >= quantityTotal` → `422 Unprocessable Entity`
- ❌ Ativação com licença expirada (`expiresAt < now`) → `422`
- ❌ Ativação com licença `status !== 'active'` → `422`

**Ciclo de Vida da Licença:**

| Status | Significado | Efeito nos Terminais |
|--------|-------------|----------------------|
| `active` | Vigente e dentro da cota | Ativação e reautenticação permitidas |
| `expired` | Data de expiração ultrapassada | Reautenticação bloqueada |
| `suspended` | Suspensa manualmente | Reautenticação bloqueada |

**Critérios/Validações:**
- Slot é consumido **apenas na ativação do dispositivo** (`POST /api/terminal/activate`), não na criação do terminal no painel
- Somente Master pode criar, renovar ou excluir licenças
- Não é possível reduzir `quantityTotal` abaixo de `quantityUsed` atual → `422`
- Toda renovação (data ou quantidade) gera registro auditável em `LicenseRenewal`
- Se `newExpiresAt` estiver no futuro, `status` é automaticamente redefinido para `active`

**Justificativa:** Monetização do sistema por número de dispositivos ativos por loja, com controle de inadimplência via suspensão e auditoria de renovações.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-yellow-800 p-1 rounded-full text-white text-xs">RN/RSP-004</div>
    <h3 class="text-lg font-semibold">📟 Ciclo de Vida do Terminal</h3>
</div>

**Estados do Terminal:**

| Estado | `isActive` | `isBlocked` | Pode Ativar? | Pode Autenticar? |
|--------|-----------|------------|--------------|-----------------|
| Criado | `false` | `false` | Sim | Não |
| Ativo | `true` | `false` | — | Sim |
| Bloqueado | `false` | `true` | Não | Não |
| Revogado | `false` | `true` | Sim (novo código) | Não |

**Regras:**
- ✅ Código de ativação tem **8 caracteres** alfanuméricos maiúsculos, sem caracteres ambíguos (`0`, `O`, `I`, `1`)
- ✅ Código de ativação é único globalmente — sistema tenta até 5 vezes em caso de colisão
- ✅ Terminal pode ser `isPriceChecker` e `isMediaDisplay` simultaneamente
- ❌ Terminal bloqueado → não pode reautenticar, `403` em toda requisição
- ❌ IP duplicado → `409 Conflict`

**Critérios/Validações:**
- `lastSeenAt` é atualizado a cada heartbeat enviado pelo dispositivo
- `revokedAt` e `revokedBy` registram quando e por quem a licença foi revogada
- Ao revogar, um **novo** `activationCode` é gerado — o antigo se torna permanentemente inválido

**Justificativa:** Rastreabilidade completa do ciclo de vida dos dispositivos e prevenção de reuso indevido de códigos de ativação.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-red-800 p-1 rounded-full text-white text-xs">RN/RSP-005</div>
    <h3 class="text-lg font-semibold">⚡ Revogação Atômica de Terminal</h3>
</div>

**Fluxo (Transação Única no Banco):**
- ✅ Terminal ativo → revogação executa 4 operações em uma transação
- ❌ Terminal já inativo → `422 Unprocessable Entity` — não há o que revogar
- ❌ Usuário de outra empresa → `403 Forbidden` (Master ignora)
- ❌ Terminal inexistente → `404 Not Found`

**Operações Atômicas:**
1. `terminal`: `isActive=false`, `isBlocked=true`, `revokedAt=now`, `revokedBy=userId`, `activationCode=novoCódigo`
2. `terminalCredential`: `status=REVOKED`, `revokedAt=now` — invalida **todos os JWTs existentes imediatamente**
3. `terminalActivation` (mais recente): `status=REVOKED`, `revokedAt`, `revokedBy`
4. `storeLicense`: `quantityUsed -= 1` (se terminal tinha loja vinculada)

**Critérios/Validações:**
- O efeito de bloqueio do JWT é **imediato** — o dispositivo perde acesso na próxima requisição, não precisa aguardar expiração
- O novo código de ativação permite que o dispositivo seja reativado com nova licença após substituição física ou manutenção

**Justificativa:** Garantir que dispositivos roubados, extraviados ou com licença vencida sejam desautorizados instantaneamente sem janelas de vulnerabilidade.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-indigo-800 p-1 rounded-full text-white text-xs">RN/RSP-006</div>
    <h3 class="text-lg font-semibold">🖼️ Gestão de Mídias e Storage</h3>
</div>

**Upload:**
- ✅ Imagem (`image/*`) ≤ 5 MB → upload para Supabase Storage
- ✅ Vídeo (`video/*`) ≤ 50 MB → upload para Supabase Storage
- ❌ Arquivo > limite → `400 Bad Request` com mensagem específica
- ❌ Tipo MIME diferente de image/* ou video/* → `400 Bad Request`

**Exclusão Automática por Vínculo:**
- ✅ Remoção de vínculo `TerminalMedia` → sistema verifica vínculos restantes
- ✅ Nenhum outro terminal usa a mídia → arquivo removido do Storage + registro excluído do banco
- ✅ Outros terminais usam a mídia → mídia preservada, apenas o vínculo é removido

**Critérios/Validações:**
- Nome do arquivo é sanitizado: acentos removidos, caracteres especiais → `-`, convertido para minúsculas
- Path no Storage: `uploads/{ano}/{mes}/{timestamp}-{nomeArquivo}` — evita colisões
- Mídia pertence à empresa do usuário que fez upload (`companyId`)
- Ao vincular mídia a terminal, sistema valida que ambos pertencem à mesma empresa

**Justificativa:** Evitar acúmulo de arquivos órfãos no Storage e garantir que o custo de armazenamento seja proporcional ao uso real.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-pink-800 p-1 rounded-full text-white text-xs">RN/RSP-007</div>
    <h3 class="text-lg font-semibold">📅 Agendamento de Conteúdo (TerminalMedia)</h3>
</div>

**Regras de Vigência:**
- ✅ `startsAt` nulo **e** `endsAt` nulo → mídia sempre ativa (`active: true`)
- ✅ `startsAt <= now` **e** `endsAt >= now` → mídia ativa (`active: true`)
- ✅ `endsAt < now` → mídia expirada (`expired: true`, `active: false`)
- ✅ `startsAt > now` → mídia agendada, ainda não iniciada (`active: false`, `expired: false`)

**Ordem de Exibição:**
- ✅ Nova mídia vinculada → `order = maxOrder + 1` (automaticamente)
- ✅ Reordenação via `PUT /api/admin/terminals/:id/media/order` → transação atômica
- ❌ Mesma mídia vinculada duas vezes ao mesmo terminal → `409 Conflict` (constraint `UNIQUE(terminalId, mediaId)`)

**Critérios/Validações:**
- O cálculo de `active` e `expired` é feito **em tempo real** a cada requisição — não há job em background
- Um terminal só pode receber mídias se tiver `isMediaDisplay = true`
- Vínculo pode opcionalmente ser associado a uma `Campaign` para rastreamento

**Justificativa:** Permitir campanhas temporais e rotatividade de conteúdo sem intervenção manual, garantindo que mídias expiradas não sejam exibidas aos clientes da loja.
</Container>

<Container>
<div class="flex items-center gap-2 mb-3">
    <div class="bg-green-800 p-1 rounded-full text-white text-xs">RN/RSP-008</div>
    <h3 class="text-lg font-semibold">📦 Upsert de Produtos por EAN</h3>
</div>

**Estratégia de Sincronização:**
- ✅ EAN não existe na loja → cria produto, retorna `201 Created`
- ✅ EAN já existe na loja → atualiza todos os campos, retorna `200 OK`
- ✅ `externalId` informado → upsert adicional por `(storeId, externalId)` para ERPs
- ❌ `ean`, `name` ou `price` ausentes → `400 Bad Request`

**Isolamento de Produto:**
- ✅ Terminal consulta EAN → `storeId` derivado do JWT (nunca do cliente)
- ✅ `isActive = false` → produto invisível para terminais (soft delete)
- ❌ Terminal sem loja vinculada → `404` na consulta de produto

**Critérios/Validações:**
- Preços são `Decimal(10,2)` — `price` obrigatório, `offerPrice` e `clubPrice` opcionais
- Busca por EAN nos terminais filtra por `isActive = true` automaticamente
- Endpoint público `GET /api/terminal/{storeId}/{ean}` não requer Bearer token — UUID da loja funciona como identificador de acesso

**Justificativa:** Facilitar integração com ERPs que realizam cargas incrementais de catálogo, sem necessidade de verificar prévia existência do produto.
</Container>

</div>

---

## Architecture and Flow

### 🏗️ System Components

<Container>

**🎯 Core Components**

| Componente | Responsabilidade | Dependências |
|-----------|-----------------|--------------|
| **Next.js 16 App Router** | Roteamento, SSR e handlers de API | Node.js 24, Turbopack |
| **Prisma ORM v7** | Abstração do banco, migrations, client type-safe | PostgreSQL (Supabase) |
| **Supabase PostgreSQL** | Banco de dados relacional principal | pgBouncer (pooler) |
| **Supabase Storage** | Armazenamento de mídias (imagens/vídeos) | Supabase Auth (service role) |
| **Jose (JWT)** | Assinatura e verificação de tokens (Web + Terminal) | — |
| **bcryptjs** | Hash de senhas de usuários | — |
| **Middleware (Proxy)** | Proteção de rotas no edge, redirecionamentos | Cookie `revvo_session` |

</Container>

---

### 🔄 Data Flow

```
[Browser/Painel Admin]
        │ Cookie JWT (revvo_session)
        ▼
[Next.js API Routes]
        │ Prisma Client
        ▼
[Supabase PostgreSQL] ◄──── [Supabase Storage]
                                    ▲
                              Upload/Delete
                                    │
[Dispositivo Terminal]
        │ Bearer JWT (Authorization)
        ▼
[Next.js API Routes /api/terminal/*]
        │
        ├── Verifica TerminalCredential (DB)
        ├── Consulta Produtos
        ├── Registra Heartbeat
        └── Retorna Mídias/Conteúdo
```

```mermaid
sequenceDiagram
    participant P as Painel Admin
    participant A as API Next.js
    participant DB as Supabase DB
    participant S as Supabase Storage
    participant T as Terminal Físico

    P->>A: POST /api/auth/login
    A->>DB: Verifica user + company
    A-->>P: Cookie revvo_session (8h)

    P->>A: POST /api/terminals (cria terminal)
    A->>DB: INSERT terminal + activationCode
    A-->>P: Terminal + código de ativação

    T->>A: POST /api/terminal/activate {activationCode}
    A->>DB: Verifica licença disponível
    A->>DB: isActive=true + quantityUsed+1 (transação)
    A-->>T: Bearer JWT (30 dias)

    T->>A: GET /api/terminal/bootstrap (Bearer)
    A->>DB: Verifica TerminalCredential (status=ACTIVE)
    A->>DB: Busca terminal + config
    A-->>T: Dados iniciais + endpoints

    T->>A: GET /api/terminal/product/{ean} (Bearer)
    A->>DB: Busca produto por storeId (do JWT) + ean
    A-->>T: Dados do produto + preços

    P->>A: POST /api/media (upload)
    A->>S: Upload arquivo
    A->>DB: INSERT media record
    A-->>P: Media com URL pública

    P->>A: POST /api/admin/terminals/:id/revoke
    A->>DB: TRANSACTION (isActive=false + REVOKED + quantityUsed-1)
    A-->>P: newActivationCode + licenseFreed
```

---

### 🔁 Processos Principais

**🎯 Responsável:** `POST /api/terminal/activate`

**📋 Processo: Ativação de Terminal**

<Steps>
    <Step title="Recepção e Normalização:">
        O dispositivo envia `activationCode` (case-insensitive). O sistema converte para maiúsculas antes de buscar no banco.
    </Step>
    <Step title="Validação do Terminal:">
        Busca o terminal pelo código. Verifica `isBlocked === false`. Se bloqueado, retorna `403`.
    </Step>
    <Step title="Verificação de Licença:">
        Se o terminal tem `storeId`, verifica: `license.status === 'active'`, `license.expiresAt >= now`, `license.quantityUsed < license.quantityTotal`. Qualquer falha → `422`.
    </Step>
    <Step title="Geração do JWT:">
        Gera Bearer JWT (HS256) com payload `{sub: terminalId, companyId, storeId, type: 'terminal'}`, válido por 30 dias.
    </Step>
    <Step title="Salvamento da Credencial:">
        Upsert em `TerminalCredential` — cria se não existir, sobrescreve token anterior se existir. Token antigo é invalidado.
    </Step>
    <Step title="Transação Atômica:">
        Em uma transação: (1) cria `TerminalActivation` com status `USED`, (2) atualiza terminal para `isActive=true, isBlocked=false`, (3) incrementa `storeLicense.quantityUsed += 1`.
    </Step>
    <Step title="Resposta:">
        Retorna `{token, terminalId, name, isPriceChecker, isMediaDisplay}`. O dispositivo armazena o token para todas as requisições futuras.
    </Step>
</Steps>

**⚙️ Configurações:**
- Expiração do token: `30 dias (2.592.000 segundos)`
- Algoritmo: `HS256`
- Secret: `TERMINAL_JWT_SECRET` (fallback para `JWT_SECRET`)

---

**🎯 Responsável:** `POST /api/admin/terminals/:id/revoke`

**📋 Processo: Revogação de Licença**

<Steps>
    <Step title="Autorização:">
        Verifica sessão web. Valida que o terminal pertence à empresa do usuário (Master ignora). Se não encontrado → `404`. Se de outra empresa → `403`.
    </Step>
    <Step title="Validação de Estado:">
        Verifica `terminal.isActive === true`. Se já inativo → `422` ("Terminal já está inativo").
    </Step>
    <Step title="Geração do Novo Código:">
        Gera novo `activationCode` único. Tenta até 5 vezes em caso de colisão. O código antigo se torna permanentemente inválido.
    </Step>
    <Step title="Transação Atômica de Revogação:">
        Em uma transação: (1) atualiza terminal com `isActive=false, isBlocked=true, revokedAt, revokedBy, newActivationCode`, (2) atualiza `TerminalCredential` para `status=REVOKED`, (3) marca a última `TerminalActivation` como `REVOKED`, (4) decrementa `storeLicense.quantityUsed -= 1` (se aplicável).
    </Step>
    <Step title="Efeito Imediato:">
        O dispositivo perde acesso na próxima requisição — o guard consulta o banco e encontra `status=REVOKED`, bloqueando independente da validade criptográfica do JWT.
    </Step>
    <Step title="Resposta:">
        Retorna `{terminalId, newActivationCode, licenseFreed, message}`. O novo código pode ser usado para reativar o dispositivo após manutenção.
    </Step>
</Steps>

---

### ⚠️ Error Handling

<Container>

**🛡️ Recovery Strategies:**

**1. Fail-Closed na Validação de Token**
- Se o banco estiver indisponível durante verificação do Bearer, o acesso é **negado** — nunca concedido
- O catch do `getTerminalFromRequest` retorna `null` em qualquer exceção de banco

**2. Unicidade com Retry**
- Geração de `activationCode` tenta até 5 vezes em caso de colisão antes de falhar
- Prevenção de race condition em banco com constraints `@unique`

**3. Transações Atômicas**
- Ativação, revogação e reordenação de mídias usam `prisma.$transaction()` — nenhuma operação é aplicada parcialmente

**🚨 Common Error Scenarios:**

| Cenário de Erro | Código | Mecanismo de Tratamento |
|----------------|--------|------------------------|
| Token JWT expirado ou inválido | `401` | `jwtVerify` lança exceção, catch retorna `null` |
| Credencial revogada no banco | `401` | Guard consulta DB após verificação criptográfica |
| Acesso a recurso de outro tenant | `403` | Filtro de `companyId` na query resolve como `null` |
| IP de terminal duplicado | `409` | Constraint `@unique` no banco, tratado pelo código `P2002` |
| Licença sem slots disponíveis | `422` | Verificação prévia antes de qualquer escrita |
| Upload excede tamanho máximo | `400` | Verificação de `file.size` antes do upload |
| Banco indisponível | `500` | Try/catch global com log de erro + resposta genérica |

</Container>

---

## Configurations & Deployment

### 🔧 Environment Variables

<Container>

**🔑 Banco de Dados e ORM**
```env
DATABASE_URL=postgresql://postgres.xxx:senha@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```
- **Formato:** `postgresql://user:pass@host:port/database`
- **Pool:** Usa PrismaPg adapter com pgBouncer via pooler da Supabase

**☁️ Supabase Storage**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_STORAGE_BUCKET=media
```
- `SUPABASE_SERVICE_ROLE_KEY`: chave com permissão de admin — **nunca exposta no client**
- `NEXT_PUBLIC_*`: prefixo expõe para o browser — use apenas para chaves públicas

**🔐 JWT Secrets**
```env
JWT_SECRET=revvo-smart-price-secret-change-in-production
TERMINAL_JWT_SECRET=revvo-terminal-secret-change-in-production
```
- Algoritmo: HS256
- `JWT_SECRET`: sessões de usuários web (8h)
- `TERMINAL_JWT_SECRET`: tokens de terminais físicos (30 dias). Fallback para `JWT_SECRET` se não definido.

</Container>

<Container>

**🌐 Produção (Vercel)**

Todas as variáveis devem ser configuradas em **Settings → Environment Variables** no projeto da Vercel para os ambientes `Production`, `Preview` e `Development`.

- **Scope recomendado para secrets:** apenas `Production`
- **`NEXT_PUBLIC_*`:** configurar em todos os ambientes

</Container>

---

### ⚙️ Prisma Configurations

<Container>

**🔨 Adapter e Client**
```typescript
// src/lib/prisma.ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
  adapter,          // Driver customizado para PostgreSQL via pgBouncer
  log: ['query', 'info', 'warn', 'error'], // Logs completos em dev
});
```

**📋 Geração do Client**
```json
// package.json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```
- Client gerado em `src/generated/prisma` (output customizado)
- Executado automaticamente após `npm install` — garante client atualizado na Vercel

**🔁 Comportamento**
- **Singleton global:** `globalForPrisma.prisma_v15` evita múltiplas instâncias em hot reload (desenvolvimento)
- **Em produção:** nova instância por cold start — sem singleton necessário
- **Transações:** `prisma.$transaction([...])` e `prisma.$transaction(async (tx) => {...})` para operações atômicas

</Container>

---

### 🔧 Auth Configurations

<Container>

**🔐 Sessão Web**
```typescript
const COOKIE = 'revvo_session';
const EXPIRES_IN = 60 * 60 * 8; // 8 horas em segundos

// Cookie flags
{
  httpOnly: true,    // Inacessível via JavaScript
  secure: true,      // Apenas HTTPS em produção
  sameSite: 'lax',  // Proteção básica contra CSRF
  maxAge: EXPIRES_IN,
  path: '/',
}
```

**📟 Token de Terminal**
```typescript
const EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30; // 30 dias

// Payload do JWT
{
  sub: terminalId,
  companyId: string,
  storeId: string | null,
  type: 'terminal',   // Discriminator — rejeita tokens web usados como terminal
}
```

**🏢 Constante Master**
```typescript
export const MASTER_COMPANY_SLUG = 'revvo-master';
// Empresa com esse slug recebe isMaster=true na sessão
```

</Container>

---

### 🏷️ System Constants

<Container>

**📐 Limites de Upload**
```typescript
// src/app/api/media/route.ts
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50 MB

// Tipos aceitos
const ALLOWED_TYPES = ['image/*', 'video/*'];
```

**🔑 Geração de Activation Code**
```typescript
// src/lib/terminal-auth.ts
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 8 caracteres — exclui: 0, O, I, 1 (ambíguos visualmente)
// Espaço de 33^8 = ~1,2 trilhão de combinações
const MAX_RETRIES = 5; // Tentativas em caso de colisão
```

**📁 Path de Upload**
```typescript
// src/lib/upload.ts
// Formato: uploads/{ano}/{mes}/{timestamp}-{nomeArquivo}
// Exemplo: uploads/2026/04/1775595123836-produto-imagem.jpg
```

**🏪 Paginação Padrão**
```typescript
// Produtos (painel e terminal)
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Notificações
const NOTIFICATIONS_LIMIT = 50; // Sempre as últimas 50
```

</Container>

---

### 📊 Monitoring

<Container>

**📈 Key Metrics**

- ⏱️ **lastSeenAt (Terminal):** Indica quando o dispositivo enviou heartbeat pela última vez. Terminais sem heartbeat há mais de X minutos podem estar offline.
- ✅ **quantityUsed / quantityTotal (License):** Ratio de ocupação de licença. Se `quantityUsed = quantityTotal`, a loja não pode ativar novos terminais.
- 📁 **Tamanho do Storage:** Volume de mídias por empresa no Supabase Storage — impacta custo.
- 🔄 **lastSync (Configuration):** Indica quando a última carga de dados foi gerada para os terminais.

**📝 Structured Logs**
```typescript
// Padrão usado em todos os handlers
console.error('Erro ao [ação]:', error);

// Exemplos presentes no código
console.error('Erro ao listar terminais:', error);
console.error('Erro no login:', error);
console.error('Erro ao fazer upload da mídia:', error);
console.error('Erro no upload para o Supabase Storage:', uploadError);
console.error('Erro ao remover arquivo do storage:', storageError);
```

**🚨 Alertas Recomendados (a implementar)**
- Terminal sem heartbeat há mais de 5 minutos
- `quantityUsed >= quantityTotal` em qualquer licença ativa
- Taxa de erros `5xx` acima de 1% nas rotas de terminal
- Upload de arquivo falhou no Storage mas sucesso na requisição

</Container>

---

## Endpoints & API

<Tabs>

<Tab title="Auth">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-001</div>
</div>

### 🎯 Login de Usuário Web
**POST** `/api/auth/login`

Autentica o usuário com e-mail e senha. Verifica status do usuário e da empresa antes de conceder acesso. Em caso de sucesso, define o cookie `revvo_session` com JWT de 8 horas.

<AccordionGroup>
<Accordion title="Body">

**email** (string, obrigatório)
- E-mail do usuário cadastrado
- Exemplo: `"admin@empresa.com.br"`

**password** (string, obrigatório)
- Senha em texto plano — comparada com hash bcrypt
- Exemplo: `"minhasenha123"`
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "admin@empresa.com.br",
    "companyId": "uuid",
    "company": {
      "id": "uuid",
      "name": "Minha Empresa",
      "status": "ATIVO",
      "slug": "minha-empresa"
    }
  }
}
```

**Erros:**
```json
{ "message": "E-mail e senha são obrigatórios" }       // 400
{ "message": "E-mail ou senha inválidos" }              // 401
{ "message": "Usuário inativo. Contate o administrador." } // 403
{ "message": "Empresa inativa. Contate o suporte." }    // 403
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-001</div>
</div>

### 🎯 Logout
**POST** `/api/auth/logout`

Encerra a sessão removendo o cookie `revvo_session`. O JWT não é invalidado no servidor (stateless).

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "message": "Sessão encerrada" }
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-001</div>
</div>

### 🎯 Sessão Atual
**GET** `/api/auth/me`

Retorna os dados decodificados do JWT de sessão atual.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "userId": "uuid",
  "companyId": "uuid",
  "name": "João Silva",
  "email": "admin@empresa.com.br",
  "isMaster": false
}
```

**Erro:**
```json
{ "message": "Não autenticado" } // 401
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Empresas">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-002</div>
</div>

### 🎯 Listar Empresas
**GET** `/api/companies`

Retorna todas as empresas cadastradas com contagem de terminais e usuários.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "name": "Santo Antônio Supermercados",
    "legalName": "Santo Antônio Comercial Ltda",
    "cnpj": "12.345.678/0001-99",
    "email": "contato@santantonio.com.br",
    "slug": "santo-antonio",
    "status": "ATIVO",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "_count": { "terminals": 5, "users": 3 }
  }
]
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-002</div>
</div>

### 🎯 Criar Empresa
**POST** `/api/companies`

<AccordionGroup>
<Accordion title="Body">

**name** (string, obrigatório) — Nome fantasia  
**legalName** (string, obrigatório) — Razão social  
**cnpj** (string, obrigatório) — CNPJ único  
**email** (string, obrigatório) — E-mail único  
**slug** (string, obrigatório) — Identificador URL-friendly único  
**status** (string, opcional) — `ATIVO` ou `INATIVO`. Default: `ATIVO`
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "name": "Nova Empresa",
  "legalName": "Nova Empresa Ltda",
  "cnpj": "98.765.432/0001-10",
  "email": "contato@nova.com.br",
  "slug": "nova-empresa",
  "status": "ATIVO"
}
```

**Erros:**
```json
{ "message": "Todos os campos obrigatórios devem ser enviados" } // 400
{ "message": "CNPJ, e-mail ou slug já cadastrado" }             // 409
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-002</div>
</div>

### 🎯 Editar Empresa
**PATCH** `/api/companies/{id}`

Atualiza campos da empresa. Todos os campos são opcionais (patch parcial).

<AccordionGroup>
<Accordion title="Parameters">

**id** (uuid, path, obrigatório) — ID da empresa

**Body (todos opcionais):** `name`, `legalName`, `cnpj`, `email`, `slug`, `status`
</Accordion>
<Accordion title="Response">

**Sucesso (200):** Objeto `Company` atualizado

**Erros:**
```json
{ "message": "CNPJ, e-mail ou slug já cadastrado" } // 409
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-red-600 p-1 rounded-full text-white text-xs">RF/RSP-002</div>
</div>

### 🎯 Remover Empresa
**DELETE** `/api/companies/{id}`

Remove a empresa e todos os dados associados em cascata (usuários, lojas, terminais, mídias, notificações).

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "message": "Empresa removida com sucesso" }
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Usuários & Perfil">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-003</div>
</div>

### 🎯 Listar Usuários
**GET** `/api/users`

Master retorna todos os usuários. Usuário comum retorna apenas os da própria empresa.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "name": "Maria Santos",
    "email": "maria@empresa.com.br",
    "isActive": true,
    "companyId": "uuid",
    "company": { "id": "uuid", "name": "Minha Empresa" },
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-003</div>
</div>

### 🎯 Criar Usuário
**POST** `/api/users`

<AccordionGroup>
<Accordion title="Body">

**name** (string, obrigatório)  
**email** (string, obrigatório) — único globalmente  
**password** (string, obrigatório) — armazenada como hash bcrypt  
**isActive** (boolean, opcional) — default `true`  
**companyId** (uuid, opcional) — apenas Master pode especificar empresa diferente da própria
</Accordion>
<Accordion title="Response">

**Sucesso (201):** Objeto `User` sem o campo `password`

**Erros:**
```json
{ "message": "Campos obrigatórios: name, email, password" } // 400
{ "message": "Já existe um usuário com esse e-mail" }       // 409
{ "message": "Empresa não encontrada" }                     // 404
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-003</div>
</div>

### 🎯 Editar Usuário
**PATCH** `/api/users/{id}`

<AccordionGroup>
<Accordion title="Parameters">

**id** (uuid, path, obrigatório)

**Body (todos opcionais):** `name`, `email`, `isActive`, `password` (será hasheado)
</Accordion>
<Accordion title="Response">

**Sucesso (200):** Objeto `User` atualizado sem `password`

**Erro:**
```json
{ "message": "E-mail já cadastrado" } // 409
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-003</div>
</div>

### 🎯 Perfil do Usuário Autenticado
**PATCH** `/api/profile`

Permite ao usuário logado alterar nome e/ou trocar senha (com confirmação da senha atual).

<AccordionGroup>
<Accordion title="Body">

**name** (string, opcional)  
**currentPassword** (string, condicional) — obrigatório ao trocar senha  
**newPassword** (string, condicional) — obrigatório ao trocar senha
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "message": "Perfil atualizado com sucesso",
  "user": { "id": "uuid", "name": "Novo Nome", "email": "..." }
}
```

**Erros:**
```json
{ "message": "Senha atual incorreta" } // 401
{ "message": "Nada a atualizar" }      // 400
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Lojas & Licenças">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-004</div>
</div>

### 🎯 Criar Loja
**POST** `/api/stores`

<AccordionGroup>
<Accordion title="Body">

**name** (string, obrigatório)  
**address** (string, opcional)  
**companyId** (uuid, opcional) — apenas Master pode especificar
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "name": "Filial Centro",
  "address": "Rua XV de Novembro, 100",
  "companyId": "uuid",
  "company": { "id": "uuid", "name": "Minha Empresa" },
  "license": null,
  "_count": { "terminals": 0 }
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-005</div>
</div>

### 🎯 Criar Licença — Master Only
**POST** `/api/stores/{id}/license`

Cria a primeira e única licença para a loja. Apenas usuários Master podem executar.

<AccordionGroup>
<Accordion title="Body">

**quantityTotal** (integer, obrigatório) — máximo de terminais simultâneos  
**startsAt** (datetime, obrigatório) — início da vigência  
**expiresAt** (datetime, obrigatório) — fim da vigência
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "quantityTotal": 10,
  "quantityUsed": 0,
  "startsAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "status": "active",
  "renewals": []
}
```

**Erros:**
```json
{ "message": "Acesso restrito ao master" } // 403
{ "message": "Loja já possui licença" }    // 409
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-005</div>
</div>

### 🎯 Renovar/Ajustar Licença — Master Only
**PATCH** `/api/stores/{id}/license`

<AccordionGroup>
<Accordion title="Body (todos opcionais)">

**newExpiresAt** (datetime) — nova data de expiração. Se futura, status → `active` automaticamente  
**addQuantity** (integer) — quantidade a adicionar ao total  
**removeQuantity** (integer) — quantidade a remover (não pode ficar abaixo de `quantityUsed`)  
**status** (string) — `active`, `expired` ou `suspended`
</Accordion>
<Accordion title="Response">

**Sucesso (200):** `StoreLicense` atualizada

**Erro:**
```json
{ "message": "Não é possível reduzir abaixo do uso atual (3)" } // 422
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-013</div>
</div>

### 🎯 Salvar Integração (Upsert)
**PUT** `/api/stores/{id}/integration`

Cria ou atualiza a integração ERP da loja em uma única operação.

<AccordionGroup>
<Accordion title="Body">

**baseUrl** (string, obrigatório) — URL base do sistema externo. Ex: `https://erp.minhaloja.com.br`  
**token** (string, opcional) — token de autenticação no ERP  
**endpointProductByEan** (string, opcional) — default `/terminal/product/{ean}`  
**endpointCatalog** (string, opcional) — default `/terminal/product`  
**endpointFullLoad** (string, opcional) — endpoint de carga completa  
**endpointIncremental** (string, opcional) — endpoint de carga incremental  
**isActive** (boolean, opcional) — default `true`
</Accordion>
<Accordion title="Response">

**Sucesso (200):** Objeto `StoreIntegration` completo
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Terminais">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-006</div>
</div>

### 🎯 Criar Terminal
**POST** `/api/terminals`

Cria o terminal e gera o `activationCode` automaticamente. **O slot de licença só é consumido na ativação do dispositivo físico.**

<AccordionGroup>
<Accordion title="Body">

**name** (string, obrigatório)  
**location** (string, obrigatório) — descrição do local físico  
**ip** (string, opcional) — único no sistema  
**storeId** (uuid, opcional) — loja onde o terminal será instalado  
**companyId** (uuid, opcional) — apenas Master pode especificar  
**isPriceChecker** (boolean, opcional) — default `true`  
**isMediaDisplay** (boolean, opcional) — default `false`
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "name": "Caixa 01",
  "location": "Entrada principal",
  "activationCode": "AB3XKRP7",
  "isActive": false,
  "isBlocked": false,
  "isPriceChecker": true,
  "isMediaDisplay": false,
  "company": { "id": "uuid", "name": "Minha Empresa" },
  "store": { "id": "uuid", "name": "Filial Centro" },
  "_count": { "terminalMedias": 0 }
}
```

**Erros:**
```json
{ "message": "Campos obrigatórios: name, location" }      // 400
{ "message": "Já existe um terminal com esse IP" }         // 409
{ "message": "Limite de terminais atingido." }             // 422
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-red-600 p-1 rounded-full text-white text-xs">RF/RSP-008</div>
</div>

### 🎯 Revogar Licença do Terminal — Master/Admin
**POST** `/api/admin/terminals/{id}/revoke`

Desativa o terminal, invalida todos os JWTs existentes imediatamente, libera slot de licença e gera novo código de ativação.

<AccordionGroup>
<Accordion title="Parameters">

**id** (uuid, path, obrigatório) — ID do terminal a revogar
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "terminalId": "uuid",
  "newActivationCode": "KP7MNRX2",
  "licenseFreed": true,
  "message": "Terminal revogado com sucesso"
}
```

**Erros:**
```json
{ "message": "Terminal não encontrado" }    // 404
{ "message": "Acesso não autorizado" }      // 403
{ "message": "Terminal já está inativo" }   // 422
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-010</div>
</div>

### 🎯 Vincular Mídia ao Terminal
**POST** `/api/admin/terminals/{id}/media`

Terminal deve ter `isMediaDisplay = true`. A ordem é atribuída automaticamente como `maxOrder + 1`.

<AccordionGroup>
<Accordion title="Body">

**mediaId** (uuid, obrigatório) — mídia da mesma empresa  
**startsAt** (datetime, opcional) — início da exibição  
**endsAt** (datetime, opcional) — fim da exibição  
**campaignId** (uuid, opcional) — campanha associada
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "order": 0,
  "startsAt": null,
  "endsAt": null,
  "terminalId": "uuid",
  "mediaId": "uuid",
  "media": {
    "id": "uuid",
    "url": "https://storage.supabase.co/...",
    "type": "image",
    "fileName": "banner-promo.jpg",
    "mimeType": "image/jpeg"
  },
  "campaign": null
}
```

**Erros:**
```json
{ "message": "Terminal não é do tipo mídia" }           // 400
{ "message": "Mídia já vinculada a este terminal" }     // 409
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-010</div>
</div>

### 🎯 Reordenar Mídias do Terminal
**PUT** `/api/admin/terminals/{id}/media/order`

Atualiza a ordem de exibição de múltiplos vínculos em uma transação atômica.

<AccordionGroup>
<Accordion title="Body">

**items** (array, obrigatório)
```json
{
  "items": [
    { "id": "uuid-terminalMedia-1", "order": 0 },
    { "id": "uuid-terminalMedia-2", "order": 1 },
    { "id": "uuid-terminalMedia-3", "order": 2 }
  ]
}
```
- **id**: ID do `TerminalMedia` (não da `Media`)
- **order**: nova posição na sequência
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "ok": true }
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Mídias">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-009</div>
</div>

### 🎯 Listar Mídias
**GET** `/api/media`

Retorna todas as mídias da empresa (Master vê todas).

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "url": "https://xxxxx.supabase.co/storage/v1/object/public/media/uploads/2026/04/...",
    "fileName": "banner-promo.jpg",
    "originalName": "Banner Promoção.jpg",
    "mimeType": "image/jpeg",
    "size": 1048576,
    "type": "image",
    "companyId": "uuid",
    "createdAt": "2026-04-07T20:00:00.000Z"
  }
]
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-009</div>
</div>

### 🎯 Upload de Mídia
**POST** `/api/media`

Envia arquivo para o Supabase Storage e registra metadados no banco. Aceita `multipart/form-data`.

**Limites:** Imagens ≤ 5 MB | Vídeos ≤ 50 MB

<AccordionGroup>
<Accordion title="Body (multipart/form-data)">

**file** (File, obrigatório) — arquivo `image/*` ou `video/*`
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "bucket": "media",
  "path": "uploads/2026/04/1775595123836-banner-promo.jpg",
  "url": "https://xxxxx.supabase.co/storage/v1/object/public/media/uploads/...",
  "fileName": "banner-promo.jpg",
  "originalName": "Banner Promoção.jpg",
  "mimeType": "image/jpeg",
  "size": 1048576,
  "type": "image",
  "companyId": "uuid"
}
```

**Erros:**
```json
{ "message": "Arquivo é obrigatório" }             // 400
{ "message": "Apenas imagem ou vídeo são permitidos" } // 400
{ "message": "Imagem excede o limite de 5MB" }     // 400
{ "message": "Vídeo excede o limite de 50MB" }     // 400
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-red-600 p-1 rounded-full text-white text-xs">RF/RSP-009</div>
</div>

### 🎯 Remover Mídia
**DELETE** `/api/media/{id}`

Remove o arquivo do Supabase Storage e o registro do banco. Se a mídia estiver vinculada a terminais, os vínculos serão quebrados.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "message": "Mídia removida com sucesso" }
```

**Erro:**
```json
{ "message": "Mídia não encontrada" } // 404
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Produtos">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-011</div>
</div>

### 🎯 Listar Produtos da Loja
**GET** `/api/stores/{id}/products`

<AccordionGroup>
<Accordion title="Query Parameters">

**page** (integer, opcional) — padrão `1`  
**limit** (integer, opcional) — padrão `50`, máximo `100`  
**q** (string, opcional) — busca por nome (case-insensitive) ou EAN
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "products": [
    {
      "id": "uuid",
      "ean": "7891000315507",
      "name": "Leite Integral 1L",
      "price": "4.99",
      "offerPrice": "3.99",
      "clubPrice": "3.49",
      "stock": 50,
      "isActive": true,
      "updatedAt": "2026-04-07T00:00:00.000Z"
    }
  ],
  "total": 1500,
  "page": 1,
  "limit": 50,
  "pages": 30
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-011</div>
</div>

### 🎯 Criar/Atualizar Produto (Upsert por EAN)
**POST** `/api/stores/{id}/products`

Realiza upsert por `(storeId, ean)`. Cria se não existir, atualiza se existir. Ideal para integração com ERPs.

<AccordionGroup>
<Accordion title="Body">

**ean** (string, obrigatório) — código de barras  
**name** (string, obrigatório)  
**price** (decimal, obrigatório) — preço normal  
**offerPrice** (decimal, opcional) — preço de oferta  
**clubPrice** (decimal, opcional) — preço de clube/fidelidade  
**stock** (integer, opcional)  
**imageUrl** (string, opcional)  
**isActive** (boolean, opcional) — default `true`  
**externalId** (string, opcional) — ID no ERP externo  
**hash** (string, opcional) — hash para detecção de mudanças  
**description** (string, opcional)
</Accordion>
<Accordion title="Response">

**Criado (201) ou Atualizado (200):**
```json
{
  "id": "uuid",
  "ean": "7891000315507",
  "name": "Leite Integral 1L",
  "price": "4.99",
  "offerPrice": "3.99",
  "clubPrice": null,
  "stock": 50,
  "isActive": true,
  "storeId": "uuid"
}
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Terminal Device">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-007</div>
</div>

### 🎯 Ativar Terminal (Primeira Vez)
**POST** `/api/terminal/activate`

**Sem autenticação.** Usado pelo dispositivo físico na primeira inicialização. Consome 1 slot de licença da loja.

<AccordionGroup>
<Accordion title="Body">

**activationCode** (string, obrigatório) — código de 8 caracteres do painel (case-insensitive)  
Exemplo: `"AB3XKRP7"` ou `"ab3xkrp7"`
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "terminalId": "uuid",
  "name": "Caixa 01",
  "isPriceChecker": true,
  "isMediaDisplay": false
}
```

**Erros:**
```json
{ "message": "Código de ativação inválido" }          // 404
{ "message": "Terminal bloqueado" }                    // 403
{ "message": "Limite de terminais atingido." }         // 422
{ "message": "Licença expirada ou suspensa" }          // 422
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-007</div>
</div>

### 🎯 Reautenticar Terminal (Renovar Token)
**POST** `/api/terminal/auth`

**Sem autenticação.** Renova o Bearer JWT quando o token de 30 dias expira. **Não consome licença.**

<AccordionGroup>
<Accordion title="Body">

**activationCode** (string, obrigatório)
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "token": "eyJhbGciOiJIUzI1NiJ9..." }
```

**Erros:**
```json
{ "message": "Terminal não encontrado ou inativo" }    // 404
{ "message": "Terminal bloqueado" }                    // 403
{ "message": "Licença da loja expirada ou suspensa" } // 403
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-007</div>
</div>

### 🎯 Bootstrap do Terminal
**GET** `/api/terminal/bootstrap`

**Bearer obrigatório.** Retorna todos os dados iniciais que o dispositivo precisa para operar: configuração, loja, empresa e endpoints a usar.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "terminal": {
    "id": "uuid",
    "name": "Caixa 01",
    "location": "Entrada principal",
    "isPriceChecker": true,
    "isMediaDisplay": false
  },
  "store": {
    "id": "uuid",
    "name": "Filial Centro",
    "address": "Rua XV, 100"
  },
  "company": { "id": "uuid", "name": "Minha Empresa" },
  "config": { "resetTime": 30 },
  "endpoints": {
    "productByEan": "/api/terminal/product/{ean}",
    "catalog": "/api/terminal/product",
    "publicProductByEan": "/api/terminal/{storeId}/{ean}"
  }
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-007</div>
</div>

### 🎯 Heartbeat do Terminal
**POST** `/api/terminal/heartbeat`

**Bearer obrigatório.** Registra sinal de vida do dispositivo. Atualiza `lastSeenAt` no terminal.

<AccordionGroup>
<Accordion title="Body (opcional)">

**ip** (string, opcional) — IP atual do dispositivo  
**appVersion** (string, opcional) — versão do aplicativo instalado
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "ok": true }
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-012</div>
</div>

### 🎯 Buscar Produto por EAN (Terminal)
**GET** `/api/terminal/product/{ean}`

**Bearer obrigatório.** O `storeId` é derivado do JWT — nunca informado pelo cliente.

<AccordionGroup>
<Accordion title="Parameters">

**ean** (string, path, obrigatório) — código de barras do produto. Ex: `7891000315507`
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "id": "uuid",
  "ean": "7891000315507",
  "name": "Leite Integral 1L",
  "imageUrl": "https://...",
  "description": "Leite UHT integral caixa 1L",
  "price": "4.99",
  "offerPrice": "3.99",
  "clubPrice": null,
  "stock": 50,
  "updatedAt": "2026-04-07T00:00:00.000Z"
}
```

**Erros:**
```json
{ "message": "Terminal inativo ou bloqueado" } // 403
{ "message": "Produto não encontrado" }        // 404
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-012</div>
</div>

### 🎯 Conteúdo de Mídia Atual
**GET** `/api/terminal/content/current`

**Bearer obrigatório.** Retorna mídias vinculadas ao terminal com status de vigência calculado em tempo real.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "medias": [
    {
      "terminalMediaId": "uuid",
      "order": 0,
      "startsAt": null,
      "endsAt": "2026-06-01T00:00:00.000Z",
      "active": true,
      "expired": false,
      "media": {
        "id": "uuid",
        "url": "https://storage.supabase.co/...",
        "type": "image",
        "fileName": "banner-promo.jpg",
        "mimeType": "image/jpeg"
      }
    }
  ]
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-green-600 p-1 rounded-full text-white text-xs">RF/RSP-012</div>
</div>

### 🎯 Produto por EAN — Endpoint Público
**GET** `/api/terminal/{storeId}/{ean}`

**Sem autenticação.** O UUID da loja funciona como identificador de acesso público. Ideal para situações onde o terminal não consegue enviar Bearer token.

<AccordionGroup>
<Accordion title="Parameters">

**storeId** (uuid, path, obrigatório) — UUID da loja  
**ean** (string, path, obrigatório) — código de barras
</Accordion>
<Accordion title="Response">

**Sucesso (200):** Mesmo formato de `GET /api/terminal/product/{ean}`

**Erros:**
```json
{ "message": "Loja não encontrada" }    // 404
{ "message": "Produto não encontrado" } // 404
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-007</div>
</div>

### 🎯 Registrar Evento do Terminal
**POST** `/api/terminal/events`

**Bearer obrigatório.** Registra eventos de telemetria do dispositivo (consultas, erros, interações).

<AccordionGroup>
<Accordion title="Body">

**type** (string, obrigatório) — tipo do evento. Ex: `PRICE_QUERY`, `MEDIA_PLAY`, `ERROR`  
**payload** (object, opcional) — dados adicionais em formato livre
```json
{
  "type": "PRICE_QUERY",
  "payload": {
    "ean": "7891000315507",
    "found": true,
    "duration": 120
  }
}
```
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{ "ok": true }
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

<Tab title="Notificações & Config">

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-014</div>
</div>

### 🎯 Criar Notificação
**POST** `/api/notifications`

<AccordionGroup>
<Accordion title="Body">

**title** (string, obrigatório)  
**body** (string, obrigatório) — conteúdo da notificação  
**type** (string, opcional) — `info` | `warning` | `danger` | `success`. Default: `info`  
**actionLabel** (string, opcional) — texto do botão de ação  
**actionUrl** (string, opcional) — URL do botão de ação  
**companyId** (uuid, opcional) — apenas Master pode especificar empresa destino
</Accordion>
<Accordion title="Response">

**Sucesso (201):**
```json
{
  "id": "uuid",
  "title": "Licença próxima do vencimento",
  "body": "A licença da Filial Centro vence em 7 dias.",
  "type": "warning",
  "actionLabel": "Ver licença",
  "actionUrl": "/licencas",
  "isRead": false,
  "readAt": null,
  "companyId": "uuid",
  "createdAt": "2026-04-07T20:00:00.000Z"
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-014</div>
</div>

### 🎯 Marcar Notificação como Lida
**PATCH** `/api/notifications/{id}`

Define `isRead = true` e `readAt = now`. Operação irreversível pelo sistema.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):** Objeto `Notification` com `isRead: true` e `readAt` preenchido
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-yellow-600 p-1 rounded-full text-white text-xs">RF/RSP-015</div>
</div>

### 🎯 Atualizar Configuração Global
**PATCH** `/api/config`

Atualiza o `resetTime` — tempo em segundos para reset da tela do terminal após inatividade.

<AccordionGroup>
<Accordion title="Body">

**resetTime** (integer, opcional) — mínimo `1` segundo. Default `30`
</Accordion>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "id": "uuid",
  "resetTime": 45,
  "lastSync": "2026-04-07T20:00:00.000Z",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-04-07T21:00:00.000Z"
}
```

**Erro:**
```json
{ "message": "resetTime deve ser um número maior que 0" } // 400
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-015</div>
</div>

### 🎯 Gerar Carga para Terminais
**POST** `/api/config/sync`

Marca o momento da última sincronização (`lastSync = now`). Deve ser executado antes do push.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "message": "Carga gerada com sucesso",
  "lastSync": "2026-04-07T21:00:00.000Z"
}
```
</Accordion>
</AccordionGroup>
</Container>

<Container>
<div class="flex items-center gap-1">
    <div class="bg-blue-600 p-1 rounded-full text-white text-xs">RF/RSP-015</div>
</div>

### 🎯 Enviar Carga aos Terminais
**POST** `/api/config/push`

Envia a carga gerada para todos os terminais cadastrados. Exige `lastSync` preenchido. Comunicação real via IP é um placeholder.

<AccordionGroup>
<Accordion title="Response">

**Sucesso (200):**
```json
{
  "message": "Carga enviada para 5 terminal(is) com sucesso",
  "terminals": [
    { "id": "uuid", "name": "Caixa 01", "ip": "192.168.1.50" }
  ]
}
```

**Erros:**
```json
{ "message": "Gere uma carga antes de enviar aos terminais" } // 400
{ "message": "Nenhum terminal cadastrado para receber a carga" } // 400
```
</Accordion>
</AccordionGroup>
</Container>

</Tab>

</Tabs>

---

## 🧪 Testing

### Configuração

<Container>

**Framework:** Vitest 4.x + `@vitest/coverage-v8`

**Scripts disponíveis:**
```bash
npm test               # executa todos os testes uma vez
npm run test:watch     # modo watch (re-executa ao salvar)
npm run test:coverage  # gera relatório de cobertura em /coverage
```

**Arquivos de configuração:**
- `vitest.config.ts` — alias `@/*`, ambiente Node, include `src/**/*.test.ts`
- `src/__tests__/setup.ts` — silencia `console.error` durante os testes

**Padrão de mock obrigatório:** sempre usar `vi.hoisted()` para variáveis referenciadas dentro de factories `vi.mock()`. Mock do `pg.Pool` deve usar `class { query = mockFn }` (não arrow function).

</Container>

### Resultado Atual

<Container>

**156 testes — 11 arquivos — 100% passando** *(atualizado em 2026-04-23)*

</Container>

### Arquivos de Teste

<Container>

**Testes Unitários de Lib**

| Arquivo | Módulo | O que cobre |
|---------|--------|-------------|
| `src/lib/__tests__/terminal-auth.test.ts` | `terminal-auth.ts` | `generateActivationCode` (charset, 8 chars, sem 0/O/I/1), `generateTerminalToken`, `verifyTerminalToken` (token inválido, tipo errado, storeId null), `getTerminalFromRequest` (sem header, REVOKED, token diferente, fail-closed se DB cair) |
| `src/lib/__tests__/license.test.ts` | `license.ts` | `checkLicenseAvailable` (sem licença, status suspended/expired, data expirada, limite atingido, último slot disponível), `incrementLicenseUsed`, `decrementLicenseUsed` (mín 0, sem licença) |
| `src/lib/__tests__/revoke-license.test.ts` | `revoke-license.ts` | Transação atômica de revogação, isolamento de tenant, master override, terminal inativo, credencial nula, sem ativações, licenseFreed, decremento de slot |
| `src/lib/__tests__/tenant-db.test.ts` | `tenant-db.ts` | `getTenantSchema` (remoção de hífens, prefixo), `listProducts` (paginação, limit 100, pages, schema, filtro ILIKE), `getProductByEan`, `upsertProduct` (ON CONFLICT, created true/false, campos nulos), `deleteProduct`, `deleteAllProducts` |
| `src/lib/__tests__/auth.test.ts` | `auth.ts` | `MASTER_COMPANY_SLUG`, `createSession` (cookie flags, JWT 3 partes), `getSession` (cookie ausente, token inválido, payload correto, chave errada, isMaster), `destroySession` |

**Testes de Rotas API (com mocks)**

| Arquivo | Rota | O que cobre |
|---------|------|-------------|
| `src/app/api/auth/__tests__/login.test.ts` | `POST /api/auth/login` | 400 campos ausentes, 401 conta/usuário/senha, 403 empresa inativa/usuário inativo, isMaster por slug, password nunca exposta no response |
| `src/app/api/terminal/__tests__/activate.test.ts` | `POST /api/terminal/activate` | 400/404/403/422, licença (suspended/expired/limite), sem storeId, uppercase do código, JWT 3 partes, upsert de credencial com ACTIVE, transação atômica |
| `src/app/api/terminal/__tests__/auth.test.ts` | `POST /api/terminal/auth` | 400/404/403, isActive=false, isBlocked, licença (nula/suspended/expirada), sem storeId não verifica licença, token JWT válido, upsert credencial, uppercase |
| `src/app/api/admin/terminals/__tests__/revoke.test.ts` | `POST /api/admin/terminals/[id]/revoke` | 401 sem sessão, 404/403/422, resposta com newActivationCode e licenseFreed, repasse correto de userId/companyId/isMaster |
| `src/app/api/stores/__tests__/products.test.ts` | `GET/POST/DELETE /api/stores/[id]/products` | 401 sem sessão, 404 loja/outra empresa, master override, paginação, busca q, 201 vs 200 (upsert), 400 campos obrigatórios, DELETE com contagem |
| `src/middleware.test.ts` | `middleware.ts` | Rotas públicas (/_next, /login, /api/auth/*, /api/terminal/*), redirecionamento sem cookie, cookie inválido, rotas master-only (403 API / redirect página), master sem restrição |

</Container>

### Cobertura por Regra de Negócio

<Container>

| Regra de Negócio | Testes |
|-----------------|--------|
| **RN/RSP-001** Multi-tenancy | `products.test.ts` (loja de outra empresa → 404), `revoke.test.ts` (403 para outro tenant), `revoke-license.test.ts` (master override) |
| **RN/RSP-002** Autenticação Dupla | `auth.test.ts` (createSession, getSession, isMaster), `terminal-auth.test.ts` (verifyTerminalToken, getTerminalFromRequest, fail-closed) |
| **RN/RSP-003** Controle de Licenças | `license.test.ts` (todas as condições 6.3), `activate.test.ts` (422 para cada cenário), `auth.test.ts` (re-auth bloqueia com licença expirada) |
| **RN/RSP-004** Ciclo de Vida Terminal | `terminal-auth.test.ts` (generateActivationCode sem 0/O/I/1), `activate.test.ts` (404/403), `revoke-license.test.ts` (novo código após revogação) |
| **RN/RSP-005** Revogação Atômica | `revoke-license.test.ts` (4 operações na transação, sem credencial/ativação, decremento de slot) |
| **RN/RSP-008** Upsert de Produtos | `products.test.ts` (201 criação, 200 atualização, campos obrigatórios, preco2/preco3 null) |

</Container>

---

## 📋 Todo List

### 🚨 Technical Improvements
- [ ] Implementar verificação de expiração de licença via cron job e atualizar `status → 'expired'` automaticamente
- [ ] Adicionar rate limiting nos endpoints públicos (`/api/terminal/activate`, `/api/terminal/{storeId}/{ean}`)
- [ ] Implementar comunicação real com terminais via IP em `POST /api/config/push`
- [ ] Adicionar campo `role` ao modelo `User` para controle de permissões granulares dentro da empresa
- [ ] Criar índice de banco em `terminal_medias.terminalId` para performance nas queries de conteúdo
- [ ] Implementar refresh automático de token de terminal antes da expiração de 30 dias
- [ ] Adicionar suporte a PATCH em `StoreIntegration` para atualizações parciais

### 📝 Documentation
- [ ] Documentar fluxo de integração ERP completo com exemplos de carga incremental
- [ ] Criar diagrama de estados do terminal (criado → ativo → revogado → reativado)
- [ ] Adicionar exemplos de webhooks para notificações em tempo real nos terminais
- [ ] Documentar formato esperado dos endpoints configuráveis em `StoreIntegration`

### 📊 Monitoring
- [ ] Implementar alerta quando `quantityUsed >= quantityTotal` em qualquer licença ativa
- [ ] Criar dashboard de terminais offline (sem heartbeat há mais de 5 minutos)
- [ ] Implementar métricas de latência por endpoint de terminal
- [ ] Adicionar log estruturado (JSON) com `terminalId`, `companyId` e `storeId` em cada request
- [ ] Criar relatório de produtos mais consultados por terminal/loja

### 🧪 Tests
- [x] Escrever testes unitários para `revokeTerminalLicense` com todos os cenários de falha *(concluído 2026-04-23)*
- [x] Testar comportamento fail-closed quando banco está indisponível na validação do Bearer *(concluído 2026-04-23)*
- [ ] Implementar testes de integração para o fluxo completo de ativação → consulta → revogação
- [ ] Adicionar testes de carga para `GET /api/terminal/product/{ean}` (endpoint crítico de produção)
- [ ] Testar race condition em ativação simultânea com licença no limite

### 🚀 New Features
- [ ] Implementar campanhas com agendamento automático de ativação/desativação
- [ ] Adicionar suporte a playlists de mídia com transições configuráveis
- [ ] Criar endpoint de relatório de heartbeats por período para monitoramento de uptime
- [ ] Implementar webhook para notificar sistema externo quando terminal fica offline
- [ ] Adicionar suporte a múltiplos buckets de Storage por empresa
- [ ] Criar endpoint de bulk import de produtos via CSV/JSON para cargas iniciais
- [ ] Implementar sistema de auditoria completo (log de todas as ações administrativas)
