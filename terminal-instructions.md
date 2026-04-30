# Revvo Smart Price — Instruções para Atualização do App Terminal

> Use este documento como referência completa para atualizar o projeto `revvo-smart-price-app`.
> Todas as rotas, modelos, payloads e regras de negócio estão documentados abaixo.

---

## Autenticação do Terminal

O terminal usa **JWT Bearer Token** obtido via ativação.

**Header em todas as requisições autenticadas:**
```
Authorization: Bearer <token>
```

**Payload do token:**
```json
{
  "sub": "terminalId",
  "companyId": "string",
  "storeId": "string | null",
  "type": "terminal",
  "iat": 1234567890,
  "exp": 1234567890
}
```

- Validade: **30 dias**
- Se o terminal for **revogado** ou **bloqueado**, o token é invalidado imediatamente no banco

---

## Fluxo de Ativação

### 1. Ativar Terminal (primeira vez)

```
POST /api/terminal/activate
```

**Request:**
```json
{ "activationCode": "ABC12DEF" }
```

**Response (200):**
```json
{
  "token": "jwt-token-aqui",
  "terminalId": "uuid",
  "name": "Terminal 01",
  "isPriceChecker": true,
  "isMediaDisplay": false
}
```

**Erros:**
- `404` — Código inválido
- `403` — Terminal bloqueado
- `422` — Licença indisponível (sem slots)

**Regras:**
- O código é case-insensitive
- Após ativação, o terminal fica `isActive=true`
- Um slot da licença da loja é consumido
- Salvar o `token` localmente para todas as próximas requisições

---

### 2. Re-autenticar Terminal (renovar token)

```
POST /api/terminal/auth
```

**Request:**
```json
{ "activationCode": "ABC12DEF" }
```

**Response (200):**
```json
{ "token": "novo-jwt-token" }
```

**Regras:**
- Só funciona se o terminal já está ativo
- Não consome licença novamente
- Use quando o token estiver próximo de expirar

---

## Bootstrap e Configuração

### 3. Bootstrap (dados iniciais ao abrir o app)

```
GET /api/terminal/bootstrap
```

**Response (200):**
```json
{
  "terminal": {
    "id": "uuid",
    "name": "Terminal 01",
    "location": "Entrada",
    "isPriceChecker": true,
    "isMediaDisplay": false
  },
  "store": {
    "id": "uuid",
    "name": "Loja Centro"
  },
  "company": {
    "id": "uuid",
    "name": "Empresa X",
    "email": "contato@empresa.com"
  },
  "endpoints": { ... },
  "resetTime": 30
}
```

**Erros:**
- `401` — Token inválido/expirado
- `403` — Terminal bloqueado

---

### 4. Configuração do Terminal

```
GET /api/terminal/config
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Terminal 01",
  "location": "Entrada",
  "isPriceChecker": true,
  "isMediaDisplay": false,
  "resetTime": 30
}
```

**Erros:**
- `403` — Terminal bloqueado

---

## Consulta de Produto (Price Checker)

### 5. Buscar Produto por EAN

```
GET /api/terminal/product/{ean}
```

