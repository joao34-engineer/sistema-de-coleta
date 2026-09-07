# Auditoria — `workshop-partial-delivery-leftovers.md` (PR 1–5)

| Campo | Valor |
| --- | --- |
| **Status** | `informative` — inventário de bugs; **não implementar a partir deste arquivo** |
| **Data** | 2026-09-07 |
| **Escopo** | Verificação das alegações de `docs/execution/workshop-partial-delivery-leftovers.md` |
| **Método** | Leitura de código/SQL + execução local de `lint`, `typecheck`, `vitest`, `steiger`. Nenhum comando de banco executado |
| **Alvos** | `20260907000000_phase_5_deliver_mid_repair.sql`, `20260907010000_phase_5_cancel_draft_and_service_order.sql`, camada TS/React correspondente |

---

## 1. Veredito

O trabalho foi **feito de verdade** — não é doc inflado. As migrations existem, as assinaturas são idênticas às anteriores (nenhum overload duplicado, nenhum `DROP FUNCTION`, grants preservados), o conjunto deliverable está correto nos dois RPCs, o PR 5 **não vazou** para o código, e a validação local reproduz verde.

O que não se sustenta são três coisas: **o fluxo mid-repair tem furos de produto que o tornam parcialmente inutilizável na prática**, **não existe um único teste de banco cobrindo o SQL dos PR 3 e PR 4**, e **a afirmação "aplicada no remoto" não tem lastro local** — a melhor evidência disponível aponta no sentido contrário.

### Validação local reproduzida (2026-09-07)

| Gate | Resultado | Alegação do doc |
| --- | --- | --- |
| `npm run typecheck` | exit 0 | verde ✅ |
| `npm run lint` | limpo | verde ✅ |
| `npm test` | **532 passed, 18 skipped** (104 files passed, 2 skipped) | "521 testes" — desatualizado, não falso |
| `npm run architecture` (Steiger) | `√ No problems found!` | verde ✅ |

---

## 2. Alegações confirmadas (não mexer)

Registro do que a auditoria **descartou** como problema, para ninguém reabrir:

- **Assinaturas.** `deliver_to_customer` (9 args), `prepare_delivery_signature_intent`, `update_service_progress`, `cancel_or_reopen_collection` (6 args) e `reopen_collection` (5 args) são caractere-a-caractere idênticas às definições anteriores em nomes, tipos, ordem, defaults, `RETURNS`, `SECURITY DEFINER`, `SET search_path` e volatilidade. Nenhum overload criado. Nenhum `DROP FUNCTION`. `GRANT EXECUTE` reemitido no PR 4.
- **Conjunto deliverable.** `in_service | ready | invoiced | partial_delivery` correto nos dois RPCs de entrega; `collection_not_invoiced` mantido como código, só o `IN` alargado.
- **`item_not_ready` roda antes de qualquer escrita de negócio** (`20260907000000:121-134`), então não há escrita parcial.
- **Isolamento de tenant no PR 3.** Toda subquery filtra `collection_id` **e** `organization_id`. Sem IDOR.
- **Armadilha `NOT IN` com NULL não existe.** `delivery_items.collection_item_id` é `not null`; onde a coluna é nullable (`service_order_items`) o SQL usa `collection_item_id is null or ... not in (...)` explicitamente.
- **PR 4: duplo-cancel não envenena o `previous_status_before_cancellation`.** Dois guards independentes fecham a armadilha clássica (`:260-262` recusa a segunda coleta; `:271-273` exclui OS já `canceled` do write).
- **PR 4: CHECK da coluna nova é exatamente o complemento** do `service_orders_status_check` (todos os status menos `canceled`). Nenhum `23514` esperando.
- **PR 4: ambos os caminhos de reopen foram atualizados**, e `reopen_collection` é de fato alcançável por HTTP — não era opcional.
- **PR 4: 409 é consistente.** Os oito guards de status de coleta em `operations-errors.ts:19-28` são todos 409; 422 é reservado a payload e regras de item. O código do erro é extraído de verdade (`PostgrestError.code`/`.message` preservados até os dois mappers).
- **PR 5 não vazou.** Zero ocorrências de `arrival_status`, `nao_recebido`, `missingItemIds`, `arrivedCount`, `missingCount` fora do próprio plano. Os quatro guards descritos continuam ativos.
- **PR 1: as cinco alegações são verdadeiras**; `pb-28` é suficiente; não há header duplicado; `routes.companySettings` correto.
- **Docs de produto atualizados.** `data-and-rules.md` §entrega e `mobile-workflows.md` documentam o conjunto deliverable e o fluxo mid-repair.

