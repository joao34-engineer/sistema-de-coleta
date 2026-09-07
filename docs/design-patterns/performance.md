# Performance — Sistema de Coleta MJT

| Campo | Valor |
| :--- | :--- |
| **Status** | `planned` — Fases 2–7; **Fase 1 entregue** (shells + pending Link + CTAs) |
| **Authority** | `informative` |
| **Owner** | product / sistema-coleta |
| **Last verified** | 2026-08-29 |
| **Escopo** | Somente `sistema-coleta/` |
| **Pedido** | Análise explícita do humano (atraso ao tocar botões + varredura de desempenho) |
| **Método** | Revisão estática do código. Sem profiler de produção, sem tempos medidos em campo. |

Este documento descreve **o que** deixa o app lento ao toque e **em que ordem** corrigir. Não é rewrite. Não abre ISR em rotas autenticadas. Não enfraquece RLS, `force-dynamic` de dados de coleta, nem a fila offline (ADR 0006).

A implementação só começa com pedido explícito e **um eixo por PR** (uma fase, ou um passo isolado se a fase for grande).

Complementa [`architecture-improvement.md`](./architecture-improvement.md): aquele plano é manutenção e SOLID; este é latência percebida. Onde os eixos coincidem (`cache()` de auth, fim do `new Request("http://localhost")`), fazer **uma vez** e marcar os dois docs.

Fontes normativas que este plano **não** enfraquece: [`AGENTS.md`](../../AGENTS.md), [`nextjs-pwa.md`](../nextjs-pwa.md), [`security.md`](../security.md), [`coding-standards.md`](../coding-standards.md).

---

## 1. Veredito

O atraso que o operador sente ao tocar **qualquer botão de navegação** é real e tem causa única:

> O App Router **mantém a tela atual** até o servidor terminar o destino. Quase não há `loading.tsx`. Cada navegação protegida paga proxy + auth repetida + queries, com `Cache-Control: no-store` e `force-dynamic`.

Há um segundo atraso, nos botões de **mutação**: a UI espera a Server Action (e às vezes a fila offline inteira) **antes** de `router.push`.

O service worker **não** é o culpado. Listas locais (filtro/busca de coletas) já são instantâneas. Oficina já tem o único skeleton do app — é o padrão a copiar.

---

## 2. O que já está certo — não mexer

| Item | Por que não é o problema |
| :--- | :--- |
| SW (`public/sw.js`) | Network-only para HTML, API e PDF. Cache-first só em `/_next/static/` e `/icons/`. |
| PDF | Gerado no servidor (`collection-documents`). |
| `next/image` | Já usado em logo e login. |
| Hub `/coletas/[id]` | Os quatro reads já vão em `Promise.all`. |
| Filtro da lista | Busca e chips em `CollectionsListPage` são estado local. |
| `oficina/loading.tsx` | Único `loading.tsx` do app. Copiar o chrome (header + pulse). |
| Páginas autenticadas dinâmicas | `cookies()` + RLS exigem render no request. O ganho **não** é “tornar o dashboard estático”. |

---

## 3. Como um tap funciona hoje

### 3.1 Navegação (Link que parece botão)

Superfícies: bottom nav, cards da lista, **Nova coleta**, CTAs da oficina, chevron Voltar.

```text
toque no Link
  → proxy.ts          getClaims()
  → layout protegido  requireAuthenticatedAdministrator()   [4 round-trips Supabase]
  → page.tsx          auth de novo + queries
  → RSC pronto
  → só então a tela muda
```

Sem `loading.tsx` no grupo `(protected)`, o React **não** troca o chrome. O operador vê a tela velha congelada.

`requireAuthenticatedAdministrator()` em cada chamada: cliente Supabase + `getClaims` + `profiles` + `organization_memberships` + `organizations`.

