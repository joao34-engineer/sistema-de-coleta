# Execution plan — entrega parcial em reparo + leftovers de oficina

| Campo | Valor |
| --- | --- |
| **Status** | `active` — **não implementar neste arquivo**; um eixo por PR. PR 1 a PR 4 **completos** (migrations `20260907000000` / `20260907010000` **aplicadas** no remoto em 07/09/2026, validação verde); PR 5 **bloqueado** (Figma O02) |
| **Authority** | `informative` até o humano pedir um PR |
| **Owner** | product / sistema-coleta |
| **Pedido** | 2026-09-06: Figma `23:107`, trap `/configuracoes/empresa`, entrega mid-repair, check-in “não chegou”, cancel OS, backfills |
| **Escopo** | Somente `sistema-coleta/`. **Não** 5.7 / 5.12 / 5.13. **Não** e-mail Resend. **Não** `db reset` |
| **Figma** | [Protótipo navegável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ/Sistema-de-Coleta-MJT-%E2%80%94-Design-System-e-Fluxos?node-id=23-107) (`fileKey` `akpo5W8c3ViA1hvjeqg9YJ`, canvas `23:107`) |
| **App** | Production `https://sistema-de-coleta.vercel.app` |
| **Line budget** | Manter este arquivo abaixo de 500 linhas |

Preflight de cada PR: `docs/feature-first-posture.md` (repo raiz) → `AGENTS.md` → `docs/README.md` → doc temático + skill (`$mjt-supabase` / `$mjt-nextjs-pwa`). DAL única (ADR 0009). Schema só aditivo; `CREATE OR REPLACE` na mesma assinatura; re-`GRANT` se houver `DROP FUNCTION` (evitar). Guias `MJT-2026-000001`–`000003` e PDFs intactos.

---

## 1. Resposta direta: entrega hoje

Sim: **hoje só dá para entregar quando a coleta inteira está `ready` / `invoiced` / `partial_delivery`.** `deliver_to_customer` recusa `in_service`. O progresso só promove a coleta a `ready` quando **todos** os `service_order_items` estão `pronto`. Não existe entrega de 1 item Pronto enquanto outro continua `em_reparo`.

Buraco 5.6 (mesmo eixo): `prepare_delivery_signature_intent` ainda só aceita `invoiced | partial_delivery` (`20260823000000`). A UI chama esse RPC **antes** de `deliver_to_customer`. Entregar a partir de `ready` (já no remoto) pode falhar com `collection_not_invoiced` no prepare. PR 3 alarga o mesmo conjunto nos dois RPCs.

Isso contradiz o produto (`vision-and-scope.md` decisão 16, `mobile-workflows.md` entrega) **e** o Figma.

**Estado 2026-09-07:** resolvido. PR 3 implementa o conjunto deliverable com `in_service`; migration **aplicada** no remoto, que já **não** se comporta como este parágrafo descreve (mantido como registro do bug original).

---

## 2. O que o Figma já desenha (canvas `23:107`)

| Frame | Node | O que mostra | Código hoje |
| --- | --- | --- | --- |
| **O04 · Entrega ao cliente** | `229:1343` | Subtítulo **Somente itens prontos**. Item 1 ✓ “Pronta para retirada”. Item 2 □ “Continua em reparo”. “1 de 2 itens serão entregues”. | Lista todos os `collection.items`; RPC não olha `pronto`; CTA Entregar só em `ready`/`invoiced`/`partial_delivery` |
| **M14 · Serviço** | `229:1546` | “Itens prontos 1 de 2”; um item Pronto e outro Em reparo no mesmo progresso | Progresso existe; não destrava entrega |
| **O02 · Entrada na oficina** | `229:1266` | Só **Conferido** e **Divergência**, ambos com qtd observada 1. **Não há** “não chegou” / qtd 0 | CHECK `quantity_observed > 0` + conjunto completo (5.8) |
| **O05 · Cancelar** | `229:1377` | Cancelar guia emitida; histórico preservado | Hub não cancela `draft`; RPC de oficina ainda aceita `draft` e estoura CHECK |
| **M11 · Configurações** | `229:1462` | Header Empresa + **bottom nav** (Configurações ativo). Sem chevron Voltar no header | Production: layout desktop, **sem** `MobilePageHeader`, **sem** `MobileBottomNav` → trap |