---

## 3. Bugs — produto e correção

### A1 · NF-e fica permanentemente inalcançável depois de qualquer entrega parcial — **Alto** — **decisão fechada 2026-09-07; código ainda não**

```
sistema-coleta/supabase/migrations/20260907000000_phase_5_deliver_mid_repair.sql:216
  next_status := case when remaining = 0 then 'delivered' else 'partial_delivery' end;
```

`register_invoice_reference` aceita exatamente um status (`20260823000001:665-667`: `if collection_record.status <> 'ready' then raise ... 'collection_not_ready'`), e o PR 3 fez `update_service_progress` recusar deliberadamente puxar `partial_delivery` de volta para `ready` (`20260907000000:475-479`). O frontend concorda: `operational-actions.ts:145-147` só oferece a CTA de NF-e em `ready`.

Antes do PR 3, entregar exigia `ready` ou `invoiced`, então sempre existia uma janela para registrar a NF-e. O PR 3 torna a entrega direto de `in_service` o caminho **pretendido** (§6.6 do plano cria a CTA "Entregar itens prontos" nesse status), e esse caminho pula `ready` inteiro. Depois da primeira entrega parcial a coleta fica em `partial_delivery` até `delivered` — a NF-e nunca mais pode ser registrada.

**Decisão 2026-09-07 (humano — não perguntar de novo):** mid-repair e NF-e **coexistem**. `register_invoice_reference` deve aceitar `ready | partial_delivery`. `optionalInvoiceAction` no hub deve oferecer NF-e também em `partial_delivery`. Não são mutuamente exclusivos. "NF-e depois de `delivered`" (§9 do plano) continua eixo separado e **não** é esta decisão.

Implementar no leftover **L2** (mesmo eixo que A9). Não reabrir o trade-off.

### A2 · A CTA primária de `partial_delivery` é um beco sem saída — **Alto** — **corrigido 2026-09-07**

```35:47:sistema-coleta/src/_pages/collection-operations/model/operational-actions.ts
const primaryByStatus: Readonly<Partial<Record<CollectionStatus, OperationalAction>>> = {
  // ...
  partial_delivery: { segment: "entrega", label: "Entregar ao cliente" },
};
```

```104:111:sistema-coleta/src/_pages/collection-operations/model/operational-actions.ts
  if (status === "in_service" && itemFacts.hasUndeliveredReadyItem) {
    return deliverReadyItemsAction;
  }
  if (status === "partial_delivery" && itemFacts.hasInRepairItem) {
    return updateProgressAction;
  }
```

O ramo `in_service → entrega` é condicionado a `hasUndeliveredReadyItem`; o ramo `partial_delivery → entrega` **não é condicionado a nada**, porque vem de `primaryByStatus`. `isWorkshopSegmentAllowed` deriva do mesmo par, então o route guard também não bloqueia.

O estado canônico que a feature cria — 2 itens, o `pronto` entregue, o `em_reparo` restante — mostra "Entregar ao cliente" como botão **primário**. Seguir esse botão leva a uma tela onde as duas linhas estão desabilitadas ("já entregue" e "Continua em reparo") e Confirmar devolve `"Selecione ao menos um item para entrega."`.

A assimetria vem da própria matriz do plano (§6.6), então a correção é na matriz, não só no código.

### A3 · Progresso lista item já entregue, e o RPC deixa mutá-lo — **Alto** — **corrigido 2026-09-07**

```11:19:sistema-coleta/app/(protected)/coletas/[id]/oficina/progresso/page.tsx
  const progressItems = collection.items.map((collectionItem) => {
    const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
    return {
      itemId: collectionItem.id,
      // ...
      status: (budgetItem?.status ?? "em_reparo") as "em_reparo" | "pronto",
```

A rota nunca carrega dados de termo de entrega — compare com `oficina/entrega/page.tsx:15`, que chama `getDeliveryTermItems`. O cliente submete todas as linhas (`service-progress-page.tsx:69-75`), e o RPC não compensa: o loop de escrita em `20260907000000:447-452` não tem filtro de item entregue, embora os agregados logo abaixo (`:462-470`, `:497-504`) excluam entregues com cuidado.

