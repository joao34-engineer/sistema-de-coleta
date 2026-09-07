# Sessão 3c — Reconnecting UI com Real Data

> **✅ STATUS: EXECUTADA E CONCLUÍDA (22–23/08/2026)**
> Todas as fases implementadas. Gate final verde: `steiger` 0 problemas · `lint` 0 erros (1 warning pré-existente) · `typecheck` limpo · `test` 89 passed / 18 skipped · `build` sucesso com 92 rotas (`/coletas/[id]` + 8 rotas `/oficina/*` registradas).
> Único passo restante na época: smoke manual ponta a ponta. **Não reabrir esta sessão.** O scan posterior fechou oficina/auth/lista e **5.6** (entrega desde Pronto). 5.7 / 5.12 / 5.13 adiados 06/09/2026.

## Contexto

A Sessão 3c faz parte da **Onda 3** da Fase 3 (Operações de Oficina). Após a migration aplicada na Sessão 3a e os comandos server-only + route handlers implementados na Sessão 3b, esta sessão tem como objetivo **religar as telas do frontend com os dados reais** provenientes das novas APIs do Phase 3.

### Objetivo

Transformar as telas de operação de oficina em interfaces funcionais conectadas aos RPCs reais, seguindo os padrões de server actions e server components já estabelecidos no projeto.

---

## Estado Verificado (pré-sessão 3c)

- **Route handlers** (7 implementados e validados):
  | Rota | RPC | Command | Idempotência |
  |------|-----|---------|--------------|
  | `app/api/collections/[id]/workshop-checkin/route.ts` | `workshop_check_in` | `workshopCheckIn` | Intent-based (signature upload) |
  | `app/api/collections/[id]/budget/route.ts` | `create_technical_budget` | `saveTechnicalBudget` | Idempotency key |
  | `app/api/collections/[id]/budget-approval/route.ts` | `approve_technical_budget` | `budgetApproval` | Idempotency key |
  | `app/api/collections/[id]/service-progress/route.ts` | `update_service_progress` | `serviceProgress` | Idempotency key |
  | `app/api/collections/[id]/invoice/route.ts` | `register_invoice_reference` | `registerInvoiceReference` | Idempotency key |
  | `app/api/collections/[id]/delivery/route.ts` | `deliver_to_customer` | `deliverToCustomer` | Intent-based (signature upload) |
  | `app/api/collections/[id]/cancel-reopen/route.ts` | `cancel_or_reopen_collection` | `cancelOrReopenCollection` | Idempotency key |

- **Arquivos de suporte existentes**:
  1. `src/_pages/collection-operations/index.server.ts` — barrel export
  2. `src/_pages/collection-operations/api/operations-supabase.ts` — cliente Supabase tipado
  3. `src/_pages/collection-operations/api/commands.ts` — lógica server-side com `executePhase3Command`
  4. `src/_pages/collection-operations/api/queries.ts` — funções de leitura
  5. `src/_pages/collection-operations/api/index.server.ts` — barrel export
  6. `src/_pages/collection-operations/model/contracts.ts` — Zod schemas de entrada/saída

- **Validação prévia**:
  - `npm run lint` → 0 erros (1 warning pre-existente)
  - `npm run typecheck` → 0 erros
  - `npm run build` → sucesso (83 rotas geradas)
  - `npm run test` → 81 passed, 18 skipped

---

## Fase 1 — Correção do Filtro "Em reparo" ✅ CONCLUÍDA

### Problema

O filtro "Em reparo" em `src/_pages/collection-lifecycle/ui/collections-list-page.tsx` mapeia incorretamente o status `draft` para representar coletas em reparo na oficina. Com a fase 3 aplicada, as coletas em reparo passam por estados específicos no workflow da oficina.

### Ação

- **Arquivo a modificar**: `src/_pages/collection-lifecycle/ui/collections-list-page.tsx`
- **Mecânica**: Localizar a lógica do filtro "in_repair" e substituir o mapeamento de status. O status `draft` deve ser removido do filtro e substituído pelos seguintes status, que representam estados ativos de reparo:
  - `in_workshop`
  - `in_budget`
  - `awaiting_approval`
  - `approved`
  - `in_service`
  - `ready`