O Figma **autoriza** entrega parcial mid-repair. **Não** autoriza “item não chegou” (ausente no protótipo). Esse eixo precisa de tela nova alinhada a O02, não de relaxar o CHECK.

---

## 3. Ordem dos PRs (um eixo cada)

| # | Eixo | SQL? | Depende de | Estado |
| --- | --- | --- | --- | --- |
| 1 | Trap `/configuracoes/empresa` | não | — | **completo** 2026-09-07 |
| 2 | Backfills (só `SELECT`; UPDATE se count > 0) | talvez `UPDATE` pontual | OK humano | **completo** 2026-09-06 (remoto limpo; sem UPDATE) |
| 3 | Entrega mid-repair (RPC + hub + UI O04) | sim, mesmo 9-arg `deliver_to_customer` | — | **completo** 2026-09-07; `20260907000000` **aplicada** no remoto; validação verde |
| 4 | Cancel: recusar `draft` + OS `canceled` | sim, `cancel_or_reopen_collection` | — | **completo** 2026-09-07; `20260907010000` **aplicada** no remoto; validação verde |
| 5 | Check-in “não chegou” | sim, CHECK + RPC + UI | Figma O02; SQL sobre o corpo shipped do PR 3 | **bloqueado** (Figma O02; decisões de modelo fechadas 2026-09-07) |

Não juntar 3+5. Não juntar 3+4.

---

## 4. PR 1 — Sair de `/configuracoes/empresa`

**Estado 2026-09-07:** **completo**.

**Quebra:** não é “header sem `backHref`”. `CompanySettingsPage` **não tem chrome mobile nenhum** (`MobilePageHeader` / `MobileBottomNav` ausentes). Layout desktop `max-w-4xl`. O dashboard deep-linka em `routes.companySettings` (`/configuracoes/empresa`). O hub `/configuracoes` (`CollectorProfilePage`) já tem header + nav; a trap é só a folha empresa.

**Correção (própria, não workaround):** copiar o par do hub, sem inventar widget.

- `MobilePageHeader` title **Empresa**, subtitle **Dados institucionais** (M11 + hub).
- `backHref={"/dashboard" as Route}` — origem do CTA “Configurações da Empresa”.
- `MobileBottomNav` no fundo (`matchPrefix: "/configuracoes"` já marca Configurações ativo).
- Shell `max-w-md` + `pb-28` como `collector-profile-page.tsx`. Manter `CompanySettingsForm`; não reescrever issuer/logo.

**Owns:** `src/_pages/company-settings/ui/company-settings-page.tsx`. Não tocar RPC.

**Aceite:** no telemóvel, Voltar volta ao dashboard; Início/Coletas na nav funcionam; salvar issuer continua igual.

---

## 5. PR 2 — Backfills

**Estado 2026-09-06:** **completo** — remoto limpo; nenhum UPDATE.

Remoto medido 2026-09-06:

```sql
-- A: OS pronta com coleta já entregue
SELECT so.id, c.official_code, so.status, c.status
FROM public.service_orders so
JOIN public.collections c ON c.id = so.collection_id AND c.organization_id = so.organization_id
WHERE c.status = 'delivered' AND so.status = 'ready';
-- count = 0

-- B: canceled_at órfão após reopen
SELECT id, official_code, status, canceled_at
FROM public.collections
WHERE status <> 'canceled' AND canceled_at IS NOT NULL;
-- count = 0
```

**Abordagem:** se count continuar 0, **não** rodar `UPDATE`. Só documentar no scan “remoto limpo”. Se no futuro count > 0, mostrar o `SELECT` ao humano e só então:

```sql
UPDATE public.service_orders AS so
SET status = 'delivered', updated_at = now()
FROM public.collections AS c
WHERE so.collection_id = c.id AND so.organization_id = c.organization_id
  AND c.status = 'delivered' AND so.status = 'ready';

UPDATE public.collections
SET canceled_at = null, canceled_by = null, cancel_reason = null,
    previous_status_before_cancellation = null
WHERE status <> 'canceled' AND canceled_at IS NOT NULL;
```

Nunca tocar linha `canceled` viva. Nunca `partial_delivery`. Sem migration se count = 0.

Inventário opcional (não é backfill; vira 0 depois do PR 4):

