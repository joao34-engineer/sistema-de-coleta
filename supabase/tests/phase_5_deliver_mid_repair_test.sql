begin;
select plan(16);

create temporary table l5_deliver_ctx (
  org_id bigint,
  user_id uuid,
  mid_repair_id uuid,
  mid_pronto_id uuid,
  mid_repair_item_id uuid,
  mid_intent_id uuid,
  mid_intent_v2_id uuid,
  invoiced_id uuid,
  invoiced_pronto_id uuid,
  invoiced_repair_id uuid,
  invoiced_intent_id uuid,
  full_id uuid,
  full_item1_id uuid,
  full_item2_id uuid,
  full_intent_id uuid,
  no_os_id uuid,
  no_os_pronto_id uuid,
  no_os_orphan_id uuid,
  no_os_intent_id uuid
);

do $$
declare
  v_org_id bigint;
  v_user_id uuid := '44444444-4444-4444-4444-444444444401';
  v_mid_id uuid := '44444444-4444-4444-4444-444444444411';
  v_mid_pronto uuid := '44444444-4444-4444-4444-444444444421';
  v_mid_repair uuid := '44444444-4444-4444-4444-444444444422';
  v_mid_os uuid := '44444444-4444-4444-4444-444444444431';
  v_mid_intent uuid := '44444444-4444-4444-4444-444444444441';
  v_mid_intent_v2 uuid := '44444444-4444-4444-4444-444444444445';
  v_invoiced_id uuid := '44444444-4444-4444-4444-444444444412';
  v_invoiced_pronto uuid := '44444444-4444-4444-4444-444444444423';
  v_invoiced_repair uuid := '44444444-4444-4444-4444-444444444424';
  v_invoiced_os uuid := '44444444-4444-4444-4444-444444444432';
  v_invoiced_intent uuid := '44444444-4444-4444-4444-444444444442';
  v_full_id uuid := '44444444-4444-4444-4444-444444444413';
  v_full_item1 uuid := '44444444-4444-4444-4444-444444444425';
  v_full_item2 uuid := '44444444-4444-4444-4444-444444444426';
  v_full_os uuid := '44444444-4444-4444-4444-444444444433';
  v_full_intent uuid := '44444444-4444-4444-4444-444444444443';
  v_no_os_id uuid := '44444444-4444-4444-4444-444444444414';
  v_no_os_pronto uuid := '44444444-4444-4444-4444-444444444427';
  v_no_os_orphan uuid := '44444444-4444-4444-4444-444444444428';
  v_no_os_os uuid := '44444444-4444-4444-4444-444444444434';
  v_no_os_intent uuid := '44444444-4444-4444-4444-444444444444';