- **Critério de aceitação**: Ao selecionar o filtro "Em reparo", apenas coletas com status que representem ofício em andamento devem aparecer. Status como `draft`, `collected`, `invoiced`, `delivered`, `canceled` não devem aparecer.

---

## Fase 2 — Correção dos Links de Navegação ✅ CONCLUÍDA

### Problema

A página de listagem de coletas e o dashboard possuem links que apontam para páginas que estavam na fase 3 fake (removidas na Onda 2), ou para `/coletas/[id]/documentos` em vez de um hub de detalhe.

### Ação

- **Arquivos a modificar**:
  - `src/_pages/collection-lifecycle/ui/collections-list-page.tsx` — links de cada item da lista
  - `src/_pages/dashboard/ui/dashboard-page.tsx` — links de "atividades" recentes
  - `src/_pages/collection-drafts/ui/draft-signature-page.tsx` — redirecionamento após finalização

- **Mecânica**: Atualizar todos os links para apontar para `/coletas/[id]` (hub de detalhe) em vez das rotas antigas.
- **Critério de aceitação**: Clicar em qualquer coleta na listagem ou dashboard navega para `/coletas/[id]`.

---

## Fase 3 — Criação do Hub de Detalhe (Collection Detail Page) ✅ CONCLUÍDA

### Objetivo

Criar uma página central de detalhe que serve como entry point para todas as operações da oficina. A página deve:
1. Exibir o status atual da coleta
2. Mostrar a timeline unificada de eventos
3. Apresentar botões contextuais para operações da oficina

### Arquivos

- `app/(protected)/coletas/[id]/page.tsx` — Server Component (entry point da rota)

### Mecânica

1. Criar a pasta `app/(protected)/coletas/[id]/` com o arquivo `page.tsx`
2. No Server Component, fazer as seguintes chamadas de dados:
   - Importar e usar `getCollectionDetail(id)` de `@/_pages/collection-lifecycle/api/queries` — retorna `CollectionDetailDTO` com `id`, `officialCode`, `status`, `rowVersion`, `items`, `signature`, etc.
   - Importar e usar `getCollectionEvents(id, null, 50)` de `@/_pages/collection-lifecycle/api/queries` — retorna eventos da timeline
   - Importar e usar `getServiceOrder(id)`, `getBudgetItems(id)`, `getDeliveryTerms(id)` de `@/_pages/collection-operations/api/queries` — dados específicos da oficina
3. Passar os dados coletados para o componente `CollectionDetailHub` via props
4. O `rowVersion` vem de `collection.rowVersion` (do `getCollectionDetail`), não de `serviceOrder`
5. Os itens da coleta (`collection.items`) vêm do `getCollectionDetail` — estes são os itens base para todas as telas

### Dados de saída esperados

| Fonte | Schema | Campos críticos |
|-------|--------|-----------------|
| `getCollectionDetail` | `collectionDetailSchema` | `id`, `officialCode`, `status`, `rowVersion`, `items[]` |
| `getCollectionEvents` | `collectionEventsResultSchema` | `items[]` (eventos com `type`, `previousStatus`, `nextStatus`) |
| `getServiceOrder` | `serviceOrderSchema` | `id`, `status`, `laborBrl`, `partsBrl`, `dueDays` |
| `getBudgetItems` | `budgetItemSchema[]` | `id`, `itemId`, `laborCostBrl`, `partsCostBrl`, `estimatedDays`, `status`, `notes` |

### Critério de aceitação

- A página `/coletas/[id]` renderiza com os dados reais
- O status é exibido via Badge
- Os itens da coleta são carregados do `getCollectionDetail`
- O `rowVersion` é passado para futuras operações

---

## Fase 4 — Criação das Telas de Operações (UI Components) ✅ CONCLUÍDA

### Visão geral

Criar as telas (Client Components) para cada operação da oficina. Cada tela recebe os dados necessários via props do Server Component correspondente.

### 4.1 — Tela de Workshop Check-in (Entrada na Oficina)

