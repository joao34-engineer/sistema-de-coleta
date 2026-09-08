# System scan — bugs e quebras funcionais

| Campo | Valor |
| :--- | :--- |
| **Status** | `active` — inventário; **código das Fases 0–5 (exceto 5.7/5.12/5.13 adiados) fechado**; **não autoriza implementação sozinho** |
| **Authority** | `informative` até o humano pedir um eixo |
| **Owner** | product / sistema-coleta |
| **Last verified** | 2026-09-06 (Production: 5.6 + cursor `20260906220000` no remoto; código 5.6 em `origin/main`) |
| **Escopo** | Somente `sistema-coleta/` |
| **Tipo** | Inventário. Não reabrir eixos marcados **feito**. |

Este arquivo é o inventário **completo** do scan de 29/08/2026, com status atualizado em 06/09/2026. Não é rewrite de arquitetura. Não substitui [`architecture/data-and-rules.md`](../architecture/data-and-rules.md) nem as fases de execução.

**Aberto de propósito:** nenhum eixo de código do scan. **Adiados 06/09/2026:** **5.7** (SignaturePad na aprovação), **5.12** / **5.13** (UI clientes/contatos/veículos). Fora do scan: Fase 4 chats 5–7 e gates remotos 1A.

**Como usar:** um eixo por PR. Não reimplementar linhas **feito**. Plano de execução que fechou B13/B23–B27/B30/5.1–5.5/5.8–5.11: [`execution/fase3-5-ready-to-implement-fix-plan.md`](../execution/fase3-5-ready-to-implement-fix-plan.md) (**closed**). Cheap cleanup 5.14–5.18: `30d8621`. Leftovers 2026-09-06 (Figma O04 mid-repair, trap settings, cancel OS, check-in missing): [`execution/workshop-partial-delivery-leftovers.md`](../execution/workshop-partial-delivery-leftovers.md) (**active**). PR 1 a PR 4 fechados (`20260907000000` / `07010000` **no remoto**); L1+L2+L4 no remoto (`07020000` / `07030000` / `07230000`); PR 5 bloqueado (Figma O02; herda helpers de remaining). Auditoria: [`workshop-leftovers-audit-2026-09-07.md`](./workshop-leftovers-audit-2026-09-07.md).

---

## 1. Veredito

A casca (login, lista, detalhe, wizard offline, PWA) existe. O ciclo de **coleta → número oficial → PDF → QR em `/verificar`** fechou em Production (`MJT-2026-000001` 2026-09-05; `MJT-2026-000002` Vercel 2026-09-05). Auth, fila offline, issuer, share consume, retry de PDF, lista/RPC, oficina (guard de status, check-in completo, SO `delivered`) e o cheap cleanup 5.14–5.18 estão no `main` (`30d8621`).

O que **ainda** está aberto neste inventário:

1. Recertificação, não código: 1.3 reload/Back; 4.4 429/503 no QR; share WhatsApp.
2. Fora do scan original, pedido 2026-09-06: ver plano [`workshop-partial-delivery-leftovers.md`](../execution/workshop-partial-delivery-leftovers.md) — não misturar com 5.7/5.12/5.13.

**Fechado 06/09/2026 (não reabrir):** 5.6 no remoto (`20260906210000`) e no deploy Production; cursor de paginação compacto (`20260906220000`, incidente dashboard “Não foi possível carregar as coletas”).

**Adiado 06/09/2026 (não implementar):** **5.7** SignaturePad na aprovação de orçamento (nome/CNPJ bastam); **5.12** / **5.13** telas de clientes, contatos e veículos.

Fases 4 chats 5–7 (prova humana de restore, campo, go-live) e gates remotos da Fase 1A **continuam adiados** — não são bugs de código deste scan.

---

## 2. Ordem das fases (prioridade)

