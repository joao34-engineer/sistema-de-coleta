# System scan — bugs e quebras funcionais

| Campo | Valor |
| :--- | :--- |
| **Status** | `active` — inventário de correção; **não autoriza implementação sozinho** |
| **Authority** | `informative` até o humano pedir um eixo |
| **Owner** | product / sistema-coleta |
| **Last verified** | 2026-08-29 |
| **Escopo** | Somente `sistema-coleta/` |
| **Tipo** | Análise read-only (código + migrations). Sem edição de app neste scan. |

Este arquivo é o inventário **completo** do scan de 29/08/2026. Não é rewrite de arquitetura. Não substitui [`architecture/data-and-rules.md`](../architecture/data-and-rules.md) nem as fases de execução.

**Como usar:** um eixo por PR. Schema (Fase 0) antes de telas de oficina (Fase 2+). A fatia de produto da Fase 1 pode correr em paralelo com a 0 **só** se não depender de `in_workshop`.

---

## 1. Veredito

A casca (login, lista, detalhe, wizard offline, PWA) existe. O que impede o V1 de campo:

1. A oficina **não consegue mudar de estado** por CHECKs da Fase 1A e colunas/RPCs desalinhados.
2. O wizard de coleta perde rascunho, omite local obrigatório e a fila offline classifica erro traduzido.
3. PDF e compartilhamento não fecham o ciclo sozinhos (worker + link público).

Fases 4 chats 5–7 (backup, campo, go-live) e gates remotos da Fase 1A **continuam adiados** — não são bugs de código deste scan.

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

## Fase 0 — Schema e contratos de oficina (fazer primeiro)

Migration **aditiva**. Sem `DROP` de dados. Testar fora de produção. Atualizar tipos se o remoto mudar.

### Passo 0.1 — Liberar status da Fase 3 em `collections`

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `20260815090000_phase_1a_collection_core.sql` (CHECK `status` + `official_code`); Fase 3 só ampliou `collections_status_check` |
| **Quebra** | `workshop_check_in` faz `status = 'in_workshop'` com `official_code` preenchido. Nenhum ramo do CHECK da 1A aceita. Entrada na oficina falha no `UPDATE`. |

### Passo 0.2 — `check_in_signature_path` no lugar certo

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `20260823000001_phase_3_rpcs_idempotency.sql` (~142–145); coluna criada em `service_orders` (`20260823000000_...`) |
| **Quebra** | RPC faz `UPDATE collections SET check_in_signature_path = ...`. A coluna não existe em `collections`. Check-in quebra no UPDATE final (depois do upload). |

### Passo 0.3 — Cancelar a partir de estados de oficina

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `previous_status_before_cancellation` CHECK só `'draft' \| 'collected'` |
| **Quebra** | Cancelar `in_workshop` / `ready` / etc. viola o CHECK. |

### Passo 0.4 — Rejeitar orçamento

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `approve_technical_budget` grava `service_orders.status = 'rejected'`; tabela só permite `draft \| budgeted \| approved \| in_service \| ready \| canceled` |
| **Quebra** | Recusar orçamento sempre falha. |

### Passo 0.5 — Progresso: id do item

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `oficina/progresso/page.tsx` envia `collection_items.id`; `update_service_progress` busca `service_order_items.id` |
| **Quebra** | `service_order_item_not_found`. Coleta nunca chega em `in_service` / `ready`. Preferir RPC por `collection_item_id` **ou** a UI enviar o id da linha de orçamento. |

### Passo 0.6 — Entregas parciais

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `delivery_terms` `unique (organization_id, collection_id)` |
| **Quebra** | Segundo termo (parcial ou conclusão) falha. Produto permite várias entregas parciais. |

### Passo 0.7 — `all_ready` no progresso

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `update_service_progress`: `all_ready` só olha o payload |
| **Quebra** | Um item `pronto` no request pode promover a coleta inteira a `ready` enquanto outros ficam `em_reparo`. |

### Passo 0.8 — Cliente no detalhe após `collected`

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `get_collection_detail` / `list_collections` — customer JSON só para `draft`, `collected`, `canceled` |
| **Quebra** | Hub mostra “Cliente não informado” em toda a oficina. |

### Passo 0.9 — Confirmar no remoto (gate desta fase)

Antes de fechar a Fase 0, comparar no projeto vinculado:

- Corpo atual de `verify_collection_document` (status `collected \| canceled` vs status vivo).
- Assinaturas de `workshop_check_in`, `create_technical_budget`, `deliver_to_customer` (camelCase vs `item_id`; `p_signature` vs intent; retorno com/sem `deliveryTermId`).
- Se o Zod exigir `deliveryTermId` e o RPC não devolver, a entrega **grava e a action reporta falha**.

