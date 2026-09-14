# Performance — Sistema de Coleta MJT

| Campo | Valor |
| :--- | :--- |
| **Status** | `closed` — Fases 1–7 **entregues** (7 = 2026-09-14: paginação 25 já existia; barrels nomeados; singleton de rate-limit; PNG de rubrica; `draft-items-page` apagada) |
| **Authority** | `informative` |
| **Owner** | product / sistema-coleta |
| **Last verified** | 2026-09-14 |
| **Escopo** | Somente `sistema-coleta/` |
| **Pedido** | Análise explícita do humano (atraso ao tocar botões + varredura de desempenho) |
| **Método** | Revisão estática do código. Sem profiler de produção, sem tempos medidos em campo. |

Este documento descreve **o que** deixa o app lento ao toque e **em que ordem** corrigir. Não é rewrite. Não abre ISR em rotas autenticadas. Não enfraquece RLS, `force-dynamic` de dados de coleta, nem a fila offline (ADR 0006).

A implementação só começa com pedido explícito e **um eixo por PR** (uma fase, ou um passo isolado se a fase for grande).

Complementa [`architecture-improvement.md`](./architecture-improvement.md): aquele plano é manutenção e SOLID; este é latência percebida. Onde os eixos coincidem (`cache()` de auth, fim do `new Request("http://localhost")`), fazer **uma vez** e marcar os dois docs.

Fontes normativas que este plano **não** enfraquece: [`AGENTS.md`](../../AGENTS.md), [`nextjs-pwa.md`](../nextjs-pwa.md), [`security.md`](../security.md), [`coding-standards.md`](../coding-standards.md).

---

## 1. Veredito

O atraso que o operador sente ao tocar **qualquer botão de navegação** é real. A causa nº 1 era a falta de `loading.tsx` (**Fase 1 feita**). Auth repetida no mesmo RSC está **fechada na Fase 2** (`cache()`). Mutações de oficina e finalize **não** prendem a form até o hub “frio” (**Fase 4 feita**). O que ainda resta atrás do skeleton:

> O App Router **mantém a tela atual** até o servidor terminar o destino. Cada navegação protegida ainda paga `proxy.ts` (`getClaims`) + queries, com `Cache-Control: no-store` e `force-dynamic`.

Trocar de aba **não** dispara replay da fila (Fase 3); reconectar, Retry e o wizard ainda drenam. Finalize online espera só **esta** coleta; o resto da fila vai em background (Fase 4.2).

O service worker **não** é o culpado. A busca da lista debounceia no cliente; a busca de cliente no wizard também (Fase 3.2). Os chips Todos / Coletadas / Em reparo / Prontas pintam o selecionado no tap (`pendingFilter`) e fazem prefetch da query (Fase 1.5). Oficina já tinha skeleton — o padrão a copiar.

---

## 2. O que já está certo — não mexer

| Item | Por que não é o problema |
| :--- | :--- |
| SW (`public/sw.js`) | Network-only para HTML, API e PDF. Cache-first só em `/_next/static/` e `/icons/`. |
| PDF | Gerado no servidor (`collection-documents`). |
| `next/image` | Já usado em logo e login. |
| Hub `/coletas/[id]` | Os quatro reads já vão em `Promise.all`. |
| Filtro da lista | Chips são URL + `listCollections` no servidor (paginação). Um único pill preto no tap (`pendingFilter`); prefetch dos outros filtros. Sem blur da lista. Sem filtrar os 25 cards locais. Busca continua draft local + debounce para a URL. |
| Shells de `loading.tsx` | `(protected)`, dashboard, coletas, hub, documentos e oficina. Copiar o chrome (header + pulse). |
| `cache()` de sessão e detalhe | Fase 2 / architecture E (2026-09-13). Um admin load e um `getCollectionDetail(id)` por tick RSC. Sem `use cache` / ISR. |
| Banner de pendentes | Fase 3.1 (2026-09-13). Mount só lista IndexedDB. Drain em `online`, Retry e captura. |
| Busca de cliente no wizard | Fase 3.2. Debounce 300 ms + geração; mínimo de 2 caracteres. |
| Submit da oficina | Fase 4.1. `useWorkshopHubSubmit` — action + `router.push` do hub na mesma `startTransition`. Sem `redirect()` nas actions. |
| Finalize online | Fase 4.2. `runAuthenticatedDrainCollection` desta guia; `void drainAllPending` para o resto. |
| Passo do wizard | Fase 4.3. `setStep` + `replace` no tap; `setDraftStep` depois; rollback se o IDB falhar. |
| Draft nas rotas + chunk por passo | Fase 5 (2026-09-13). `itens` / `revisao` / `assinatura` passam `initialDraft`; SignaturePad só no passo de assinatura. |
| Headers de estáticos | Fase 6.1. Catch-all continua `private, no-store`. `/_next/static` immutable; `/icons` `max-age=86400`. |
| Queries de oficina | Fase 6.2. `select` alinhado ao Zod; `createOperationsSupabaseClient` em `cache()`. |
| Lista de documentos | Fase 6.3. Nested artifacts/jobs/`official_code`. Slim `official_code` só se a lista vier vazia. |
| Geist | Fase 6.4. `next/font/google` no `app/layout.tsx` liga `--font-geist-sans`. |
| Viewer de PDF | Fase 6.5. Lazy iframe (`Pré-visualizar`); **não** é o frame Figma M10. |
| Lista `/coletas` | Fase 7.1. Cursor `limit: 25` + **Carregar mais** (já existia). Sem virtualização. |
| Páginas autenticadas dinâmicas | `cookies()` + RLS exigem render no request. O ganho **não** é “tornar o dashboard estático”. |