| Fase | Nome | Por que nesta ordem |
| :--- | :--- | :--- |
| **0** | Schema e RPCs de oficina | Sem isto, entrada/orçamento/progresso/entrega morrem no banco |
| **1** | Fatia de produto (primeira recomendada) | Wizard, local, URL, fila, CTAs, worker/share |
| **2** | Offline e wizard (resto) | `in_flight`, mentira de sync, lock, reconnect |
| **3** | Auth e sessão | Login fail-closed, usuário preso, quota |
| **4** | Documento e compartilhamento (resto) | Quota do share, retry, issuer, QR page |
| **5** | Polimento e lacunas de escopo | Busca, filtros, `/clientes`, testes e2e |

Não implementar Fase 2 de oficina (passos 2.1–2.4) antes da Fase 0.

---

## Fase 0 — Schema e contratos de oficina — **FECHADA** (B01–B09)

Migration aditiva `20260829220000_phase_0_workshop_schema_contracts.sql` + mapper DAL/Zod. Sem `DROP` de dados. Aceite: check-in, orçamento, rejeição, progresso, cancelamento e 2ª entrega parcial.

### Passo 0.1 — Liberar status da Fase 3 em `collections` — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `20260815090000_phase_1a_collection_core.sql` (CHECK `status` + `official_code`); Fase 3 só ampliou `collections_status_check` |
| **Quebra** | `workshop_check_in` faz `status = 'in_workshop'` com `official_code` preenchido. Nenhum ramo do CHECK da 1A aceita. Entrada na oficina falha no `UPDATE`. |
| **Correção** | Constraint `collections_issued_identity_check`: draft sem identidade; qualquer status emitido exige código/snapshot. |

### Passo 0.2 — `check_in_signature_path` no lugar certo — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `20260823000001_phase_3_rpcs_idempotency.sql` (~142–145); coluna criada em `service_orders` (`20260823000000_...`) |
| **Quebra** | RPC faz `UPDATE collections SET check_in_signature_path = ...`. A coluna não existe em `collections`. Check-in quebra no UPDATE final (depois do upload). |
| **Correção** | Coluna em `collections`; cópia para SO no budget; policy de Storage também lê o path da coleta. |

### Passo 0.3 — Cancelar a partir de estados de oficina — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `previous_status_before_cancellation` CHECK só `'draft' \| 'collected'` |
| **Quebra** | Cancelar `in_workshop` / `ready` / etc. viola o CHECK. |
| **Correção** | CHECK ampliado para status emitidos de oficina (exceto `canceled` e `delivered`). |

### Passo 0.4 — Rejeitar orçamento — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `approve_technical_budget` grava `service_orders.status = 'rejected'`; tabela só permite `draft \| budgeted \| approved \| in_service \| ready \| canceled` |
| **Quebra** | Recusar orçamento sempre falha. |
| **Correção** | `service_orders_status_check` inclui `rejected`. |

### Passo 0.5 — Progresso: id do item — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `oficina/progresso/page.tsx` envia `collection_items.id`; `update_service_progress` busca `service_order_items.id` |
| **Quebra** | `service_order_item_not_found`. Coleta nunca chega em `in_service` / `ready`. Preferir RPC por `collection_item_id` **ou** a UI enviar o id da linha de orçamento. |
| **Correção** | RPC resolve por `service_order_items.collection_item_id` (contrato alinhado às demais RPCs). |

### Passo 0.6 — Entregas parciais — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `delivery_terms` `unique (organization_id, collection_id)` |
| **Quebra** | Segundo termo (parcial ou conclusão) falha. Produto permite várias entregas parciais. |
| **Correção** | Unique por coleta removido; `UNIQUE (id, organization_id)` e índice por coleta permanecem. |

### Passo 0.7 — `all_ready` no progresso — **feito**

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `update_service_progress`: `all_ready` só olha o payload |
| **Quebra** | Um item `pronto` no request pode promover a coleta inteira a `ready` enquanto outros ficam `em_reparo`. |
| **Correção** | Após UPDATEs, recalcula `all_ready`/`any_ready` em todos os `service_order_items` da coleta. |

### Passo 0.8 — Cliente no detalhe após `collected` — **feito**

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `get_collection_detail` / `list_collections` — customer JSON só para `draft`, `collected`, `canceled` |
| **Quebra** | Hub mostra “Cliente não informado” em toda a oficina. |
| **Correção** | Snapshot do cliente para todo status ≠ `draft` quando `customer_snapshot` existe. |