Três consequências:
1. O contador `{readyCount} de {items.length}` conta o item entregue — Figma M14 ("Itens prontos 1 de 2") fica errado depois do termo parcial.
2. O operador pode voltar um item já entregue para "Em reparo", mutando a linha de OS de um item que já tem termo imutável assinado.
3. Combinado com A12, `hasInRepairItem` fica true para sempre e o hub segue oferecendo "Atualizar progresso" numa coleta cujo único item em reparo já foi entregue ao cliente.

O critério de aceite do plano ("progresso ainda abre no item restante") está meio cumprido: abre no restante **e** no entregue.

### A4 · `getBudgetItems` colapsa para `[]` se uma linha falhar no Zod — **Alto** — **corrigido 2026-09-07 (L3)**

```86:93:sistema-coleta/src/_pages/collection-operations/api/queries.ts
export async function getBudgetItems(collectionId: string) {
  // ...
  return z.array(budgetItemSchema).safeParse(normalizeOperationsPayload(data)).data ?? [];
}
```

`budgetItemSchema` declara `collectionItemId: uuidSchema` (não-nullable) e `estimatedDays: z.number().int().positive()`. Mas `service_order_items.collection_item_id` é **nullable** no banco (`20260822125100:785`; `database.generated.ts:1764` confirma `string | null`) — o SQL do próprio PR 3 ramifica nessa possibilidade (`soi.collection_item_id is null`, linhas 463 e 498). Como o parse é tudo-ou-nada sobre o array, **uma** linha NULL faz a função devolver `[]`, e todo consumidor degrada em silêncio:

- `load-operation.ts:24` → `isWorkshopSegmentAllowed("in_service", "entrega", { hasUndeliveredReadyItem: false })` é false → `/oficina/entrega` redireciona de volta ao hub.
- O hub esconde "Entregar itens prontos".
- `entrega/page.tsx:27` marca **todo** item como "Continua em reparo".

Ou seja: o fluxo novo inteiro bloqueado, sem erro em lugar nenhum. Agravante de inconsistência: o hub embrulha a chamada em `getBudgetItems(id).catch(() => [])` (`coletas/[id]/page.tsx:19`) enquanto `load-operation.ts:20` não embrulha — a mesma falha vira mudança silenciosa de CTA numa página e error boundary 500 na outra.

### A5 · Item restante sem linha de OS = deadlock terminal — **Médio**

`20260907000000:194-213` calcula `any_remaining_in_repair` via `EXISTS` sobre `service_order_items` com `status = 'em_reparo'`. Um `collection_items` restante **sem nenhuma** linha de OS entra em `remaining` (coleta vira `partial_delivery`, correto) mas não em `any_remaining_in_repair` — a OS é marcada `ready` com um item não orçado pendente. O plano diz "todos restantes `pronto` → `ready`"; o implementado é "nenhum restante `em_reparo` → `ready`".

Pior: esse item nunca satisfaz `item_not_ready` (`:121-134`), então `remaining` nunca chega a 0 e a coleta **nunca** pode chegar a `delivered`. O frontend trata esse estado como real, não impossível — `operational-actions.ts:87-88` e as duas rotas de oficina fazem `budgetItem?.status ?? "em_reparo"`.

Inconsistência irmã na mesma migration: linhas de OS com `collection_item_id is null` são ignoradas por `any_remaining_in_repair` mas entram no `bool_and(status = 'pronto')` de `update_service_progress` (`:455-461`) — as duas funções discordam sobre o que é "tudo pronto".

### A6 · `item_not_ready` é satisfeito por qualquer duplicata `pronto` — **Médio**

```
20260907000000:121-134
      from public.service_order_items as soi
      where soi.collection_id = p_collection_id
        and soi.organization_id = collection_record.organization_id
        and soi.collection_item_id = delivered_id
        and soi.status = 'pronto'
```

Não existe unique (nem índice) em `service_order_items (organization_id, collection_id, collection_item_id)` — o cabeçalho de `20260829230000` diz isso explicitamente. `create_technical_budget` não deduplica `p_items` e insere incondicionalmente no ramo de primeiro orçamento. Um payload repetindo o mesmo `item_id` gera duas linhas; se uma for `pronto` e outra `em_reparo`, o `EXISTS` passa e um item em reparo é entregue — exatamente o invariante que o guard existe para proteger.