```sql
SELECT c.id, c.official_code, c.status, so.status AS so_status
FROM public.collections AS c
JOIN public.service_orders AS so
  ON so.collection_id = c.id AND so.organization_id = c.organization_id
WHERE c.status = 'canceled' AND so.status <> 'canceled';
```

---

## 6. PR 3 — Entrega de itens Pronto com outros ainda em reparo

**Estado 2026-09-07:** completo. Migration `20260907000000_phase_5_deliver_mid_repair.sql` **aplicada** no remoto. Validação verde (lint, typecheck, 521 testes, Steiger).

Contrato canônico (Figma O04, decisão 16, `data-and-rules.md` §entrega): entregar só **prontos**; resto continua no fluxo operacional; coleta vai a `entrega_parcial` quando ainda há pendentes.

Conjunto **deliverable** (os três RPCs, mesma lista): `in_service` | `ready` | `invoiced` | `partial_delivery`.

1. **Seleção UI:** só `service_order_items.status = 'pronto'` e ainda não entregues. `em_reparo` visíveis, **desabilitados**, copy **Continua em reparo**. Já entregues: **já entregue**.
2. **`deliver_to_customer`** (9 args, `CREATE OR REPLACE` a partir de `20260906210000`):
   - Aceitar o conjunto deliverable (hoje recusa `in_service`).
   - Cada id em `p_delivered_item_ids` tem linha de OS com `status = 'pronto'`. Senão `item_not_ready` (422). Recusar `em_reparo` / item sem OS.
   - Guards 5.5 intactos (`duplicate_delivery_item`, `item_already_delivered`).
3. **`prepare_delivery_signature_intent`** (mesma assinatura, `CREATE OR REPLACE` do corpo `20260823000000`): `delivery_term` aceita o **mesmo** conjunto. Sem isto, UI quebra em `ready` **e** em `in_service` antes de chegar ao deliver.
4. **Status depois do termo:**
   - `remaining = 0` → coleta + OS `delivered` (5.9).
   - ainda há pendentes → coleta **`partial_delivery`** (não ficar em `in_service` depois de existir termo; filtros/hub já usam esse balde).
   - OS: se algum restante `em_reparo` → `in_service`; se todos restantes `pronto` → `ready`; nenhum restante → `delivered`. (Hoje o RPC põe OS `ready` em qualquer parcial — errado para mid-repair.)
5. **`update_service_progress`**: alargar guard para `approved | in_service | partial_delivery` para o restante continuar em reparo. Sem isto, `partial_delivery` trava o progresso. Não aceitar `ready`/`invoiced`/`delivered`.
6. **Hub / 5.17:** `in_service` com algum Pronto não entregue: primary **Atualizar progresso**, extra **Entregar itens prontos**. `partial_delivery`: primary **Entregar ao cliente**; extra **Atualizar progresso** se ainda houver `em_reparo`. `isWorkshopSegmentAllowed` segue a matriz.
7. **Copy:** `item_not_ready` em `operations-errors.ts` / `action-error.ts`. Manter código `collection_not_invoiced` (só alargar o `IN`). Overlay `database.types.ts` se types remote não entrar no PR.

**Não:** forçar todos os itens a Pronto para destravar. **Não:** filtrar só no cliente. **Não:** deixar coleta em `in_service` após termo (workaround para não tocar o progresso).

**Owns:** uma migration com os três `CREATE OR REPLACE` (assinaturas iguais); `operational-actions.ts` + testes; `customer-delivery-page.tsx`; `entrega/page.tsx`; `delivery-selection.ts`; `commands.ts` já encadeia prepare→deliver; `data-and-rules.md` / `mobile-workflows.md` (conjunto deliverable).

**Aceite:** `in_service` 1/2 Pronto → hub mostra Entregar itens prontos → só o Pronto selecionável → termo gravado → coleta `partial_delivery`, OS `in_service` → progresso ainda abre no item restante. Entregar `em_reparo` via action = 422. Caminho 5.6 (`ready` → prepare → deliver) passa a funcionar.

---

## 7. PR 4 — Cancelar rascunho vs cancelar OS