### Passo 0.9 — Confirmar no remoto (gate desta fase) — **feito**

Remoto alinhado às migrations 3b locais; Zod público aceita status emitidos de oficina; mapper DAL envia `p_items` em snake_case. Aceite sintético: check-in → orçamento → rejeição; progresso parcial; cancel a partir de `in_workshop`; 2ª entrega parcial; `get_collection_detail` com customer em oficina.
---

## Fase 1 — Fatia de produto (primeira recomendada)

Estes sete eixos eram a “lista curta”. Fazem sentido **depois ou em paralelo** da Fase 0, com a ressalva: orçamento/CTAs de oficina só valem com 0.1–0.5 verdes.

### Passo 1.1 — Semear orçamento a partir de `collection.items` — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `oficina/orcamento/page.tsx`; `seedBudgetItemsFromCollection` |
| **Quebra** | `getBudgetItems()` vazio até o primeiro `create_technical_budget`. Tela: “Nenhum item na coleta”. |
| **Correção** | Seed pelos itens da coleta quando não houver budget. Não reabrir. |

### Passo 1.2 — “Local da coleta” obrigatório (endereço cadastral opcional) — **feito** (Vercel 2026-09-05)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `new-collection-page.tsx`; `finalize_collection` (`collection_incomplete` se location vazio); `createDraftWithCustomerAction` aceita location e **não grava** |
| **Quebra** | Um campo “Endereço cadastral” opcional vira `collectionLocation`. Review deixa passar “não informado”. Finalize falha ou emite guia sem local. Dois campos: cadastral opcional + local da coleta obrigatório; bloquear revisão/assinatura sem local. |
| **Aceite** | Nova coleta em Production mostra **Local da coleta \***; revisão lista o local; finalize sem local não emite; `MJT-2026-000002` saiu com local **Oficina MJT — teste QR Vercel**. |

### Passo 1.3 — URL com `?rascunho=` ou `/coletas/[id]/itens` e Back — **feito** (Vercel 2026-09-05)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `collection-capture-page.tsx` (`backHref="/coletas/nova"`); `nova/page.tsx` |
| **Quebra** | Depois de Continuar a URL fica `/coletas/nova`. Reload / Back abre formulário novo e permite segundo rascunho. Deep links `.../revisao` ignoram `initialStep` se já existe draft local (`reload` usa `local.currentStep`). |
| **Aceite** | Continuar em Production foi para `/coletas/{id}/itens` → `/revisao` → `/assinatura` → `/documentos`. Não ficou em `/coletas/nova`. Reload/Back a criar segundo rascunho não foi retestado à parte. |

### Passo 1.4 — Códigos de máquina na fila offline; tradução só na UI — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `offline-runner.ts` `classify`; `toActionFailureCode` / `toFinalizeActionFailureCode` |
| **Quebra** | Runner esperava `stale_version` e `authentication_required`; actions devolviam frase em português. |
| **Correção** | Fila guarda código estável; chip/painel mapeiam PT via `messageForQueueError`. Não reabrir. |

### Passo 1.5 — CTAs do hub — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `operational-actions.ts`; hub |
| **Quebra** | `rejected`/`reopened` mostravam “Reabrir”; RPC só reabre `canceled`. Sem Cancelar nos estados ativos. |
| **Correção** | Matriz B14: Reabrir só em `canceled`; `rejected` → Novo orçamento; Cancelar onde o RPC de oficina permite. Rotas `/oficina/*` também recusam status ilegal (5.17). Não reabrir. |

### Passo 1.6 — Worker de documento + decisão V1 de e-mail/share — **feito** (PDF + QR; e-mail fora do V1)

> Stale vs código: finalize/cancel/reopen/revise disparam `processQueuedDocumentRenders` via `after()` no mesmo processo; Documentos tem `PdfPendingStatus` + WhatsApp/`navigator.share` em `/d/{token}`. Cron/curl continuam só retry. Não reabrir este passo como autorização de implementação.

