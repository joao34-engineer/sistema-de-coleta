# Contratos HTTP da Fase 1A

Este documento registra os contratos server-side da Fase 1A. As respostas autenticadas usam `Cache-Control: no-store`; nenhuma rota retorna linha bruta do banco, caminho privado de Storage ou segredo.

## Convenções

- Rotas autenticadas exigem sessão Supabase e perfil `administrator` ativo na organização da coleta.
- UUIDs de rota são validados antes de qualquer consulta. JSON, `FormData`, query string e cabeçalhos são entradas não confiáveis.
- `expectedVersion` é inteiro positivo (`>= 1`). Uma escrita concorrente vencida retorna `409 stale_version`; não há atualização parcial.
- `Idempotency-Key` é UUID. Ausente ou vazio retorna `400 { error: { code: "idempotency_key_required" } }`; presente e inválido retorna `422 validation_error`.
- `displayName` é o nome do DTO HTTP; o campo persistido é `customers.legal_name`.
- Erros inesperados retornam código seguro. Logs internos guardam somente operação, request ID, código, status e ator pseudonimizado.

## Clientes

### `GET /api/customers`

Lista clientes ativos da organização. Query: `q`, `cursor` UUID legado de clientes, `limit` entre 1 e 50. O filtro pesquisa nome legal, documento e telefone normalizados.

Resposta `200`:

```json
{
  "ok": true,
  "data": {
    "customers": [{
      "id": "uuid",
      "displayName": "Nome ou razão social",
      "taxId": "52998224725",
      "phone": "11998765432",
      "address": null,
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-08-20T12:00:00.000Z"
    }],
    "nextCursor": null
  }
}
```

### `POST /api/customers`

Cria cliente e aceita `address` opcional por uma única RPC transacional (`create_customer_with_address`). `taxId` e `phone` são normalizados no servidor. O índice único `(organization_id, tax_id)` é a autoridade contra concorrência; colisão retorna `409 duplicate_tax_id`, nunca erro interno. A regra de endereço primário é aplicada no banco, com no máximo um endereço primário por cliente e organização.

### `GET /api/customers/{id}` e `PATCH /api/customers/{id}`

O `PATCH` aceita somente `displayName`, `taxId` e `phone`. Endereço não é atualizado por substituição implícita; usa as rotas específicas abaixo. Alteração concorrente do documento retorna `409 duplicate_tax_id`.

### `POST /api/customers/{id}/addresses`

Cria endereço cadastral. Campos: `label`, `street`, `streetNumber`, `complement`, `district`, `city`, `stateCode`, `postalCode` e `isPrimary`. CEP é normalizado para oito dígitos e UF para duas letras maiúsculas.

### `PATCH /api/customers/{id}/addresses/{addressId}`

Atualiza somente campos enviados do endereço, sempre escopado por organização, cliente e endereço. Não existe rota de exclusão nesta fase.

## Rascunho e itens

### `POST /api/collections/drafts`

Cria o UUID de rascunho. Repetição do mesmo UUID na organização retorna o rascunho existente com `idempotent: true`.

### `GET /api/collections/{id}/draft`

Retorna o rascunho ativo e somente itens não removidos.

### `PATCH /api/collections/{id}/draft`

Recebe `expectedVersion` e campos opcionais `customerId`, `collectionLocation`, `responsibleName`, `responsibleTaxId` e `collectedAt`. A rota chama uma RPC transacional de atualização do cabeçalho e devolve `{ data: { draft } }` com a versão resultante. `responsibleTaxId` inválido (checksum de CPF/CNPJ) retorna `422 { ok: false, code: "invalid_signer_tax_id" }` — não `draft_update_failed`.

### `POST /api/collections/{id}/items`

Recebe `expectedVersion`, `description`, `quantity`, `condition` e `notes`. A inclusão ocorre na RPC `create_collection_item`, que valida organização/rascunho, registra evento e incrementa `collections.row_version` atomicamente.

### `PATCH /api/collections/{id}/items/{itemId}`

Recebe `expectedVersion` e ao menos um campo do item. A RPC valida o vínculo item–coleta e retorna item atualizado e rascunho com a nova versão.

### `POST /api/collections/{id}/items/{itemId}/remove`

Recebe `expectedVersion`. A RPC marca o item como removido, registra auditoria e incrementa a versão na mesma transação. A remoção não apaga o item fisicamente.

## Evidências e assinatura

### `POST /api/collections/{id}/evidences`