O §8 do plano faz esse mesmo raciocínio para `workshop_checkin_items` ("usar `EXISTS`, não join simples: não há unique"). O raciocínio não foi aplicado a `service_order_items`.

### A7 · Fallback de reopen achata `partial_delivery`/`invoiced` para OS `ready` — **Médio**

```306:317:sistema-coleta/supabase/migrations/20260907010000_phase_5_cancel_draft_and_service_order.sql
          when 'invoiced' then 'ready'
          when 'partial_delivery' then 'ready'
```

O PR 3, na migration imediatamente anterior, estabeleceu que uma coleta `partial_delivery` pode legitimamente carregar OS em `in_service` — é o ponto inteiro da entrega mid-repair. Quando esse fallback dispara, escreve `ready` sobre uma OS que deveria estar `in_service`, e aí a OS discorda dos itens que continuam `em_reparo`.

Só é Médio porque o fallback é morto no caminho feliz (o cancel grava o status verdadeiro na coluna e o ramo primário o prefere). Alcançável para linhas canceladas antes desta migration — o plano mediu `count = 0` no remoto para essa forma, então nenhum dado vivo é afetado hoje.

### A8 · Fallback sem rede de segurança: OS pode continuar `canceled` após reopen — **Médio**

```319:326:sistema-coleta/supabase/migrations/20260907010000_phase_5_cancel_draft_and_service_order.sql
      if restored_os_status is not null then
        update public.service_orders
          set status = restored_os_status,
```

O `else null` do CASE pula o update. O comentário justifica com "collected / in_workshop não têm OS", mas já estamos dentro do ramo que **provou** que a OS existe. Chegar ao `else null` ali significa deixar a OS como está — que num reopen é `canceled`. Exatamente o estado órfão que a migration diz existir para prevenir.

A lacuna concreta é `awaiting_approval`: status válido de coleta (`collections_status_check`, `20260822125100:15`), pós-orçamento, portanto **com** OS, e ausente do mapeamento. Alcançabilidade baixa (nenhum RPC grava `awaiting_approval` hoje), por isso Médio. Um `else` caindo no próprio status da OS, ou um `raise`, tornaria o invariante incondicional.

### A9 · `invoiced` é rebaixado silenciosamente a `partial_delivery` — **Médio** — **decisão fechada 2026-09-07; código ainda não**

Mesma linha `:216`. O fato não se perde (a linha em `invoice_references` fica intacta), mas a coluna de status deixa de refletir a nota emitida, e os baldes da UI dependem de status. Comportamento pré-PR 3 (`20260906170000:176`), porém o conjunto alargado o torna alcançável a partir de mais caminhos. Combinado com A1, é irreversível.

**Decisão 2026-09-07 (humano — não perguntar de novo):** se a coleta já está `invoiced` e ainda há `remaining > 0` após uma entrega, **permanece `invoiced`**. Não rebaixar para `partial_delivery`. L2 implementa isto no mesmo `CREATE OR REPLACE` de `deliver_to_customer` que alarga `register_invoice_reference`.

### A10 · Rota REST de entrega rejeita qualquer entrega sem observações — **Médio** — **corrigido 2026-09-07 (L7)**

```16:20:sistema-coleta/app/api/collections/[id]/delivery/route.ts
    deliveredItemIds: JSON.parse(formData.get("deliveredItemIds") as string),
    // ...
    notes: formData.get("notes"),
```

`formData.get("notes")` devolve `null` quando o campo não existe, e `notes: z.string().trim().max(1000).optional()` (`contracts.ts:106`) aceita `undefined` mas rejeita `null`. Toda entrega sem nota por esse endpoint falha com 422 genérico. A Server Action acerta: `phase3-flow.actions.ts:158` usa `formData.get("notes") || undefined`.

Mesmo arquivo, linha 16: o `JSON.parse` está **fora** do `try`, então um body malformado lança `SyntaxError` cru e devolve 500 não tratado em vez do 422 pretendido.

### A11 · O contador do Figma O04 nunca renderiza no frame citado — **Médio** — **corrigido 2026-09-07 (L7)**