**Arquivo**: `src/_pages/collection-operations/ui/workshop-checkin-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `collectionItems: Array<{ id: string, description: string, quantity: number }>` — vem de `collection.items` do `getCollectionDetail`
- `rowVersion: number` — vem de `collection.rowVersion` do `getCollectionDetail`

**Nota**: Não existe um tipo `CollectionItem` no projeto. Os itens da coleta vêm do schema `collectionDetailSchema` cujo campo `items` é `z.array(z.object({ id, description, quantity, condition, notes }))`. Definir interface local ou usar `z.infer`.

**Schema de entrada (de `contracts.ts`)**:
```
workshopCheckInSchema = {
  collectionId: uuid,
  expectedVersion: number (int, positive),
  administratorName: string (min 2, max 160),
  administratorTaxId: taxId (valida CPF/CNPJ),
  items: array of workshopCheckInItemSchema (min 1),
  signatureIntentId: uuid
}
```

**workflow da tela**:
1. Exibir uma lista de checkboxes/itens para conferência — cada item da coleta deve ser revisado com quantidade observada e condição observada
2. Campos de administrador: nome e CNPJ/CPF
3. Assinatura via `SignaturePad` (reutilizar `src/shared/ui/signature-pad.tsx`)
4. Ao salvar: gerar `signatureIntentId` (UUID), converter assinatura para Blob, montar FormData
5. Chamar `workshopCheckInAction` (server action a ser criada)

**Importante**: O formulário usa `FormData` (não JSON), porque a assinatura PNG é enviada como file blob.

### 4.2 — Tela de Technical Budget (Orçamento)

**Arquivo**: `src/_pages/collection-operations/ui/technical-budget-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `budgetItems: BudgetItem[]` — vem de `getBudgetItems(id)`
- `rowVersion: number`

**Schema de entrada (de `contracts.ts`)**:
```
technicalBudgetSchema = {
  collectionId: uuid,
  expectedVersion: number,
  items: array of {
    itemId: uuid,
    itemDescription: string,
    laborCostBrl: number (min 0),
    partsCostBrl: number (min 0),
    estimatedDays: number (int, min 1),
    notes: string (max 1000) | null | optional
  } (min 1),
  generalNotes: string (max 2000) | null | optional
}
```

**workflow da tela**:
1. Exibir lista de itens editáveis (um por linha)
2. Cada item: descrição, mão de obra (R$), peças (R$), prazo (dias), observações
3. Calcular total como soma de todos `laborCostBrl` + `partsCostBrl`
4. Campo de observações gerais (`generalNotes`, não `notes`)
5. Ao salvar: montar objeto JSON, gerar `idempotencyKey` (UUID), chamar `saveTechnicalBudgetAction`

**Importante**: O campo de observações gerais é `generalNotes` (não `notes`). Cada item tem `notes` individual.

### 4.3 — Tela de Budget Approval (Aprovação/Rejeição)

**Arquivo**: `src/_pages/collection-operations/ui/budget-approval-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `budgetTotal: number`
- `rowVersion: number`

**Schema de entrada (de `contracts.ts`)**:
```
budgetApprovalSchema = {
  collectionId: uuid,
  expectedVersion: number,
  approved: boolean,
  rejectionReason: string (max 1000) | optional,  // obrigatório se !approved
  signerName: string (min 2, max 160),
  signerTaxId: taxId (valida CPF/CNPPJ),
  signature: string | optional  // base64 da assinatura
}
```

**workflow da tela**:
1. Exibir o total do orçamento (calculado no Server Component)
2. Dois botões: Aprovar e Rejeitar
3. Se rejeitando: campo obrigatório de motivo (mínimo 5 caracteres)
4. Campos obrigatórios em ambos: nome e CNPJ/CPF do responsável
5. Ao salvar: montar objeto, gerar `idempotencyKey`, chamar `approveBudgetAction`

**Importante**: A validação `rejectionReason` com mínimo 5 caracteres é feita via `.refine()` no Zod — mas o cliente também deve validar antes de enviar.

### 4.4 — Tela de Service Progress (Progresso do Reparo)

**Arquivo**: `src/_pages/collection-operations/ui/service-progress-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `budgetItems: BudgetItem[]` — itens vêm de `getBudgetItems(id)` (schema `budgetItemSchema`)
- `rowVersion: number`