---

## 3. Como um tap funciona hoje

### 3.1 Navegação (Link que parece botão)

Superfícies: bottom nav, cards da lista, **Nova coleta**, CTAs da oficina, chevron Voltar.

```text
toque no Link
  → proxy.ts          getClaims()          [ainda extra, P0-3]
  → layout protegido  requireAuthenticatedAdministrator()  [cache() — 1× no RSC]
  → page.tsx / DAL    mesmo cache + queries
  → loading.tsx       shell (Fase 1)
  → RSC pronto
  → a tela muda
```

`requireAuthenticatedAdministrator` e `getCollectionDetail(id)` usam `cache()` do React (**Fase 2 / architecture E**). Chamadas repetidas no mesmo tick não reexecutam I/O. Server Action continua request novo e reautentica.

| Destino | Auth I/O no mesmo RSC | Depois disso |
| :--- | ---: | :--- |
| `/dashboard` | **1** (layout / queries / `DashboardRoute` compartilham o cache) | settings + lista |
| `/coletas` | **1** | lista (limit 25 + cursor) |
| `/coletas/nova` | **1** | wizard client hidrata sozinho |
| `/coletas/[id]` | **1** auth + **1** detalhe por id | eventos + service order + budget (paralelo) |

`getClaims` no proxy é **extra**, antes do RSC começar. Não remover o gate.

### 3.2 Mutação (botão que envia e depois navega)

```text
toque
  → startTransition
       mutate (RPC + upload + revalidatePath)
       se ok → router.push(/coletas/[id])
  → loading.tsx do hub (Fase 1)
  → waterfall 3.1 no hub
```

Oficina: `useWorkshopHubSubmit` (`src/_pages/collection-operations/model/use-workshop-hub-submit.ts`). Pending no tap; erro fica na form; não navega antes de `ok`. Finalize: `saveLocalSignature` → drain **desta** coleta → `presentFinalizeSync` → hub / “Salvo neste aparelho” / falha; outras guias drenam sem `await`.

### 3.3 Passo do wizard (sem Server Action)

```text
toque “Revisar coleta” / etapa seguinte
  → setStep + router.replace   (mesmo tick)
  → setDraftStep (IndexedDB)
  → se falhar: rollback do passo + URL + mensagem
```

O paint não espera o write. Draft ausente é falha (`draft_not_found`). Remount da rota irmã ainda pode flashar hydrate — residual, não Fase 5.

---

## 4. Inventário

Cada issue abaixo é um item isolado. Severidade: **P0** = o operador sente no próximo tap; **P1** = amplifica o P0 ou dói em fluxo frequente; **P2** = higiene / escala.

---

### P0-1 — Quase nenhum `loading.tsx` — **feito (Fase 1)**

| | |
| :--- | :--- |
| **Sintoma** | Toque em Link: a tela antiga fica parada até o fetch do destino. |
| **Onde** | Só existia `oficina/loading.tsx`. Agora há shells em `(protected)/`, `dashboard/`, `coletas/`, `coletas/[id]/`, `coletas/[id]/documentos/`. |
| **Por que dói** | Sem boundary de loading, o App Router não mostra shell. Era a causa nº 1 do “botão espera o fetch”. |
| **Não confundir** | `error.tsx` / `global-error.tsx` já existem. Não substituem loading. |