| Destino | Chamadas de auth no mesmo request | Depois disso |
| :--- | ---: | :--- |
| `/dashboard` | 3 (layout + `listCollections` + `DashboardRoute`) | settings + lista |
| `/coletas` | 2 (layout + `listCollections`) | lista (limit 50) |
| `/coletas/nova` | 2 (layout + page) | wizard client hidrata sozinho |
| `/coletas/[id]` | 3 (layout + detalhe + eventos) | + service order + budget (paralelo) |

`getClaims` no proxy é **extra**, antes do RSC começar. Não remover o gate — só não repetir o restante.

### 3.2 Mutação (botão que envia e depois navega)

```text
toque
  → await serverAction()     RPC + upload + revalidatePath
  → startTransition(push)    só agora começa a navegação
  → de novo o waterfall 3.1 no hub
```

`startTransition` envolve o **push**, não a espera.

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

### P0-2 — Auth repetida 2–3 vezes por request

| | |
| :--- | :--- |
| **Sintoma** | Cada navegação paga o mesmo admin load várias vezes. |
| **Onde** | `src/shared/auth/require-admin.ts`. Chamado no layout, em `listCollections` / `getCollectionDetail` / `getCollectionEvents`, e de novo em `DashboardRoute`. Páginas `nova` / `itens` / `revisao` / `assinatura` chamam outra vez além do layout. |
| **Por que dói** | Cada pass = 1 cliente + claims + 3 queries. Dashboard = 3 passes. Hub = 3 passes. |
| **Relação** | Mesmo eixo que [`architecture-improvement.md`](./architecture-improvement.md) §4.7 e Fase E. |

---

### P0-3 — `getClaims` no proxy em quase todo HTML

| | |
| :--- | :--- |
| **Sintoma** | Atraso **antes** do RSC, em toda rota casada pelo matcher. |
| **Onde** | `proxy.ts` (exceto `/api/health` e estáticos do matcher). |
| **Por que dói** | Soma-se ao P0-2. Não é bug de segurança. |
| **Não fazer** | Tirar o redirect de anônimo em rota protegida. |

---

### P1-1 — `force-dynamic` + `Cache-Control: private, no-store` em `/(.*)`

| | |
| :--- | :--- |
| **Sintoma** | Nenhuma navegação reaproveita HTML/RSC. Assets estáticos também recebem `no-store` no header catch-all. |
| **Onde** | `app/(protected)/layout.tsx` (`dynamic = "force-dynamic"`) e a maioria das pages. `next.config.ts` headers `source: "/(.*)"`. |
| **Por que dói** | `force-dynamic` em dado autenticado é correto. O catch-all `no-store` em `/_next/static` e `/icons` impede cache de JS/CSS/ícones no HTTP (o SW mitiga só parte). |

---

### P1-2 — Fila offline drena em **todo** mount protegido

| | |
| :--- | :--- |
| **Sintoma** | Ao entrar em qualquer tela autenticada, o cliente abre IndexedDB e pode replay serial da fila. |
| **Onde** | `OfflinePendingBanner` em `(protected)/layout.tsx` → `drainAllPending` no `useEffect`. |
| **Por que dói** | Compete com hidratação e com a navegação que o operador acabou de disparar. Replay é serial por desenho (`offline-runner.ts`) — latência, não bug de idempotência. |
| **Não fazer** | Segundo write path. A fila continua reusando as actions (ADR 0006). |

---

### P1-3 — Mutação: `await` action, **depois** `router.push`

| | |
| :--- | :--- |
| **Sintoma** | Botão de oficina fica na mesma tela até RPC + upload + `revalidatePath` terminarem. |
| **Onde** | `workshop-checkin-page.tsx` e o mesmo padrão em orçamento, aprovação, progresso, NF-e, entrega, cancelar/reabrir. `phase3-flow.actions.ts` chama `revalidatePath(/coletas/[id])`. |
| **Por que dói** | Spinner (quando existe) é honesto; a navegação só começa no fim. Em seguida o hub sofre P0-1 + P0-2. |

---

### P1-4 — Finalizar coleta espera a fila inteira