**Nota**: `BudgetItem` pode ser definido como `z.infer<typeof budgetItemSchema>` importado de `queries.ts` ou como interface local.

**Schema de entrada (de `contracts.ts`)**:
```
serviceProgressSchema = {
  collectionId: uuid,
  expectedVersion: number,
  items: array of {
    itemId: uuid,
    itemDescription: string,
    status: "em_reparo" | "pronto",
    notes: string (max 1000) | null | optional
  } (min 1)
}
```

**workflow da tela**:
1. Exibir lista de itens do orçamento (budgetItems)
2. Cada item: descrição, select de status ("em reparo" / "pronto"), campo de observações
3. Ao salvar: montar array de itens, gerar `idempotencyKey`, chamar `updateServiceProgressAction`

**Importante**: Os valores de status são strings em português: `"em_reparo"` e `"pronto"` (não "in_progress"/"completed").

### 4.5 — Tela de Invoice Reference (NF-e)

**Arquivo**: `src/_pages/collection-operations/ui/invoice-reference-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `rowVersion: number`

**Schema de entrada (de `contracts.ts`)**:
```
invoiceReferenceSchema = {
  collectionId: uuid,
  expectedVersion: number,
  number: string (min 1, max 32),
  series: string (min 1, max 10),
  issuedAt: string (ISO datetime),
  totalBrl: number (positive),
  notes: string (max 1000) | optional
}
```

**workflow da tela**:
1. Campos: número, série, data de emissão, valor total (R$)
2. Campo de observações (opcional)
3. Ao salvar: montar objeto JSON, gerar `idempotencyKey`, chamar `registerInvoiceReferenceAction`

**Importante**: `issuedAt` é string ISO datetime (não Date). `totalBrl` é o campo do valor. `series` é obrigatório.

### 4.6 — Tela de Customer Delivery (Entrega ao Cliente)

**Arquivo**: `src/_pages/collection-operations/ui/customer-delivery-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `items: Array<{ id: string, description: string, quantity: number }>` — vem de `collection.items` do `getCollectionDetail`
- `rowVersion: number`

**Nota**: Não existe tipo `CollectionItem` no projeto. Usar os itens do `collectionDetailSchema` diretamente.

**Schema de entrada (de `contracts.ts`)**:
```
customerDeliverySchema = {
  collectionId: uuid,
  expectedVersion: number,
  deliveredItemIds: array of uuid (min 1),
  receiverName: string (min 2, max 160),
  receiverTaxId: taxId (valida CPF/CNPJ),
  notes: string (max 1000) | optional,
  signatureIntentId: uuid
}
```

**workflow da tela**:
1. Lista de checkboxes para selecionar itens entregues
2. Campos: nome do cliente e CNPJ/CPF do cliente
3. Campo de observações (opcional)
4. Assinatura via `SignaturePad`
5. Ao salvar: gerar `signatureIntentId`, converter assinatura para File, montar FormData, chamar `deliverToCustomerAction`

**Importante**: Usa `deliveredItemIds` (array de UUIDs), não `items` com `itemId`. Campos são `receiverName` e `receiverTaxId`.

### 4.7 — Tela de Cancel/Reopen

**Arquivo**: `src/_pages/collection-operations/ui/cancel-reopen-page.tsx`

**Dados de entrada via props**:
- `collectionId: string`
- `allowedAction: "cancel" | "reopen"`
- `rowVersion: number`

**Schema de entrada (de `contracts.ts`)**:
```
cancelReopenSchema = {
  collectionId: uuid,
  expectedVersion: number,
  action: "cancel" | "reopen",
  reason: string (trim, min 5, max 1000)
}
```

**workflow da tela**:
1. Campo de motivo (mínimo 5 caracteres)
2. Botões: Cancelar (se `allowedAction === "cancel"`) e/ou Reabrir (se `allowedAction === "reopen"`)
3. Ao salvar: montar objeto, gerar `idempotencyKey`, chamar `cancelOrReopenCollectionAction`