Recebe `multipart/form-data` com `file`, `expectedVersion` e `itemId` opcional. O servidor valida tamanho, MIME e assinatura binária. O fluxo é:

1. RPC cria intent pendente com caminho privado de staging e expiração.
2. Storage recebe o arquivo somente nesse caminho.
3. RPC confirma intent, verifica versão, vínculo do item e metadados, cria a evidência, incrementa a versão e registra o evento.

Falha de upload ou commit dispara compensação best-effort e deixa o intent rastreável para o job de limpeza. Objetos de staging não possuem leitura autorizada.

Se a confirmação da RPC já tiver sido aceita, a API não remove o objeto nem tenta cancelar o intent: uma falha posterior de releitura/validação é registrada com código seguro, e o registro confirmado permanece íntegro. A compensação só cancela primeiro um intent ainda pendente e remove o objeto depois da confirmação do cancelamento.

O job server-only `npm run cleanup:upload-intents` chama `expire_collection_upload_intents`, remove os caminhos retornados dos buckets privados de evidências/assinaturas e chama `ack_collection_upload_cleanup` somente após a remoção. Ele é idempotente: falhas de remoção ou de confirmação deixam o intent para nova tentativa e geram apenas log seguro. A execução exige `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SUPABASE_CONFIRM_PROJECT_REF` apontando explicitamente para o projeto de teste/operacional autorizado.

### `PUT /api/collections/{id}/signature`

Recebe `multipart/form-data` com PNG, `signerName`, `signerTaxId`, `acceptanceText` e `expectedVersion`. Usa o mesmo prepare/upload/commit, mas guarda os metadados do signatário no intent. Resposta contém `collectionId`, `signatureId` e `rowVersion`. CPF/CNPJ com checksum inválido retorna `422 { error: { code: "invalid_signer_tax_id" } }`; PNG ou outros campos inválidos continuam `validation_error`.

## Ciclo de vida

### `POST /api/collections/{id}/finalize`

Recebe `expectedVersion` e exige `Idempotency-Key`. A RPC bloqueia a coleta, valida cliente, local, responsável, item e assinatura, congela cliente/evidências no snapshot, reserva o código oficial e cria a primeira versão documental. Retry com a mesma chave e hash devolve a mesma resposta. Depois do RPC com sucesso, o adaptador (Server Action e esta rota) agenda `processQueuedDocumentRenders` no mesmo processo via `after()` — o celular recebe o número imediatamente; a falha do render não desfaz o finalize.

### `POST /api/collections/{id}/cancel` e `POST /api/collections/{id}/reopen`

Recebem `expectedVersion`, `reason` e `Idempotency-Key`. São transações idempotentes, preservam código e documentos anteriores e registram eventos append-only. Quando o comando cria uma nova versão documental, o adaptador HTTP agenda o mesmo kick in-process de PDF/QR. A rota Fase 3 `/cancel-reopen` não cria documento e não dispara o worker.

### Descarte de rascunho (`discard_collection_draft`)

Não há Route Handler dedicado. A Server Action `discardDraftAction` chama o DAL `discardCollectionDraft`, que executa a RPC `discard_collection_draft(p_collection_id, p_expected_version)`.

- Só `status = 'draft'` da organização do administrador autenticado.
- Remove a árvore do rascunho (itens, eventos, evidências, assinatura, intents, idempotency).
- Recusa coleta emitida (`collection_not_draft`) e versão velha (`stale_version`).
- Não apaga `customers` nem documentos/PDF. A UI offline, após purge local por `collection_not_draft`/`not_found`, explica que a guia oficial não foi apagada.
- Anon e `public` não recebem `EXECUTE`. A fila offline enfileira `discard_draft` quando o rascunho já existe no servidor.

## Consulta e paginação

`GET /api/collections` aceita busca e filtro no servidor, além do cursor:

- `q` — busca unificada (código oficial e nome por `ILIKE`; CPF/CNPJ e telefone pelos dígitos, após `regexp_replace` no SQL e `normalizeDigits` no TypeScript). Sete ou mais dígitos também fazem match parcial em documento e telefone.
- `filter` — chip da lista: `all` | `collected` | `in_repair` | `ready`. O servidor traduz para `statuses` via `statusesForListFilter` (taxonomia compartilhada).
- `statuses` — lista explícita de status canônicos (vírgula ou repetido). Tem precedência sobre `filter` quando presente.
- filtros pontuais existentes: `code`, `customer`, `taxId`, `phone`, `status`, `from`, `to`.
- `cursor` opaco base64url `{ createdAt, id }` e `limit` entre 1 e 50 (padrão 25).

