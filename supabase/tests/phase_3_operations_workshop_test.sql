begin;
select plan(48);

-- 1. Tabelas novas existem
select has_table('public', 'service_orders', 'service_orders table exists');
select has_table('public', 'service_order_items', 'service_order_items table exists');
select has_table('public', 'invoice_references', 'invoice_references table exists');
select has_table('public', 'delivery_items', 'delivery_items table exists');
select has_table('public', 'workshop_checkin_items', 'workshop_checkin_items table exists');

-- 2. Colunas essenciais
select has_column('public', 'service_orders', 'status', 'service_orders carry status');
select has_column('public', 'service_orders', 'labor_brl', 'service_orders carry labor cost');
select has_column('public', 'service_orders', 'parts_brl', 'service_orders carry parts cost');
select has_column('public', 'invoice_references', 'number', 'invoice references carry number');
select has_column('public', 'invoice_references', 'series', 'invoice references carry series');
select has_column('public', 'invoice_references', 'total_brl', 'invoice references carry total');
select has_column('public', 'delivery_items', 'collection_item_id', 'delivery items link to collection items');

-- 3. Constraints de status
select is((
  select pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid = 'public.service_orders'::regclass
    and contype = 'c'
    and conname = 'service_orders_status_check'
), '(status = ANY (ARRAY[\'draft\'::text, \'budgeted\'::text, \'approved\'::text, \'in_service\'::text, \'ready\'::text, \'canceled\'::text]))', 'service_orders status constraint matches allowed values');

-- 4. Constraints de integridade referencial
select is((
  select count(*)::integer from pg_constraint
  where conrelid = 'public.service_orders'::regclass
    and contype = 'f'
    and confrelid = 'public.collections'::regclass
), 1, 'service_orders references collections with composite FK');

-- 5. RPCs existem com assinaturas corretas
select has_function('public', 'workshop_check_in', array['uuid', 'integer', 'text', 'text', 'jsonb', 'text'], 'workshop check-in RPC exists');
select has_function('public', 'create_technical_budget', array['uuid', 'integer', 'jsonb', 'text'], 'technical budget RPC exists');
select has_function('public', 'approve_technical_budget', array['uuid', 'integer', 'boolean', 'text', 'text', 'text'], 'budget approval RPC exists');
select has_function('public', 'update_service_progress', array['uuid', 'integer', 'jsonb'], 'service progress RPC exists');
select has_function('public', 'register_invoice_reference', array['uuid', 'integer', 'text', 'text', 'date', 'numeric', 'text'], 'invoice reference RPC exists');
select has_function('public', 'deliver_to_customer', array['uuid', 'integer', 'uuid[]', 'text', 'text', 'text', 'text'], 'customer delivery RPC exists');
select has_function('public', 'cancel_or_reopen_collection', array['uuid', 'integer', 'text', 'text'], 'cancel/reopen RPC exists');

-- 6. Todas as RPCs sao security definer com search_path fixo
select is((select prosecdef from pg_proc where oid = 'public.workshop_check_in(uuid, integer, text, text, jsonb, text)'::regprocedure), true, 'workshop_check_in is security definer');
select is((select prosecdef from pg_proc where oid = 'public.create_technical_budget(uuid, integer, jsonb, text)'::regprocedure), true, 'create_technical_budget is security definer');
select is((select prosecdef from pg_proc where oid = 'public.approve_technical_budget(uuid, integer, boolean, text, text, text)'::regprocedure), true, 'approve_technical_budget is security definer');
select is((select prosecdef from pg_proc where oid = 'public.update_service_progress(uuid, integer, jsonb)'::regprocedure), true, 'update_service_progress is security definer');
select is((select prosecdef from pg_proc where oid = 'public.register_invoice_reference(uuid, integer, text, text, date, numeric, text)'::regprocedure), true, 'register_invoice_reference is security definer');
select is((select prosecdef from pg_proc where oid = 'public.deliver_to_customer(uuid, integer, uuid[], text, text, text, text)'::regprocedure), true, 'deliver_to_customer is security definer');
select is((select prosecdef from pg_proc where oid = 'public.cancel_or_reopen_collection(uuid, integer, text, text)'::regprocedure), true, 'cancel_or_reopen_collection is security definer');