---

## Fase 5 — Server Components para cada tela ✅ CONCLUÍDA

### Visão geral

Criar um Server Component (`page.tsx`) para cada tela de operação, que busca os dados necessários e passa para o Client Component correspondente.

### Server Components a criar

| Rota | Server Component | Client Component |
|------|-----------------|-----------------|
| `/coletas/[id]/oficina/checkin` | `app/(protected)/coletas/[id]/oficina/checkin/page.tsx` | `WorkshopCheckInPage` |
| `/coletas/[id]/oficina/orcamento` | `app/(protected)/coletas/[id]/oficina/orcamento/page.tsx` | `TechnicalBudgetPage` |
| `/coletas/[id]/oficina/aprovacao` | `app/(protected)/coletas/[id]/oficina/aprovacao/page.tsx` | `BudgetApprovalPage` |
| `/coletas/[id]/oficina/progresso` | `app/(protected)/coletas/[id]/oficina/progresso/page.tsx` | `ServiceProgressPage` |
| `/coletas/[id]/oficina/nfe` | `app/(protected)/coletas/[id]/oficina/nfe/page.tsx` | `InvoiceReferencePage` |
| `/coletas/[id]/oficina/entrega` | `app/(protected)/coletas/[id]/oficina/entrega/page.tsx` | `CustomerDeliveryPage` |
| `/coletas/[id]/oficina/cancelar` | `app/(protected)/coletas/[id]/oficina/cancelar/page.tsx` | `CancelReopenPage` (com `allowedAction="cancel"`) |
| `/coletas/[id]/oficina/reabrir` | `app/(protected)/coletas/[id]/oficina/reabrir/page.tsx` | `CancelReopenPage` (com `allowedAction="reopen"`) |

### Mecânica

Cada Server Component deve:
1. Extrair o `id` dos parâmetros da rota (`await params`)
2. Buscar os dados necessários via `queries.ts` (Server-only, autenticação implícita)
3. Calcular `rowVersion` (via `getCollectionDetail`) e passar para o Client Component
4. Renderizar o Client Component com os props apropriados

**Exemplo de Server Component para orçamento**:
- Buscar `getCollectionDetail(id)` para obter `rowVersion` e `items`
- Buscar `getBudgetItems(id)` para obter itens do orçamento
- Calcular `budgetTotal` = soma de `laborCostBrl + partsCostBrl` de cada item
- Renderizar `TechnicalBudgetPage` com `collectionId`, `rowVersion`, `budgetItems`, `budgetTotal`

**Exemplo de Server Component para aprovação**:
- Buscar `getCollectionDetail(id)` para obter `rowVersion`
- Buscar `getBudgetItems(id)` para calcular `budgetTotal`
- Renderizar `BudgetApprovalPage` com `collectionId`, `rowVersion`, `budgetTotal`

**Exemplo de Server Component para progresso**:
- Buscar `getCollectionDetail(id)` para obter `rowVersion`
- Buscar `getBudgetItems(id)` para obter itens
- Renderizar `ServiceProgressPage` com `collectionId`, `rowVersion`, `budgetItems`

**Exemplo de Server Component para cancelamento/reabertura**:
- Buscar `getCollectionDetail(id)` para obter `rowVersion` e `status`
- Renderizar `CancelReopenPage` com `collectionId`, `rowVersion`, `allowedAction` (determinado por rota)

---

## Fase 6 — Server Actions Wrapper ✅ CONCLUÍDA (padrão revisado: chamada direta, sem fetch HTTP interno)

### Objetivo

Criar server actions que envolvem as chamadas para as API routes já implementadas, mantendo consistência com o padrão do projeto e permitindo uso do lado cliente.

### Arquivo

`src/_app/actions/phase3-flow.actions.ts`

### Mecânica