| | |
| :--- | :--- |
| **Sintoma** | “Finalizar coleta” (online) não sai do wizard até `drainAllPending` acabar. |
| **Onde** | `collection-capture-page.tsx` — `saveLocalSignature` → `await drainAllPending` → só então `onOpenCollection` / `router.push`. |
| **Por que dói** | Pode incluir criar cliente, rascunho, itens, assinatura e finalize. O tap parece morto além do `isLoading`. |

---

### P1-5 — Busca de cliente a cada tecla

| | |
| :--- | :--- |
| **Sintoma** | Digitar “Maria” dispara ~5 Server Actions. |
| **Onde** | `new-collection-page.tsx` — `onChange` → `handleSearch` → `searchCustomersAction` sem debounce. |
| **Por que dói** | Cada action reautentica e consulta o banco. Amplifica P0-2. Sem cancelamento do request anterior. |

---

### P1-6 — Wizard hidrata **depois** do mount

| | |
| :--- | :--- |
| **Sintoma** | `/coletas/nova` e passos de rascunho abrem vazios/parciais até IndexedDB + action + drain. |
| **Onde** | Rotas passam só `actor` + `resumeDraftId`. `CollectionCapturePage` (~466 linhas, `"use client"`) no `useEffect`: store → `reload` → `fetchDraftWithItemsAction` se faltar local → `drainIfOnline`. |
| **Por que dói** | Dado que o servidor já poderia ter buscado chega tarde. Um chunk JS grande no aparelho de campo. |
| **Legado** | `draft-items-page.tsx` / `draft-review-page.tsx` ainda fazem fetch no mount se `initialDraft` faltar (rotas atuais usam o wizard; o padrão permanece perigoso). `draft-signature-page.tsx` foi apagada (scan 5.15, `30d8621`). |

---

### P1-7 — Server Action fabrica `Request` para `http://localhost`

| | |
| :--- | :--- |
| **Sintoma** | Cada add/patch/remove item (e busca de cliente no fluxo draft) serializa JSON duas vezes. |
| **Onde** | `src/_pages/collection-drafts/api/actions.ts`; `src/_app/actions/draft-flow.actions.ts`. |
| **Por que dói** | CPU + parse + auth de novo no handler HTTP-shaped. Stack trace ilegível. |
| **Relação** | [`architecture-improvement.md`](./architecture-improvement.md) Fase A — **mesmo PR**, dois benefícios (manutenção + latência). |

---

### P1-8 — Documentos: auth extra + queries em série

| | |
| :--- | :--- |
| **Sintoma** | Abrir documentos da coleta espera auth + `documents` + **depois** `document_artifacts`. |
| **Onde** | `collection-documents/api/delivery/queries.server.ts` (`listCollectionDocuments`). Há fetch separado de `official_code` que o detalhe da coleta já tem. |
| **Por que dói** | Duas idas ao banco onde um join/`in` paralelo + `cache()` de auth bastam. |

---

### P1-9 — Viewer de PDF em iframe autenticado

| | |
| :--- | :--- |
| **Sintoma** | Tela de documento baixa o PDF inteiro no iframe (redirect + download). |
| **Onde** | `document-viewer-page.tsx`. |
| **Por que dói** | Memória e rede no celular. Geração no servidor está correta; o embed é o custo. |

---

### P1-10 — Assinatura PNG no main thread

| | |
| :--- | :--- |
| **Sintoma** | Confirmar assinatura faz `toDataURL` + `atob` + `File` antes do upload. |
| **Onde** | `signature-pad.tsx`; `dataUrlToFile` em `workshop-checkin-page.tsx` (e equivalentes). |
| **Por que dói** | Canvas grande trava o thread. Aceitável para rubrica pequena; não reutilizar para foto de evidência. |

---

### P1-11 — `select("*")` nas queries de oficina