**Estado 2026-09-07:** completo. Migration `20260907010000_phase_5_cancel_draft_and_service_order.sql` **aplicada** no remoto. Validação verde; erro mapeado como HTTP **409** (consistente com os demais guards de status de coleta). Reopen restaura a OS em `cancel_or_reopen_collection` e em `reopen_collection` (este segundo caminho entra porque o cancel agora põe a OS em `canceled`).

Corpo canónico: `cancel_or_reopen_collection` em `20260906180000` (6 args). Sem `DROP FUNCTION`; re-`GRANT EXECUTE` no REPLACE.

### 4a. Draft

O ramo `cancel` só recusa `delivered`/`canceled`. `draft` passa, o `UPDATE` para `canceled` sem `official_code`/snapshot viola `collections_issued_identity_check` (`23514` opaco). Hub já esconde Cancel (`operational-actions.ts` devolve null/null; 5.17 redireciona). Caminho morto: Server Action / RPC direto.

**Correção:** antes do UPDATE, `status = 'draft'` → `P0001` `collection_not_cancelable_draft`. Mapear 422: “Descarte o rascunho; coleta emitida é que se cancela.” Caminho certo: `discard_collection_draft` (`20260905020000`). Lifecycle `cancel_collection` já recusa não-`collected` — não misturar nesse PR.

### 4b. OS `canceled`

CHECK da OS já inclui `canceled`; o RPC **não** toca `service_orders`. Cancelar `in_workshop`/`in_service` deixa OS viva. OS só existe após orçamento.

**Correção:** coluna aditiva `service_orders.previous_status_before_cancellation` (nullable; CHECK = status da OS excepto `canceled`). Não gravar só em `collection_events.metadata` (reopen fica opaco). No cancel, se existir OS: gravar previous, `status = 'canceled'`. No reopen: restaurar previous e limpar a coluna; se previous null, mapear a partir do status restaurado da coleta (`in_budget→budgeted`, `approved→approved`, `in_service→in_service`, `ready|invoiced|partial_delivery→ready`, `rejected→rejected`; `collected`/`in_workshop` sem OS = no-op). Sem OS → no-op.

**Não** cancelar OS em `draft`. **Não** `DELETE`. **Não** deixar OS `canceled` após reopen.

**Owns:** `CREATE OR REPLACE` mesma assinatura + `ALTER TABLE`; `operations-errors.ts` / `action-error.ts`; testes draft recusado / cancel com OS / reopen restaura.

**Aceite:** cancelar guia `collected`/`in_service` deixa OS `canceled` se existir; Reabrir restaura o status anterior; cancelar draft via RPC = código claro, linha draft intacta.

---

## 8. PR 5 — Check-in “item não chegou”

**Estado 2026-09-07:** **bloqueado** na tela Figma O02 (ainda não tem “não chegou”). Decisões 1 e 2 fechadas abaixo. Não abrir o PR até o humano confirmar a tela.

Figma O02 **não** tem esse estado. Relaxar `quantity_observed > 0` sozinho é workaround e quebra 5.8.

Guards atuais (todos > 0): CHECK anónimo `workshop_checkin_items_quantity_observed_check` (`20260822125100` col. 804); RPC `20260906150000` `invalid_workshop_item`; Zod `quantityObserved: z.number().positive()` em `contracts.ts`; UI `min={1}`. Completeness 5.8 é outro guard (`workshop_checkin_items_incomplete`).

**Recon (o PR é maior do que o texto antigo implicava):** o código de hoje **não** tem toggle Conferido | Divergência — três inputs livres (texto/número) por linha. Montar O02 é um build maior. Orçamento, progresso e entrega **nunca** leem `workshop_checkin_items`; cada um precisa do filtro de missing.

**Modelo próprio (overlay operacional; não reescreve a guia emitida):**