| | |
| :--- | :--- |
| **Severidade** | crítica (PDF) / produto (envio) |
| **Onde** | `document_jobs` no finalize; `POST /api/internal/document-jobs/run`; `resend-adapter.ts`; `whatsapp-share-button.tsx` |
| **Quebra** | Finalize só enfileira. Sem cron/secret, PDF fica `snapshot_ready`. E-mail é dry-run salvo `DOCUMENT_EMAIL_SEND_ENABLED=true`. WhatsApp (se montado) aponta `/api/documents/{id}/download` (exige admin → 401 no cliente). Botão WhatsApp **não está** em `collection-documents-page.tsx`. Sem `navigator.share`. |
| **Decisão humana** | Agendar o worker. Declarar se e-mail Resend e share nativo entram no V1 ou ficam “preparação”. Link público deve ser `/d/{token}` ou `/verificar/{token}`, nunca a rota autenticada. |
| **Aceite** | Finalize em Production (`MJT-2026-000002`) gerou PDF (**Baixar PDF**). QR no telemóvel abriu `https://sistema-de-coleta.vercel.app/verificar/…` e mostrou a guia autêntica. E-mail continua fora (`DOCUMENT_EMAIL_SEND_ENABLED` não ligado). Share nativo / WhatsApp não recertificados. |

---

## Fase 2 — Offline e wizard (resto)

### Passo 2.1 — Recuperar mutações `in_flight` — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `drainCollectionQueue` (só `pending`/`failed`); `listPendingMutations` inclui `in_flight` |
| **Quebra** | Crash no meio do sync. Painel conta pendente; drain nunca reprocessa. Draft eterno. No boot: `in_flight` → `pending`. |

### Passo 2.2 — Finalize online não mentir — **feito**

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `collection-capture-page.tsx` após `drainAllPending` |
| **Quebra** | Se o draft local sobra (sync falhou), ainda mostra “Salvo neste aparelho”. Mostrar erro + retry. |

### Passo 2.3 — Lock de drain sem `navigator.locks` — **feito**

| | |
| :--- | :--- |
| **Severidade** | alta (Safari) |
| **Onde** | `fallbackDrainLock` retorna se `busy` |
| **Quebra** | Drains sobrepostos (wizard + banner + save) são no-op. Enfileirar, não descartar. |

### Passo 2.4 — Banner pendente no evento `online` — **feito**

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `offline-pending-banner.tsx` |
| **Quebra** | Drain só no mount / botão. Reconectar em `/coletas` ou dashboard não sincroniza. |

### Passo 2.5 — Descartar e hidratar — **feito**

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `offline-pending-panel.tsx` (`onDiscard(first.id)`); `hydrateServerDraft` / `reload` |
| **Quebra** | Descartar sempre o primeiro rascunho. Hidratar servidor inventa telefone `11000000000` e CPF `00000000000`. Discard local deixa rascunho órfão no servidor. |

### Passo 2.6 — Endereço SP/SP no sync — **feito**

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `production-offline-commands.ts` |
| **Quebra** | Street sozinha vira cidade São Paulo / UF SP. |

### Passo 2.7 — Pad de assinatura — **feito**

| | |
| :--- | :--- |
| **Severidade** | baixa |
| **Onde** | `signature-pad.tsx` |
| **Quebra** | Desenhar não basta; precisa “Confirmar Assinatura”. Fácil finalizar sem PNG. |

---

## Fase 3 — Auth e sessão — **FECHADA** (B23–B27, `main` 2026-09-06)

### Passo 3.1 — Logout na tela de acesso negado — **feito**

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `AccessDeniedPage`; `proxy.ts` |
| **Quebra** | Sessão Supabase sem papel administrator (também perfil inativo, membership inativa ou org ausente) ficava presa. Sem Sair. |
| **Correção** | Botão Sair na tela de acesso negado. Não reabrir. |

### Passo 3.2 — Login fail-closed e env — **feito**