-- 7. Constraints de status expandidos em collections e collection_events
select is((
  select pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_status_check'
), '(status = ANY (ARRAY[\'draft\'::text, \'collected\'::text, \'canceled\'::text, \'in_workshop\'::text, \'in_budget\'::text, \'awaiting_approval\'::text, \'approved\'::text, \'in_service\'::text, \'ready\'::text, \'invoiced\'::text, \'partial_delivery\'::text, \'delivered\'::text, \'rejected\'::text, \'reopened\'::text]))', 'collections status expanded for full workflow');
select is((
  select pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid = 'public.collection_events'::regclass
    and contype = 'c'
    and conname = 'collection_events_previous_status_check'
), '(previous_status IS NULL OR previous_status = ANY (ARRAY[\'draft\'::text, \'collected\'::text, \'canceled\'::text, \'in_workshop\'::text, \'in_budget\'::text, \'awaiting_approval\'::text, \'approved\'::text, \'in_service\'::text, \'ready\'::text, \'invoiced\'::text, \'partial_delivery\'::text, \'delivered\'::text, \'rejected\'::text, \'reopened\'::text]))', 'collection_events previous_status accepts all workflow states');

-- 8. Row version / concorrencia otimista
select has_column('public', 'collections', 'row_version', 'collections keep optimistic locking');

-- 9. Anon nao pode ler/escrever tabelas da oficina
set local role anon;
select throws_ok($$select id from public.service_orders$$, '42501', 'permission denied for table service_orders', 'anon cannot read service_orders');
select throws_ok($$select id from public.collection_events$$, '42501', 'permission denied for table collection_events', 'anon cannot read collection_events');
reset role;

-- 10. Anon nao pode chamar RPCs da oficina
set local role anon;
select throws_ok($$select public.workshop_check_in(gen_random_uuid(), 1, 'a', '52998224725', '[]'::jsonb, 'sig')$$, '42501', 'permission denied for function workshop_check_in', 'anon cannot call workshop_check_in');
select throws_ok($$select public.cancel_or_reopen_collection(gen_random_uuid(), 1, 'cancel', 'motivo')$$, '42501', 'permission denied for function cancel_or_reopen_collection', 'anon cannot call cancel_or_reopen_collection');
reset role;

-- 11. Eventos de coleta sao imutaveis
select is((
  select count(*)::integer
  from pg_trigger
  where tgrelid = 'public.collection_events'::regclass
    and tgenabled = 'O'
    and pg_get_triggerdef(oid) like '%prevent_immutable_record_mutation%'
), 1, 'collection_events has immutability trigger');

-- 12. Policies de RLS replicadas (admin-only via current_user_is_admin)
select is((
  select count(*)::integer
  from pg_policies
  where schemaname = 'public' and tablename = 'service_orders'
    and policyname = 'service_orders_admin_all'
    and pgpolicies_using ~ 'current_user_is_admin'
), 1, 'service_orders admin policy uses current_user_is_admin');
select is((
  select count(*)::integer
  from pg_policies
  where schemaname = 'public' and tablename = 'invoice_references'
    and policyname = 'invoice_references_admin_all'
    and pgpolicies_using ~ 'current_user_is_admin'
), 1, 'invoice_references admin policy uses current_user_is_admin');

-- 13. Grants minimos: authenticated recebe apenas select/insert/update (sem delete)
select is(has_table_privilege('authenticated', 'public.service_orders', 'select'), true, 'authenticated can read service_orders');
select is(has_table_privilege('authenticated', 'public.service_orders', 'delete'), false, 'authenticated cannot delete service_orders');
select is(has_table_privilege('authenticated', 'public.invoice_references', 'delete'), false, 'authenticated cannot delete invoice_references');
select is(has_table_privilege('authenticated', 'public.delivery_items', 'delete'), false, 'authenticated cannot delete delivery_items');

-- 14. Grants de RPC para authenticated (papel correto tem acesso)
select is(has_function_privilege('authenticated', 'public.workshop_check_in(uuid, integer, text, text, jsonb, text)', 'execute'), true, 'authenticated can call workshop_check_in');
select is(has_function_privilege('authenticated', 'public.budget_approval(uuid, integer, boolean, text, text, text)', 'execute'), true, 'authenticated can call budget approval');
select is(has_function_privilege('authenticated', 'public.deliver_to_customer(uuid, integer, uuid[], text, text, text, text)', 'execute'), true, 'authenticated can call customer delivery');

-- 15. Nota: a migration Fase 3 (20260822125100) NAO amplia o ledger de
--     idempotencia nem usa idempotency_key/request_hash nas RPCs — as transicoes
--     sao validadas via row_version otimista em vez de replay idempotent.
--     Idempotencia via ledger e intents privados para assinatura ficam como
--     backlog de refinamento (Sessao 3b+), preservando compatibilidade com 1A.
select is(has_table('public', 'idempotency_requests'), true, 'idempotency ledger retained from phase 1');

select * from finish();
rollback;