```127:130:sistema-coleta/src/_pages/collection-operations/ui/customer-delivery-page.tsx
  const selectableCount = items.filter((item) => isDeliverableItem(...)).length;
  const isPartialSelection = deliveredItemIds.length > 0 && deliveredItemIds.length < selectableCount;
```

O Figma O04 (`229:1343`) é 2 itens — um `pronto`, um `em_reparo` — legendado "1 de 2 itens serão entregues". Nesse cenário `selectableCount` é 1, então selecionar o item pronto dá `1 > 0 && 1 < 1` → false, e a legenda nunca aparece. O teste em `tests/component/customer-delivery-page.test.tsx:104-113` fixa um cenário diferente (dois `pronto` + um `em_reparo`) para produzir "1 de 2" — passa verde enquanto o estado do Figma não reproduz.

### A12 · `alreadyDeliveredItemIds` nunca é passado em produção — **Médio** — **corrigido 2026-09-07**

```78:82:sistema-coleta/src/_pages/collection-operations/model/operational-actions.ts
export function operationalItemFactsFrom(
  collectionItemIds: ReadonlyArray<string>,
  budgetItems: ReadonlyArray<OperationalBudgetLine>,
  alreadyDeliveredItemIds: ReadonlyArray<string> = [],
```

Os dois call sites reais (`collection-detail-hub.tsx:62-65`, `load-operation.ts:17-22`) passam **dois** argumentos. Em produção `hasUndeliveredReadyItem` significa apenas `hasReadyItem`; a exclusão de entregues é código morto. `operational-actions.test.ts:273-284` testa o comportamento de três argumentos, o que dá falsa confiança de que o app o exercita. `hasInRepairItem` (linhas 92-94) nunca exclui entregues em nenhum caso — é o que sustenta a consequência 3 de A3.

---

## 4. Lacunas de teste e verificação

### B1 · Zero cobertura pgTAP para o SQL dos PR 3 e PR 4 — **Alto**

`supabase/tests/` tem oito arquivos (`foundation`, `phase_0_workshop_schema_contracts`, `phase_1a_collection_core`, `phase_2_documents`, `phase_3_auth_login_failure_quota`, `phase_3_operations_workshop`, `phase_5_list_collection_events_actor_name`, `phase_5_workshop_check_in_complete_items`). **Nenhum** cobre a cadeia de entrega (`20260906160000`, `20260906170000`, `20260906210000`, `20260907000000`) nem qualquer coisa do PR 4. `previous_status_before_cancellation` só aparece em três linhas de `phase_0_workshop_schema_contracts_test.sql` — e ali é a constraint de **`collections`**, não a nova de `service_orders`.

A "validação verde" do plano é TypeScript-only. **Nenhum** dos ramos SQL auditados acima é executado por CI. O precedente existe (`phase_5_workshop_check_in_complete_items_test.sql`), então é omissão, não falta de capacidade.

### B2 · A linha "Owns" do PR 4 promete testes que não existem — **Alto**

O plano (linha 177) promete "testes draft recusado / cancel com OS / reopen restaura". O que existe é só o mapeamento de erro na camada de app: `tests/unit/operations-errors-delivery.test.ts:43-68` (409 + copy) e `tests/unit/action-error.test.ts:71-94` (copy PT). Reais, não skipados — mas não tocam o SQL. O PR 3 criou o precedente de teste textual de migration (`tests/unit/phase-5-deliver-mid-repair-migration.test.ts`); o PR 4 não tem contraparte.

### B3 · `rpc as any` faz o typecheck não provar nada sobre o contrato de 9 args — **Médio**

```59:61:sistema-coleta/src/_pages/collection-operations/api/commands.ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;
```

Viola o "Zero `any`" do `sistema-coleta/AGENTS.md` e mascara um descompasso vivo: `database.generated.ts:2317` declara `p_notes: string` (não-nullable) enquanto `commands.ts:281` passa `p_notes: input.notes ?? null`. Pré-existente, não introduzido pelo PR 3 — mas é a razão pela qual "typecheck verde" não diz nada sobre a alegação 4 do plano.

---

## 5. Alegações do plano que não se sustentam

### C1 · "Migrations aplicadas no remoto" — sem lastro local, evidência aponta o contrário — **Alto**