A resposta inclui `items`, `nextCursor` e `totalCount` (total do filtro, independente da página). Trocar `q` ou `filter` descarta o cursor. `ILIKE` não é insensível a acento (extensão `unaccent` não instalada).

`GET /api/collections` e `GET /api/collections/{id}/events` usam o mesmo cursor opaco. A ordenação é estável por `created_at` e `id`; o cliente não deve interpretar nem fabricar cursor.

Detalhes de coletas finalizadas/canceladas usam o cliente congelado e o snapshot documental, incluindo evidências confirmadas. O cadastro atual do cliente não reescreve uma guia já emitida. Detalhe e lista usam o snapshot do cliente em **todo** status emitido (oficina incluída), não só `collected|canceled`.

Rascunhos podem existir sem cliente: `customer` no detalhe e `customerName`, `customerTaxId` e `customerPhone` na lista são nulos nesse caso. Evidências do detalhe aceitam o shape SQL (`contentType`/`byteSize`) e são normalizadas no DTO para `mimeType`/`sizeBytes`; `sha256` ausente é exposto como `null`. Caminhos privados nunca são retornados pela API.

## Códigos de erro estáveis

| HTTP | Código | Significado |
| --- | --- | --- |
| 400 | `validation_error` | Entrada, UUID ou corpo inválido |
| 400 | `idempotency_key_required` | Comando crítico sem chave |
| 401 | `authentication_required` | Sessão ausente ou inválida |
| 403 | `forbidden` | Papel ou organização sem acesso |
| 404 | `not_found` | Recurso inexistente no escopo autorizado |
| 409 | `duplicate_tax_id` | CPF/CNPJ já cadastrado na organização |
| 409 | `stale_version` | Escrita perdeu a comparação otimista |
| 409 | `idempotency_conflict` | Chave reutilizada com payload diferente |
| 422 | `business_rule_violation` | Pré-condição do fluxo não atendida |
| 429 | `rate_limit_exceeded` | Quota pública de verificação ou download de share |
| 503 | `temporarily_unavailable` | Limitador indisponível (fail-closed) |
| 500 | `*_failed` / `unexpected_error` | Falha interna registrada sem PII |

## Documentos, compartilhamento e entrega (Fase 2)

Todas as rotas abaixo são `no-store`. A listagem e o download autenticados exigem um administrador ativo na organização da coleta. Caminhos de Storage e hashes não são retornados para o navegador.

### `GET /api/collections/{id}/documents`

Lista versões append-only da coleta e os artefatos já confirmados (`pdf` ou `qr`). Cada artefato expõe somente `id`, tipo, MIME, tamanho e data de criação.

### `GET /api/documents/{documentId}/download?artifact=pdf|qr`

Autoriza o documento pela sessão, cria URL assinada de curta duração no bucket privado e redireciona o navegador. Documento ou artefato fora da organização retorna `404` sem revelar existência.

### `POST /api/documents/{documentId}/shares`

Recebe `{ shareType?: "pdf" | "verification", expiresAt?: null, maxDownloads?: 20 }`. A API fixa expiração em sete dias e máximo de 20 downloads; não aceita uma data ou quota escolhida pelo cliente. A rota chama `create_document_share`; o token bruto aparece somente na resposta de criação (`data.token`) e deve ser tratado como segredo. Repetir a ação cria um novo share; a guia e o artefato não são alterados.

### `POST /api/documents/shares/{shareId}/revoke`

Revoga o link chamando `revoke_document_share`. A operação é idempotente no banco: revogar novamente mantém o primeiro `revokedAt`.

### `POST /api/documents/shares/{shareId}/email`

Recebe `{ email }` e exige `Idempotency-Key` UUID. A chave é consultada no histórico de `share_deliveries` por `provider_reference`; retry devolve o mesmo registro sem uma segunda entrega. O adaptador Resend é dry-run por padrão (`providerReference` com prefixo `dry-run:`); somente `DOCUMENT_EMAIL_SEND_ENABLED=true` habilita envio real via Resend (`providerReference` com prefixo `resend:`), exigindo `RESEND_API_KEY` e `DOCUMENT_FROM_EMAIL` server-only. O link do e-mail usa `NEXT_PUBLIC_APP_URL` + `/d/{token}` — nunca a rota autenticada de download. `NODE_ENV=test` permanece dry-run sem rede.

### `POST /api/documents/revisions`

