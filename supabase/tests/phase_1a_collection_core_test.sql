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

select * from finish();
rollback;