**Response (200):**
```json
{
  "id": "uuid",
  "tenant_id": "string",
  "ean": "7891234567890",
  "codigo_produto": "001",
  "produto": "Coca-Cola 350ml",
  "preco1": 5.99,
  "preco2": 5.49,
  "preco3": null,
  "image_url": "https://...",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

**Erros:**
- `404` — Produto não encontrado
- `403` — Terminal bloqueado ou sem loja vinculada

**Regras:**
- O terminal precisa ter `isActive=true`, não estar bloqueado e ter loja vinculada
- Os dados vêm do schema tenant da loja (catálogo isolado por loja)

---

## Conteúdo de Mídia (Media Display)

### 6. Conteúdo Atual do Terminal

```
GET /api/terminal/content/current
```

**Response (200):**
```json
{
  "medias": [
    {
      "terminalMediaId": "uuid",
      "order": 1,
      "startsAt": "2026-01-01T00:00:00Z",
      "endsAt": "2026-12-31T23:59:59Z",
      "active": true,
      "expired": false,
      "media": {
        "id": "uuid",
        "url": "https://supabase.../image.jpg",
        "type": "image",
        "fileName": "promo-verao.jpg",
        "mimeType": "image/jpeg"
      }
    }
  ]
}
```

**Regras:**
- Filtra por data (startsAt/endsAt)
- `active: true` = dentro do período de exibição
- `expired: true` = período encerrado
- Ordenado por `order`
- Pode conter imagens e vídeos

---

## Heartbeat e Eventos

### 7. Enviar Heartbeat (manter online)

```
POST /api/terminal/heartbeat
```

**Request:**
```json
{
  "ip": "192.168.1.100",
  "appVersion": "1.2.0"
}
```

**Response (200):**
```json
{ "ok": true }
```

**Regras:**
- Enviar periodicamente (sugestão: a cada 1-5 minutos)
- Atualiza o `lastSeenAt` do terminal no banco
- IP e appVersion são opcionais

---

### 8. Registrar Evento

```
POST /api/terminal/events
```

**Request:**
```json
{
  "type": "product_scanned",
  "payload": {
    "ean": "7891234567890",
    "found": true
  }
}
```

**Response (200):**
```json
{ "ok": true }
```

**Tipos de evento sugeridos:**
- `product_scanned` — Produto consultado
- `media_displayed` — Mídia exibida
- `app_started` — App iniciou
- `app_error` — Erro no app
- `screen_touched` — Interação do usuário

---

## Configuração Global

### 9. Obter Configuração

```
GET /api/config
```

**Response (200):**
```json
{
  "id": "uuid",
  "resetTime": 30,
  "lastSync": "2026-01-01T00:00:00Z"
}
```

**Regras:**
- `resetTime` = tempo em segundos para o terminal voltar à tela inicial após inatividade
- Endpoint público (sem autenticação)

---

## Resumo dos Endpoints do Terminal

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/terminal/activate` | Não | Ativar terminal com código |
| POST | `/api/terminal/auth` | Não | Re-autenticar (renovar token) |
| GET | `/api/terminal/bootstrap` | Bearer | Dados iniciais completos |
| GET | `/api/terminal/config` | Bearer | Configuração do terminal |
| GET | `/api/terminal/product/{ean}` | Bearer | Buscar produto por EAN |
| GET | `/api/terminal/content/current` | Bearer | Mídias atuais do terminal |
| POST | `/api/terminal/heartbeat` | Bearer | Enviar heartbeat |
| POST | `/api/terminal/events` | Bearer | Registrar evento |
| GET | `/api/config` | Não | Configuração global |

---

## Modelos de Dados Relevantes

### Terminal
```typescript
interface Terminal {
  id: string
  name: string
  ip: string | null
  location: string
  isPriceChecker: boolean
  isMediaDisplay: boolean
  isActive: boolean
  isBlocked: boolean
  activationCode: string
  lastSeenAt: Date | null
  storeId: string | null
  companyId: string
}
```

### Produto (schema tenant)
```typescript
interface Product {
  id: string
  tenant_id: string
  ean: string
  codigo_produto: string | null
  produto: string
  preco1: number
  preco2: number | null
  preco3: number | null
  image_url: string | null
  created_at: Date
  updated_at: Date
}
```

### Media
```typescript
interface Media {
  id: string
  url: string
  type: 'image' | 'video'
  fileName: string
  mimeType: string
}
```

### TerminalMedia (conteúdo agendado)
```typescript
interface TerminalMedia {
  terminalMediaId: string
  order: number
  startsAt: Date | null
  endsAt: Date | null
  active: boolean
  expired: boolean
  media: Media
}
```

---

## Fluxo Recomendado do App

```
1. Tela de Ativação
   └─ POST /api/terminal/activate (com código)
   └─ Salvar token no storage local

2. Inicialização
   └─ GET /api/terminal/bootstrap
   └─ Configurar app baseado em isPriceChecker / isMediaDisplay

3. Loop Principal
   ├─ Se Price Checker:
   │   └─ Aguardar scan → GET /api/terminal/product/{ean}
   │   └─ Exibir preço → Timeout (resetTime) → Voltar
   │
   ├─ Se Media Display:
   │   └─ GET /api/terminal/content/current
   │   └─ Exibir mídias em loop (respeitando order)
   │   └─ Polling periódico para atualizar conteúdo
   │
   └─ Heartbeat: POST /api/terminal/heartbeat (a cada 1-5 min)

4. Tratamento de Erros
   ├─ 401 → Token expirado → Tentar POST /api/terminal/auth
   ├─ 403 → Terminal bloqueado/revogado → Tela de "Terminal Desativado"
   └─ 422 → Licença expirada → Tela de "Licença Inválida"
```

---

## Notas Importantes

1. **Token de 30 dias** — Implementar lógica de renovação automática antes de expirar
2. **Terminal bloqueado** — Quando o admin revoga, o token é invalidado. O app deve detectar 403 e mostrar tela apropriada
3. **Código de ativação** — Muda após cada revogação, sempre 8 caracteres sem 0/O/I/L
4. **resetTime** — Vem do bootstrap/config, padrão 30 segundos
5. **Mídias** — Podem ser imagem ou vídeo, respeitar order e datas de agendamento
6. **Heartbeat** — Essencial para monitoramento, enviar mesmo quando idle
7. **Eventos** — Usar para analytics e debugging remoto
8. **Multi-loja** — Produtos são isolados por loja (schema tenant), o terminal só vê produtos da sua loja