Exige `Idempotency-Key` UUID e recebe `{ sourceDocumentId, expectedVersion, typedDocumentPatch, revisionType, reason }`. O patch aceita somente `customer`, `collection` e `items` nos campos documentados pelo contrato SQL. A rota chama `revise_collection_document`, que valida a versão atual, cria novo snapshot/versionamento, registra a revisão, agenda `render_pdf` e retorna o `jobId`. Depois do RPC com sucesso o adaptador agenda o kick in-process de PDF/QR. Retry com a mesma chave e payload devolve a mesma resposta.

As rotas aninhadas `/api/collections/{id}/documents/{documentId}/download`, `/shares`, `/shares/email`, `/revisions` e `/retry` são aliases finos dos mesmos comandos, para clientes que mantêm o contexto da coleta na URL. Não há divergência de autorização ou DTO.

### `POST /api/collections/{id}/documents/{documentId}/retry`

Reenfileira manualmente o job `render_pdf` quando o artefato ainda não existe. Exige administrador autenticado na organização da coleta. Chama `retry_document_job` via DAL (sessão do usuário, sem service role). Respostas:

| HTTP | Corpo |
| --- | --- |
| 200 | `{ data: { jobId, documentId, jobType, status: "queued" \| "succeeded", alreadyReady: boolean } }` |
| 401 | `{ error: { code: "authentication_required" } }` |
| 403 | `{ error: { code: "forbidden" } }` |
| 404 | `{ error: { code: "not_found" \| "document_job_not_found" } }` — documento fora da coleta ou job inexistente |
| 422 | `{ error: { code: "document_job_in_progress" } }` — lease ativo; não rouba o worker |
| 422 | `{ error: { code: "validation_error" } }` — UUID inválido |

Quando `alreadyReady` é `false` e o job volta a `queued`, o adaptador agenda o kick in-process de PDF/QR (`after()`). Quando o PDF já existe, retorna `alreadyReady: true` sem re-renderizar. Job `failed` é resetado para `queued` com `attempt_count = 0` na mesma linha `(document_id, job_type)`.

## Verificação pública

Consulta de autenticidade de guia emitida. Rotas `no-store`; nunca expõem token bruto, IP, PII ou caminhos privados.

### `GET /verificar/{token}`

Página HTML (Server Component). O token na rota deve ser hexadecimal minúsculo de 64 caracteres (`/^[0-9a-f]{64}$/`). Formato inválido responde com a mesma UI genérica **Registro não encontrado** sem consumir quota do limitador.

Abuso da consulta é limitado por `public_verification` (30 requisições / 5 minutos por IP HMAC). Excesso **não** propaga erro 500: a página renderiza um card de espera (HTTP 200) com **Aguarde antes de consultar novamente.** Segredo ou RPC do limitador indisponível renderiza **Consulta temporariamente indisponível.** Server Components não definem status HTTP 429/503 na página HTML.

### `GET /api/public/collections/{verificationToken}`

Contrato JSON espelhando a mesma validação e limitador. Respostas:

| HTTP | Corpo |
| --- | --- |
| 200 | DTO público mínimo (`authentic`, `officialCode`, `issuedAt`, `status`, `organization`, `documentVersion`) |
| 404 | `{ error: { code: "not_found", message: "Registro não encontrado." } }` — token inválido ou registro inexistente |
| 429 | `{ error: { code: "rate_limit_exceeded", message: "Aguarde antes de consultar novamente." } }` + cabeçalho `Retry-After` |
| 503 | `{ error: { code: "temporarily_unavailable", message: "Consulta temporariamente indisponível." } }` |

### `GET /d/{shareToken}` e `GET /d/{shareToken}/download`

A página não consome o contador: exibe apenas a ação genérica de download. O endpoint `/download` inspeciona o share (`inspect_document_share`, sem incrementar o contador), gera a URL assinada curta e só então consome o slot (`consume_document_share`) antes do redirect `302`. Falha na geração da URL assinada não queima quota. Token inválido, expirado, revogado, tipo não-PDF ou sem PDF recebe `404` genérico, `no-store` e `Referrer-Policy: no-referrer`.

Abuso do download é limitado por `document_share_download` (30 requisições / 5 minutos por IP HMAC). Excesso responde `429 { error: { code: "rate_limit_exceeded" } }` com `Retry-After` (JSON para clientes API; HTML mínimo para navegação com `Sec-Fetch-Dest: document` ou `Accept: text/html`). Segredo ou RPC indisponível responde `503` no mesmo formato. A página `/d/{token}` não consome essa quota.