Aceite da Fase 0: check-in, orçamento, rejeição, progresso, cancelamento e 2ª entrega parcial passam no SQL (teste isolado ou remoto sintético). Sem `db reset`.

---

## Fase 1 — Fatia de produto (primeira recomendada)

Estes sete eixos eram a “lista curta”. Fazem sentido **depois ou em paralelo** da Fase 0, com a ressalva: orçamento/CTAs de oficina só valem com 0.1–0.5 verdes.

### Passo 1.1 — Semear orçamento a partir de `collection.items`

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `oficina/orcamento/page.tsx`; `technical-budget-page.tsx` |
| **Quebra** | `getBudgetItems()` está vazio até o primeiro `create_technical_budget`. Tela: “Nenhum item na coleta”. Semear pelos itens da coleta quando não houver budget. |

### Passo 1.2 — “Local da coleta” obrigatório (endereço cadastral opcional)

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `new-collection-page.tsx`; `finalize_collection` (`collection_incomplete` se location vazio); `createDraftWithCustomerAction` aceita location e **não grava** |
| **Quebra** | Um campo “Endereço cadastral” opcional vira `collectionLocation`. Review deixa passar “não informado”. Finalize falha ou emite guia sem local. Dois campos: cadastral opcional + local da coleta obrigatório; bloquear revisão/assinatura sem local. |

### Passo 1.3 — URL com `?rascunho=` ou `/coletas/[id]/itens` e Back

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `collection-capture-page.tsx` (`backHref="/coletas/nova"`); `nova/page.tsx` |
| **Quebra** | Depois de Continuar a URL fica `/coletas/nova`. Reload / Back abre formulário novo e permite segundo rascunho. Deep links `.../revisao` ignoram `initialStep` se já existe draft local (`reload` usa `local.currentStep`). |

### Passo 1.4 — Códigos de máquina na fila offline; tradução só na UI

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `offline-runner.ts` `classify`; `toSafeActionError`; `finalizeCollectionAction` / `saveCollectionSignatureAction` |
| **Quebra** | Runner espera `stale_version` e `authentication_required`. Actions devolvem frase em português. Sem retry de versão e sem pausa de sessão na assinatura/finalize. Manter `error` estável na fila; mapear texto só no chip/painel. |

### Passo 1.5 — CTAs do hub

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `operational-actions.tsx`; rota `/oficina/cancelar` sem link |
| **Quebra** | `rejected` e `reopened` mostram “Reabrir”; RPC só reabre `canceled`. Sem Cancelar no hub para estados ativos. **Fazer:** Cancelar no hub (quando o RPC permitir); Reabrir só em `canceled`; `rejected` → novo orçamento (não reopen). |

### Passo 1.6 — Worker de documento + decisão V1 de e-mail/share

| | |
| :--- | :--- |
| **Severidade** | crítica (PDF) / produto (envio) |
| **Onde** | `document_jobs` no finalize; `POST /api/internal/document-jobs/run`; `resend-adapter.ts`; `whatsapp-share-button.tsx` |
| **Quebra** | Finalize só enfileira. Sem cron/secret, PDF fica `snapshot_ready`. E-mail é dry-run salvo `DOCUMENT_EMAIL_SEND_ENABLED=true`. WhatsApp (se montado) aponta `/api/documents/{id}/download` (exige admin → 401 no cliente). Botão WhatsApp **não está** em `collection-documents-page.tsx`. Sem `navigator.share`. |
| **Decisão humana** | Agendar o worker. Declarar se e-mail Resend e share nativo entram no V1 ou ficam “preparação”. Link público deve ser `/d/{token}` ou `/verificar/{token}`, nunca a rota autenticada. |

---

## Fase 2 — Offline e wizard (resto)

### Passo 2.1 — Recuperar mutações `in_flight`

| | |
| :--- | :--- |
| **Severidade** | crítica |
| **Onde** | `drainCollectionQueue` (só `pending`/`failed`); `listPendingMutations` inclui `in_flight` |
| **Quebra** | Crash no meio do sync. Painel conta pendente; drain nunca reprocessa. Draft eterno. No boot: `in_flight` → `pending`. |

### Passo 2.2 — Finalize online não mentir

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `collection-capture-page.tsx` após `drainAllPending` |
| **Quebra** | Se o draft local sobra (sync falhou), ainda mostra “Salvo neste aparelho”. Mostrar erro + retry. |

### Passo 2.3 — Lock de drain sem `navigator.locks`

| | |
| :--- | :--- |
| **Severidade** | alta (Safari) |
| **Onde** | `fallbackDrainLock` retorna se `busy` |
| **Quebra** | Drains sobrepostos (wizard + banner + save) são no-op. Enfileirar, não descartar. |