1. Criar o arquivo com a diretiva `"use server"` no topo
2. Importar os schemas Zod de `@/_pages/collection-operations/model/contracts`
3. Criar 7 server actions, uma para cada operação:
   - `workshopCheckInAction(collectionId, formData)` — recebe FormData (tem upload de assinatura)
   - `saveTechnicalBudgetAction(collectionId, data, idempotencyKey)` — recebe objeto JSON
   - `approveBudgetAction(collectionId, data, idempotencyKey)`
   - `updateServiceProgressAction(collectionId, data, idempotencyKey)`
   - `registerInvoiceReferenceAction(collectionId, data, idempotencyKey)`
   - `deliverToCustomerAction(collectionId, data, file)` — recebe File separadamente
   - `cancelOrReopenCollectionAction(collectionId, data, idempotencyKey)`

### Padrão de implementação

Cada action deve:
1. Fazer `fetch` interno para a API route correspondente
2. Enviar `Idempotency-Key` header (UUID) para operações idempotentes
3. Para operações com upload de assinatura (checkin e delivery): enviar FormData
4. Para operações JSON (budget, approval, progress, invoice, cancel): enviar JSON com header `Content-Type: application/json`
5. Tratar erros HTTP e retornar `{ success: false, error: string }` em caso de falha
6. Chamar `revalidatePath('/coletas/[id]')` após sucesso
7. Retornar `{ success: true, data }` em caso de sucesso

### Observação sobre `signatureIntentId`

O `signatureIntentId` é um **UUID gerado pelo cliente** que existe no próprio schema Zod (`workshopCheckInSchema` e `customerDeliverySchema`). Ele serve como chave de idempotência para o fluxo de upload de assinatura:

1. **Cliente**: gera `signatureIntentId` (UUID) → inclui no objeto dados/FormData
2. **Servidor**: usa `signatureIntentId` como idempotency key → chama `prepare_delivery_signature_intent` → obtém `intentId` real → faz upload → comita ou rollbacka

---

## Fase 7 — Conexão Navegação (Operational Actions) ✅ CONCLUÍDA

### Objetivo

Criar o componente que renderiza os botões contextuais no hub de detalhe, baseado no status atual da coleta.

### Arquivo

`src/_pages/collection-operations/ui/operational-actions.tsx`

### Mecânica

1. Receber `status: string`, `collectionId: string`, `rowVersion: number` via props
2. Renderizar botões condicionalmente baseado no status atual:
   - `collected` → botão "Entrada na oficina" → link para `/coletas/[id]/oficina/checkin`
   - `in_workshop` → botão "Registrar orçamento" → link para `/coletas/[id]/oficina/orcamento`
   - `in_budget` ou `awaiting_approval` → botão "Aprovar orçamento" → link para `/coletas/[id]/oficina/aprovacao`
   - `approved` ou `in_service` → botão "Atualizar progresso" → link para `/coletas/[id]/oficina/progresso`
   - `ready` → botão "Registrar NF-e" → link para `/coletas/[id]/oficina/nfe`
   - `invoiced` ou `partial_delivery` → botão "Entregar ao cliente" → link para `/coletas/[id]/oficina/entrega`
   - `canceled` → botão "Reabrir" → link para `/coletas/[id]/oficina/reabrir`
   - `rejected` → primário "Novo orçamento" → `/oficina/orcamento`; secundário "Cancelar" → `/oficina/cancelar`
   - estados ativos (`collected` … `partial_delivery`) → CTA primário existente + secundário "Cancelar" → `/oficina/cancelar`
   - `reopened` → inalcançável (RPC não grava); sem CTA. `delivered` / `draft` → sem CTA

### Componentes auxiliares (a criar)

- `src/_pages/collection-operations/ui/collection-timeline.tsx` — timeline unificada de eventos
- `src/_pages/collection-operations/ui/collection-status-badge.tsx` — badge colorido do status

---

## Fase 8 — Integração com páginas legadas ✅ CONCLUÍDA

### Objetivo

Atualizar a página de documentos e a página de drafts para redirecionar ao novo hub.

### Arquivos a modificar