---

### P0-2 — Auth repetida 2–3 vezes por request — **feito (Fase 2 / architecture Fase E)**

| | |
| :--- | :--- |
| **Sintoma** | Cada navegação pagava o mesmo admin load várias vezes. |
| **Onde** | `src/shared/auth/require-admin.ts` e `getCollectionDetail` em `collection-lifecycle/api/queries.ts`. |
| **Por que doía** | Cada pass = 1 cliente + claims + 3 queries. Dashboard = 3–5 passes. Hub = 3 passes. |
| **Entregue** | `cache()` no DAL de sessão e em `getCollectionDetail(id)` (2026-09-13). `ForPage` e as queries do mesmo RSC compartilham o resultado. |
| **Relação** | [`architecture-improvement.md`](./architecture-improvement.md) §4.7 e Fase E — **fechado**. |

---

### P0-3 — `getClaims` no proxy em quase todo HTML

| | |
| :--- | :--- |
| **Sintoma** | Atraso **antes** do RSC, em toda rota casada pelo matcher. |
| **Onde** | `proxy.ts` (exceto `/api/health` e estáticos do matcher). |
| **Por que dói** | Soma-se ao P0-2. Não é bug de segurança. |
| **Não fazer** | Tirar o redirect de anônimo em rota protegida. |

---

### P1-1 — `force-dynamic` + `Cache-Control: private, no-store` em `/(.*)` — **feito (Fase 6.1)**

| | |
| :--- | :--- |
| **Sintoma** | Nenhuma navegação reaproveita HTML/RSC. Assets estáticos também recebem `no-store` no header catch-all. |
| **Onde** | `app/(protected)/layout.tsx` (`dynamic = "force-dynamic"`) e a maioria das pages. `next.config.ts` headers `source: "/(.*)"`. |
| **Por que doía** | `force-dynamic` em dado autenticado é correto. O catch-all `no-store` em `/_next/static` e `/icons` impedia cache de JS/CSS/ícones no HTTP (o SW mitigava só parte). |
| **Entregue** | Catch-all `private, no-store` permanece. Overrides depois: `/_next/static` `public, max-age=31536000, immutable`; `/icons` `public, max-age=86400`. `/sw.js`, `/d/*`, `/verificar/*` intactos. |

---

### P1-2 — Fila offline drena em **todo** mount protegido — **feito (Fase 3.1)**

| | |
| :--- | :--- |
| **Sintoma** | Ao entrar em qualquer tela autenticada, o cliente abria IndexedDB e podia replay serial da fila. |
| **Onde** | `OfflinePendingBanner` em `(protected)/layout.tsx`. Mount agora só lista; `drainAllPending` em `online`, Retry e captura. |
| **Por que doía** | Compete com hidratação e com a navegação que o operador acabou de disparar. Replay é serial por desenho (`offline-runner.ts`) — latência, não bug de idempotência. |
| **Não fazer** | Segundo write path. A fila continua reusando as actions (ADR 0006). |

---

### P1-3 — Mutação: `await` action, **depois** `router.push` — **feito (Fase 4.1)**

| | |
| :--- | :--- |
| **Sintoma** | Botão de oficina fica na mesma tela até RPC + upload + `revalidatePath` terminarem. |
| **Onde** | Sete páginas de oficina. Actions em `collection-operations/api/actions.ts`. |
| **Entregue** | `useWorkshopHubSubmit`: `startTransition` envolve action + `router.push` do hub. Pending no tap; erro permanece na form. |

---

### P1-4 — Finalizar coleta espera a fila inteira — **feito (Fase 4.2)**

| | |
| :--- | :--- |
| **Sintoma** | “Finalizar coleta” (online) não sai do wizard até `drainAllPending` acabar. |
| **Onde** | `collection-capture-page.tsx` |
| **Entregue** | `await runAuthenticatedDrainCollection` (só esta guia) + `void drainAllPending` para o resto. `presentFinalizeSync` inalterado. |

---

### P1-5 — Busca de cliente a cada tecla — **feito (Fase 3.2)**

| | |
| :--- | :--- |
| **Sintoma** | Digitar “Maria” disparava ~5 Server Actions. |
| **Onde** | `new-collection-page.tsx` + `useCustomerSearch` — debounce 300 ms, geração, mínimo de 2 caracteres. |
| **Por que doía** | Cada action reautentica e consulta o banco. Amplifica P0-2. Sem cancelamento do request anterior. |

---