begin
  select id into v_org_id from public.organizations where code = 'mjt';
  if v_org_id is null then
    raise exception 'organization mjt not found';
  end if;

  insert into auth.users (id, email, created_at, updated_at)
  values (v_user_id, 'l5-deliver@example.com', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (user_id, full_name, status)
  values (v_user_id, 'L5 Deliver', 'active')
  on conflict (user_id) do nothing;

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values (v_org_id, v_user_id, 'administrator', 'active')
  on conflict (organization_id, user_id) do nothing;

  -- Mid-repair: in_service, 1 pronto + 1 em_reparo
  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  ) values (
    v_mid_id, v_org_id, 'in_service', 'MJT-2026-910001', 2026, 910001,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_mid_pronto, v_org_id, v_mid_id, 'Item pronto', 1, v_user_id),
    (v_mid_repair, v_org_id, v_mid_id, 'Item em reparo', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  ) values (
    v_mid_os, v_org_id, v_mid_id, v_user_id, 10, 10, 7, 'in_service'
  );

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  ) values
    (v_org_id, v_mid_id, v_mid_pronto, 10, 10, 7, 'pronto'),
    (v_org_id, v_mid_id, v_mid_repair, 10, 10, 7, 'em_reparo');

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  ) values (
    v_mid_intent, v_org_id, v_mid_id, 'delivery_term',
    format('%s/%s/%s.png', v_org_id, v_mid_id, v_mid_intent),
    'image/png', 1000, repeat('0', 64), 1,
    'Recebedor', '52998224725', 'Entrega dos equipamentos confirmada.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  ) values (
    v_mid_intent_v2, v_org_id, v_mid_id, 'delivery_term',
    format('%s/%s/%s.png', v_org_id, v_mid_id, v_mid_intent_v2),
    'image/png', 1000, repeat('b', 64), 2,
    'Recebedor', '52998224725', 'Entrega dos equipamentos confirmada.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  -- Invoiced + remaining > 0 must stay invoiced
  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  ) values (
    v_invoiced_id, v_org_id, 'invoiced', 'MJT-2026-910002', 2026, 910002,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_invoiced_pronto, v_org_id, v_invoiced_id, 'Item faturado pronto', 1, v_user_id),
    (v_invoiced_repair, v_org_id, v_invoiced_id, 'Item faturado em reparo', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  ) values (
    v_invoiced_os, v_org_id, v_invoiced_id, v_user_id, 10, 10, 7, 'in_service'
  );

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  ) values
    (v_org_id, v_invoiced_id, v_invoiced_pronto, 10, 10, 7, 'pronto'),
    (v_org_id, v_invoiced_id, v_invoiced_repair, 10, 10, 7, 'em_reparo');

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  ) values (
    v_invoiced_intent, v_org_id, v_invoiced_id, 'delivery_term',
    format('%s/%s/%s.png', v_org_id, v_invoiced_id, v_invoiced_intent),
    'image/png', 1000, repeat('0', 64), 1,
    'Recebedor', '52998224725', 'Entrega dos equipamentos confirmada.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  -- Both pronto → remaining 0 → delivered
  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  ) values (
    v_full_id, v_org_id, 'in_service', 'MJT-2026-910003', 2026, 910003,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_full_item1, v_org_id, v_full_id, 'Item A', 1, v_user_id),
    (v_full_item2, v_org_id, v_full_id, 'Item B', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  ) values (
    v_full_os, v_org_id, v_full_id, v_user_id, 10, 10, 7, 'ready'
  );

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  ) values
    (v_org_id, v_full_id, v_full_item1, 10, 10, 7, 'pronto'),
    (v_org_id, v_full_id, v_full_item2, 10, 10, 7, 'pronto');

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  ) values (
    v_full_intent, v_org_id, v_full_id, 'delivery_term',
    format('%s/%s/%s.png', v_org_id, v_full_id, v_full_intent),
    'image/png', 1000, repeat('0', 64), 1,
    'Recebedor', '52998224725', 'Entrega dos equipamentos confirmada.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  -- Item without OS must not block delivered
  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  ) values (
    v_no_os_id, v_org_id, 'in_service', 'MJT-2026-910004', 2026, 910004,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_no_os_pronto, v_org_id, v_no_os_id, 'Item orçado', 1, v_user_id),
    (v_no_os_orphan, v_org_id, v_no_os_id, 'Item sem OS', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  ) values (
    v_no_os_os, v_org_id, v_no_os_id, v_user_id, 10, 10, 7, 'ready'
  );

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  ) values (
    v_org_id, v_no_os_id, v_no_os_pronto, 10, 10, 7, 'pronto'
  );

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  ) values (
    v_no_os_intent, v_org_id, v_no_os_id, 'delivery_term',
    format('%s/%s/%s.png', v_org_id, v_no_os_id, v_no_os_intent),
    'image/png', 1000, repeat('0', 64), 1,
    'Recebedor', '52998224725', 'Entrega dos equipamentos confirmada.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  insert into l5_deliver_ctx (
    org_id, user_id,
    mid_repair_id, mid_pronto_id, mid_repair_item_id, mid_intent_id, mid_intent_v2_id,
    invoiced_id, invoiced_pronto_id, invoiced_repair_id, invoiced_intent_id,
    full_id, full_item1_id, full_item2_id, full_intent_id,
    no_os_id, no_os_pronto_id, no_os_orphan_id, no_os_intent_id
  ) values (
    v_org_id, v_user_id,
    v_mid_id, v_mid_pronto, v_mid_repair, v_mid_intent, v_mid_intent_v2,
    v_invoiced_id, v_invoiced_pronto, v_invoiced_repair, v_invoiced_intent,
    v_full_id, v_full_item1, v_full_item2, v_full_intent,
    v_no_os_id, v_no_os_pronto, v_no_os_orphan, v_no_os_intent
  );
end $$;

select has_function(
  'public',
  'deliver_to_customer',
  array['uuid', 'integer', 'uuid[]', 'text', 'text', 'text', 'uuid', 'uuid', 'text'],
  'deliver_to_customer keeps the 9-arg signature'
);

select set_config('request.jwt.claim.sub', (select user_id::text from l5_deliver_ctx), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select user_id::text from l5_deliver_ctx))::text,
  true
);
set local role authenticated;

select ok(
  (select private.prepare_delivery_signature_intent(
    (select mid_repair_id from l5_deliver_ctx),
    1,
    'delivery_term',
    'Recebedor',
    '52998224725',
    'Entrega dos equipamentos confirmada.',
    repeat('a', 64),
    1000
  )->>'intentId') is not null,
  'prepare_delivery_signature_intent accepts in_service'
);

select throws_ok(
  $sql$
    select public.deliver_to_customer(
      (select mid_repair_id from l5_deliver_ctx),
      1,
      array[(select mid_pronto_id from l5_deliver_ctx), (select mid_pronto_id from l5_deliver_ctx)],
      'Recebedor',
      '52998224725',
      null,
      (select mid_intent_id from l5_deliver_ctx),
      '55555555-5555-5555-5555-555555555501',
      repeat('0', 64)
    )
  $sql$,
  'P0001',
  'duplicate_delivery_item',
  'duplicate delivered ids are rejected'
);