| | |
| :--- | :--- |
| **Severidade** | crítica se o deploy estiver incompleto |
| **Onde** | `enforceLoginRateLimit`; `getServiceEnvironment`; `getDocumentRateLimitSecret` |
| **Quebra** | Env incompleto virava “Não foi possível concluir o login agora.” |
| **Correção** | Fail-closed no login. `getServiceEnvironment` exige URL + `SUPABASE_SECRET_KEY` + `SUPABASE_CONFIRM_PROJECT_REF`; o HMAC é `getDocumentRateLimitSecret()` à parte. Migrations `auth_login` já estavam no remoto (2026-08-29). Não reabrir. |

### Passo 3.3 — Quota de login — **feito**

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | Rate limit **antes** de `signInWithPassword` |
| **Quebra** | 5 tentativas na janela UTC de 900 s (incluindo sucesso) bloqueavam o admin. |
| **Correção** | Conta só falha; sucesso zera a quota. Não reabrir. |

### Passo 3.4 — Cookies e sign-out — **feito**

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `supabase-server.ts` `setAll`; `signOutAction` |
| **Quebra** | Login parecia ok e o proxy devolvia ao login; ou “Sair” não limpava sessão. |
| **Correção** | `setAll` no caminho RSC continua engolindo (padrão `@supabase/ssr`); Server Actions de login/logout falham alto se o cookie não gravar. Não reabrir. |

### Passo 3.5 — Proxy sem env público — **feito**

| | |
| :--- | :--- |
| **Severidade** | média (misconfig) |
| **Onde** | `proxy.ts` `hasPublicEnvironment()` |
| **Quebra** | Sem env público o proxy fazia `next()` e o layout quebrava (`getPublicEnvironment()`). URL sintaticamente inválida passava o check. |
| **Correção** | Proxy fail-closed em rota protegida. Não pôr checagem de papel no `proxy.ts`. Não reabrir. |

---

## Fase 4 — Documento, QR e share (resto) — **FECHADA** no código (B28–B32)

Recertificação humana residual: 4.4 429/503; PDF antigo de `MJT-2026-000001` ainda aponta localhost.

### Passo 4.1 — Consumir share só depois da URL assinada — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `app/(public)/d/[shareToken]/download/route.ts` |
| **Quebra** | `consumeDocumentShare` incrementava `download_count` antes do signed URL. Falha de Storage = 404 + 1 uso perdido. |
| **Correção** | Consome a cota só depois da URL assinada. Não reabrir. |

### Passo 4.2 — Retry de PDF — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | retry de job + `PdfPendingStatus` |
| **Quebra** | Sempre `422 document_retry_not_available`. Job falho sem recuperação na UI. |
| **Correção** | `retryDocumentJob` + estado pendente honesto na tela Documentos. Não reabrir. |

### Passo 4.3 — Perfil emissor incompleto — **feito** (`main` 2026-09-06)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `finalize_collection` → `issuer_profile_incomplete`; settings |
| **Quebra** | Sem logo/perfil, nenhum número oficial. Mensagem genérica. Settings diziam “usados futuramente”. |
| **Correção** | Copy verdadeiro nas configurações; fila/UI mapeiam o código em português. Página de assinatura legado apagada (5.15). Não reabrir. |

### Passo 4.4 — Página `/verificar/[token]` — **feito** (caminho feliz 2026-09-05)

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `verificar/[verificationToken]/page.tsx` |
| **Quebra** | Rate limit sem try/catch → 500. A API JSON trata 429. Se o RPC devolver status de oficina, o Zod (`collected \| canceled`) vira “Registro não encontrado” (ligar à Fase 0.9). |
| **Aceite** | Scan do QR de `MJT-2026-000002` no telemóvel abriu o host Vercel e mostrou a guia autêntica. 429/503 e status de oficina no Zod não foram retestados ao vivo. |

### Passo 4.5 — `NEXT_PUBLIC_APP_URL` — **feito** (Vercel 2026-09-05)

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `shares.server.ts`; worker (`document_verification_base_url_missing`) |
| **Quebra** | Sem URL pública, share e render de QR/PDF falham. |
| **Aceite** | Production tem `NEXT_PUBLIC_APP_URL=https://sistema-de-coleta.vercel.app`. PDF novo (v1 de `000002`) QR aponta ao host Vercel. PDF antigo de `000001` continua localhost (bytes antigos; env não reescreve Storage). |

---

