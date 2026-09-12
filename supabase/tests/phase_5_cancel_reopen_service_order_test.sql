begin;
select plan(16);

create temporary table l5_cancel_ctx (
  org_id bigint,
  user_id uuid,
  draft_id uuid,
  service_id uuid,
  service_os_id uuid,
  lifecycle_id uuid,
  lifecycle_os_id uuid,
  unknown_id uuid,
  unknown_os_id uuid
);

do $$
declare
  v_org_id bigint;
  v_user_id uuid := '44444444-4444-4444-4444-444444444801';
  v_draft_id uuid := '44444444-4444-4444-4444-444444444811';
  v_service_id uuid := '44444444-4444-4444-4444-444444444812';
  v_service_os uuid := '44444444-4444-4444-4444-444444444822';
  v_service_item uuid := '44444444-4444-4444-4444-444444444832';
  v_lifecycle_id uuid := '44444444-4444-4444-4444-444444444813';
  v_lifecycle_os uuid := '44444444-4444-4444-4444-444444444823';
  v_lifecycle_item uuid := '44444444-4444-4444-4444-444444444833';
  v_unknown_id uuid := '44444444-4444-4444-4444-444444444814';
  v_unknown_os uuid := '44444444-4444-4444-4444-444444444824';
  v_unknown_item uuid := '44444444-4444-4444-4444-444444444834';
begin
  select id into v_org_id from public.organizations where code = 'mjt';
  if v_org_id is null then
    raise exception 'organization mjt not found';
  end if;

  insert into auth.users (id, email, created_at, updated_at)
  values (v_user_id, 'l5-cancel@example.com', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (user_id, full_name, status)
  values (v_user_id, 'L5 Cancel', 'active')
  on conflict (user_id) do nothing;

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values (v_org_id, v_user_id, 'administrator', 'active')
  on conflict (organization_id, user_id) do nothing;

  insert into public.collections (
    id, organization_id, status, created_by, row_version
  ) values (
    v_draft_id, v_org_id, 'draft', v_user_id, 1
  );

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  ) values
    (v_service_id, v_org_id, 'in_service', 'MJT-2026-920001', 2026, 920001,
     '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725', v_user_id, 1),
    (v_lifecycle_id, v_org_id, 'in_service', 'MJT-2026-920002', 2026, 920002,
     '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725', v_user_id, 1),
    (v_unknown_id, v_org_id, 'in_service', 'MJT-2026-920003', 2026, 920003,
     '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725', v_user_id, 1);

  update public.collections
    set status = 'canceled',
        previous_status_before_cancellation = 'collected',
        canceled_at = now(),
        canceled_by = v_user_id,
        cancel_reason = 'legacy cancel without OS previous'
  where id = v_unknown_id;

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_service_item, v_org_id, v_service_id, 'Item serviço', 1, v_user_id),
    (v_lifecycle_item, v_org_id, v_lifecycle_id, 'Item ciclo', 1, v_user_id),
    (v_unknown_item, v_org_id, v_unknown_id, 'Item desconhecido', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  ) values
    (v_service_os, v_org_id, v_service_id, v_user_id, 10, 10, 7, 'in_service'),
    (v_lifecycle_os, v_org_id, v_lifecycle_id, v_user_id, 10, 10, 7, 'in_service'),
    (v_unknown_os, v_org_id, v_unknown_id, v_user_id, 10, 10, 7, 'in_service');

  update public.service_orders
    set status = 'canceled',
        previous_status_before_cancellation = null
  where id = v_unknown_os;

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  ) values
    (v_org_id, v_service_id, v_service_item, 10, 10, 7, 'em_reparo'),
    (v_org_id, v_lifecycle_id, v_lifecycle_item, 10, 10, 7, 'em_reparo'),
    (v_org_id, v_unknown_id, v_unknown_item, 10, 10, 7, 'em_reparo');

  insert into l5_cancel_ctx (
    org_id, user_id, draft_id, service_id, service_os_id,
    lifecycle_id, lifecycle_os_id, unknown_id, unknown_os_id
  ) values (
    v_org_id, v_user_id, v_draft_id, v_service_id, v_service_os,
    v_lifecycle_id, v_lifecycle_os, v_unknown_id, v_unknown_os
  );
end $$;