select throws_ok(
  $sql$
    select public.deliver_to_customer(
      (select mid_repair_id from l5_deliver_ctx),
      1,
      array['99999999-9999-9999-9999-999999999999'::uuid],
      'Recebedor',
      '52998224725',
      null,
      (select mid_intent_id from l5_deliver_ctx),
      '55555555-5555-5555-5555-555555555502',
      repeat('0', 64)
    )
  $sql$,
  'P0001',
  'collection_item_not_found',
  'unknown item id is collection_item_not_found'
);

select throws_ok(
  $sql$
    select public.deliver_to_customer(
      (select mid_repair_id from l5_deliver_ctx),
      1,
      array[(select mid_repair_item_id from l5_deliver_ctx)],
      'Recebedor',
      '52998224725',
      null,
      (select mid_intent_id from l5_deliver_ctx),
      '55555555-5555-5555-5555-555555555503',
      repeat('0', 64)
    )
  $sql$,
  'P0001',
  'item_not_ready',
  'em_reparo item is item_not_ready'
);

select is(
  (select public.deliver_to_customer(
    (select mid_repair_id from l5_deliver_ctx),
    1,
    array[(select mid_pronto_id from l5_deliver_ctx)],
    'Recebedor',
    '52998224725',
    null,
    (select mid_intent_id from l5_deliver_ctx),
    '55555555-5555-5555-5555-555555555504',
    repeat('0', 64)
  )->>'status'),
  'partial_delivery',
  'mid-repair delivery leaves collection in partial_delivery'
);

select is(
  (select status from public.service_orders where collection_id = (select mid_repair_id from l5_deliver_ctx)),
  'in_service',
  'mid-repair delivery leaves OS in_service'
);

select is(
  (select count(*)::integer from public.delivery_items where collection_id = (select mid_repair_id from l5_deliver_ctx)),
  1,
  'mid-repair delivery writes one delivery_items row'
);

select throws_ok(
  $sql$
    select public.deliver_to_customer(
      (select mid_repair_id from l5_deliver_ctx),
      2,
      array[(select mid_pronto_id from l5_deliver_ctx)],
      'Recebedor',
      '52998224725',
      null,
      (select mid_intent_v2_id from l5_deliver_ctx),
      '55555555-5555-5555-5555-555555555505',
      repeat('1', 64)
    )
  $sql$,
  'P0001',
  'item_already_delivered',
  'second deliver of the same id is item_already_delivered'
);

select throws_ok(
  $sql$
    select public.update_service_progress(
      (select mid_repair_id from l5_deliver_ctx),
      2,
      jsonb_build_array(jsonb_build_object(
        'item_id', (select mid_pronto_id from l5_deliver_ctx),
        'status', 'em_reparo',
        'notes', null
      )),
      '55555555-5555-5555-5555-555555555506',
      repeat('2', 64)
    )
  $sql$,
  'P0001',
  'item_already_delivered',
  'progress refuses an already delivered item'
);

select is(
  (select public.deliver_to_customer(
    (select invoiced_id from l5_deliver_ctx),
    1,
    array[(select invoiced_pronto_id from l5_deliver_ctx)],
    'Recebedor',
    '52998224725',
    null,
    (select invoiced_intent_id from l5_deliver_ctx),
    '55555555-5555-5555-5555-555555555507',
    repeat('3', 64)
  )->>'status'),
  'invoiced',
  'invoiced collection stays invoiced when remaining > 0'
);

select is(
  (select public.deliver_to_customer(
    (select full_id from l5_deliver_ctx),
    1,
    array[(select full_item1_id from l5_deliver_ctx), (select full_item2_id from l5_deliver_ctx)],
    'Recebedor',
    '52998224725',
    null,
    (select full_intent_id from l5_deliver_ctx),
    '55555555-5555-5555-5555-555555555508',
    repeat('4', 64)
  )->>'status'),
  'delivered',
  'delivering every remaining OS item sets collection delivered'
);

select is(
  (select status from public.service_orders where collection_id = (select full_id from l5_deliver_ctx)),
  'delivered',
  'delivering every remaining OS item sets OS delivered'
);

select is(
  (select public.deliver_to_customer(
    (select no_os_id from l5_deliver_ctx),
    1,
    array[(select no_os_pronto_id from l5_deliver_ctx)],
    'Recebedor',
    '52998224725',
    null,
    (select no_os_intent_id from l5_deliver_ctx),
    '55555555-5555-5555-5555-555555555509',
    repeat('5', 64)
  )->>'status'),
  'delivered',
  'item without OS does not keep remaining above zero'
);

select * from finish();
rollback;