## Fase 5 — Polimento e escopo

Não misturar com schema (0) nem com a fatia 1 no mesmo PR.

| Passo | Status | Severidade | Quebra / correção |
| :--- | :--- | :--- | :--- |
| 5.1 | **feito** | média | Lista/dashboard usam RPC com busca, filtro e `totalCount` no servidor |
| 5.2 | **feito** | média | Taxonomia única: “Em reparo” não inclui `ready` |
| 5.3 | **feito** | média | Contagens honestas no servidor; prontas incluem `invoiced` |
| 5.4 | **feito** | média | Labels de evento pontilhados + `actorName` a partir do perfil/metadata |
| 5.5 | **feito** | média | Entrega começa vazia; RPC recusa id repetido / já entregue |
| 5.6 | **feito** | média | Entrega a partir de Pronto; NF-e opcional. Remoto + Production 06/09/2026 (`20260906210000`) |
| 5.7 | **adiado** | média | Aprovação de orçamento: nome + CNPJ obrigatórios; SignaturePad **opcional**. Humano 06/09/2026: não implementar o pad agora |
| 5.8 | **feito** | média | Check-in recusa conjunto incompleto de itens |
| 5.9 | **feito** | média | OS ganha status terminal `delivered` após entrega total |
| 5.10 | **feito** | média | `awaiting_approval` documentado como reserva; dwell real é `in_budget`. Não ligar sem pedido |
| 5.11 | **feito** | média | Lifecycle reopen limpa colunas de cancel; workshop reopen usa `coalesce` |
| 5.12 | **adiado** | alta (escopo) | Sem rotas `/clientes`. Humano 06/09/2026: adiado |
| 5.13 | **adiado** | alta (escopo) | Sem UI de contatos nem veículos. Humano 06/09/2026: adiado |
| 5.14 | **feito** | baixa | E2E login/admin alinhados ao copy atual (`30d8621`) |
| 5.15 | **feito** | baixa | `DraftSignaturePage` apagada; assinatura viva é `CollectionCapturePage` |
| 5.16 | **feito** | baixa | Um só `verifyCollectionDocument` (`api/public/verification.ts`) |
| 5.17 | **feito** | baixa | `loadCollectionForOperation` redireciona se o status não permite o segmento |
| 5.18 | **feito** | baixa | pgTAP Fase 3 alinhado às RPCs 3b (`approve_technical_budget`). Não gated no CI |

**Nota 5.6 — fechada 06/09/2026.** Entrega é permitida em `in_service`, `ready`, `invoiced` e `partial_delivery` (leftovers PR 3). **Registrar NF-e (opcional)** em `ready` e `partial_delivery` (L2, `20260907030000` **no remoto**). O sistema não emite nota fiscal; o registro interno não é pré-requisito da entrega. Lançar NF-e depois de `delivered` fica fora (só com pedido explícito).

**Leftovers PR 3 — feito 07/09/2026.** Implementado e revisado; migration `20260907000000_phase_5_deliver_mid_repair.sql` **no remoto**. Conjunto deliverable `in_service | ready | invoiced | partial_delivery`; `item_not_ready` (P0001 → HTTP 422); OS segue o restante (`delivered` / `in_service` / `ready`).

**Leftovers PR 4 — feito 07/09/2026.** Implementado e revisado; migration `20260907010000_phase_5_cancel_draft_and_service_order.sql` **no remoto**. Cancel de `draft` passa a `collection_not_cancelable_draft` (P0001) no lugar do `23514` opaco. Coluna nullable `service_orders.previous_status_before_cancellation`. Os dois caminhos de reopen restauram a OS.

**Leftovers L4 — feito 07/09/2026.** `20260907230000` **no remoto**. `remaining` = vivos não entregues **com** linha OS; unique parcial em `service_order_items`; `item_not_ready` = todas as linhas `pronto`; orçamento recusa `item_id` duplicado. PR 5 (check-in “não chegou”) continua bloqueado no Figma O02 e herda os helpers de remaining.

