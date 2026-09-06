begin;
select plan(6);

set local role service_role;

do $$
declare
  v_org_id bigint;
  v_user_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_user_profile uuid := '11111111-1111-4111-8111-111111111111';
  v_user_signer uuid := '22222222-2222-4222-8222-222222222222';
  v_user_receiver uuid := '33333333-3333-4333-8333-333333333333';
  v_collection_admin uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_collection_profile uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc';
  v_collection_signer uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd';
  v_collection_receiver uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe';
begin
  select id into v_org_id from public.organizations where code = 'mjt' limit 1;
  if v_org_id is null then
    raise exception 'fixture_org_missing';
  end if;

  insert into public.profiles (user_id, full_name, status)
  values
    (v_user_admin, null, 'active'),
    (v_user_profile, 'Nome Perfil', 'active'),
    (v_user_signer, null, 'active'),
    (v_user_receiver, null, 'active')
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    status = 'active';

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values
    (v_org_id, v_user_admin, 'administrator', 'active'),
    (v_org_id, v_user_profile, 'administrator', 'active'),
    (v_org_id, v_user_signer, 'administrator', 'active'),
    (v_org_id, v_user_receiver, 'administrator', 'active')
  on conflict (organization_id, user_id) do update set role_code = 'administrator', status = 'active';

  insert into public.collections (
    id, organization_id, status, row_version, created_by
  ) values
    (v_collection_admin, v_org_id, 'draft', 1, v_user_admin),
    (v_collection_profile, v_org_id, 'draft', 1, v_user_profile),
    (v_collection_signer, v_org_id, 'draft', 1, v_user_signer),
    (v_collection_receiver, v_org_id, 'draft', 1, v_user_receiver)
  on conflict (id) do nothing;

  insert into public.collection_events (
    id, organization_id, collection_id, actor_user_id, event_type, metadata, created_at
  ) values
    (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      v_org_id,
      v_collection_admin,
      v_user_admin,
      'collection.workshop.checked_in',
      jsonb_build_object('administratorName', 'Operador Check-in'),
      now()
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
      v_org_id,
      v_collection_profile,
      v_user_profile,
      'collection.workshop.checked_in',
      jsonb_build_object('administratorName', 'Operador Check-in'),
      now()
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccce',
      v_org_id,
      v_collection_signer,
      v_user_signer,
      'collection.budget.approved',
      jsonb_build_object('signerName', 'Responsavel Orcamento'),
      now()
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccf',
      v_org_id,
      v_collection_receiver,
      v_user_receiver,
      'collection.delivered',
      jsonb_build_object('receiverName', 'Cliente Entrega'),
      now()
    )
  on conflict (id) do nothing;
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

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc'::uuid, null, 50) as payload
)
select is(
  (select payload->'items'->0->>'actorName' from result),
  'Nome Perfil',
  'actorName prefers profile.full_name over metadata.administratorName'
);

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd'::uuid, null, 50) as payload
)
select is(
  (select payload->'items'->0->>'actorName' from result),
  'Responsavel Orcamento',
  'actorName matches metadata.signerName when profile.full_name and administratorName are absent'
);

with result as (
  select public.list_collection_events('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe'::uuid, null, 50) as payload
)
select is(
  (select payload->'items'->0->>'actorName' from result),
  'Cliente Entrega',
  'actorName matches metadata.receiverName when profile.full_name and administratorName are absent'
);

select * from finish();
rollback;