- `src/_pages/collection-documents/ui/collection-documents-page.tsx` — adicionar link "voltar para detalhe"
- `src/_pages/collection-drafts/ui/draft-signature-page.tsx` — após finalização do draft, redirecionar para `/coletas/[id]` em vez de `/coletas/[id]/documentos`

---

## Fase 9 — Testes ✅ CONCLUÍDA (unitários; teste de integração não aplicável — actions chamam commands direto)

### Testes unitários a adicionar

| Arquivo | Descrição |
|---------|-----------|
| `tests/unit/collections-list-filter.test.ts` | Valida correção do filtro "Em reparo" — status corretos incluídos/excluídos |

### Testes de integração (se aplicável)

| Arquivo | Descrição |
|---------|-----------|
| `tests/integration/phase3-operations.test.ts` | Valida chamadas server actions para cada API route |

---

## Fase 10 — Validação Final ✅ CONCLUÍDA (gate completo verde em 22–23/08/2026)

### Checklist de validação

1. **Lint**:
   - `npm run lint` — 0 erros, máximo 1 warning pre-existente

2. **TypeCheck**:
   - `npm run typecheck` — 0 erros de tipo (incluindo tipos gerados do Supabase)

3. **Build**:
   - `npm run build` — todas as novas rotas geradas sem warnings de CSS

4. **Testes**:
   - `npm run test` — nenhum teste existente quebrado

5. **Steiger (FSD)**:
   - `npx steiger src` — 0 problemas de arquitetura

---

## Resumo de arquivos a criar

| Arquivo | Tipo | Finalidade |
|---------|------|------------|
| `app/(protected)/coletas/[id]/page.tsx` | Server Component | Hub de detalhe |
| `app/(protected)/coletas/[id]/oficina/checkin/page.tsx` | Server Component | Server component para check-in |
| `app/(protected)/coletas/[id]/oficina/orcamento/page.tsx` | Server Component | Server component para orçamento |
| `app/(protected)/coletas/[id]/oficina/aprovacao/page.tsx` | Server Component | Server component para aprovação |
| `app/(protected)/coletas/[id]/oficina/progresso/page.tsx` | Server Component | Server component para progresso |
| `app/(protected)/coletas/[id]/oficina/nfe/page.tsx` | Server Component | Server component para NF-e |
| `app/(protected)/coletas/[id]/oficina/entrega/page.tsx` | Server Component | Server component para entrega |
| `app/(protected)/coletas/[id]/oficina/cancelar/page.tsx` | Server Component | Server component para cancelamento |
| `app/(protected)/coletas/[id]/oficina/reabrir/page.tsx` | Server Component | Server component para reabertura |
| `src/_app/actions/phase3-flow.actions.ts` | Server Actions | Wrappers para API routes |
| `src/_pages/collection-operations/ui/collection-detail-hub.tsx` | Client Component | Orquestração do hub |
| `src/_pages/collection-operations/ui/collection-timeline.tsx` | Client Component | Timeline de eventos |
| `src/_pages/collection-operations/ui/operational-actions.tsx` | Client Component | Botões contextuais |
| `src/_pages/collection-operations/ui/workshop-checkin-page.tsx` | Client Component | Formulário de check-in |
| `src/_pages/collection-operations/ui/technical-budget-page.tsx` | Client Component | Formulário de orçamento |
| `src/_pages/collection-operations/ui/budget-approval-page.tsx` | Client Component | Formulário de aprovação |
| `src/_pages/collection-operations/ui/service-progress-page.tsx` | Client Component | Formulário de progresso |
| `src/_pages/collection-operations/ui/invoice-reference-page.tsx` | Client Component | Formulário de NF-e |
| `src/_pages/collection-operations/ui/customer-delivery-page.tsx` | Client Component | Formulário de entrega |
| `src/_pages/collection-operations/ui/cancel-reopen-page.tsx` | Client Component | Formulário de cancel/reopen |

## Arquivos a modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/_pages/collection-lifecycle/ui/collections-list-page.tsx` | Corrigir filtro "Em reparo", linkar para `/coletas/[id]` |
| `src/_pages/dashboard/ui/dashboard-page.tsx` | Linkar para `/coletas/[id]` |
| `src/_pages/collection-documents/ui/collection-documents-page.tsx` | Adicionar link "voltar para detalhe" |
| `src/_pages/collection-drafts/ui/draft-signature-page.tsx` | Redirecionar para `/coletas/[id]` após finalização |