## Login (Server Action)

`signInAction` não é rota HTTP. Códigos estáveis do estado: `validation_error`, `invalid_credentials`, `rate_limit_exceeded`, `temporarily_unavailable`, `unexpected_error`. Rate limit (`auth_login`, 5 falhas na janela UTC de 900 s por IP+e-mail HMAC) ocorre antes de `signInWithPassword`; login com sucesso zera a quota (scan 3.3). Não há HTTP 429 no login. Credencial inválida não revela se o e-mail existe. Falha inesperada no `catch` registra `logTransactionFailure` (`operation: sign_in`, `status: 500`) sem PII.

## Logout

### `POST /api/auth/sign-out`

Encerra a sessão no Auth (`signOut` global, revoga o refresh token) e responde `303` para `/login`. Não é Server Action: o POST HTTP evita re-render paralelo do layout autenticado, que disparava vários `grant_type=refresh_token` no mesmo refresh token (`token_revoked` em `auth.refresh_tokens`).

- Same-origin obrigatório (`Origin` ou `Referer` igual ao host do pedido). Cruzado responde `403` sem chamar Auth.
- O proxy não chama `getClaims` nesta rota (igual a `/api/health`), para não renovar a sessão no caminho do logout.
- Falha ao gravar cookie ou no Auth responde `500` `no-store`, sem Location.
- `Cache-Control: private, no-store`. Sem corpo JSON.

## Saúde (Fase 4 Chat 4)

### `GET /api/health` e `HEAD /api/health`

Probe público, sem sessão e sem rate limit. `Cache-Control: no-store`. O proxy faz early-return (não chama `getClaims`).

Checks em paralelo (publishable key, timeout curto): processo da aplicação; Supabase Auth (`/auth/v1/health`) e PostgREST (`/rest/v1/`). Corpos upstream são descartados.

Resposta `200`:

```json
{ "ok": true, "status": "ok", "checks": { "app": "ok", "supabase": "ok" } }
```

Resposta `503` (env ausente, timeout ou check Supabase falhou):

```json
{ "ok": false, "status": "degraded", "checks": { "app": "ok", "supabase": "fail" } }
```

`HEAD` devolve o mesmo status e cabeçalhos, sem corpo. Não há segredo, URL interna, versão GoTrue nem stack na resposta.

## Worker interno

Happy path do celular: finalize / cancel / reopen (Fase 1A) / revise no mesmo processo Next — `after()` chama o DAL `processQueuedDocumentRenders` (lote 2). Sem secret no aparelho e sem `fetch` da própria `/api`. Esta rota HTTP e o cron são **retry/recovery**, não o fluxo do dia a dia.

### `GET` / `POST /api/internal/document-jobs/run` (alias `POST /api/internal/document-generation/run`)

Rota interna para retry do worker documental. Autorização (não enfraquecida):

| Canal | Cabeçalho | Env (≥32 chars) |
| --- | --- | --- |
| Ops / curl (retry) | `X-Document-Worker-Secret: <secret>` | `DOCUMENT_WORKER_SECRET` |
| Vercel Cron (retry) | `Authorization: Bearer <secret>` (enviado automaticamente se `CRON_SECRET` estiver configurado no projeto) | `CRON_SECRET` |

Comparação em tempo constante. Sem credencial válida responde `403`. Respostas são `no-store` e retornam somente contagem/status.

- **GET** — cron em `vercel.json` (`0 7 * * *` → `/api/internal/document-jobs/run`, uma vez ao dia; plano Hobby recusa cron sub-diário); processa lote padrão de 5 se o kick in-process morrer ou o job falhar.
- **POST** — aceita opcionalmente `{ batchSize: 1..5 }` (padrão 5). O alias `/api/internal/document-generation/run` permanece POST-only com a mesma autenticação de worker.
- `/cleanup` usa a mesma proteção por `X-Document-Worker-Secret`.

Retry manual (ops, não UX):

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/internal/document-jobs/run" \
  -H "Content-Type: application/json" \
  -H "X-Document-Worker-Secret: $DOCUMENT_WORKER_SECRET" \
  -d '{"batchSize":5}'
```

Ou GET com o segredo do cron (mesmo valor configurado em `CRON_SECRET`):

```bash
curl -X GET "$NEXT_PUBLIC_APP_URL/api/internal/document-jobs/run" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Em planos Vercel sem cron sub-diário, o curl acima continua sendo só backup se `after()` não completar. Não coloque o segredo no repositório. Não peça ao operador de campo para rodar curl.
