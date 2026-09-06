begin;
select plan(20);

-- 0.2 — coluna de assinatura de check-in no cabecalho
select has_column('public', 'collections', 'check_in_signature_path', 'collections carry check_in_signature_path');

-- 0.1 — identidade emitida; antigo collections_check removido
select is((
  select count(*)::integer from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_issued_identity_check'
), 1, 'collections_issued_identity_check exists');
select is((
  select count(*)::integer from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_check'
), 0, 'legacy collections_check is gone');

-- 0.3 — previous_status aceita oficina; sem canceled/delivered
select is((
  select pg_get_constraintdef(oid) like '%in_workshop%'
    and pg_get_constraintdef(oid) like '%in_budget%'
    and pg_get_constraintdef(oid) like '%rejected%'
  from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_previous_status_before_cancellation_check'
), true, 'previous_status check includes workshop statuses');
select is((
  select pg_get_constraintdef(oid) not like '%''canceled''%'
  from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_previous_status_before_cancellation_check'
), true, 'previous_status check excludes canceled');
select is((
  select pg_get_constraintdef(oid) not like '%''delivered''%'
  from pg_constraint
  where conrelid = 'public.collections'::regclass
    and contype = 'c'
    and conname = 'collections_previous_status_before_cancellation_check'
), true, 'previous_status check excludes delivered');

-- 0.4 — service_orders aceita rejected
select is((
  select pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid = 'public.service_orders'::regclass
    and contype = 'c'
    and conname = 'service_orders_status_check'
), '(status = ANY (ARRAY[\'draft\'::text, \'budgeted\'::text, \'approved\'::text, \'in_service\'::text, \'ready\'::text, \'canceled\'::text, \'rejected\'::text, \'delivered\'::text]))', 'service_orders status includes rejected');

-- 0.6 — unique por coleta removido; unique (id, org) e indice permanecem
select is((
  select count(*)::integer from pg_constraint
  where conrelid = 'public.delivery_terms'::regclass
    and conname = 'delivery_terms_organization_id_collection_id_key'
), 0, 'delivery_terms unique (organization_id, collection_id) is gone');
select is((
  select count(*)::integer from pg_constraint
  where conrelid = 'public.delivery_terms'::regclass
    and contype = 'u'
    and conname = 'delivery_terms_id_organization_id_key'
), 1, 'delivery_terms unique (id, organization_id) remains');
select is((
  select count(*)::integer from pg_class
  where relnamespace = 'public'::regnamespace
    and relname = 'delivery_terms_collection_idx'
    and relkind = 'i'
), 1, 'delivery_terms_collection_idx remains');

-- 0.2 — Storage policy le path em collections
select is((
  select coalesce(qual, '') like '%collections%'
    and coalesce(qual, '') like '%check_in_signature_path%'
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'collection_signatures_read_delivery_or_checkin'
), true, 'storage policy matches collections.check_in_signature_path');

-- Grants: authenticated EXECUTE nas assinaturas 3b / 1A; anon nao
select is(has_function_privilege('authenticated', 'public.create_technical_budget(uuid, integer, jsonb, text, uuid, text)', 'execute'), true, 'authenticated can execute create_technical_budget 3b');
select is(has_function_privilege('authenticated', 'public.update_service_progress(uuid, integer, jsonb, uuid, text)', 'execute'), true, 'authenticated can execute update_service_progress 3b');
select is(has_function_privilege('authenticated', 'public.get_collection_detail(uuid)', 'execute'), true, 'authenticated can execute get_collection_detail');
select is(has_function_privilege('authenticated', 'public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer)', 'execute'), true, 'authenticated can execute list_collections');
select is(has_function_privilege('anon', 'public.create_technical_budget(uuid, integer, jsonb, text, uuid, text)', 'execute'), false, 'anon cannot execute create_technical_budget');
select is(has_function_privilege('anon', 'public.update_service_progress(uuid, integer, jsonb, uuid, text)', 'execute'), false, 'anon cannot execute update_service_progress');
select is(has_function_privilege('anon', 'public.get_collection_detail(uuid)', 'execute'), false, 'anon cannot execute get_collection_detail');
select is(has_function_privilege('anon', 'public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer)', 'execute'), false, 'anon cannot execute list_collections');

-- Sem UPDATE de tabela em collections para authenticated (RPCs sao SECURITY DEFINER)
select is(has_table_privilege('authenticated', 'public.collections', 'update'), false, 'authenticated has no table UPDATE on collections');

select * from finish();
rollback;
