begin;
select plan(10);

create temporary table pr9_ctx (
  org_id bigint,
  user_id uuid,
  failure_collection_id uuid,
  failure_intent_id uuid,
  failure_duplicate_items jsonb,
  failure_incomplete_items jsonb,
  failure_unknown_items jsonb,
  success_collection_id uuid,
  success_intent_id uuid,
  success_items jsonb,
  success_idempotency_key uuid
);

do $$
declare
  v_org_id bigint;
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_failure_collection_id uuid := '22222222-2222-2222-2222-222222222201';
  v_failure_item1_id uuid := '22222222-2222-2222-2222-222222222211';
  v_failure_item2_id uuid := '22222222-2222-2222-2222-222222222212';
  v_failure_intent_id uuid := '00000000-0000-0000-0000-000000000001';
  v_success_collection_id uuid := '22222222-2222-2222-2222-222222222301';
  v_success_item1_id uuid := '22222222-2222-2222-2222-222222222311';
  v_success_item2_id uuid := '22222222-2222-2222-2222-222222222312';
  v_success_intent_id uuid := '00000000-0000-0000-0000-000000000002';
  v_success_idempotency_key uuid := '33333333-3333-3333-3333-333333333333';
  v_failure_duplicate_items jsonb;
  v_failure_incomplete_items jsonb;
  v_failure_unknown_items jsonb;
  v_success_items jsonb;
begin
  select id into v_org_id from public.organizations where code = 'mjt';
  if v_org_id is null then
    raise exception 'organization mjt not found';
  end if;

  insert into auth.users (id, email, created_at, updated_at)
  values (v_user_id, 'pr9-test@example.com', now(), now())
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
    v_failure_collection_id, v_org_id, 'collected', 'MJT-2026-900001', 2026, 900001,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_failure_item1_id, v_org_id, v_failure_collection_id, 'Item 1', 1, v_user_id),
    (v_failure_item2_id, v_org_id, v_failure_collection_id, 'Item 2', 1, v_user_id);

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  )
  values (
    v_failure_intent_id, v_org_id, v_failure_collection_id, 'workshop_check_in',
    format('%s/%s/%s.png', v_org_id, v_failure_collection_id, v_failure_intent_id),
    'image/png', 1000,
    '0000000000000000000000000000000000000000000000000000000000000000', 1,
    'Administrador', '52998224725', 'Check-in de oficina confirmado.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  v_failure_duplicate_items := jsonb_build_array(
    jsonb_build_object('item_id', v_failure_item1_id, 'item_description', 'Item 1', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null),
    jsonb_build_object('item_id', v_failure_item1_id, 'item_description', 'Item 1', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null)
  );
  v_failure_incomplete_items := jsonb_build_array(
    jsonb_build_object('item_id', v_failure_item1_id, 'item_description', 'Item 1', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null)
  );
  v_failure_unknown_items := jsonb_build_array(
    jsonb_build_object('item_id', v_failure_item1_id, 'item_description', 'Item 1', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null),
    jsonb_build_object('item_id', v_failure_item2_id, 'item_description', 'Item 2', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null),
    jsonb_build_object('item_id', '99999999-9999-9999-9999-999999999999', 'item_description', 'Item X', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null)
  );

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number,
    customer_snapshot, collection_location, responsible_name, responsible_tax_id,
    created_by, row_version
  )
  values (
    v_success_collection_id, v_org_id, 'collected', 'MJT-2026-900002', 2026, 900002,
    '{}'::jsonb, 'Local de teste', 'Responsável', '52998224725',
    v_user_id, 1
  );

  insert into public.collection_items (id, organization_id, collection_id, description, quantity, created_by)
  values
    (v_success_item1_id, v_org_id, v_success_collection_id, 'Item 1', 1, v_user_id),
    (v_success_item2_id, v_org_id, v_success_collection_id, 'Item 2', 1, v_user_id);

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind, storage_path, content_type, byte_size,
    sha256, expected_version, signer_name, signer_tax_id, acceptance_text,
    status, expires_at, created_by, committed_at
  )
  values (
    v_success_intent_id, v_org_id, v_success_collection_id, 'workshop_check_in',
    format('%s/%s/%s.png', v_org_id, v_success_collection_id, v_success_intent_id),
    'image/png', 1000,
    '0000000000000000000000000000000000000000000000000000000000000000', 1,
    'Administrador', '52998224725', 'Check-in de oficina confirmado.',
    'committed', now() + interval '15 minutes', v_user_id, now()
  );

  v_success_items := jsonb_build_array(
    jsonb_build_object('item_id', v_success_item1_id, 'item_description', 'Item 1', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null),
    jsonb_build_object('item_id', v_success_item2_id, 'item_description', 'Item 2', 'quantity_observed', 1, 'condition_observed', 'ok', 'divergence_notes', null)
  );

  insert into pr9_ctx (
    org_id, user_id, failure_collection_id, failure_intent_id,
    failure_duplicate_items, failure_incomplete_items, failure_unknown_items,
    success_collection_id, success_intent_id, success_items, success_idempotency_key
  )
  values (
    v_org_id, v_user_id, v_failure_collection_id, v_failure_intent_id,
    v_failure_duplicate_items, v_failure_incomplete_items, v_failure_unknown_items,
    v_success_collection_id, v_success_intent_id, v_success_items, v_success_idempotency_key
  );