| | |
| :--- | :--- |
| **Sintoma** | Hub e oficina puxam linha larga. |
| **Onde** | `collection-operations/api/queries.ts` — `service_orders`, `service_order_items`, `delivery_terms`, etc. Cada função cria cliente novo (`createOperationsSupabaseClient`). |
| **Por que dói** | Payload maior que o view-model. Drafts já usam lista de colunas — copiar o hábito. |

---

### P1-12 — Passo do wizard espera IndexedDB antes de pintar

| | |
| :--- | :--- |
| **Sintoma** | “Revisar coleta” / “Emitir guia” só muda o passo depois de `setDraftStep`. |
| **Onde** | `CollectionCapturePage` `onStep`: `await setDraftStep` → `setStep`. |
| **Por que dói** | IDB é rápido, mas o tap não é otimista. Um `setStep` imediato + write em background (com rollback se falhar) basta. |

---

### P2-1 — Geist no CSS, sem `next/font`

| | |
| :--- | :--- |
| **Sintoma** | `--font-geist-sans` no `globals.css`; `app/layout.tsx` não carrega a fonte. |
| **Por que dói** | Fallback do sistema + possível shift no primeiro paint. |

---

### P2-2 — Lista sem virtualização (hoje limit 50)

| | |
| :--- | :--- |
| **Sintoma** | `/coletas` e dashboard pedem `limit: 50`. Filtro local re-renderiza todos os cards. Sem `React.memo` nas linhas. |
| **Por que dói** | Ok no volume atual. Dói se o limite crescer sem paginação/virtualização. |

---

### P2-3 — Barrel `export *` no slice de operations

| | |
| :--- | :--- |
| **Sintoma** | `collection-operations/index.server.ts` e `api/index.server.ts` reexportam tudo. |
| **Por que dói** | Grafo de import mais largo para o bundler. Preferir import direto. Server-only, risco baixo. |

---

### P2-4 — Rate-limit cria client service a cada chamada

| | |
| :--- | :--- |
| **Sintoma** | Login e download público constroem `createClient` por request. |
| **Onde** | `shared/lib/rate-limit.server.ts`. |
| **Por que dói** | Segurança está correta (RPC + limite). Singleton de módulo reduz só o setup. Não afrouxar o limite. |

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

### Fase 1 — Feedback instantâneo de navegação — **feito**

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

---

### Fase 2 — Um auth por request

**Objetivo:** uma resolução de administrador por tick de servidor.

**Não faz:** cache entre requests (`use cache` / ISR) em dado de coleta. Proxy continua a recusar anônimo.

#### Passo 2.1 — `cache()` em `requireAuthenticatedAdministrator`

**Faz:** `export const requireAuthenticatedAdministrator = cache(async () => { ... })` (API do React). Layout, queries e `DashboardRoute` passam a compartilhar o resultado.

**Aceite:** no mesmo request, a função pesada roda **uma** vez. Testes de auth existentes verdes.

**Relação:** [`architecture-improvement.md`](./architecture-improvement.md) Fase E. Se já estiver feito lá, só marcar este passo.

#### Passo 2.2 — Não reautenticar a página só para pegar `userId`

**Faz:** páginas `nova` / `itens` / `revisao` / `assinatura` usam o valor já cacheado (o `cache()` do 2.1 já resolve). Opcional: não chamar de novo se o layout puder passar ator por padrão do projeto — **sem** context client.

**Aceite:** zero regressão de redirect para `/login` ou Access Denied.

#### Passo 2.3 — `cache()` opcional em `getCollectionDetail(id)`

**Faz:** memoizar por `collectionId` no mesmo request (hub + loaders de oficina se ainda duplicarem).

**Aceite:** duas leituras do mesmo id no mesmo render não disparam dois RPCs.

---

### Fase 3 — Não competir com a navegação

**Objetivo:** o mount de uma tela nova não dispara sync em massa nem action por tecla.

#### Passo 3.1 — Parar o drain automático no layout

**Faz:** `OfflinePendingBanner` só lista pendentes no mount. `drainAllPending` em: evento `online`, botão Retry, e o fluxo de captura (já existe).

