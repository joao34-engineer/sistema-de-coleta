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

O que falta para Fase 3 completa (Sessões 3b/3c):
- Comandos server-only consumindo os schemas Zod + Route Handlers finos em `app/api/...`
- Religar telas do Figma 8-9 com dados reais (entry point: `/coletas/[id]/documentos` ou nova tela de detalhe).
- Corrigir filtro "Em reparo" em `collections-list-page.tsx` (hoje mapeia `draft`).

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
