# Regras de Negócio — Revvo Smart Price

Documento de referência técnica descrevendo todas as regras de negócio do sistema.

---

## Índice

1. [Multi-tenancy e Isolamento de Dados](#1-multi-tenancy-e-isolamento-de-dados)
2. [Autenticação de Usuários Web](#2-autenticação-de-usuários-web)
3. [Empresas (Companies)](#3-empresas-companies)
4. [Usuários](#4-usuários)
5. [Lojas (Stores)](#5-lojas-stores)
6. [Licenças de Terminais](#6-licenças-de-terminais)
7. [Terminais](#7-terminais)
8. [Ativação e Autenticação de Terminais (Dispositivo)](#8-ativação-e-autenticação-de-terminais-dispositivo)
9. [Revogação de Licença de Terminal](#9-revogação-de-licença-de-terminal)
10. [Mídias](#10-mídias)
11. [Mídias Vinculadas a Terminais (TerminalMedia)](#11-mídias-vinculadas-a-terminais-terminalmedia)
12. [Produtos](#12-produtos)
13. [Integração de Catálogo (StoreIntegration)](#13-integração-de-catálogo-storeintegration)
14. [Notificações](#14-notificações)
15. [Configuração Global](#15-configuração-global)
16. [Segurança e Validações Gerais](#16-segurança-e-validações-gerais)

---

## 1. Multi-tenancy e Isolamento de Dados

O sistema opera em modelo multi-tenant: cada empresa enxerga e gerencia apenas os próprios dados.

### 1.1 Perfil Master

- Existe um perfil especial chamado **Master**, identificado pelo slug de empresa igual a `revvo-master`.
- O usuário Master tem acesso irrestrito a **todas as empresas**, lojas, terminais, usuários e mídias do sistema.
- Ao criar recursos (lojas, terminais, usuários), o Master pode especificar `companyId` para qualquer empresa.

### 1.2 Perfil Usuário Comum

- Ao fazer login, o `companyId` é extraído do usuário autenticado e gravado na sessão.
- Todas as queries de listagem aplicam automaticamente um filtro `WHERE companyId = session.companyId`.
- O usuário comum **não pode** especificar outro `companyId` nos requests — mesmo que envie no body, o servidor ignora e usa o da sessão.
- Tentativas de acessar recursos de outra empresa retornam `403 Forbidden`.

### 1.3 Controle Server-Side

O isolamento é aplicado **exclusivamente no servidor**. O cliente nunca é confiado para informar a qual empresa pertence um recurso.

---

## 2. Autenticação de Usuários Web

### 2.1 Login

1. O sistema verifica se o e-mail existe no banco.
2. Verifica se `user.isActive === true`. Se inativo, retorna `403`.
3. Verifica se `user.company.status === 'ATIVO'`. Se inativo, retorna `403`.
4. Compara a senha enviada com o hash bcrypt armazenado.
5. Se tudo válido, cria um JWT assinado com HS256 e o armazena em um cookie `revvo_session` com as seguintes propriedades:
   - `httpOnly: true` — inacessível via JavaScript
   - `secure: true` em produção
   - `sameSite: lax`
   - Expiração: **8 horas**

### 2.2 Payload da Sessão

O JWT contém: `userId`, `companyId`, `name`, `email`, `isMaster`.

### 2.3 Logout

Ao fazer logout, o cookie `revvo_session` é deletado do navegador. O JWT não é invalidado no servidor (stateless), portanto expira naturalmente em 8h.

### 2.4 Proteção de Rotas

Todas as rotas administrativas verificam o cookie no início do handler. Se ausente ou inválido, retornam `401 Unauthorized`.

---

## 3. Empresas (Companies)

### 3.1 Identificadores Únicos

Os campos `cnpj`, `email` e `slug` são únicos no banco. Tentar criar ou editar uma empresa com valor duplicado retorna `409 Conflict`.

### 3.2 Status

- Uma empresa pode ter status `ATIVO` ou `INATIVO`.
- Quando uma empresa está `INATIVO`, nenhum de seus usuários consegue fazer login (bloqueio no passo de autenticação).
- O status padrão ao criar é `ATIVO`.

### 3.3 Exclusão em Cascata

Ao deletar uma empresa, o banco remove automaticamente (CASCADE):
- Todos os usuários vinculados
- Todas as lojas (e por consequência licenças, terminais, produtos, integrações)
- Todos os terminais vinculados diretamente à empresa
- Todas as mídias da empresa
- Todas as campanhas
- Todas as notificações

### 3.4 Slug Master

O slug `revvo-master` é reservado para a empresa administradora do sistema. Qualquer usuário vinculado a essa empresa recebe automaticamente permissões de Master.

---

## 4. Usuários

### 4.1 Senha

- A senha é armazenada como hash bcrypt com fator 10.
- A senha nunca é retornada em nenhum endpoint.
- O endpoint de edição de usuário (`PATCH /api/users/:id`) permite alterar a senha — ela será hasheada antes de salvar.

### 4.2 Ativação

- O campo `isActive` controla se o usuário pode fazer login.
- Um usuário inativo (`isActive: false`) recebe `403` ao tentar autenticar.

### 4.3 Escopo de Criação

- Usuário comum só pode criar usuários dentro da própria empresa.
- Master pode criar usuários para qualquer empresa especificando `companyId` no body.

### 4.4 E-mail Único

O e-mail é único em toda a tabela. Tentativa de cadastro com e-mail duplicado retorna `409 Conflict`.

### 4.5 Perfil Próprio

O endpoint `PATCH /api/profile` permite ao usuário autenticado:
- Alterar o próprio nome.
- Trocar a senha, desde que informe a `currentPassword` correta. Se a senha atual estiver errada, retorna `401`.

---

## 5. Lojas (Stores)

### 5.1 Vinculação à Empresa

Toda loja pertence a uma empresa. Um usuário comum só vê lojas da própria empresa.

### 5.2 Licença como Pré-requisito

Para que terminais sejam **ativados** em uma loja, ela precisa ter uma licença ativa. A loja pode existir sem licença, mas os terminais associados a ela não poderão ser ativados.

### 5.3 Exclusão em Cascata

Ao deletar uma loja:
- Todos os terminais da loja são removidos (CASCADE).
- A licença e seus registros de renovação são removidos.
- Todos os produtos são removidos.
- A integração é removida.

---

## 6. Licenças de Terminais

### 6.1 Modelo de Licença

Cada loja pode ter **no máximo uma licença** (`StoreLicense`). A licença controla:
- `quantityTotal`: quantidade máxima de terminais que podem estar ativos simultaneamente.
- `quantityUsed`: quantidade de terminais atualmente ativos (incrementado na ativação, decrementado na revogação/exclusão).
- `status`: `active`, `expired` ou `suspended`.
- `startsAt` / `expiresAt`: período de vigência.

### 6.2 Criação de Licença

- Somente o **Master** pode criar licenças.
- Uma loja só pode ter uma licença. Tentar criar uma segunda retorna `409 Conflict`.

### 6.3 Consumo de Slot

- O slot de licença **não é consumido** na criação do terminal no painel.
- O slot **é consumido** no momento em que o dispositivo físico realiza a ativação (`POST /api/terminal/activate`).
- Antes da ativação, o sistema verifica:
  1. `license.status === 'active'`
  2. `license.expiresAt >= now`
  3. `license.quantityUsed < license.quantityTotal`
- Se qualquer condição falhar, a ativação é negada com `422 Unprocessable Entity`.

### 6.4 Liberação de Slot

O slot é liberado (`quantityUsed - 1`) em dois casos:
1. **Revogação** do terminal via `POST /api/admin/terminals/:id/revoke`.
2. **Exclusão** do terminal via `DELETE /api/terminals/:id` — somente se o terminal estava ativo (`isActive === true`).

### 6.5 Renovação

- Somente o **Master** pode renovar ou ajustar licenças.
- Toda renovação (extensão de data ou acréscimo de quantidade) gera um registro em `LicenseRenewal` com os dados anteriores, permitindo auditoria.
- Não é possível reduzir `quantityTotal` abaixo do `quantityUsed` atual. Tentativa retorna `422`.
- Se a nova `expiresAt` estiver no futuro, o `status` é automaticamente redefinido para `active`.

### 6.6 Efeito da Expiração

- Terminais de uma loja com licença expirada **não conseguem se reautenticar** (reautenticação verifica validade da licença).
- Terminais já autenticados com JWT ainda válido continuam operando até que o JWT expire ou o terminal seja bloqueado.

### 6.7 Exclusão de Licença

- Somente o **Master** pode remover uma licença.

---

## 7. Terminais

### 7.1 Tipos de Terminal

Um terminal pode ter dois modos de operação, controlados por flags booleanas:
- `isPriceChecker`: terminal de consulta de preços (padrão: `true`).
- `isMediaDisplay`: terminal de exibição de mídia (padrão: `false`).
- As flags são independentes — um terminal pode ser ambos.

### 7.2 Código de Ativação

- Ao criar um terminal, o sistema gera automaticamente um `activationCode` de **8 caracteres** alfanuméricos maiúsculos, excluindo caracteres ambíguos (sem `0`, `O`, `I`, `1`).
- O código é único em toda a tabela de terminais.
- Se houver colisão, o sistema tenta até 5 vezes antes de falhar.
- O código é utilizado pelo dispositivo físico para se ativar ou reautenticar.

### 7.3 Estado do Terminal

| Campo | Descrição |
|---|---|
| `isActive` | `false` até a primeira ativação. `true` após ativar. Volta a `false` após revogação. |
| `isBlocked` | Bloqueio manual ou resultado de revogação. Terminal bloqueado não consegue reautenticar. |
| `lastSeenAt` | Atualizado a cada heartbeat enviado pelo dispositivo. |
| `activationCode` | Substituído por um novo código após revogação (código antigo não pode ser reutilizado). |
| `revokedAt` | Data da revogação. |
| `revokedBy` | ID do usuário que revogou. |

### 7.4 IP Único

O campo `ip` é opcional, mas se informado deve ser único no banco. Tentativa de cadastrar IP duplicado retorna `409 Conflict`.

### 7.5 Associação a Loja

- Um terminal pode ou não estar associado a uma loja.
- Terminais sem loja não conseguem consultar produtos pelo JWT (retornam lista vazia ou 404).
- A associação à loja é opcional na criação e pode ser alterada via PATCH.

### 7.6 Licença na Criação

Ao criar um terminal **com** `storeId`, o sistema verifica previamente se a licença da loja está disponível — mas **não consome o slot**. O slot é consumido apenas na ativação do dispositivo físico.

---

## 8. Ativação e Autenticação de Terminais (Dispositivo)

### 8.1 Primeira Ativação (`POST /api/terminal/activate`)

Fluxo completo:
1. Busca o terminal pelo `activationCode` (case-insensitive).
2. Verifica se o terminal **não está bloqueado**.
3. Se tiver `storeId`, verifica se a licença da loja está ativa e dentro da cota.
4. Gera um JWT (Bearer) assinado com HS256, válido por **30 dias**, contendo `terminalId`, `companyId`, `storeId`.
5. Salva o token na tabela `TerminalCredential` (upsert — sobrescreve token anterior se existir).
6. Em transação atômica:
   - Cria registro em `TerminalActivation` com status `USED`.
   - Define `terminal.isActive = true`, `isBlocked = false`, limpa `revokedAt` e `revokedBy`.
   - Incrementa `storeLicense.quantityUsed += 1`.

### 8.2 Reautenticação (`POST /api/terminal/auth`)

Usado quando o JWT de 30 dias expira:
1. Busca o terminal pelo `activationCode`.
2. Verifica `isActive === true` e `isBlocked === false`.
3. Verifica validade da licença da loja (status ativo e não expirada).
4. Gera novo JWT de 30 dias.
5. Atualiza `TerminalCredential` com o novo token.
6. **Não cria** novo `TerminalActivation` e **não consome** slot de licença.

### 8.3 Validação do Bearer Token

A cada requisição protegida por Bearer token, o sistema:
1. Extrai o JWT do header `Authorization: Bearer <token>`.
2. Verifica assinatura e expiração criptográfica.
3. Consulta o banco em `TerminalCredential` WHERE `terminalId = payload.sub`.
4. Verifica se `credential.status !== 'REVOKED'`.
5. Verifica se `credential.token === token` (garante que um token antigo não funcione após reautenticação).
6. Se qualquer verificação falhar, retorna `401`. Se o banco estiver fora do ar, nega acesso por segurança.

---

## 9. Revogação de Licença de Terminal

### 9.1 Gatilho

Executada via `POST /api/admin/terminals/:id/revoke` por usuário autenticado com sessão web.

### 9.2 Fluxo (Transação Atômica)

1. Valida que o terminal existe e pertence à empresa do usuário (Master ignora essa restrição).
2. Valida que o terminal está ativo (`isActive === true`). Se já inativo, retorna `422`.
3. Gera novo `activationCode` único (o código antigo se torna inválido imediatamente).
4. Em uma única transação de banco:
   - `terminal.isActive = false`, `isBlocked = true`, `revokedAt = now`, `revokedBy = userId`, `activationCode = novoCódigo`.
   - `terminalCredential.status = 'REVOKED'`, `revokedAt = now` — **invalida imediatamente** qualquer JWT existente, mesmo que não tenha expirado.
   - Registro mais recente em `TerminalActivation` recebe `status = 'REVOKED'`, `revokedAt`, `revokedBy`.
   - Se o terminal tinha `storeId`, decrementa `storeLicense.quantityUsed -= 1` (mínimo 0).

### 9.3 Efeito Imediato

Após a revogação, o dispositivo físico perde acesso **imediatamente** na próxima requisição, pois o guard consulta o banco antes de autorizar. O JWT antigo é matematicamente válido mas será rejeitado por estar marcado como `REVOKED` no banco.

### 9.4 Reativação

Após revogação, o terminal pode ser reativado normalmente usando o **novo** `activationCode` gerado, desde que a licença da loja esteja disponível.

---

## 10. Mídias

### 10.1 Storage

Mídias são armazenadas no **Supabase Storage** no bucket definido pela variável `SUPABASE_STORAGE_BUCKET`.

### 10.2 Tipos e Limites

| Tipo | MIME | Limite |
|---|---|---|
| Imagem | `image/*` | 5 MB |
| Vídeo | `video/*` | 50 MB |

Qualquer outro tipo é rejeitado com `400 Bad Request`.

### 10.3 Sanitização do Nome

O nome do arquivo é sanitizado antes do upload:
- Acentos e diacríticos são removidos (normalização NFD).
- Caracteres especiais são substituídos por `-`.
- Múltiplos hífens consecutivos são colapsados em um.
- Tudo convertido para minúsculas.

### 10.4 Caminho no Storage

O arquivo é armazenado no path `uploads/{ano}/{mes}/{timestamp}-{nomeArquivo}`, garantindo organização por data e evitando colisões por nome.

### 10.5 Exclusão

Ao deletar uma mídia diretamente (`DELETE /api/media/:id`):
1. O arquivo é removido do Supabase Storage.
2. O registro é removido do banco.

### 10.6 Exclusão Automática por Vínculo

Ao remover um vínculo `TerminalMedia` (`DELETE /api/admin/terminals/:id/media/:terminalMediaId`):
1. O vínculo é removido.
2. O sistema verifica se a mídia ainda está vinculada a algum outro terminal.
3. Se **não houver mais vínculos**, a mídia é automaticamente excluída do Storage e do banco.
4. Se **houver outros vínculos**, a mídia é preservada.

### 10.7 Escopo por Empresa

Cada mídia pertence a uma empresa (`companyId`). Usuário comum só vê e gerencia mídias da própria empresa.

---

## 11. Mídias Vinculadas a Terminais (TerminalMedia)

### 11.1 Pré-requisito

Só é possível vincular mídias a terminais que tenham `isMediaDisplay = true`. Tentativa em terminal sem essa flag retorna `400`.

### 11.2 Unicidade

Um mesmo arquivo de mídia **não pode ser vinculado duas vezes ao mesmo terminal**. A tentativa retorna `409 Conflict`. A constraint é `UNIQUE(terminalId, mediaId)`.

### 11.3 Ordem de Exibição

- Cada vínculo tem um campo `order` (inteiro) que determina a sequência de exibição.
- Ao vincular uma nova mídia, o sistema busca o maior `order` atual do terminal e atribui `maxOrder + 1`.
- A ordem pode ser reorganizada via `PUT /api/admin/terminals/:id/media/order`, que atualiza múltiplos vínculos em uma única transação atômica.

### 11.4 Agendamento (Scheduling)

Cada vínculo pode ter `startsAt` e `endsAt` opcionais, que definem o período de exibição:

| Condição | Status |
|---|---|
| `startsAt` nulo ou `<= agora` E (`endsAt` nulo ou `>= agora`) | `active: true` |
| `endsAt` não nulo E `< agora` | `expired: true` |
| `startsAt` não nulo E `> agora` | Ainda não iniciado, `active: false` |

O cálculo de `active` e `expired` é feito em tempo real a cada requisição de conteúdo — não há job em background para expirar registros.

### 11.5 Vinculação a Campanha

Um vínculo pode opcionalmente estar associado a uma `Campaign` via `campaignId`, permitindo rastrear quais mídias fazem parte de campanhas específicas.

---

## 12. Produtos

### 12.1 Upsert por EAN

O endpoint `POST /api/stores/:id/products` realiza **upsert** pelo par `(storeId, ean)`:
- Se não existir produto com esse EAN na loja, cria um novo.
- Se já existir, atualiza os dados.
- Retorna `201` na criação e `200` na atualização.

Também existe upsert por `(storeId, externalId)` para integração com ERPs.

### 12.2 Preços

| Campo | Tipo | Descrição |
|---|---|---|
| `price` | Decimal(10,2) | Preço normal — obrigatório |
| `offerPrice` | Decimal(10,2) | Preço de oferta — opcional |
| `clubPrice` | Decimal(10,2) | Preço de clube/fidelidade — opcional |

### 12.3 Produto Ativo

O campo `isActive` (padrão `true`) controla a visibilidade do produto. Terminais **só consultam produtos ativos**. O campo é uma exclusão lógica (soft delete).

### 12.4 Isolamento por Terminal

Quando um terminal consulta um produto por EAN:
- O `storeId` é **derivado do JWT do terminal** — nunca informado pelo cliente.
- Isso garante que um terminal só acesse produtos da própria loja.

### 12.5 Busca Paginada

A listagem de produtos suporta:
- Paginação por `page` e `limit` (máximo 100 por página).
- Busca textual `q` por nome (case-insensitive) ou EAN.

### 12.6 Endpoint Público por Loja

`GET /api/terminal/{storeId}/{ean}` é um endpoint público (sem autenticação). O UUID da loja funciona como identificador de acesso. Esse endpoint é retornado pelo bootstrap para terminais que não conseguem enviar Bearer token em todas as situações.

---

## 13. Integração de Catálogo (StoreIntegration)

### 13.1 Propósito

Permite configurar uma URL base de ERP/sistema externo para sincronização de produtos via API.

### 13.2 Upsert

O endpoint `PUT /api/stores/:id/integration` sempre realiza upsert — cria se não existir, atualiza se existir. Uma loja pode ter no máximo **uma integração**.

### 13.3 Endpoints Configuráveis

| Campo | Padrão | Descrição |
|---|---|---|
| `endpointProductByEan` | `/terminal/product/{ean}` | Consulta produto por EAN |
| `endpointCatalog` | `/terminal/product` | Catálogo completo |
| `endpointFullLoad` | null | Carga completa de produtos |
| `endpointIncremental` | null | Carga incremental (delta) |

### 13.4 Token de Autenticação

O campo `token` é armazenado para autenticação no sistema externo. Não há criptografia adicional além da segurança do banco.

### 13.5 lastSyncAt

O campo `lastSyncAt` é atualizado externamente via processo de sincronização. Não é atualizado automaticamente pelo sistema.

---

## 14. Notificações

### 14.1 Escopo

Notificações são enviadas por empresa. Um usuário comum vê apenas notificações da própria empresa. Master vê todas.

### 14.2 Tipos

| Tipo | Uso sugerido |
|---|---|
| `info` | Informações gerais |
| `warning` | Alertas que requerem atenção |
| `danger` | Erros ou situações críticas |
| `success` | Confirmações de ações |

### 14.3 Leitura

- `PATCH /api/notifications/:id` marca a notificação como lida, definindo `isRead = true` e `readAt = now`.
- Uma notificação marcada como lida não pode ser desmarcada pelo sistema.

### 14.4 Limite de Listagem

A API retorna sempre as **últimas 50 notificações** ordenadas por `createdAt` decrescente.

### 14.5 Ação Opcional

Notificações podem ter `actionLabel` e `actionUrl` para exibir um botão de ação na interface.

### 14.6 Exclusão

Notificações podem ser deletadas individualmente. A exclusão retorna `204 No Content`.

---

## 15. Configuração Global

### 15.1 Singleton

Existe apenas **um registro** de configuração no sistema (tabela `configurations`). Se não existir ao ser consultado, é criado automaticamente com os valores padrão.

### 15.2 resetTime

- Define o tempo em segundos para o terminal resetar a tela após inatividade.
- Valor padrão: **30 segundos**.
- Valor mínimo: **1 segundo**. Valores menores são rejeitados com `400`.
- O valor é entregue ao terminal via endpoints `bootstrap` e `config`.

### 15.3 Fluxo de Carga

O sistema tem um conceito de "carga" para envio de dados aos terminais:

1. **Gerar carga** (`POST /api/config/sync`): atualiza o campo `lastSync` para o momento atual. Indica que os dados estão prontos para envio.
2. **Enviar carga** (`POST /api/config/push`): envia a carga para todos os terminais cadastrados. Exige que `lastSync` não seja nulo — não é possível enviar sem antes gerar. A comunicação real com os terminais via IP é um **placeholder** a ser implementado.

---

## 16. Segurança e Validações Gerais

### 16.1 Dois Sistemas de Autenticação Separados

| Sistema | Mecanismo | Validade | Uso |
|---|---|---|---|
| Web Session | Cookie JWT (`revvo_session`) | 8 horas | Painel administrativo |
| Terminal Bearer | Header `Authorization: Bearer` | 30 dias | Dispositivos físicos |

Os dois sistemas usam secrets distintos (`JWT_SECRET` para web, `TERMINAL_JWT_SECRET` para terminais).

### 16.2 Verificação de Revogação em Tempo Real

O guard de terminais **não confia apenas na assinatura criptográfica** do JWT. Em toda requisição, ele consulta o banco para verificar se a credencial não foi revogada. Isso garante revogação imediata sem precisar esperar a expiração do token.

### 16.3 Operações Atômicas

As operações críticas usam transações de banco para garantir consistência:
- Ativação de terminal: ativação + consumo de licença + registro de ativação.
- Revogação: desativação + revogação de credencial + revogação de ativação + liberação de licença.
- Reordenação de mídias: atualização de múltiplos registros em uma transação.

### 16.4 Unicidades Críticas

| Campo | Escopo | Comportamento ao Duplicar |
|---|---|---|
| `user.email` | Global | `409 Conflict` |
| `company.cnpj` | Global | `409 Conflict` |
| `company.email` | Global | `409 Conflict` |
| `company.slug` | Global | `409 Conflict` |
| `terminal.ip` | Global | `409 Conflict` |
| `terminal.activationCode` | Global | Regerado (até 5 tentativas) |
| `product.ean` | Por loja | Upsert (atualiza em vez de duplicar) |
| `product.externalId` | Por loja | Upsert |
| `terminalMedia(terminalId, mediaId)` | Por terminal | `409 Conflict` |
| `storeLicense.storeId` | Global | `409 Conflict` |
| `storeIntegration.storeId` | Global | Upsert |

### 16.5 Validação de Tenant em Recursos Aninhados

Ao vincular uma mídia a um terminal, o sistema verifica que a mídia pertence à mesma empresa do terminal. Não é possível vincular mídias de outras empresas.

### 16.6 Proteção de Credencial de Terminal

- A credencial (token) é armazenada na tabela `TerminalCredential`.
- A cada reautenticação, o token antigo é **substituído** — um terminal só tem um token válido por vez.
- Se o sistema de banco de dados estiver indisponível durante a validação do Bearer token, o acesso é **negado por padrão** (fail-closed), nunca concedido.