Nenhum comando de banco foi executado nesta auditoria; isto vem só de leitura de arquivos.

1. **Cronologia impossível.** O diretório de traces do Supabase CLI tem três arquivos; o mais novo (`2026-09-07.ndjson`) tem mtime **06/09/2026 22:05:51**. As duas migrations têm mtime **07/09/2026 00:26:54** e **00:44:58** — ambas escritas **depois** da última atividade registrada do CLI nesta máquina. Nenhum trace foi tocado depois.
2. **O SQL não aparece em trace nenhum.** Busca por `deliver_mid_repair`, `previous_status_before_cancellation`, `collection_not_cancelable_draft` e `item_not_ready` nos traces não retorna nada, embora os traces gravem `db.query.text` completo dos statements empurrados.
3. **O último push registrado foi outra migration:** o corpo de `private.encode_collection_cursor`, isto é `20260906220000` (o fix de cursor), seguido de um `migration list`.
4. **A frase "aplicada" veio de um commit só de docs** (`091429a docs(workshop): record PR 3 and PR 4 migrations as applied`, 12 linhas em dois `.md`). Nada foi executado por esse commit.

Leitura honesta: **o código e as migrations existem e estão commitados, mas nenhum artefato local sustenta "aplicada no remoto", e o melhor artefato disponível aponta no sentido contrário.** Ressalva justa: telemetria de CLI não é trilha de auditoria garantida — um push de CI, de outra máquina, ou com telemetria desligada não deixaria rastro aqui. Então é "não substanciado e contrariado pela melhor evidência local", não prova de que o remoto não os tem. Dado que o próprio plano manda `db push --dry-run` → humano → push, isto precisa de reconferência humana contra `supabase_migrations.schema_migrations`.

### C2 · A regra "Não juntar 3+4" do próprio plano foi violada — **Médio**

O §3 diz literalmente "Não juntar 3+5. **Não juntar 3+4**" e a tabela apresenta PR 1–4 como quatro entregas de um eixo cada. Na prática os dois eixos vieram num **único commit** `859b1c8 feat(workshop): deliver mid-repair and name the cancel-draft error` — as duas migrations, as mudanças de hub, e o próprio documento que proíbe a combinação, tudo junto (22 arquivos, +1683/−53).

Isso importa concretamente para o PR 5: o §8 diz "o SQL do PR 5 nasce do corpo **shipped** do PR 3", e esse corpo agora está num commit entrelaçado com o eixo de cancel.

### C3 · `docs/README.md` nunca recebeu a atualização do PR 3 / PR 4 — **Médio**

O índice para em `20260906220000` (linha 53). Nem `20260907000000` nem `20260907010000` aparecem em lugar nenhum de `docs/README.md`. Como o `AGENTS.md` manda ler `docs/README.md` como índice de pre-flight, um agente que siga a governança recebe o retrato pré-PR-3.

### C4 · Docs que ainda afirmam a regra antiga — **Baixo**

- `docs/design-patterns/system-scan-for-bugs.md:381` — "Entrega é permitida em `ready`, `invoiced` e `partial_delivery`", sem `in_service`. Duas linhas abaixo (383) há a nota "Leftovers PR 3" que a supera, então o arquivo afirma as duas regras.
- `docs/execution/phase-3c-reconnecting-ui.md:458-460` — matriz de CTA pré-PR-3 (`in_service` sem a extra "Entregar itens prontos"). Marcado como concluído, mas não arquivado e sem emenda no status.
- `docs/execution/fase3-5-ready-to-implement-fix-plan.md:782,784` — mesmo problema.

### C5 · Inventário de guards do PR 5 está incompleto — **Médio** — **parse-by-row 2026-09-07 (L3); qtd 0 continua no PR 5**

O §8 (linha 189) lista quatro guards de `quantity_observed > 0`. Existe um **quinto**, no caminho de leitura:

```136:146:sistema-coleta/src/_pages/collection-operations/api/queries.ts
        quantityObserved: z.number().positive(),
        // ...
    .safeParse(normalizeOperationsPayload(data)).data ?? [];
```

Importa mais que os outros pelo modo de falha: `?? []` faz uma única linha com `quantity_observed = 0` invalidar o **array inteiro** e devolver `[]` em silêncio — mesmo padrão de A4. O PR 5 precisa relaxar isto também, e o plano não diz.