**Incidente cursor 06/09/2026 — fechado.** `encode_collection_cursor` passou a emitir RFC 4648 base64url compacto (`20260906220000`, remoto aplicado). Dashboard / “carregar mais” deixam de falhar quando `nextCursor` existe. Zod e decode permanecem estritos. Não reabrir sanitização no cliente.

---

## 3. Fora deste inventário (não são bugs do scan)

- Backup/restore, testes de campo, treino e go-live (Fase 4 chats 5–7).
- Gates remotos Fase 1A (RLS cruzada, concorrência, Storage, cleanup) — adiados.
- Recuperação de senha / SMTP de convite — adiados na Fase 0.
- E-mail Resend (`DOCUMENT_EMAIL_SEND_ENABLED`) e recertificação WhatsApp/`navigator.share` — decisão de produto, não eixo deste scan.
- [`architecture-improvement.md`](./architecture-improvement.md) — organização de código (A–H), não correção funcional. Não tratar como bug do scan.
- Cheiros residuais **sem eixo até pedido explícito**:
  - UI de entrega lista todos os itens da coleta (já entregues desabilitados); não restringe à progressão **Pronto** do orçamento. A RPC também não exige item `pronto`. **PR 3 feito 07/09/2026 — migration `20260907000000` aplicada:** conjunto deliverable inclui `in_service`; `item_not_ready` (422); OS segue o restante.
  - `register_invoice_reference` só aceita `status = ready` (NF-e depois de `delivered` / `partial_delivery` impossível).
  - Check-in: `quantity_observed > 0` + conjunto completo — não dá para registrar “item não chegou”.
  - Backfills opcionais (OS `ready` com coleta `delivered`; `canceled_at` em coleta reaberta): `SELECT` + OK humano, não código. **Auditado 06/09/2026 no remoto `sistema-coleta-mjt`: remoto limpo** — ambas as sondas `count = 0`, mais o inventário de coleta `canceled` com OS viva também `0`. Nenhum `UPDATE`, nenhuma migration. Reauditar com os mesmos `SELECT` antes de qualquer backfill futuro.
  - `draft-items-page` / `draft-review-page` sem rota (wizard vivo é `CollectionCapturePage`).
  - `cancel_or_reopen_collection` aceita cancelar `draft` e quebra o CHECK de identidade; hub não oferece esse CTA. **PR 4 feito 07/09/2026 — migration `20260907010000` aplicada:** `collection_not_cancelable_draft` no lugar do `23514` opaco; aponta para `discard_collection_draft`.
  - `service_orders.status = 'canceled'` no CHECK, nenhuma RPC grava. **PR 4 feito 07/09/2026 — mesma migration aplicada:** coluna nullable `previous_status_before_cancellation`; cancel grava e põe a OS em `canceled`; reopen restaura em `cancel_or_reopen_collection` e em `reopen_collection`.

---

## 4. Aceite sugerido por fase

| Fase | Gate mínimo |
| :--- | :--- |
| 0 | Check-in, orçamento, rejeição, progresso, cancelar oficina e 2ª entrega parcial no SQL; remoto confirmado (0.9) — **feito** 29/08/2026 |
| 1 | Nova coleta: local obrigatório, URL/Back, finalize com número; fila classifica códigos; hub CTAs; PDF nasce após worker (ou estado “PDF pendente” honesto) — **feito** (código `main` 2026-09-06; 1.2 / 1.3 / 1.6 recertificados em Production 2026-09-05, `MJT-2026-000002`). Recertificar 1.3 reload/Back se o humano pedir |
| 2 | Crash no sync + retry conclui; finalize online não mente; reconnect no banner — **feito** 05/09/2026 |
| 3 | Admin entra; não-admin sai; env documentado no deploy — **feito** no código (`30d8621` + PRs auth). Smoke e2e local precisa Chromium |
| 4 | Share `/d/{token}` não queima cota à toa; verify não 500; issuer incompleto com mensagem clara — **feito** no código. 4.4 / 4.5 recertificados (QR Vercel). Recertificar 429/503 do QR se o humano pedir |
| 5 | 5.1–5.6 e 5.8–5.18 **feitos** (5.6 no remoto + Production). Cursor `20260906220000` no remoto. **5.7 / 5.12 / 5.13 adiados** (06/09/2026). |