select has_column(
  'public',
  'service_orders',
  'previous_status_before_cancellation',
  'service_orders store previous_status_before_cancellation'
);

select ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.service_orders'::regclass
      and conname = 'service_orders_previous_status_before_cancellation_check'
  ),
  'service_orders previous_status CHECK exists'
);

select set_config('request.jwt.claim.sub', (select user_id::text from l5_cancel_ctx), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select user_id::text from l5_cancel_ctx))::text,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.cancel_or_reopen_collection(
      (select draft_id from l5_cancel_ctx),
      1,
      'cancel',
      'tentativa de cancelar rascunho',
      '66666666-6666-6666-6666-666666666601',
      repeat('0', 64)
    )
  $sql$,
  'P0001',
  'collection_not_cancelable_draft',
  'cancel of draft is collection_not_cancelable_draft'
);

select is(
  (select status from public.collections where id = (select draft_id from l5_cancel_ctx)),
  'draft',
  'draft row stays draft after refused cancel'
);

select is(
  (select public.cancel_or_reopen_collection(
    (select service_id from l5_cancel_ctx),
    1,
    'cancel',
    'cancelamento com ordem de servico',
    '66666666-6666-6666-6666-666666666602',
    repeat('1', 64)
  )->>'status'),
  'canceled',
  'cancel in_service collection succeeds'
);

select is(
  (select status from public.service_orders where id = (select service_os_id from l5_cancel_ctx)),
  'canceled',
  'cancel marks OS canceled'
);

select is(
  (select previous_status_before_cancellation from public.service_orders where id = (select service_os_id from l5_cancel_ctx)),
  'in_service',
  'cancel stores OS previous_status_before_cancellation'
);

select throws_ok(
  $sql$
    select public.cancel_or_reopen_collection(
      (select service_id from l5_cancel_ctx),
      2,
      'cancel',
      'segunda tentativa de cancelar',
      '66666666-6666-6666-6666-666666666603',
      repeat('2', 64)
    )
  $sql$,
  'P0001',
  'collection_cannot_be_canceled',
  'second cancel of canceled collection is refused'
);

select is(
  (select previous_status_before_cancellation from public.service_orders where id = (select service_os_id from l5_cancel_ctx)),
  'in_service',
  'second cancel does not overwrite OS previous_status'
);

select is(
  (select public.cancel_or_reopen_collection(
    (select service_id from l5_cancel_ctx),
    2,
    'reopen',
    'reabrir coleta da oficina',
    '66666666-6666-6666-6666-666666666604',
    repeat('3', 64)
  )->>'status'),
  'in_service',
  'workshop reopen restores collection in_service'
);

select is(
  (select status from public.service_orders where id = (select service_os_id from l5_cancel_ctx)),
  'in_service',
  'workshop reopen restores OS in_service'
);

select is(
  (select previous_status_before_cancellation from public.service_orders where id = (select service_os_id from l5_cancel_ctx)),
  null,
  'workshop reopen clears OS previous_status_before_cancellation'
);

select is(
  (select public.cancel_or_reopen_collection(
    (select lifecycle_id from l5_cancel_ctx),
    1,
    'cancel',
    'cancelamento para reopen lifecycle',
    '66666666-6666-6666-6666-666666666605',
    repeat('4', 64)
  )->>'status'),
  'canceled',
  'lifecycle fixture cancels before 5-arg reopen'
);

select is(
  (select public.reopen_collection(
    (select lifecycle_id from l5_cancel_ctx),
    2,
    'reabrir via lifecycle',
    '66666666-6666-6666-6666-666666666606',
    repeat('5', 64)
  )->>'status'),
  'in_service',
  'lifecycle reopen_collection restores collection in_service'
);

select is(
  (select status from public.service_orders where id = (select lifecycle_os_id from l5_cancel_ctx)),
  'in_service',
  'lifecycle reopen_collection restores OS in_service'
);

select throws_ok(
  $sql$
    select public.cancel_or_reopen_collection(
      (select unknown_id from l5_cancel_ctx),
      1,
      'reopen',
      'reabrir sem mapeamento de OS',
      '66666666-6666-6666-6666-666666666607',
      repeat('6', 64)
    )
  $sql$,
  'P0001',
  'service_order_reopen_status_unknown',
  'unmapped OS reopen status raises service_order_reopen_status_unknown'
);

select * from finish();
rollback;