### P1-6 — Wizard hidrata **depois** do mount — **feito (Fase 5.1 / 5.3; legado 7.5)**

| | |
| :--- | :--- |
| **Sintoma** | `/coletas/nova` e passos de rascunho abriam vazios/parciais até IndexedDB + action + drain. |
| **Onde** | `itens` / `revisao` / `assinatura` agora chamam `loadWizardDraftForPage` e passam `initialDraft`. `CollectionCapturePage` pinta a partir das props e hidrata o IDB; `fetchDraftWithItemsAction` fica de fallback. Passos via `next/dynamic` (SignaturePad só em assinatura). |
| **Por que doía** | Dado que o servidor já poderia ter buscado chegava tarde. Um chunk JS grande no aparelho de campo. |
| **Legado** | `draft-items-page.tsx` apagada (Fase 7.5). `draft-review-page.tsx` é só apresentação no wizard. `draft-signature-page.tsx` foi apagada (scan 5.15, `30d8621`). |

---

### P1-7 — Server Action fabrica `Request` para `http://localhost` — **feito (Fase 5.2 / architecture Fase A)**

| | |
| :--- | :--- |
| **Sintoma** | Cada add/patch/remove item serializava JSON duas vezes via shim. |
| **Onde** | `src/_pages/collection-drafts/api/actions.ts` e `src/_app/actions/draft-flow.actions.ts` chamam comandos/queries DTO. HTTP da Fase 1A permanece em `api/http.ts`. |
| **Entregue** | Zero `new Request("http://localhost/...")` nas actions. |
| **Relação** | [`architecture-improvement.md`](./architecture-improvement.md) Fase A — **fechado**. |

---

### P1-8 — Documentos: auth extra + queries em série — **feito (Fase 6.3)**

| | |
| :--- | :--- |
| **Sintoma** | Abrir documentos da coleta espera auth + `documents` + **depois** `document_artifacts`. |
| **Onde** | `collection-documents/api/delivery/queries.server.ts` (`listCollectionDocuments`). Há fetch separado de `official_code` que o detalhe da coleta já tem. |
| **Por que doía** | Duas idas ao banco onde um join/`in` paralelo basta. Auth já é `cache()` (Fase 2). |
| **Entregue** | Nested `document_artifacts` + `document_jobs` + `collections.official_code` num select. Slim `getCollectionOfficialCode` só na lista vazia. |

---

### P1-9 — Viewer de PDF em iframe autenticado — **feito (Fase 6.5)**

| | |
| :--- | :--- |
| **Sintoma** | Tela de documento baixa o PDF inteiro no iframe (redirect + download). |
| **Onde** | `document-viewer-page.tsx`. |
| **Por que doía** | Memória e rede no celular. Geração no servidor está correta; o embed é o custo. |
| **Entregue** | `LazyPdfPreview`: Baixar/abrir nativo no tap de entrada; iframe só após **Pré-visualizar**. Não é o lote visual Figma M10. |

---

### P1-10 — Assinatura PNG no main thread — **feito (Fase 7.4)**

| | |
| :--- | :--- |
| **Sintoma** | Confirmar assinatura faz `toDataURL` + `atob` + `File` antes do upload. |
| **Onde** | `signature-pad.tsx`; `dataUrlToFile` em `workshop-checkin-page.tsx` (e equivalentes). |
| **Por que doía** | Canvas grande trava o thread. Aceitável para rubrica pequena; não reutilizar para foto de evidência. |
| **Entregue** | Pad permanece ~parent × 180 PNG. `signatureDataUrlToPngFile` único em check-in e entrega. Evidência continua `validateEvidenceFile`, não o pad. |

---

### P1-11 — `select("*")` nas queries de oficina — **feito (Fase 6.2)**

| | |
| :--- | :--- |
| **Sintoma** | Hub e oficina puxam linha larga. |
| **Onde** | `collection-operations/api/queries.ts` — `service_orders`, `service_order_items`, `delivery_terms`, etc. Cada função cria cliente novo (`createOperationsSupabaseClient`). |
| **Por que doía** | Payload maior que o view-model. Drafts já usam lista de colunas — copiar o hábito. |
| **Entregue** | Colunas 1:1 com Zod. `createOperationsSupabaseClient` em `cache()`. Check-in já era explícito. |

---

### P1-12 — Passo do wizard espera IndexedDB antes de pintar — **feito (Fase 4.3)**