end $$;

select has_function('public', 'workshop_check_in', array['uuid', 'integer', 'text', 'text', 'jsonb', 'uuid', 'uuid', 'text'], 'workshop_check_in has 8-arg signature');

select set_config('request.jwt.claim.sub', (select user_id::text from pr9_ctx), true);
set local role authenticated;

-- 1. array vazio continua invalid_workshop_checkin_request
select throws_ok(
  format(
    'select public.workshop_check_in((select failure_collection_id from pr9_ctx), 1, %L, %L, %L::jsonb, (select failure_intent_id from pr9_ctx), %L, %L)',
    'Administrador', '52998224725', '[]',
    '11111111-1111-1111-1111-111111111111',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ),
  'P0001',
  'invalid_workshop_checkin_request',
  'empty item array is rejected'
);

-- 2. id duplicado
select throws_ok(
  format(
    'select public.workshop_check_in((select failure_collection_id from pr9_ctx), 1, %L, %L, (select failure_duplicate_items from pr9_ctx), (select failure_intent_id from pr9_ctx), %L, %L)',
    'Administrador', '52998224725',
    '22222222-2222-2222-2222-222222222222',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ),
  'P0001',
  'duplicate_workshop_item',
  'duplicate item id is rejected'
);

-- 3. conjunto incompleto
select throws_ok(
  format(
    'select public.workshop_check_in((select failure_collection_id from pr9_ctx), 1, %L, %L, (select failure_incomplete_items from pr9_ctx), (select failure_intent_id from pr9_ctx), %L, %L)',
    'Administrador', '52998224725',
    '33333333-3333-3333-3333-333333333333',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ),
  'P0001',
  'workshop_checkin_items_incomplete',
  'missing item is rejected'
);

-- 4. id estranho mantém collection_item_not_found
select throws_ok(
  format(
    'select public.workshop_check_in((select failure_collection_id from pr9_ctx), 1, %L, %L, (select failure_unknown_items from pr9_ctx), (select failure_intent_id from pr9_ctx), %L, %L)',
    'Administrador', '52998224725',
    '44444444-4444-4444-4444-444444444444',
    '0000000000000000000000000000000000000000000000000000000000000000'
  ),
  'P0001',
  'collection_item_not_found',
  'unknown item id is rejected'
);

-- 5. check-in completo e idempotente
select is(
  (select public.workshop_check_in(
    (select success_collection_id from pr9_ctx), 1,
    'Administrador', '52998224725',
    (select success_items from pr9_ctx),
    (select success_intent_id from pr9_ctx),
    (select success_idempotency_key from pr9_ctx),
    '0000000000000000000000000000000000000000000000000000000000000000'
  ))->>'status',
  'in_workshop',
  'complete check-in succeeds'
);

-- 6. replay com a mesma chave retorna o resultado armazenado
select is(
  (select public.workshop_check_in(
    (select success_collection_id from pr9_ctx), 1,
    'Administrador', '52998224725',
    (select success_items from pr9_ctx),
    (select success_intent_id from pr9_ctx),
    (select success_idempotency_key from pr9_ctx),
    '0000000000000000000000000000000000000000000000000000000000000000'
  ))->>'status',
  'in_workshop',
  'replay with same idempotency key returns stored result'
);

-- 7. status e versão da coleta atualizados
select is(
  (select status from public.collections where id = (select success_collection_id from pr9_ctx)),
  'in_workshop',
  'success collection status is in_workshop'
);

select is(
  (select row_version from public.collections where id = (select success_collection_id from pr9_ctx)),
  2,
  'success collection row_version is incremented'
);

-- 8. itens de check-in foram persistidos
select is(
  (select count(*)::integer from public.workshop_checkin_items
   where collection_id = (select success_collection_id from pr9_ctx)),
  2,
  'success persists one workshop_checkin_item per item'
);

select * from finish();
rollback;
