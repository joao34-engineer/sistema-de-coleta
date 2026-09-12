begin;
select plan(8);

create temporary table pr5_ctx (
  org_id bigint,
  user_id uuid,
  mixed_collection_id uuid,
  mixed_intent_id uuid,
  mixed_arrived_id uuid,
  mixed_missing_id uuid,
  mixed_items jsonb,
  all_missing_collection_id uuid,
  all_missing_intent_id uuid,
  all_missing_items jsonb,
  remaining_collection_id uuid,
  remaining_arrived_id uuid,
  remaining_missing_id uuid,
  remaining_check_item_id uuid
);

do $$
declare
  v_org_id bigint;
  v_user_id uuid := '11111111-1111-1111-1111-111111111141';
  v_mixed_collection_id uuid := '22222222-2222-2222-2222-222222222401';
  v_mixed_arrived_id uuid := '22222222-2222-2222-2222-222222222411';
  v_mixed_missing_id uuid := '22222222-2222-2222-2222-222222222412';
  v_mixed_intent_id uuid := '00000000-0000-0000-0000-000000000041';
  v_all_missing_collection_id uuid := '22222222-2222-2222-2222-222222222501';
  v_all_missing_item1_id uuid := '22222222-2222-2222-2222-222222222511';
  v_all_missing_item2_id uuid := '22222222-2222-2222-2222-222222222512';
  v_all_missing_intent_id uuid := '00000000-0000-0000-0000-000000000042';
  v_remaining_collection_id uuid := '22222222-2222-2222-2222-222222222601';
  v_remaining_arrived_id uuid := '22222222-2222-2222-2222-222222222611';
  v_remaining_missing_id uuid := '22222222-2222-2222-2222-222222222612';
  v_remaining_check_item_id uuid := '22222222-2222-2222-2222-222222222613';
  v_mixed_items jsonb;
  v_all_missing_items jsonb;
begin
  select id into v_org_id from public.organizations where code = 'mjt';
  if v_org_id is null then
    raise exception 'organization mjt not found';
  end if;

  insert into auth.users (id, email, created_at, updated_at)
  values (v_user_id, 'pr5-missing@example.com', now(), now())
  on conflict (id) do nothing;

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values (v_org_id, v_user_id, 'administrator', 'active')
  on conflict (organization_id, user_id) do nothing;

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  )
  values (
    v_mixed_collection_id, v_org_id, 'collected', 'MJT-2026-900010', 2026, 900010,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_mixed_arrived_id, v_org_id, v_mixed_collection_id, 'Item chegou', 1, v_user_id),
    (v_mixed_missing_id, v_org_id, v_mixed_collection_id, 'Item missing', 1, v_user_id);

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  )
  values (
    v_mixed_intent_id, v_org_id, v_mixed_collection_id, 'workshop_check_in',
    format('%s/%s/%s.png', v_org_id, v_mixed_collection_id, v_mixed_intent_id),
    'image/png', 1000,
    '0000000000000000000000000000000000000000000000000000000000000000', 1,
    'Administrador', '52998224725', 'Check-in de oficina confirmado.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  v_mixed_items := jsonb_build_array(
    jsonb_build_object(
      'item_id', v_mixed_arrived_id, 'item_description', 'Item chegou',
      'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null,
      'arrival_status', 'arrived'
    ),
    jsonb_build_object(
      'item_id', v_mixed_missing_id, 'item_description', 'Item missing',
      'quantity_observed', 0, 'condition_observed', 'nao_recebido',
      'divergence_notes', 'Não veio na carga', 'arrival_status', 'missing'
    )
  );

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  )
  values (
    v_all_missing_collection_id, v_org_id, 'collected', 'MJT-2026-900011', 2026, 900011,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_all_missing_item1_id, v_org_id, v_all_missing_collection_id, 'Missing 1', 1, v_user_id),
    (v_all_missing_item2_id, v_org_id, v_all_missing_collection_id, 'Missing 2', 1, v_user_id);

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  )
  values (
    v_all_missing_intent_id, v_org_id, v_all_missing_collection_id, 'workshop_check_in',
    format('%s/%s/%s.png', v_org_id, v_all_missing_collection_id, v_all_missing_intent_id),
    'image/png', 1000,
    '0000000000000000000000000000000000000000000000000000000000000000', 1,
    'Administrador', '52998224725', 'Check-in de oficina confirmado.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  v_all_missing_items := jsonb_build_array(
    jsonb_build_object(
      'item_id', v_all_missing_item1_id, 'item_description', 'Missing 1',
      'quantity_observed', 0, 'condition_observed', 'nao_recebido',
      'divergence_notes', 'Não descarregado', 'arrival_status', 'missing'
    ),
    jsonb_build_object(
      'item_id', v_all_missing_item2_id, 'item_description', 'Missing 2',
      'quantity_observed', 0, 'condition_observed', 'nao_recebido',
      'divergence_notes', 'Não descarregado', 'arrival_status', 'missing'
    )
  );

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  )
  values (
    v_remaining_collection_id, v_org_id, 'in_service', 'MJT-2026-900012', 2026, 900012,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_remaining_arrived_id, v_org_id, v_remaining_collection_id, 'Restante chegou', 1, v_user_id),
    (v_remaining_missing_id, v_org_id, v_remaining_collection_id, 'Restante missing', 1, v_user_id),
    (v_remaining_check_item_id, v_org_id, v_remaining_collection_id, 'CHECK alvo', 1, v_user_id);

  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id, labor_brl, parts_brl, due_days, status
  )
  values (
    '22222222-2222-2222-2222-222222222690', v_org_id, v_remaining_collection_id, v_user_id, 0, 0, 1, 'in_service'
  );

  insert into public.service_order_items (
    organization_id, collection_id, collection_item_id, labor_cost_brl, parts_cost_brl, estimated_days, status
  )
  values
    (v_org_id, v_remaining_collection_id, v_remaining_arrived_id, 0, 0, 1, 'pronto'),
    (v_org_id, v_remaining_collection_id, v_remaining_missing_id, 0, 0, 1, 'pronto');

  insert into public.workshop_checkin_items (
    organization_id, collection_id, collection_item_id,
    quantity_observed, condition_observed, divergence_notes, arrival_status
  )
  values
    (v_org_id, v_remaining_collection_id, v_remaining_arrived_id, 1, 'ok', null, 'arrived'),
    (v_org_id, v_remaining_collection_id, v_remaining_missing_id, 0, 'nao_recebido', 'Não chegou', 'missing');

  insert into pr5_ctx (
    org_id, user_id, mixed_collection_id, mixed_intent_id, mixed_arrived_id, mixed_missing_id, mixed_items,
    all_missing_collection_id, all_missing_intent_id, all_missing_items,
    remaining_collection_id, remaining_arrived_id, remaining_missing_id, remaining_check_item_id
  )
  values (
    v_org_id, v_user_id, v_mixed_collection_id, v_mixed_intent_id, v_mixed_arrived_id, v_mixed_missing_id, v_mixed_items,
    v_all_missing_collection_id, v_all_missing_intent_id, v_all_missing_items,
    v_remaining_collection_id, v_remaining_arrived_id, v_remaining_missing_id, v_remaining_check_item_id
  );