Validação de código (quando implementar o que ainda está aberto): `npm run check` em `sistema-coleta`. Schema: permissões admin / não-admin / anon, sem reset do remoto.

---

## 5. Índice rápido (id estável)

| ID | Fase.passo | Título curto | Status |
| :--- | :--- | :--- |
| B01 | 0.1 | CHECK status + official_code bloqueia oficina | **feito** |
| B02 | 0.2 | `check_in_signature_path` na tabela errada | **feito** |
| B03 | 0.3 | CHECK previous_status no cancel | **feito** |
| B04 | 0.4 | `service_orders.status = rejected` | **feito** |
| B05 | 0.5 | Progresso: id de item errado | **feito** |
| B06 | 0.6 | Um `delivery_terms` por coleta | **feito** |
| B07 | 0.7 | `all_ready` prematuro | **feito** |
| B08 | 0.8 | Cliente some no detalhe | **feito** |
| B09 | 0.9 | Confirmar RPCs/QR no remoto | **feito** |
| B10 | 1.1 | Orçamento vazio | **feito** |
| B11 | 1.2 | Local da coleta | **feito** |
| B12 | 1.3 | URL / Back / initialStep | **feito** (recert reload/Back à parte) |
| B13 | 1.4 | Códigos na fila offline | **feito** |
| B14 | 1.5 | Cancelar / Reabrir / rejected | **feito** |
| B15 | 1.6 | Worker + e-mail/share V1 | **feito** (PDF + QR; e-mail fora) |
| B16 | 2.1 | `in_flight` | **feito** |
| B17 | 2.2 | Finalize online mente | **feito** |
| B18 | 2.3 | fallbackDrainLock | **feito** |
| B19 | 2.4 | Banner sem `online` | **feito** |
| B20–B22 | 2.5–2.7 | Discard / hydrate / SP / pad | **feito** |
| B23–B27 | 3.1–3.5 | Auth | **feito** |
| B28 | 4.1 | Share consume após signed URL | **feito** |
| B29 | 4.2 | Retry de PDF | **feito** |
| B30 | 4.3 | Issuer incompleto | **feito** |
| B31 | 4.4 | `/verificar` | **feito** |
| B32 | 4.5 | `NEXT_PUBLIC_APP_URL` | **feito** |
| B33 | 5.1 | Lista/busca no servidor | **feito** |
| B34 | 5.2 | Filtro “Em reparo” vs `ready` | **feito** |
| B35 | 5.3 | Contagem “prontas” / `invoiced` | **feito** |
| B36 | 5.4 | Timeline labels / `actorName` | **feito** |
| B37 | 5.5 | Entrega: seleção e ids | **feito** |
| B38 | 5.6 | Entrega exige `invoiced`? | **feito** (entrega desde Pronto; NF-e opcional) |
| B39 | 5.7 | Aprovação sem SignaturePad | **adiado** (pad opcional) |
| B40 | 5.8 | Check-in conjunto completo | **feito** |
| B41 | 5.9 | OS `delivered` | **feito** |
| B42 | 5.10 | `awaiting_approval` unused | **feito** (doc) |
| B43 | 5.11 | Lifecycle reopen limpa cancel | **feito** |
| B44 | 5.12 | UI `/clientes` | **adiado** |
| B45 | 5.13 | UI contatos / veículos | **adiado** |
| B46–B50 | 5.14–5.18 | E2E copy, legado, verify, guard, pgTAP | **feito** (`30d8621`) |

---

## 6. Fontes do scan

Análise de 29/08/2026 sobre `src/`, `app/`, `public/sw.js`, `supabase/migrations/` (1A, 2, 3a/3b, 4 chats 2–3) e docs de execução. Sem alteração de código na sessão do scan.

Status de código relido em 06/09/2026 contra `origin/main` (`30d8621`) + 5.6 Production e cursor remoto `20260906220000`. Errata do plano [`execution/fase3-5-ready-to-implement-fix-plan.md`](../execution/fase3-5-ready-to-implement-fix-plan.md) §11 já absorvida neste arquivo.