| | |
| :--- | :--- |
| **Sintoma** | “Revisar coleta” / “Emitir guia” só muda o passo depois de `setDraftStep`. |
| **Onde** | `CollectionCapturePage` `onStep` |
| **Entregue** | `setStep` + `replace` imediatos; `setDraftStep` depois; rollback + mensagem se o write falhar. Residual: remount da rota irmã pode flashar hydrate. |

---

### P2-1 — Geist no CSS, sem `next/font` — **feito (Fase 6.4)**

| | |
| :--- | :--- |
| **Sintoma** | `--font-geist-sans` no `globals.css`; `app/layout.tsx` não carrega a fonte. |
| **Por que doía** | Fallback do sistema + possível shift no primeiro paint. |
| **Entregue** | `Geist` via `next/font/google` no `app/layout.tsx`; `--font-geist-sans` no `<html>`. |

---

### P2-2 — Lista sem virtualização — **feito (Fase 7.1; paginação já existia)**

| | |
| :--- | :--- |
| **Sintoma** | O inventário citava `limit: 50` e filtro local. |
| **Entregue** | `/coletas` e `/coletas/rascunhos` já usam `limit: 25` + cursor **Carregar mais**. Dashboard pede `limit: 2`. Filtros da lista são URL + servidor (Fase 1.5). Virtualização adiada até o limite passar de ~50. |

---

### P2-3 — Barrel `export *` no slice de operations — **feito (Fase 7.2)**

| | |
| :--- | :--- |
| **Sintoma** | `collection-operations/index.server.ts` e `api/index.server.ts` reexportavam com `export *`. |
| **Entregue** | API pública nomeada (padrão de lifecycle/drafts). `app/` e `_app/` continuam nos barrels `index.ts` / `index.server.ts` (Fase F). Sem sidestep. |

---

### P2-4 — Rate-limit cria client service a cada chamada — **feito (Fase 7.3)**

| | |
| :--- | :--- |
| **Sintoma** | Login e download público construíam `createClient` por chamada. |
| **Onde** | `shared/lib/rate-limit.server.ts`. |
| **Entregue** | `getRateLimitClient()` singleton de módulo. RPC, janelas, HMAC e fail-closed intactos. Sem `cache()` do React (cliente service-role, sem cookies). |

---

### P2-5 — `Button` dentro de `Link` no dashboard — **feito (Fase 1.4)**

| | |
| :--- | :--- |
| **Sintoma** | HTML inválido (`<a><button>`). |
| **Onde** | `dashboard-page.tsx` — **Nova coleta** e **Configurações da Empresa** agora são `PendingNavLink` + `buttonClassName`. |
| **Por que dói** | Não causava o atraso; piorava alvo de toque e a11y. |

---

## 5. Plano incremental

Ordem = o que o operador sente primeiro. **Uma fase por PR**, salvo o humano pedir um passo só. Gate de cada PR: `npm run check` em `sistema-coleta`. Sem misturar com rewrite FSD, backup (Fase 4 Chat 5), nem gates remotos da Fase 1A.

Não tornar rotas autenticadas estáticas. Não cachear HTML de coleta no SW.

---

### Fase 1 — Feedback instantâneo de navegação — **feito** (1.5 em 2026-09-07)

**Objetivo:** o tap troca o chrome **antes** do dado chegar. É o P0 que o humano descreveu.

**Não faz:** mudar auth, fila offline, headers globais, nem mutações.

#### Passo 1.1 — Shell em `(protected)/loading.tsx` — **feito**

**Faz:** skeleton no mesmo chrome mobile (header 80px + cards pulse + bottom nav), via `ProtectedRouteSkeleton` (padrão de `oficina/loading.tsx`).

**Aceite:** toque Início ↔ Coletas mostra o pulse imediatamente.

#### Passo 1.2 — Shell por destino pesado — **feito**

**Faz:** `loading.tsx` em `dashboard/`, `coletas/`, `coletas/[id]/` (hub) e `coletas/[id]/documentos/`. Oficinas já tinham.

**Aceite:** abrir um card de coleta mostra skeleton do hub, não a lista congelada.

#### Passo 1.3 — Estado pendente no `Link` — **feito**

**Faz:** `PendingNavLink` + `useLinkStatus` no bottom nav, cards, CTA operacional, Voltar, Ver rascunhos e Ver documentos.

**Aceite:** o alvo tocado muda de estilo no mesmo frame, sem esperar RSC.

#### Passo 1.4 — `Link` estilizado, sem `Button` interno — **feito**

**Faz:** dashboard — **Nova coleta** e **Configurações da Empresa** como `PendingNavLink` com `buttonClassName` (P2-5).