Nota lateral: `getWorkshopCheckInItems` **não tem nenhum caller** em `src/` ou `app/`. A afirmação substantiva do plano ("orçamento, progresso e entrega nunca leem `workshop_checkin_items`") se confirma, mas o leitor de DAL já existe — vale saber antes de escopar o PR 5 como "adicionar três leitores novos".

### C6 · Contagem de testes desatualizada — **Nit**

O plano diz "521 testes". A execução local de 07/09/2026 dá **532 passed, 18 skipped** (550 total). Não é falso, é velho.

---

## 6. PR 1 — achados

### D1 · Regressão desktop: grid de duas colunas espremido em 448px — **Médio** — **corrigido 2026-09-07 (L7)**

```111:113:sistema-coleta/src/_pages/company-settings/ui/company-settings-form.tsx
        <div className="grid gap-4 md:grid-cols-2">
```

O shell pré-PR-1 era `max-w-4xl px-4 py-8` (~864px), então `md:grid-cols-2` dava duas colunas de ~420px. Agora é `max-w-md` (448px) menos `px-4` dos dois lados = 416px de conteúdo. Em viewport ≥768px o breakpoint `md:` ainda dispara, e doze campos — incluindo "Nome do signatário" e "Cargo do signatário" — renderizam em duas colunas de ~200px. No telemóvel é coluna única e está correto; isto é desktop-only. O plano descreve o PR 1 como adição pura de chrome, o que é verdade do arquivo de página, mas a consequência para o form não foi avaliada.

### D2 · O PR 1 apagou a única copy explicativa da página — **Médio** — **corrigido 2026-09-07 (L7)**

O diff de `dca4bea` remove, sem substituto, o parágrafo "Estes dados identificam a MJT na guia de coleta (PDF)…" e o wrapper `<section className="rounded-medium border … shadow-surface">`. O `IssuerSetupBanner` compensa parcialmente listando campos faltantes, mas o **porquê** — que esses campos destravam a emissão do número oficial e o PDF — sumiu da UI. O form agora encosta no fundo sem padding sob o header sticky.

### D3 · `backHref` fixo em `/dashboard`, mas há duas portas de entrada — **Médio** — **corrigido 2026-09-07 (L7)**

`dashboard-page.tsx:183` e `collector-profile-page.tsx:67` (o hub `/configuracoes`, botão "Editar Perfil Institucional") apontam ambos para `/configuracoes/empresa`. Quem chega pelo hub e aperta Voltar cai no `/dashboard`, pulando o hub de onde veio. Não é mais uma trap, mas é o alvo errado para um dos dois caminhos.

### D4 · Estado ativo da nav depende de hidratação e não tem `aria-current` — **Baixo**

```62:63:sistema-coleta/src/shared/ui/mobile-bottom-nav.tsx
        const isActive = hydrated && (pathname ?? "").startsWith(item.matchPrefix);
```

O prefix match em si está certo (`"/configuracoes/empresa".startsWith("/configuracoes")`), mas `isActive` é `false` no HTML do servidor até `useHydrated()` virar — há flash sem aba ativa, e o estado nunca aparece sem JS. O ativo é comunicado só por cor e peso de fonte, sem `aria-current="page"`. Pré-existente no componente compartilhado.

### D5 · Hub e folha agora têm `<h1>` e subtítulo idênticos — **Baixo**

`collector-profile-page.tsx:18-20` (`/configuracoes`) e `company-settings-page.tsx:13-14` (`/configuracoes/empresa`) renderizam ambos "Empresa" / "Dados institucionais". Duas páginas distintas, uma identidade. O PR 1 copiou o par do hub deliberadamente, então a colisão está shipped.

---

## 7. Nits e observações menores

