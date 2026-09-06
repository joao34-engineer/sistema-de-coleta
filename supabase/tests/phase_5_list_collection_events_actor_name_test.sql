begin;
select plan(3);

set local role service_role;

do $$
declare
  v_org_id bigint;
  v_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_collection_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  select id into v_org_id from public.organizations where code = 'mjt' limit 1;
  if v_org_id is null then
    raise exception 'fixture_org_missing';
  end if;

  insert into public.profiles (user_id, full_name, status)
  values (v_user_id, null, 'active')
  on conflict (user_id) do update set full_name = null, status = 'active';

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values (v_org_id, v_user_id, 'administrator', 'active')
  on conflict (organization_id, user_id) do update set role_code = 'administrator', status = 'active';

  insert into public.collections (
    id, organization_id, status, row_version, created_by
  ) values (
    v_collection_id, v_org_id, 'draft', 1, v_user_id
  ) on conflict (id) do nothing;

  insert into public.collection_events (
    id, organization_id, collection_id, actor_user_id, event_type, metadata, created_at
  ) values (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    v_org_id,
    v_collection_id,
    v_user_id,
    'collection.workshop.checked_in',
    jsonb_build_object('administratorName', 'Operador Check-in'),
    now()
  ) on conflict (id) do nothing;
end $$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, null, 50) as payload
)
select ok(
  (select jsonb_array_length(payload->'items') from result) = 1,
  'list_collection_events returns one event'
);

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, null, 50) as payload
)
select isnt(
  (select payload->'items'->0->>'actorName' from result),
  null,
  'actorName is resolved from metadata when profile.full_name is null'
);

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, null, 50) as payload
)
select is(
  (select payload->'items'->0->>'actorName' from result),
  'Operador Check-in',
  'actorName matches metadata.administratorName'
);

select * from finish();
rollback;