### Passo 2.4 — Banner pendente no evento `online`

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `offline-pending-banner.tsx` |
| **Quebra** | Drain só no mount / botão. Reconectar em `/coletas` ou dashboard não sincroniza. |

### Passo 2.5 — Descartar e hidratar

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `offline-pending-panel.tsx` (`onDiscard(first.id)`); `hydrateServerDraft` / `reload` |
| **Quebra** | Descartar sempre o primeiro rascunho. Hidratar servidor inventa telefone `11000000000` e CPF `00000000000`. Discard local deixa rascunho órfão no servidor. |

### Passo 2.6 — Endereço SP/SP no sync

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `production-offline-commands.ts` |
| **Quebra** | Street sozinha vira cidade São Paulo / UF SP. |

### Passo 2.7 — Pad de assinatura

| | |
| :--- | :--- |
| **Severidade** | baixa |
| **Onde** | `signature-pad.tsx` |
| **Quebra** | Desenhar não basta; precisa “Confirmar Assinatura”. Fácil finalizar sem PNG. |

---

## Fase 3 — Auth e sessão

### Passo 3.1 — Logout na tela de acesso negado

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `AccessDeniedPage`; `proxy.ts` redireciona `/login` → `/dashboard` se há `sub` |
| **Quebra** | Usuário Supabase sem papel administrator fica preso. Sem Sair. |

### Passo 3.2 — Login fail-closed e env

| | |
| :--- | :--- |
| **Severidade** | crítica se o deploy estiver incompleto |
| **Onde** | `enforceLoginRateLimit` → `DOCUMENT_RATE_LIMIT_SECRET`, `getServiceEnvironment` (secret + `SUPABASE_CONFIRM_PROJECT_REF`) |
| **Quebra** | Qualquer tentativa vira “Não foi possível concluir o login agora.” `CONFIRM_PROJECT_REF` é exigido e **não** é usado no RPC. Confirmar migrations `auth_login` no remoto. |

### Passo 3.3 — Quota de login

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | Rate limit **antes** de `signInWithPassword` |
| **Quebra** | 5 tentativas/15 min (incluindo sucesso) bloqueiam o admin. Preferir contar só falha. |

### Passo 3.4 — Cookies e sign-out

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `supabase-server.ts` `setAll` swallow; `signOutAction` ignora erro |
| **Quebra** | Login parece ok e o proxy devolve ao login; ou “Sair” não limpa sessão. |

### Passo 3.5 — Proxy sem env público

| | |
| :--- | :--- |
| **Severidade** | média (misconfig) |
| **Onde** | `proxy.ts` `hasPublicEnvironment()` → `next()` |
| **Quebra** | Sem gate de borda. O layout ainda autentica. |

---

## Fase 4 — Documento, QR e share (resto)

### Passo 4.1 — Consumir share só depois da URL assinada

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `app/(public)/d/[shareToken]/download/route.ts` |
| **Quebra** | `consumeDocumentShare` incrementa `download_count` antes do signed URL. Falha de Storage = 404 + 1 uso perdido. 429 devolve JSON no `<a href>`. |

### Passo 4.2 — Retry de PDF

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `.../documents/[documentId]/retry` |
| **Quebra** | Sempre `422 document_retry_not_available`. Job falho sem recuperação na UI. |

### Passo 4.3 — Perfil emissor incompleto

| | |
| :--- | :--- |
| **Severidade** | alta |
| **Onde** | `finalize_collection` → `issuer_profile_incomplete` |
| **Quebra** | Sem logo/perfil, nenhum número oficial. Mensagem genérica. Settings ainda dizem “usados futuramente”. |

### Passo 4.4 — Página `/verificar/[token]`

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `verificar/[verificationToken]/page.tsx` |
| **Quebra** | Rate limit sem try/catch → 500. A API JSON trata 429. Se o RPC devolver status de oficina, o Zod (`collected \| canceled`) vira “Registro não encontrado” (ligar à Fase 0.9). |

### Passo 4.5 — `NEXT_PUBLIC_APP_URL`

| | |
| :--- | :--- |
| **Severidade** | média |
| **Onde** | `shares.server.ts`; worker (`document_verification_base_url_missing`) |
| **Quebra** | Sem URL pública, share e render de QR/PDF falham. |

---

## Fase 5 — Polimento e escopo

Não misturar com schema (0) nem com a fatia 1 no mesmo PR.