- **`collection_events` não registra o fato mid-repair.** `20260907000000:232-248` é idêntico à versão anterior: grava `'partial', remaining > 0` mas não `remaining`, nem o status resultante da OS, nem quais itens seguem em reparo. `event_type` continua `'collection.delivered'` numa entrega parcial. O comportamento central do PR 3 (OS para `in_service` em vez de `ready`) não deixa rastro no log append-only.
- **PR 4 também não grava metadata da transição da OS.** O plano diz "não gravar **só** em `collection_events.metadata`", o que foi lido como "não gravar em metadata". Um `jsonb_build_object('serviceOrderPreviousStatus', …)` custaria nada e tornaria A7/A8 diagnosticáveis depois do fato.
- **`deliver_to_customer` atualiza a OS sem filtro de tenant** (`20260907000000:226`: `where id = order_record.id`), enquanto o PR 4 filtra `organization_id` em todos os writes. Herdado de `20260906160000:170-174`, não introduzido aqui — mas a assimetria merece um olhar.
- **`item_not_ready` ofusca `collection_item_not_found`.** O check em `:121-134` roda antes do loop em `:136-145`, então id de outro tenant, removido ou inexistente devolve "Somente itens marcados como Pronto podem ser entregues." A segurança não muda; a mensagem engana e `collection_item_not_found` virou quase código morto nesse RPC.
- **`request_hash` não cobre `p_delivered_item_ids`.** `digestLifecycleRequest` (`commands.ts:30-34`) só cobre operação, coleta, versão e motivo. Mitigado hoje porque a idempotency key é o `signatureIntentId` gerado a cada tentativa e `p_expected_version` está no hash — mas entrega parcial torna múltiplas entregas por coleta a norma, e esse guard passou a ser load-bearing.
- **`getBudgetItems` roda duas vezes por request** (`entrega/page.tsx:10-13` + `load-operation.ts:20`; mesmo em `progresso/page.tsx:9`). Duas idas idênticas ao banco em página `force-dynamic`.
- **Códigos de entrega ausentes do registry estável** `shared/lib/action-failure-code.ts:5-31`: falta `item_not_ready`, `item_already_delivered`, `duplicate_delivery_item`, `collection_not_cancelable_draft`. Passam pelo fallback de regex, então o comportamento está certo — o registry é que deixou de documentar quais códigos são estáveis.
- **`update_service_progress` omite `updated_at = now()`** nos três updates de `service_orders` (`:474`, `:486`, `:506`), enquanto `deliver_to_customer:225` seta. Assimetria pré-existente, mas a migration tocou nessas linhas.
- **`service_order_record` declarado e nunca usado** em `deliver_to_customer` (`:30`).
- **`_pages` importa de `_app`** (`customer-delivery-page.tsx:12`, `service-progress-page.tsx:11`), invertendo a hierarquia do `AGENTS.md` raiz. O Steiger não pega porque `steiger.config.ts:13` desabilita `fsd/typo-in-layer-name` para `_app`/`_pages`, então esses diretórios nunca são reconhecidos como camadas. Padrão pré-existente em todo o repo.

---

## 8. Ordem sugerida de correção

Um eixo por PR, como manda o plano original. Nada aqui autoriza abrir PR — é inventário.

| Prioridade | Itens | Por quê |
| --- | --- | --- |
| 1 | **C1** | Antes de qualquer coisa: confirmar com o humano se as migrations estão no remoto. Todo o resto depende dessa resposta |
| 2 | **A2 + A3 + A12** | **Corrigido 2026-09-07** (código + `20260907020000`; push remoto ainda depende de C1) |
| 3 | **A4 + C5** | **Corrigido 2026-09-07 (L3)** — parse por linha; `quantityObserved > 0` no reader até o PR 5 |
| 4 | **A1 + A9** | **Decisão fechada 2026-09-07.** NF-e disponível em `partial_delivery`; `invoiced` não rebaixa. Implementar leftover L2. Não perguntar de novo |
| 5 | **A5 + A6** | Eixo SQL de invariantes de item (L4). A5: `remaining` só entregáveis; A6 unique index |
| 6 | **B1 + B2** | pgTAP para a cadeia de entrega e para o PR 4 (L5) |
| 7 | **A7 + A8** | Eixo SQL de reopen (L6). Baixa alcançabilidade hoje, dívida real |
| 8 | **A10, A11, D1–D3** | **Corrigido 2026-09-07 (L7)** |
| 9 | **C2–C4, C6** | C3/C4/C6 emendados 07/09/2026; C2 histórico (commit 3+4) |

**Não** tocar no PR 5 antes de A5/A6 — o §8 do plano já avisa que o SQL do PR 5 nasce do corpo shipped do PR 3, e A5/A6 reescrevem exatamente o bloco `remaining`/validação de item que o PR 5 vai herdar.
