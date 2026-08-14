begin;
select plan(24);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'roles', 'roles table exists');
select has_table('public', 'organization_memberships', 'membership table exists');
select has_table('public', 'organization_settings', 'settings table exists');
select has_table('public', 'audit_events', 'audit table exists');
select has_function('private', 'current_user_is_admin', ARRAY['bigint'], 'admin helper is private');
select has_function('private', 'set_organization_settings_updated_by', ARRAY[]::text[], 'updated_by trigger helper exists');

select is((select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in ('organizations', 'profiles', 'roles', 'organization_memberships', 'organization_settings', 'audit_events') and relrowsecurity), 6, 'all application tables have RLS enabled');
select is((select public from storage.buckets where id = 'organization-assets'), false, 'organization bucket is private');
select is((select public from storage.buckets where id = 'collection-evidences'), false, 'evidence bucket is private');
select is((select public from storage.buckets where id = 'collection-signatures'), false, 'signature bucket is private');
select is((select public from storage.buckets where id = 'collection-documents'), false, 'document bucket is private');
select is((select count(*)::integer from public.organizations where code = 'mjt'), 1, 'MJT organization is unique');
select is((select count(*)::integer from public.roles where code = 'administrator'), 1, 'administrator role is unique');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'organization_settings' and policyname = 'settings_select_admin'), 1, 'settings select policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'organization_settings' and policyname = 'settings_update_admin'), 1, 'settings update policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'organization_assets_select_admin'), 1, 'private logo select policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'organization_assets_insert_admin'), 1, 'private logo insert policy exists');
select is((select count(*)::integer from pg_trigger where tgrelid = 'public.organization_settings'::regclass and tgname = 'a_settings_set_updated_by'), 1, 'settings actor trigger exists');
select is(has_column_privilege('authenticated', 'public.organization_settings', 'updated_by', 'update'), true, 'authenticated can submit actor column for trigger normalization');

set local role anon;
select throws_ok($$select id from public.organizations$$, '42501', 'permission denied for table organizations', 'anon cannot read organizations');
select throws_ok($$select organization_id from public.organization_settings$$, '42501', 'permission denied for table organization_settings', 'anon cannot read settings');
select throws_ok($$insert into public.audit_events (organization_id, event_type, subject_type, subject_id) values (1, 'forbidden', 'test', '1')$$, '42501', 'permission denied for table audit_events', 'anon cannot write audit events');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('organization-assets', '1/company-logo/forbidden.png', null)$$, '42501', 'permission denied for table objects', 'anon cannot upload a logo');
reset role;

select * from finish();
rollback;