| Passo | Severidade | Quebra |
| :--- | :--- | :--- |
| 5.1 | média | Lista/busca só nos 50 primeiros; RPC `list_collections` (código, cliente, CPF, telefone, status, datas) não é usado |
| 5.2 | média | Filtro “Em reparo” inclui `ready` (também em “Prontas”) |
| 5.3 | média | Dashboard “prontas” só conta `ready`, some após NF-e (`invoiced`) |
| 5.4 | média | Timeline: labels (`workshop_check_in`) ≠ eventos (`collection.workshop.checked_in`); `actorName` sempre null |
| 5.5 | média | Entrega pré-marca **todos** os itens; não exclui já entregues; RPC não rejeita id repetido |
| 5.6 | média | Entrega exige `invoiced` (NF-e) antes do termo — confirmar se é regra de produto |
| 5.7 | média | Aprovação de orçamento sem assinatura desenhada |
| 5.8 | média | Check-in aceita subconjunto de itens (produto pede conferência de todos) |
| 5.9 | média | `deliver_to_customer` volta `service_orders.status` para `ready` |
| 5.10 | média | `awaiting_approval` nunca é escrito (orçamento vai a `in_budget` e aprova dali) |
| 5.11 | média | Dois stacks cancel/reopen (lifecycle vs `cancel_or_reopen`); lifecycle não limpa `canceled_at` |
| 5.12 | alta (escopo) | Sem rotas `/clientes` / cadastro; só API + passo da coleta |
| 5.13 | alta (escopo) | Sem UI de contatos nem veículos (tabelas no modelo) |
| 5.14 | baixa | E2E de login espera copy antigo (`Sistema de Coleta` vs `Entre para continuar.`) |
| 5.15 | baixa | `DraftSignaturePage` legado gera nova idempotency key (não roteada) |
| 5.16 | baixa | Dois `verifyCollectionDocument` (só um usado) |
| 5.17 | baixa | Rotas de oficina sem guard de status (só RPC) |
| 5.18 | baixa | pgTAP da Fase 3 ainda descreve assinatura antiga das RPCs |

---

## 3. Fora deste inventário (não são bugs do scan)

- Backup/restore, testes de campo, treino e go-live (Fase 4 chats 5–7).
- Gates remotos Fase 1A (RLS cruzada, concorrência, Storage, cleanup) — adiados.
- Recuperação de senha / SMTP de convite — adiados na Fase 0.
- [`architecture-improvement.md`](./architecture-improvement.md) — organização de código, não correção funcional.

---

## 4. Aceite sugerido por fase

| Fase | Gate mínimo |
| :--- | :--- |
| 0 | Check-in, orçamento, rejeição, progresso, cancelar oficina e 2ª entrega parcial no SQL; remoto confirmado (0.9) |
| 1 | Nova coleta: local obrigatório, URL/Back, finalize com número; fila classifica códigos; hub CTAs; PDF nasce após worker (ou estado “PDF pendente” honesto) |
| 2 | Crash no sync + retry conclui; finalize online não mente; reconnect no banner |
| 3 | Admin entra; não-admin sai; env documentado no deploy |
| 4 | Share `/d/{token}` não queima cota à toa; verify não 500; issuer incompleto com mensagem clara |
| 5 | Sob demanda; um eixo por PR |

Validação de código (quando implementar): `npm run check` em `sistema-coleta`. Schema: permissões admin / não-admin / anon, sem reset do remoto.

---

## 5. Índice rápido (id estável)

| ID | Fase.passo | Título curto |
| :--- | :--- | :--- |
| B01 | 0.1 | CHECK status + official_code bloqueia oficina |
| B02 | 0.2 | `check_in_signature_path` na tabela errada |
| B03 | 0.3 | CHECK previous_status no cancel |
| B04 | 0.4 | `service_orders.status = rejected` |
| B05 | 0.5 | Progresso: id de item errado |
| B06 | 0.6 | Um `delivery_terms` por coleta |
| B07 | 0.7 | `all_ready` prematuro |
| B08 | 0.8 | Cliente some no detalhe |
| B09 | 0.9 | Confirmar RPCs/QR no remoto |
| B10 | 1.1 | Orçamento vazio |
| B11 | 1.2 | Local da coleta |
| B12 | 1.3 | URL / Back / initialStep |
| B13 | 1.4 | Códigos na fila offline |
| B14 | 1.5 | Cancelar / Reabrir / rejected |
| B15 | 1.6 | Worker + e-mail/share V1 |
| B16 | 2.1 | `in_flight` |
| B17 | 2.2 | Finalize online mente |
| B18 | 2.3 | fallbackDrainLock |
| B19 | 2.4 | Banner sem `online` |
| B20–B22 | 2.5–2.7 | Discard / hydrate / SP / pad |
| B23–B27 | 3.1–3.5 | Auth |
| B28–B32 | 4.1–4.5 | Documento resto |
| B33+ | 5.x | Polimento |

---

## 6. Fontes do scan

Análise de 29/08/2026 sobre `src/`, `app/`, `public/sw.js`, `supabase/migrations/` (1A, 2, 3a/3b, 4 chats 2–3) e docs de execução. Sem alteração de código na sessão do scan.
