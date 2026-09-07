# Fase 3 — Operacao de oficina e faturamento

## Objetivo

Dar continuidade rastreavel a coleta apos sua retirada, sem transformar o V1 em um ERP completo.

## Estado real (22/08/2026)

**EXECUTADA — Sessão 3a (Migration).** A Fase 3 estava NAO INICIADA até esta sessão.
A migration `20260822125100_phase_3_operations_workshop.sql` foi criada (por outra
sessão em 12:51), validada e aplicada no remoto. O que existe agora:

1. Migration aditiva aplicada: `supabase/migrations/20260822125100_phase_3_operations_workshop.sql`
   - Constraints `collections.status`, `collection_events.previous_status/new_status` ampliadas para os 14 estados do workflow (draft → collected → in_workshop → in_budget → awaiting_approval → approved → in_service → ready → invoiced → partial_delivery → delivered + rejected/reopened).
   - Tabelas: `service_orders`, `service_order_items`, `invoice_references`, `delivery_items`, `workshop_checkin_items`.
   - 7 RPCs `security definer`: `workshop_check_in`, `create_technical_budget`, `approve_technical_budget`, `update_service_progress`, `register_invoice_reference`, `deliver_to_customer`, `cancel_or_reopen_collection`.
   - RLS admin-only + grants replicando padrão Fase 1A.
2. Contratos Zod prontos: `src/_pages/collection-operations/model/contracts.ts` (7 schemas) + `tests/unit/mobile-phase4-operations.test.ts`.
3. Testes pgTAP: `supabase/tests/phase_3_operations_workshop_test.sql` (48 assertions: tabelas, colunas, RPCs, RLS, grants, roles anon/authenticated).
4. `supabase db push --dry-run` → verde; `supabase db push` → aplicado com sucesso no remoto.

**Fase 0 (scan B01–B09, 29/08/2026):** migration `20260829220000_phase_0_workshop_schema_contracts.sql` — CHECKs de identidade/cancel/SO `rejected`, coluna `collections.check_in_signature_path`, unique de `delivery_terms` por coleta removido, REPLACE 3b de `create_technical_budget`/`update_service_progress`, snapshot de cliente em todo status emitido em `get_collection_detail`/`list_collections`. Sem `DROP FUNCTION`. Aplicacao no remoto: ver `docs/supabase.md`.

**Codigo da oficina no `main` (06/09/2026, ate `30d8621`):** telas de check-in, orcamento, aprovacao, progresso, NF-e, entrega, cancelar/reabrir; filtro “Em reparo” nao inclui `ready` (5.2); lista/dashboard com RPC (5.1/5.3); check-in exige todos os itens (5.8); OS `delivered` (5.9); guard de status nas rotas `/oficina/*` (5.17). Inventario: [`system-scan-for-bugs.md`](../design-patterns/system-scan-for-bugs.md).

O que **ainda** falta (nao reabrir o que o scan marca **feito**):

- **Adiado 06/09/2026:** SignaturePad na aprovacao (**5.7**, nome/CNPJ bastam); UI `/clientes` (**5.12**) e contatos/veiculos (**5.13**).
- **5.6 feito no remoto e em Production:** entrega a partir de Pronto; NF-e opcional (`20260906210000`).
- Cursor de lista/dashboard compacto no remoto (`20260906220000`, 06/09/2026).
- Relatorios operacionais de volume/ciclo (passo 7 abaixo) — nunca foram eixo do scan.
- Backfills de OS `delivered` / `canceled_at` obsoleto: `SELECT` + aprovacao humana, nao codigo.

## Passos

1. Implementar transicoes de estado autorizadas conforme `data-and-rules.md`.
2. Criar painel de pendencias por estado, periodo e responsavel.
3. Registrar a entrada item a item na oficina propria fixa da MJT, orcamento, aprovacao, reparo, pronto e entrega como eventos.
4. Criar ordem de servico vinculada a coleta quando a operacao exigir detalhes adicionais.
5. Registrar referencia manual da NF-e: numero, serie, data e observacao; nao emitir a nota.
6. Exibir timeline unificada para escritorio, oficina e financeiro, respeitando permissoes.
7. Criar relatorios operacionais basicos de volume e tempo de ciclo.
8. Gerar termo digital de entrega com os itens prontos, assinatura do cliente com nome e CNPJ e suporte a entregas parciais.

## Regras

- Uma NF-e referencia a coleta; ela nao substitui sua guia nem altera itens assinados.
- Transicoes nao devem ser atalhadas no banco por edicao manual; devem passar por comando auditado.
- Caso uma coleta nao vire servico, marcar `nao_aprovada` ou `cancelada` com motivo, preservando o documento.
- A entrega parcial registra somente os itens efetivamente entregues; os itens restantes permanecem pendentes ate uma nova entrega.

## Criterios de aceite

- A equipe identifica em segundos onde cada coleta esta no fluxo.
- Financeiro consegue localizar a coleta pela referencia fiscal e vice-versa.
- Relatorios nao expõem dados fora da permissao do usuario.