---

## Decisões de Implementização

> **Registro pós-execução (22–23/08/2026):** as decisões 1 e 5 abaixo foram **superadas durante a implementação**, conforme acordado com o humano:

1. ~~**Server Actions wrapper**: As server actions fazem fetch interno para as API routes já existentes.~~ **(SUPERADA)** As server actions validam com os mesmos schemas Zod e chamam **diretamente as funções de comando** (`commands.ts`) — zero chamada HTTP interna. Mesmo comportamento dos route handlers, sem risco de perda de cookies. O `idempotencyKey` (UUID) continua gerado pelo cliente.

2. **signatureIntentId**: É um campo obrigatório dentro do próprio schema Zod para operações com upload de assinatura (check-in e delivery). O cliente gera o UUID e inclui no objeto dados/FormData. O servidor usa esse valor como idempotency key e internamente gera o `intentId` real via RPC `prepare_delivery_signature_intent`.

3. **expectedVersion**: Deve ser obtido do `getCollectionDetail` (via `collection.rowVersion`) no Server Component e passado como prop para o Client Component. Não deve ser hardcoded como `0`.

4. **Tipos**: Os tipos Zod são importados diretamente de `contracts.ts`. Para os Client Components, os tipos podem ser derivados via `z.infer<typeof schema>` ou definidos como interfaces locais.

5. ~~**Navegação pós-submit**: Após sucesso, redireciona via `window.location.href`...~~ **(SUPERADA — requisito de clique imediato)** Navegação pós-sucesso usa `startTransition(() => router.push('/coletas/[id]'))` (client-side) nas 7 telas: as actions chamam `revalidatePath`, então o push entrega dados frescos sem full-reload; `useTransition` mantém a UI responsiva e o botão ocupado (`isLoading={isSubmitting || isPending}`) até a revalidação completar. Todos os links entre telas usam `<Link prefetch>` com feedback `active:` imediato.

6. **Server Components para leitura**: Queries usam `createOperationsSupabaseClient` (do Operations) e `createLifecycleSupabaseClient` (do Lifecycle). Funções existentes: `getServiceOrder`, `getBudgetItems`, `getDeliveryTerms`, `getInvoiceReference`, `getWorkshopCheckInItems`, `getCollectionDetail`, `getCollectionEvents`.

7. **Tipos compartilhados (pós-execução)**: `CollectionStatus`, labels PT-BR e o helper `matchesStatusFilter` vivem em `src/shared/model/collection-status.ts` (com paridade type-level contra o enum Zod em `collection-lifecycle/model/contracts.ts`); view models serializáveis do hub em `collection-operations/model/view-models.ts` — elimina cross-imports FSD entre slices irmãs (Steiger 0 problemas).

---

## Critérios de Aceite

- [x] A equipe identifica em segundos onde cada coleta está no fluxo (via Badge + timeline no hub)
- [x] Financeiro consegue localizar a coleta pela referência fiscal e vice-versa (via tela de NF-e)
- [x] Relatórios não expõem dados fora da permissão do usuário (RLS no Supabase já configurado)
- [x] Todas as operações da oficina são executáveis via UI sem erros de validação *(validação cliente espelha os schemas Zod; smoke manual pendente)*
- [x] Assinaturas são capturadas via SignaturePad e enviadas como PNG (blob no FormData)
- [x] Entregas parciais funcionam: apenas itens selecionados são marcados como entregues
- [ ] Idempotência: reenvio da mesma operação não duplica dados *(implementada via `idempotencyKey`/`signatureIntentId`; confirmação em runtime no smoke manual)*
- [x] Zero dados fictícios: lacunas usam placeholders `{{...}}` ou estados vazios honestos
- [x] `steiger`, `lint`, `typecheck`, `build` e `test` todos passando *(gate verde: 89 passed / 18 skipped, 92 rotas no build)*