**Aceite:** um único elemento focável; sem `<button>` dentro de `<a>`.

#### Passo 1.5 — Chips de filtro da lista — **feito** (2026-09-07)

**Sintoma:** Todos / Coletadas / Em reparo / Prontas eram `button` + `router.replace`. O pill só mudava depois do RSC (`listCollections`). `loading.tsx` de `/coletas` não cobre troca de `?filter=` na mesma rota.

**Não faz:** `useLinkStatus` no chip corrente (deixava dois pills pretos). Não aplica opacity na lista. Não usa `prefetch={false}`.

**Faz:** um `pendingFilter` local — só o pill tocado fica selecionado. Os outros são `Link` com `prefetch={true}` + `router.prefetch` no mount. `scroll={false}`. A query continua no servidor (URL + DAL). Sem filtrar `initialItems` no cliente.

**Aceite:** um único pill preto no tap; a lista não embaça; o destino já foi prefetchado; paginação/`limit` 25 intactos.

---

### Fase 2 — Um auth por request — **feita** (2026-09-13)

**Objetivo:** uma resolução de administrador por tick de servidor.

**Não faz:** cache entre requests (`use cache` / ISR) em dado de coleta. Proxy continua a recusar anônimo.

#### Passo 2.1 — `cache()` em `requireAuthenticatedAdministrator` — **feito**

**Faz:** `export const requireAuthenticatedAdministrator = cache(async () => { ... })` (API do React). Layout, queries e `DashboardRoute` passam a compartilhar o resultado.

**Aceite:** no mesmo request, a função pesada roda **uma** vez. Testes de auth existentes verdes.

**Relação:** [`architecture-improvement.md`](./architecture-improvement.md) Fase E.

#### Passo 2.2 — Não reautenticar a página só para pegar `userId` — **feito** (via 2.1)

**Faz:** páginas `nova` / `itens` / `revisao` / `assinatura` usam o valor já cacheado (o `cache()` do 2.1 já resolve). Opcional: não chamar de novo se o layout puder passar ator por padrão do projeto — **sem** context client.

**Aceite:** zero regressão de redirect para `/login` ou Access Denied. Chamadas de página permanecem; o I/O colapsa no `cache()`.

#### Passo 2.3 — `cache()` opcional em `getCollectionDetail(id)` — **feito**

**Faz:** memoizar por `collectionId` no mesmo request (hub + loaders de oficina se ainda duplicarem).

**Aceite:** duas leituras do mesmo id no mesmo render não disparam dois RPCs.

---

### Fase 3 — Não competir com a navegação — **feita** (2026-09-13)

**Objetivo:** o mount de uma tela nova não dispara sync em massa nem action por tecla.

#### Passo 3.1 — Parar o drain automático no layout — **feito**

**Faz:** `OfflinePendingBanner` só lista pendentes no mount. `drainAllPending` em: evento `online`, botão Retry, e o fluxo de captura (já existe).

**Aceite:** trocar de aba do bottom nav **não** inicia replay. Reconectar e Retry ainda sincronizam. ADR 0006 intacto.

#### Passo 3.2 — Debounce da busca de cliente — **feito**

**Faz:** 300 ms; ignorar resposta fora de ordem (geração); não disparar com menos de 2 caracteres (já existia o mínimo).

**Aceite:** um nome de 5 letras = **uma** action após pausa, não cinco.

---

### Fase 4 — Mutações sem prender a tela — **feita** (2026-09-13)

**Objetivo:** o botão responde na hora; o trabalho pesado não bloqueia a troca de rota quando for seguro.

**Não faz:** `useOptimistic` em todo o app. Não pular RPC. Não segundo write path.

#### Passo 4.1 — Oficina: pending imediato; navegar sem esperar o hub “frio” — **feito**

**Faz:** `useWorkshopHubSubmit` — `startTransition` envolve **action + push**. Pending no primeiro tap (antes de `dataUrlToFile` no check-in/entrega). Double-tap bloqueado nas sete páginas.

**Aceite:** após sucesso, o operador vê o skeleton do hub (Fase 1) em vez da form morta.

#### Passo 4.2 — Finalizar: não bloquear no drain completo — **feito**

**Faz:** persistir assinatura no IndexedDB; se online, `await runAuthenticatedDrainCollection` (esta guia) e `void runAuthenticatedDrain` (resto). Erro desta coleta continua em `presentFinalizeSync` / painel de falha.

