begin;
select plan(52);

select has_table('public', 'customers', 'customers exists');
select has_table('public', 'customer_contacts', 'customer contacts exists');
select has_table('public', 'customer_addresses', 'customer addresses exists');
select has_table('public', 'vehicles', 'vehicles exists');
select has_table('public', 'collections', 'collections exists');
select has_table('public', 'collection_items', 'collection items exists');
select has_table('public', 'evidences', 'evidences exists');
select has_table('public', 'signatures', 'signatures exists');
select has_table('public', 'collection_sequences', 'collection sequences exists');
select has_table('public', 'collection_events', 'collection events exists');
select has_table('public', 'documents', 'documents exists');
select has_table('public', 'idempotency_requests', 'idempotency requests exists');

select has_column('public', 'collections', 'row_version', 'collections use optimistic locking');
select has_column('public', 'collections', 'official_code', 'collections retain official code');
select has_column('public', 'documents', 'snapshot_hash', 'documents retain a hash');
select has_column('public', 'documents', 'verification_token', 'documents retain a verification token');
select has_column('public', 'idempotency_requests', 'request_hash', 'idempotency binds a request hash');

select is(private.is_valid_cpf_cnpj('52998224725'), true, 'valid CPF is accepted');
select is(private.is_valid_cpf_cnpj('11111111111'), false, 'repeated CPF is rejected');
select is(private.is_valid_cpf_cnpj('04252011000110'), true, 'valid CNPJ is accepted');
select is(private.is_valid_cpf_cnpj('04252011000111'), false, 'invalid CNPJ is rejected');

select has_function('public', 'save_collection_signature', array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'integer'], 'signature command exists');
select has_function('public', 'finalize_collection', array['uuid', 'integer', 'uuid', 'text'], 'finalize command exists');
select has_function('public', 'cancel_collection', array['uuid', 'integer', 'text', 'uuid', 'text'], 'cancel command exists');
select has_function('public', 'reopen_collection', array['uuid', 'integer', 'text', 'uuid', 'text'], 'reopen command exists');
select has_function('public', 'verify_collection_document', array['text'], 'public verification command exists');
select is((select prosecdef from pg_proc where oid = 'public.finalize_collection(uuid, integer, uuid, text)'::regprocedure), true, 'finalize is controlled by security definer');
select is((select coalesce(proconfig::text, '') like '%search_path=%' from pg_proc where oid = 'public.finalize_collection(uuid, integer, uuid, text)'::regprocedure), true, 'finalize pins search path');
select is(has_function_privilege('anon', 'public.finalize_collection(uuid, integer, uuid, text)', 'execute'), false, 'anon cannot finalize');
select is(has_function_privilege('authenticated', 'public.finalize_collection(uuid, integer, uuid, text)', 'execute'), true, 'authenticated receives minimum finalize grant');
select is(has_function_privilege('anon', 'public.verify_collection_document(text)', 'execute'), true, 'anon can use the narrow verification RPC');

select is((select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in ('customers', 'customer_contacts', 'customer_addresses', 'vehicles', 'collections', 'collection_items', 'evidences', 'signatures', 'collection_sequences', 'collection_events', 'documents', 'idempotency_requests') and relrowsecurity), 12, 'all phase 1 tables enable RLS');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'collections' and policyname = 'collections_update_draft_admin'), 1, 'draft-only collection update policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'evidences' and policyname = 'evidences_insert_draft_admin'), 1, 'evidence insert is draft-only');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'signatures' and policyname = 'signatures_insert_draft_admin'), 1, 'signature insert is draft-only');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'documents' and policyname = 'documents_select_admin'), 1, 'documents have read policy only');
select is(has_table_privilege('authenticated', 'public.documents', 'update'), false, 'normal users cannot update documents');
select is(has_table_privilege('authenticated', 'public.documents', 'delete'), false, 'normal users cannot delete documents');
select is(has_table_privilege('authenticated', 'public.signatures', 'update'), false, 'normal users cannot update signatures');
select is(has_table_privilege('authenticated', 'public.signatures', 'delete'), false, 'normal users cannot delete signatures');
select is(has_table_privilege('authenticated', 'public.collection_events', 'update'), false, 'normal users cannot update events');
select is(has_table_privilege('authenticated', 'public.collection_events', 'delete'), false, 'normal users cannot delete events');