end $$;

select has_function(
  'public',
  'workshop_check_in',
  array['uuid', 'integer', 'text', 'text', 'jsonb', 'uuid', 'uuid', 'text'],
  'workshop_check_in keeps the 8-arg signature'
);

select set_config('request.jwt.claim.sub', (select user_id::text from pr5_ctx), true);
set local role authenticated;

select is(
  (select public.workshop_check_in(
    (select mixed_collection_id from pr5_ctx), 1,
    'Administrador', '52998224725',
    (select mixed_items from pr5_ctx),
    (select mixed_intent_id from pr5_ctx),
    '33333333-3333-3333-3333-333333333341',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ))->>'status',
  'in_workshop',
  'mixed missing check-in stays in_workshop'
);

select is(
  (select quantity_observed from public.workshop_checkin_items
    where collection_item_id = (select mixed_missing_id from pr5_ctx)),
  0::numeric,
  'missing row stores quantity 0'
);

select is(
  (select condition_observed from public.workshop_checkin_items
    where collection_item_id = (select mixed_missing_id from pr5_ctx)),
  'nao_recebido',
  'missing row stores canonical condition'
);

select is(
  (select public.workshop_check_in(
    (select all_missing_collection_id from pr5_ctx), 1,
    'Administrador', '52998224725',
    (select all_missing_items from pr5_ctx),
    (select all_missing_intent_id from pr5_ctx),
    '33333333-3333-3333-3333-333333333342',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ))->>'status',
  'delivered',
  '100 percent missing check-in goes to delivered'
);

select throws_ok(
  format(
    $sql$
      select public.create_technical_budget(
        %L::uuid, 2,
        jsonb_build_array(jsonb_build_object(
          'item_id', %L::uuid,
          'item_description', 'Item missing',
          'labor_cost_brl', 1,
          'parts_cost_brl', 0,
          'estimated_days', 1,
          'notes', null
        )),
        null,
        '33333333-3333-3333-3333-333333333343'::uuid,
        '0000000000000000000000000000000000000000000000000000000000000000'
      )
    $sql$,
    (select mixed_collection_id from pr5_ctx),
    (select mixed_missing_id from pr5_ctx)
  ),
  'P0001',
  'item_not_received',
  'budget refuses a missing item'
);

reset role;

select is(
  private.count_remaining_deliverable_items(
    (select org_id from pr5_ctx),
    (select remaining_collection_id from pr5_ctx)
  ),
  1,
  'remaining excludes missing check-in items'
);

select throws_ok(
  format(
    $sql$
      insert into public.workshop_checkin_items (
        organization_id, collection_id, collection_item_id,
        quantity_observed, condition_observed, divergence_notes, arrival_status
      ) values (
        %s, %L::uuid, %L::uuid, 0, 'ok', null, 'arrived'
      )
    $sql$,
    (select org_id from pr5_ctx),
    (select remaining_collection_id from pr5_ctx),
    (select remaining_check_item_id from pr5_ctx)
  ),
  '23514',
  'new row for relation "workshop_checkin_items" violates check constraint "workshop_checkin_items_arrival_invariant_check"',
  'arrived quantity 0 is rejected by CHECK'
);

select * from finish();
rollback;