**Aceite:** “Finalizar coleta” não espera o replay de **outras** coletas da fila. Idempotência e `p_client_item_id` intactos.

#### Passo 4.3 — Passo do wizard otimista — **feito**

**Faz:** `setStep(next)` imediato; `router.replace` no mesmo tick; `setDraftStep` em seguida; rollback + mensagem se o write local falhar. Draft ausente é falha.

**Aceite:** “Revisar coleta” muda de etapa no mesmo tap.

---

### Fase 5 — Dados do wizard no servidor + actions diretas — **feita** (2026-09-13)

**Objetivo:** menos waterfall no client; menos JSON interno.

**Não faz:** apagar `/api/collections`. Não criar `entities/`.

#### Passo 5.1 — Draft como props da rota — **feito**

**Faz:** `itens` / `revisao` / `assinatura` buscam o draft no Server Component (`loadWizardDraftForPage`) e passam `initialDraft`. Resume em `nova` continua redirect para `/itens`. O client pinta com as props e hidrata o IDB; IndexedDB com mutações pendentes vence. Fallback `fetchDraftWithItemsAction` se o RSC não trouxe draft.

**Aceite:** com rede, o primeiro paint do passo já tem itens. Offline continua IndexedDB-first.

#### Passo 5.2 — Action chama o comando, não o `Request` fake — **feito** (architecture Fase A)

**Faz:** `addItemToDraftAction` etc. chamam funções DTO em `commands.ts` / `queries.ts`. Fim de `new Request("http://localhost/...")`.

**Aceite:** zero shim localhost nas actions. Contrato HTTP da Fase 1A inalterado.

**Relação:** [`architecture-improvement.md`](./architecture-improvement.md) Fase A.

#### Passo 5.3 — Fatiar `CollectionCapturePage` — **feito**

**Faz:** `next/dynamic` por passo (cliente / itens / revisão / assinatura). `SignaturePad` só no chunk de assinatura. `CollectionCapturePage` permanece o controlador offline.

**Aceite:** abrir “Nova coleta” não parseia SignaturePad até o passo de assinatura.

---

### Fase 6 — Headers, payload e higiene de leitura — **feita** (2026-09-14)

**Objetivo:** menos byte e menos round-trip **depois** do tap já parecer instantâneo.

#### Passo 6.1 — `Cache-Control` só onde precisa `no-store` — **feito**

**Faz:** manter `private, no-store` em HTML autenticado, `/api`, `/d/*`, `/verificar/*`. Overrides depois do catch-all: `/_next/static` immutable; `/icons` um dia (nomes não hashed).

**Aceite:** Response headers de um JS em `/_next/static/` não são `no-store`. Páginas de coleta continuam sem cache compartilhado.

#### Passo 6.2 — Colunas explícitas nas queries de oficina — **feito**

**Faz:** `select` alinhado aos schemas Zod já existentes. `createOperationsSupabaseClient` em `cache()`.

**Aceite:** o hub não pede colunas que o view-model descarta.

#### Passo 6.3 — Documentos em paralelo / um round-trip — **feito**

**Faz:** nested artifacts + jobs + `collections.official_code`. Slim `official_code` só na lista vazia. Auth via `cache()` da Fase 2.

**Aceite:** uma ida a menos ao banco no caminho feliz da lista de documentos.

#### Passo 6.4 — Geist via `next/font` — **feito**

**Faz:** carregar no `app/layout.tsx` e ligar a variável CSS.

**Aceite:** `--font-geist-sans` resolve; sem flash de fonte genérica se a rede permitir.

#### Passo 6.5 — PDF viewer (quando doer em campo) — **feito**

**Faz:** link de download + abrir nativo; iframe só após **Pré-visualizar**. Sem processar PDF no client. **Não** é o frame Figma M10.

**Aceite:** a tela de documento não aloca o PDF inteiro só para “entrar” na página, se o operador só quer o link.

---

### Fase 7 — Higiene — **feita** (2026-09-14)

Não era P0. Entregue no mesmo PR porque o humano pediu a fase.

| Passo | Issue | Faz |
| :--- | :--- | :--- |
| 7.1 | P2-2 | **Feito (já existia).** Cursor `limit: 25` em `/coletas` e rascunhos; dashboard `limit: 2`. Sem virtualização. |
| 7.2 | P2-3 | **Feito.** Exports nomeados nos barrels de operations. Sem sidestep da Fase F. |
| 7.3 | P2-4 | **Feito.** Singleton `getRateLimitClient()`. RPC e limites intactos. |
| 7.4 | P1-10 | **Feito.** Pad 180px PNG; helper único; não reusar para foto. |
| 7.5 | P1-6 legado | **Feito.** `draft-items-page.tsx` apagada. `draft-review-page.tsx` permanece. |