**Aceite:** trocar de aba do bottom nav **não** inicia replay. Reconectar e Retry ainda sincronizam. ADR 0006 intacto.

#### Passo 3.2 — Debounce da busca de cliente

**Faz:** 300–400 ms; ignorar/cancelar resposta fora de ordem; não disparar com menos de 2 caracteres (já existe o mínimo).

**Aceite:** um nome de 5 letras = **uma** action após pausa, não cinco.

---

### Fase 4 — Mutações sem prender a tela

**Objetivo:** o botão responde na hora; o trabalho pesado não bloqueia a troca de rota quando for seguro.

**Não faz:** `useOptimistic` em todo o app. Não pular RPC. Não segundo write path.

#### Passo 4.1 — Oficina: pending imediato; navegar sem esperar o hub “frio”

**Faz:** `isSubmitting` no primeiro tap (já existe em parte). Após `ok`, o `router.push` pode ficar no `startTransition` **junto** com a action, ou ir a um hub que já tem `loading.tsx` (Fase 1). Preferir `<form action={...}>` + `useFormStatus` onde couber, no estilo login/settings.

**Aceite:** após sucesso, o operador vê o skeleton do hub (Fase 1) em vez da form morta.

#### Passo 4.2 — Finalizar: não bloquear no drain completo

**Faz:** persistir assinatura no IndexedDB; se online, disparar drain **sem** obrigar `await` de toda a fila antes de sair — **ou** ir para o estado “Salvo neste aparelho” / hub assim que o rascunho local estiver consistente. Erro de sync continua no painel de pendentes.

**Aceite:** “Finalizar coleta” não espera o replay de **outras** coletas da fila. Idempotência e `p_client_item_id` intactos.

#### Passo 4.3 — Passo do wizard otimista

**Faz:** `setStep(next)` imediato; `setDraftStep` em seguida; rollback + mensagem se o write local falhar.

**Aceite:** “Revisar coleta” muda de etapa no mesmo tap.

---

### Fase 5 — Dados do wizard no servidor + actions diretas

**Objetivo:** menos waterfall no client; menos JSON interno.

**Não faz:** apagar `/api/collections`. Não criar `entities/`.

#### Passo 5.1 — Draft como props da rota

**Faz:** `itens` / `revisao` / `assinatura` (e resume em `nova`) buscam o draft no Server Component e passam `initialDraft` / itens. O client só hidrata o store local se precisar.

**Aceite:** com rede, o primeiro paint do passo já tem itens. Offline continua IndexedDB-first.

#### Passo 5.2 — Action chama o comando, não o `Request` fake

**Faz:** `addItemToDraftAction` etc. chamam funções DTO em `drafts.server` / commands extraídos. Fim de `new Request("http://localhost/...")`.

**Aceite:** zero shim localhost nas actions. Contrato HTTP da Fase 1A inalterado.

**Relação:** [`architecture-improvement.md`](./architecture-improvement.md) Fase A.

#### Passo 5.3 — Fatiar `CollectionCapturePage`

**Faz:** `next/dynamic` por passo (cliente / itens / revisão / assinatura) ou voltar a páginas por rota já existentes, com o mesmo store.

**Aceite:** abrir “Nova coleta” não parseia SignaturePad até o passo de assinatura.

---

### Fase 6 — Headers, payload e higiene de leitura

**Objetivo:** menos byte e menos round-trip **depois** do tap já parecer instantâneo.

#### Passo 6.1 — `Cache-Control` só onde precisa `no-store`

**Faz:** manter `private, no-store` em HTML autenticado, `/api` (exceto health se já público), `/d/*`, `/verificar/*`. Tirar o catch-all de `/_next/static` e `/icons` — deixar cache longo (o SW já trata o shell).

**Aceite:** Response headers de um JS em `/_next/static/` não são `no-store`. Páginas de coleta continuam sem cache compartilhado.

#### Passo 6.2 — Colunas explícitas nas queries de oficina