1. A guia já listou o item no finalize. Ele permanece no snapshot/PDF. Check-in **não** remove `collection_items` nem omite o id.
2. `arrival_status text not null default 'arrived'`, CHECK `arrived | missing`. Um CHECK composto amarra os fatos: `arrived` implica `quantity_observed > 0`; `missing` implica `quantity_observed = 0`, `condition_observed = 'nao_recebido'` e `divergence_notes` não vazio. **Não** só `>= 0`.
3. `condition_observed` **mantém** `NOT NULL`. A RPC grava o valor canónico no servidor; a UI não pede o campo quando “Não chegou” está selecionado. O código ramifica só em `arrival_status`; ninguém parseia texto livre.
4. `divergence_notes` **obrigatório** quando `missing`.
5. 5.8 continua: **todo** item vivo entra no payload. Missing é uma linha, não omissão. Coleta pode ir a `in_workshop` quando o roster está conferido (chegado ou missing).
6. Evento `collection.workshop.checked_in`: `itemCount`, `arrivedCount`, `missingCount`, `missingItemIds[]` (sem PII). Não depender só da nota livre.
7. Itens `missing` **não** entram em orçamento/progresso/entrega. Permanecem na guia como coletados e não recebidos.
8. UI O02: Conferido | Divergência | **Não chegou**. “Não chegou” zera qtd e exige nota. (Hoje esses toggles não existem no código — ver recon acima.)

**Decisão 1 — representação (fechada 2026-09-07).** `arrival_status` é o discriminador único; o sentinel é consequência do CHECK, não convenção. As duas opções originais foram **rejeitadas**: sentinel solto em `condition_observed` é inaplicável (a coluna é `text` livre com só check de tamanho — nada impede uma linha `arrived` carregar o sentinel); largar o `NOT NULL` enfraqueceria o invariante de toda linha chegada por causa de um caso raro, a ambiguidade que este documento proíbe. Retroativamente seguro: toda linha existente tem `quantity_observed > 0` e recebe o default `arrived`; o CHECK novo já é satisfeito, sem backfill.

**Decisão 2 — estado terminal (fechada 2026-09-07).** Coleta cujo único restante nunca foi recebido vai a **`delivered`**. Sem status novo: `collections_status_check` e os baldes da UI ficam iguais; a nuance vive na linha de check-in, na guia e em `missingItemIds` do evento.

**`remaining` (deadlock resolvido).** Significa “ainda entregável e não entregue” — exclui item marcado missing. Dois caminhos **rejeitados**: inserir `delivery_items` para item missing (fabrica entrega do que nunca chegou e envenena o ledger de que o termo é construído); soft-delete de `collection_items` (anti-padrão proibido; o snapshot/PDF lê essa tabela e revisões futuras mudariam). A exclusão é `EXISTS` em `workshop_checkin_items`, nunca flag desnormalizada em `collection_items`. Usar `EXISTS`, não join simples: não há unique em `(collection_id, collection_item_id)` — linha duplicada de check-in multiplicaria a conta.

**Sequência dura:** PR 5 edita o mesmo bloco `remaining` que o PR 3 reescreveu. O SQL do PR 5 nasce do corpo **shipped** do PR 3; **nunca** em paralelo com ele.

**Anti-padrões:** soft-delete do item; omitir do payload; mutar PDF sem revisão; só largar o CHECK; sentinel só em texto livre; `delivery_items` fantasma.

**Aceite:** 2 itens, 1 missing → check-in ok, coleta `in_workshop`; orçamento só no item chegado; PDF original inalterado. Se o único restante for missing, coleta → `delivered`.

Só abrir este PR depois do humano confirmar a tela (Figma ainda não a tem).

---

## 9. Fora deste plano

- 5.7 SignaturePad na aprovação; 5.12 `/clientes`; 5.13 contatos/veículos.
- NF-e depois de `delivered` (eixo separado; não misturar com PR 3).
- Apagar `draft-items-page` / `draft-review-page` (cleanup morto; PR próprio se pedido).
- Enable `DOCUMENT_EMAIL_SEND_ENABLED`.

---

## 10. Validação

Cada PR: testes do eixo + `npm run lint` + `npm run typecheck`. SQL: `db push --dry-run` → humano → push. UI: telemóvel (PR 1 e PR 3). `npm run architecture` se imports FSD mudarem. Commit/deploy só com pedido.

## 11. Prompt de execução (copiar no chat do PR)

```text
Implemente SOMENTE o PR N do plano
sistema-coleta/docs/execution/workshop-partial-delivery-leftovers.md
Preflight: feature-first-posture, sistema-coleta/AGENTS.md, docs/README.md, skill da stack.
Não misturar outro PR. Não db reset. Não 5.7/5.12/5.13.
Seguir Figma node citado na seção do PR.
DAL ADR 0009. CREATE OR REPLACE mesma assinatura.
Pedir commit/push/deploy ao humano no fim.
```