select is((select public from storage.buckets where id = 'collection-evidences'), false, 'evidence bucket remains private');
select is((select public from storage.buckets where id = 'collection-signatures'), false, 'signature bucket remains private');
select is((select public from storage.buckets where id = 'collection-documents'), false, 'document bucket remains private');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'collection_evidences_insert_draft_admin'), 1, 'evidence storage upload policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'collection_signatures_insert_draft_admin'), 1, 'signature storage upload policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'collection_documents_insert_admin'), 1, 'document storage upload policy exists');

set local role anon;
select throws_ok($$select id from public.collections$$, '42501', 'permission denied for table collections', 'anon cannot read collections');
select throws_ok($$select id from public.documents$$, '42501', 'permission denied for table documents', 'anon cannot read documents');
select throws_ok($$select id from public.signatures$$, '42501', 'permission denied for table signatures', 'anon cannot read signatures');
select throws_ok($$insert into public.collection_events (organization_id, collection_id, event_type) values (1, gen_random_uuid(), 'forbidden')$$, '42501', 'permission denied for table collection_events', 'anon cannot append audit events');
reset role;

-- Fase 5.11: lifecycle cancel -> reopen deve limpar canceled_at.
-- Setup como superusuário para bypassar RLS; a execução dos comandos usa
-- role authenticated + request.jwt.claims, espelhando a sessão real.
create temporary table if not exists test_lifecycle_ctx (
  collection_id uuid,
  user_id uuid
);

do $$
declare
  test_org_id bigint;
  test_user_id uuid;
  test_customer_id uuid;
  test_collection_id uuid;
  test_official_code text;
begin
  select id into test_org_id from public.organizations where code = 'mjt' limit 1;
  if test_org_id is null then
    insert into public.organizations (code, display_name) values ('mjt', 'MJT') returning id into test_org_id;
  end if;

  test_user_id := gen_random_uuid();
  insert into auth.users (id, email)
  values (test_user_id, 'lifecycle-test-' || test_user_id::text || '@example.com');

  insert into public.organization_memberships (organization_id, user_id, role_code)
  values (test_org_id, test_user_id, 'administrator');

  insert into public.customers (organization_id, legal_name, tax_id, phone, created_by)
  values (test_org_id, 'Lifecycle Test Customer', '52998224725', '11987654321', test_user_id)
  returning id into test_customer_id;

  test_official_code := 'MJT-2026-' || lpad(floor(random() * 1000000)::integer::text, 6, '0');

  insert into public.collections (
    organization_id, customer_id, customer_snapshot, status, official_code,
    issued_year, sequence_number, created_by
  ) values (
    test_org_id, test_customer_id,
    jsonb_build_object(
      'id', test_customer_id,
      'legal_name', 'Lifecycle Test Customer',
      'tax_id', '52998224725',
      'phone', '11987654321'
    ),
    'collected', test_official_code, 2026, 1, test_user_id
  ) returning id into test_collection_id;

  insert into test_lifecycle_ctx (collection_id, user_id)
  values (test_collection_id, test_user_id);
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select user_id::text from test_lifecycle_ctx))::text,
  true
);

select public.cancel_collection(
  (select collection_id from test_lifecycle_ctx),
  1,
  'lifecycle cancel reason',
  gen_random_uuid(),
  repeat('0', 64)
);

select public.reopen_collection(
  (select collection_id from test_lifecycle_ctx),
  2,
  'lifecycle reopen reason',
  gen_random_uuid(),
  repeat('0', 64)
);

reset role;

select is(
  (select canceled_at from public.collections where id = (select collection_id from test_lifecycle_ctx)),
  null::timestamptz,
  'lifecycle cancel then reopen leaves canceled_at null'
);

select * from finish();
rollback;