**Faz:** `select` alinhado aos schemas Zod já existentes. Reusar um cliente por request se for trivial.

**Aceite:** o hub não pede colunas que o view-model descarta.

#### Passo 6.3 — Documentos em paralelo / um round-trip

**Faz:** artifacts no mesmo fluxo que a lista (join ou `Promise.all` após ids). Auth via `cache()` da Fase 2. Não refetch de `official_code` se o detalhe já veio.

**Aceite:** uma ida a menos ao banco no caminho feliz da lista de documentos.

#### Passo 6.4 — Geist via `next/font`

**Faz:** carregar no `app/layout.tsx` e ligar a variável CSS.

**Aceite:** `--font-geist-sans` resolve; sem flash de fonte genérica se a rede permitir.

#### Passo 6.5 — PDF viewer (quando doer em campo)

**Faz:** link de download + abrir nativo, ou lazy do iframe. Sem processar PDF no client.

**Aceite:** a tela de documento não aloca o PDF inteiro só para “entrar” na página, se o operador só quer o link.

---

### Fase 7 — Higiene (quando o arquivo já estiver aberto)

Não abrir PR só para isto, salvo o humano pedir.

| Passo | Issue | Faz |
| :--- | :--- | :--- |
| 7.1 | P2-2 | Paginação ou virtualização **se** o limite passar de ~50. |
| 7.2 | P2-3 | Imports diretos no lugar de `export *` ao tocar o slice. |
| 7.3 | P2-4 | Client de rate-limit em módulo (singleton), sem mudar a RPC. |
| 7.4 | P1-10 | Manter PNG pequeno; não reusar o pad para foto. |
| 7.5 | P1-6 legado | Apagar ou alinhar `draft-*-page.tsx` se ninguém montar. |

---

## 6. Ordem e dependências

```text
Fase 1  loading + pending Link     → independe do resto; maior ganho percebido
Fase 2  cache() auth               → reduz o tempo atrás do skeleton
Fase 3  drain + debounce           → o skeleton da Fase 1 deixa de “brigar” com a fila
Fase 4  mutações                   → melhor com Fase 1 (hub já tem shell)
Fase 5  wizard + actions diretas   → pode ir em paralelo à 4; Fase A de architecture-improvement
Fase 6  headers / select / font    → depois do tap já parecer instantâneo
Fase 7  higiene                    → opportunista
```

Não juntar Fase 1 com Fase 5 no mesmo PR. Não juntar performance com Chat 5 de backup.

---

## 7. Relação com a documentação existente

| Documento | Papel |
| :--- | :--- |
| [`architecture-improvement.md`](./architecture-improvement.md) | Manutenção. Fases A e E **são** os passos 5.2 e 2.1 daqui. |
| [`nextjs-pwa.md`](../nextjs-pwa.md) | SW e fila. Este plano não muda a política “SW só de shell”. |
| [`decisions/0006-offline-draft-queue.md`](../decisions/0006-offline-draft-queue.md) | Fila oficial. Fase 3 só muda **quando** drena, não o contrato. |
| [`execution/phase-4-hardening-launch.md`](../execution/phase-4-hardening-launch.md) | PWA/offline já verdes. Performance não é um chat da Fase 4. |
| [`http-api.md`](../http-api.md) | Contrato HTTP intacto. |

Sem ADR novo: não há mudança de plataforma. Se a Fase 4.2 alterar a regra “só navega após sync completo”, registrar no ADR 0006 ou num ADR curto.

---

## 8. Critérios de sucesso

O app está mais rápido **para o operador** quando:

1. Tocar bottom nav, card ou Voltar **mostra shell no mesmo instante** (Fase 1).
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
- Local: revisão de `proxy.ts`, `(protected)/layout.tsx`, `require-admin.ts`, `next.config.ts`, `collection-capture-page.tsx`, `workshop-checkin-page.tsx`, `offline-pending-banner.tsx`, `queries.ts` (lifecycle e operations)
- Data da revisão: 2026-08-29