---

## 6. Ordem e dependências

```text
Fase 1  loading + pending Link     → feita
Fase 2  cache() auth + detalhe     → feita (2026-09-13; = architecture Fase E)
Fase 3  drain + debounce           → feita (2026-09-13; mount lista só; reconectar/Retry/captura drenam)
Fase 4  mutações                   → feita (2026-09-13; oficina transition; finalize só desta coleta; passo otimista)
Fase 5  wizard + actions diretas   → feita (2026-09-13; 5.1 props RSC; 5.2 = architecture Fase A; 5.3 dynamic por passo)
Fase 6  headers / select / font    → feita (2026-09-14; 6.5 = lazy iframe, não Figma M10)
Fase 7  higiene                    → feita (2026-09-14; 7.1 paginação 25 já existia; 7.2 barrels nomeados; 7.3 singleton rate-limit; 7.4 PNG rubrica; 7.5 draft-items órfã apagada)
```

Não juntar Fase 1 com Fase 5 no mesmo PR. Não juntar performance com Chat 5 de backup. Fase 7 fechou o plano de latência percebida; P0-3 (`getClaims` no proxy) permanece fora deste eixo.

---

## 7. Relação com a documentação existente

| Documento | Papel |
| :--- | :--- |
| [`architecture-improvement.md`](./architecture-improvement.md) | Manutenção. Fases A e E **são** os passos 5.2 e 2.1 daqui — ambas **feitas**. |
| [`nextjs-pwa.md`](../nextjs-pwa.md) | SW e fila. Este plano não muda a política “SW só de shell”. |
| [`decisions/0006-offline-draft-queue.md`](../decisions/0006-offline-draft-queue.md) | Fila oficial. Fase 3: **quando** drena (não cada paint do layout). Fase 4.2: finalize online espera só **esta** coleta. Fase 4.3: URL do wizard no tap, IDB depois, com rollback. |
| [`execution/phase-4-hardening-launch.md`](../execution/phase-4-hardening-launch.md) | PWA/offline já verdes. Performance não é um chat da Fase 4. |
| [`http-api.md`](../http-api.md) | Contrato HTTP intacto. |
| [`figma-prototype-frames.md`](../design-system/figma-prototype-frames.md) | Inventário visual. Fase 6.5 não implementa M10. |

Sem ADR novo de plataforma. A Fase 4.2 emendou [ADR 0006](../decisions/0006-offline-draft-queue.md) (finalize online aguarda só a fila desta coleta). A Fase 4.3 emendou o timing B12: `replace` antes do write local, com rollback.

---

## 8. Critérios de sucesso

O app está mais rápido **para o operador** quando:

1. Tocar bottom nav, card, Voltar **ou chip de filtro da lista** mostra feedback no mesmo instante (Fase 1, incl. 1.5).
2. Um request autenticado resolve o administrador **uma** vez (Fase 2).
3. Trocar de tela **não** dispara `drainAllPending` sozinho (Fase 3).
4. Confirmar oficina / finalizar coleta **não** prende a UI na form até o hub inteiro pintar (Fases 1 + 4).
5. Busca de cliente não martela o servidor a cada tecla (Fase 3).
6. Nenhuma RPC, RLS, número oficial, PDF ou contrato HTTP da Fase 1A foi “otimizado” apagando regra.

Se um PR não move esses ponteiros, não é trabalho de performance — é ruído.

---

## 9. Fontes

- Next.js — [Loading UI and Streaming](https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming)
- Next.js — [Authentication (DAL + `cache()`)](https://nextjs.org/docs/app/guides/authentication)
- Next.js — [`useLinkStatus`](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- Next.js — [Data Security / Data Access Layer](https://nextjs.org/docs/app/guides/data-security)
- Local: revisão de `proxy.ts`, `(protected)/layout.tsx`, `require-admin.ts`, `next.config.ts`, `collection-capture-page.tsx`, `workshop-checkin-page.tsx`, `use-workshop-hub-submit.ts`, `offline-pending-banner.tsx`, `queries.ts` (lifecycle e operations), `collections-list-page.tsx`
- Data da revisão: 2026-08-29; chips da lista em 2026-09-07; Fase 4 e Fase 5 em 2026-09-13; Fase 6 e Fase 7 em 2026-09-14
