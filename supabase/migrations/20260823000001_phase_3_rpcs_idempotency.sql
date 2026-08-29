-- Fase 3b: idempotência nas 7 RPCs de oficina.
-- Esta migration é ADITIVA: usa CREATE OR REPLACE FUNCTION para ampliar as assinaturas
-- existentes com p_idempotency_key + p_request_hash e replicar o ledger de
-- idempotency_requests idêntico ao padrão de finalize_collection (1a).
-- Não apaga nem reseta dados. A tabela idempotency_requests.operation CHECK foi ampliada
-- na migration 20260823000000 para aceitar as novas operações.
-- DROP das assinaturas 3a ANTES do CREATE 3b: CREATE OR REPLACE com args novos
-- cria overload, não substituição. Sem estes DROPs o GRANT sem lista de args falha.

drop function if exists public.workshop_check_in(uuid, integer, text, text, jsonb, text);
drop function if exists public.create_technical_budget(uuid, integer, jsonb, text);
drop function if exists public.approve_technical_budget(uuid, integer, boolean, text, text, text);
drop function if exists public.update_service_progress(uuid, integer, jsonb);
drop function if exists public.register_invoice_reference(uuid, integer, text, text, date, numeric, text);
drop function if exists public.deliver_to_customer(uuid, integer, uuid[], text, text, text, text);
drop function if exists public.cancel_or_reopen_collection(uuid, integer, text, text);

-- 5a. workshop_check_in — collected -> in_workshop
--     ASSINATURA agora via intent (não mais p_signature text).
--     operation ledger: 'workshop_check_in'
create or replace function public.workshop_check_in(
  p_collection_id uuid,
  p_expected_version integer,
  p_administrator_name text,
  p_administrator_tax_id text,
  p_items jsonb,
  p_signature_intent_id uuid,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  item_record record;
  item_exists boolean;
  signature_path text;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or length(trim(coalesce(p_administrator_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_administrator_tax_id, ''))
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or p_signature_intent_id is null
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_workshop_checkin_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER DE IDIOMPONENT CÂNIA — idêntico a finalize_collection (1a:1972-2003)
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'workshop_check_in'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'workshop_check_in',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status <> 'collected' then
    raise exception using errcode = 'P0001', message = 'collection_not_collected';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  -- valida intent de assinatura committed
  select i.storage_path
    into signature_path
  from private.delivery_signature_intents as i
  where i.id = p_signature_intent_id
    and i.organization_id = collection_record.organization_id
    and i.collection_id = p_collection_id
    and i.kind = 'workshop_check_in'
    and i.status = 'committed'
    and i.expected_version = p_expected_version;
  if not found then
    raise exception using errcode = 'P0001', message = 'signature_intent_not_committed';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    item_description text,
    quantity_observed numeric,
    condition_observed text,
    divergence_notes text
  ) loop
    if length(trim(coalesce(item_record.item_description, ''))) < 1
      or item_record.quantity_observed is null or item_record.quantity_observed <= 0
      or length(trim(coalesce(item_record.condition_observed, ''))) < 1 then
      raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
    end if;
    select 1 into item_exists
    from public.collection_items
    where id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'collection_item_not_found';
    end if;
    insert into public.workshop_checkin_items (
      organization_id, collection_id, collection_item_id,
      quantity_observed, condition_observed, divergence_notes
    ) values (
      collection_record.organization_id, p_collection_id, item_record.item_id,
      item_record.quantity_observed, item_record.condition_observed,
      nullif(trim(item_record.divergence_notes), '')
    );
  end loop;

  next_version := collection_record.row_version + 1;
  update public.collections
    set status = 'in_workshop', row_version = next_version, updated_by = actor_id,
        check_in_signature_path = signature_path
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.workshop.checked_in', 'collected', 'in_workshop',
    jsonb_build_object(
      'row_version', next_version,
      'administratorName', p_administrator_name,
      'administratorTaxId', p_administrator_tax_id,
      'checkInSignaturePath', signature_path
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'in_workshop',
    'rowVersion', next_version,
    'administratorName', p_administrator_name
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'workshop_check_in'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5b. create_technical_budget — in_workshop -> in_budget
--     operation ledger: 'save_technical_budget'
create or replace function public.create_technical_budget(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb,
  p_general_notes text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  total_labor numeric(12,2) := 0;
  total_parts numeric(12,2) := 0;
  budget_id uuid;
  item_record record;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_budget_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'save_technical_budget'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'save_technical_budget',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status <> 'in_workshop' then
    raise exception using errcode = 'P0001', message = 'collection_not_in_workshop';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    item_description text,
    labor_cost_brl numeric,
    parts_cost_brl numeric,
    estimated_days integer,
    notes text
  ) loop
    if length(trim(coalesce(item_record.item_description, ''))) < 1
      or item_record.labor_cost_brl < 0 or item_record.parts_cost_brl < 0
      or item_record.estimated_days < 1 then
      raise exception using errcode = 'P0001', message = 'invalid_budget_item';
    end if;
    total_labor := total_labor + coalesce(item_record.labor_cost_brl, 0);
    total_parts := total_parts + coalesce(item_record.parts_cost_brl, 0);
    insert into public.service_order_items (
      organization_id, collection_id, collection_item_id,
      labor_cost_brl, parts_cost_brl, estimated_days, notes
    ) values (
      collection_record.organization_id, p_collection_id, item_record.item_id,
      coalesce(item_record.labor_cost_brl, 0), coalesce(item_record.parts_cost_brl, 0),
      item_record.estimated_days, nullif(trim(item_record.notes), '')
    );
  end loop;

  next_version := collection_record.row_version + 1;
  budget_id := gen_random_uuid();
  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id,
    labor_brl, parts_brl, due_days, status
  ) values (
    budget_id, collection_record.organization_id, p_collection_id, actor_id,
    total_labor, total_parts, (select max(estimated_days) from public.service_order_items where collection_id = p_collection_id), 'budgeted'
  );

  update public.collections
    set status = 'in_budget', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.budget.created', 'in_workshop', 'in_budget',
    jsonb_build_object(
      'row_version', next_version,
      'serviceOrderId', budget_id,
      'laborBrl', total_labor,
      'partsBrl', total_parts,
      'generalNotes', nullif(trim(p_general_notes), '')
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'in_budget',
    'rowVersion', next_version,
    'serviceOrderId', budget_id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'save_technical_budget'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5c. approve_technical_budget — in_budget -> approved | rejected
--     operation ledger: 'budget_approval'
create or replace function public.approve_technical_budget(
  p_collection_id uuid,
  p_expected_version integer,
  p_approved boolean,
  p_rejection_reason text,
  p_signer_name text,
  p_signer_tax_id text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  service_order_record public.service_orders%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  next_status text;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_approved is null
    or length(trim(coalesce(p_signer_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_signer_tax_id, ''))
    or (not p_approved and length(trim(coalesce(p_rejection_reason, ''))) < 5)
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_approval_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'budget_approval'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'budget_approval',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status <> 'in_budget' then
    raise exception using errcode = 'P0001', message = 'collection_not_in_budget';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  select * into service_order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_order_not_found';
  end if;

  next_version := collection_record.row_version + 1;
  next_status := case when p_approved then 'approved' else 'rejected' end;

  update public.service_orders
    set approval_signer_name = p_signer_name,
        approval_signer_tax_id = p_signer_tax_id,
        status = next_status
  where id = service_order_record.id;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.budget.' || case when p_approved then 'approved' else 'rejected' end,
    'in_budget', next_status,
    jsonb_build_object(
      'row_version', next_version,
      'approved', p_approved,
      'rejectionReason', case when not p_approved then p_rejection_reason else null end,
      'signerName', p_signer_name
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', next_status,
    'rowVersion', next_version,
    'serviceOrderId', service_order_record.id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'budget_approval'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5d. update_service_progress — approved -> in_service -> ready
--     operation ledger: 'update_service_progress'
create or replace function public.update_service_progress(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  service_order_record public.service_orders%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  any_ready boolean := false;
  all_ready boolean := true;
  item_record record;
  item_found boolean;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_progress_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'update_service_progress'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'update_service_progress',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status not in ('approved', 'in_service') then
    raise exception using errcode = 'P0001', message = 'collection_not_in_service';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  select * into service_order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_order_not_found';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    status text,
    notes text
  ) loop
    if item_record.status not in ('em_reparo', 'pronto') then
      raise exception using errcode = 'P0001', message = 'invalid_item_progress_status';
    end if;
    select 1 into item_found
    from public.service_order_items
    where id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'service_order_item_not_found';
    end if;
    update public.service_order_items
      set status = item_record.status,
          notes = nullif(trim(item_record.notes), '')
    where id = item_record.item_id;
    if item_record.status = 'pronto' then
      any_ready := true;
    else
      all_ready := false;
    end if;
  end loop;

  next_version := collection_record.row_version + 1;
  if any_ready and all_ready then
    update public.service_orders set status = 'ready' where id = service_order_record.id;
    update public.collections
      set status = 'ready', row_version = next_version, updated_by = actor_id
    where id = p_collection_id;
  else
    if collection_record.status = 'approved' then
      update public.service_orders set status = 'in_service' where id = service_order_record.id;
      update public.collections
        set status = 'in_service', row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
    else
      update public.collections set row_version = next_version, updated_by = actor_id where id = p_collection_id;
    end if;
  end if;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.service.progress_updated', collection_record.status,
    (select status from public.collections where id = p_collection_id),
    jsonb_build_object('row_version', next_version)
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', (select status from public.collections where id = p_collection_id),
    'rowVersion', next_version,
    'serviceOrderId', service_order_record.id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'update_service_progress'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5e. register_invoice_reference — ready -> invoiced
--     operation ledger: 'register_invoice_reference'
create or replace function public.register_invoice_reference(
  p_collection_id uuid,
  p_expected_version integer,
  p_number text,
  p_series text,
  p_issued_at date,
  p_total_brl numeric,
  p_notes text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  invoice_id uuid;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or length(trim(coalesce(p_number, ''))) < 1
    or length(trim(coalesce(p_series, ''))) < 1
    or p_issued_at is null
    or p_total_brl <= 0
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_invoice_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'register_invoice_reference'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'register_invoice_reference',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'collection_not_ready';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  invoice_id := gen_random_uuid();
  insert into public.invoice_references (
    id, organization_id, collection_id, number, series, issued_at, total_brl, notes, created_by
  ) values (
    invoice_id, collection_record.organization_id, p_collection_id,
    p_number, p_series, p_issued_at, p_total_brl,
    nullif(trim(p_notes), ''), actor_id
  );

  next_version := collection_record.row_version + 1;
  update public.collections
    set status = 'invoiced', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.invoice.registered', 'ready', 'invoiced',
    jsonb_build_object(
      'row_version', next_version,
      'invoiceId', invoice_id,
      'number', p_number,
      'series', p_series,
      'issuedAt', p_issued_at::text,
      'totalBrl', p_total_brl
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'invoiced',
    'rowVersion', next_version,
    'invoiceId', invoice_id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'register_invoice_reference'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5f. deliver_to_customer — invoiced -> partial_delivery | delivered
--     ASSINATURA agora via intent (não mais p_signature text).
--     Cria delivery_terms + delivery_term_items (imutáveis).
--     operation ledger: 'customer_delivery'
create or replace function public.deliver_to_customer(
  p_collection_id uuid,
  p_expected_version integer,
  p_delivered_item_ids uuid[],
  p_receiver_name text,
  p_receiver_tax_id text,
  p_notes text,
  p_signature_intent_id uuid,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  service_order_record public.service_orders%rowtype;
  request_record public.idempotency_requests%rowtype;
  order_record public.service_orders%rowtype;
  next_version integer;
  next_status text;
  item record;
  item_exists boolean;
  remaining integer;
  delivery_term_id uuid;
  signature_path text;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or array_length(p_delivered_item_ids, 1) is null or array_length(p_delivered_item_ids, 1) < 1
    or length(trim(coalesce(p_receiver_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_receiver_tax_id, ''))
    or p_signature_intent_id is null
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'customer_delivery'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'customer_delivery',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status not in ('invoiced', 'partial_delivery') then
    raise exception using errcode = 'P0001', message = 'collection_not_invoiced';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  -- valida intent de assinatura de delivery_term committed
  select i.storage_path
    into signature_path
  from private.delivery_signature_intents as i
  where i.id = p_signature_intent_id
    and i.organization_id = collection_record.organization_id
    and i.collection_id = p_collection_id
    and i.kind = 'delivery_term'
    and i.status = 'committed'
    and i.expected_version = p_expected_version;
  if not found then
    raise exception using errcode = 'P0001', message = 'signature_intent_not_committed';
  end if;

  for item in select unnest(p_delivered_item_ids) as item_id loop
    select 1 into item_exists
    from public.collection_items
    where id = item.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'collection_item_not_found';
    end if;
    insert into public.delivery_items (
      organization_id, collection_id, collection_item_id, quantity
    ) select collection_record.organization_id, p_collection_id, item.item_id, quantity
      from public.collection_items
      where id = item.item_id
        and collection_id = p_collection_id
        and organization_id = collection_record.organization_id;
  end loop;

  -- cria termo de entrega imutável + itens
  delivery_term_id := gen_random_uuid();
  select * into order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;

  insert into public.delivery_terms (
    id, organization_id, collection_id, service_order_id,
    receiver_name, receiver_tax_id, signature_path, notes, created_by
  ) values (
    delivery_term_id, collection_record.organization_id, p_collection_id,
    case when order_record.id is not null then order_record.id end,
    p_receiver_name, p_receiver_tax_id, signature_path,
    nullif(trim(p_notes), ''), actor_id
  );

  insert into public.delivery_term_items (
    organization_id, delivery_term_id, collection_item_id, collection_id, quantity
  )
  select collection_record.organization_id, delivery_term_id, ci.id, p_collection_id, ci.quantity
    from unnest(p_delivered_item_ids) as delivered_id
    join public.collection_items as ci
      on ci.id = delivered_id
      and ci.collection_id = p_collection_id
      and ci.organization_id = collection_record.organization_id;

  select count(*) into remaining
  from public.collection_items
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
    and removed_at is null
    and id not in (
      select collection_item_id from public.delivery_items
      where collection_id = p_collection_id
        and organization_id = collection_record.organization_id
    );

  next_version := collection_record.row_version + 1;
  next_status := case when remaining = 0 then 'delivered' else 'partial_delivery' end;

  if order_record.id is not null then
    update public.service_orders set status = 'ready' where id = order_record.id;
  end if;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.delivered', collection_record.status, next_status,
    jsonb_build_object(
      'row_version', next_version,
      'deliveryTermId', delivery_term_id,
      'deliveredItemIds', p_delivered_item_ids,
      'receiverName', p_receiver_name,
      'receiverTaxId', p_receiver_tax_id,
      'signaturePath', signature_path,
      'notes', nullif(trim(p_notes), ''),
      'partial', remaining > 0
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', next_status,
    'rowVersion', next_version,
    'delivered', true,
    'partial', remaining > 0,
    'deliveryTermId', delivery_term_id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'customer_delivery'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 5g. cancel_or_reopen_collection — motivo + auditoria
--     JÁ tinha idempotência parcial (sem ledger). Adicionamos p_idempotency_key + p_request_hash
--     e registramos no ledger com operation resolvido pelo p_action.
--     operation ledger: 'cancel_collection' | 'reopen_collection'
create or replace function public.cancel_or_reopen_collection(
  p_collection_id uuid,
  p_expected_version integer,
  p_action text,
  p_reason text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  operation_value text;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_action not in ('cancel', 'reopen')
    or length(trim(coalesce(p_reason, ''))) < 5
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_cancel_reopen_request';
  end if;
  operation_value := case when p_action = 'cancel' then 'cancel_collection' else 'reopen_collection' end;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- LEDGER
  select *
    into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = operation_value
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, operation_value,
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  if p_action = 'cancel' then
    if collection_record.status in ('delivered', 'canceled') then
      raise exception using errcode = 'P0001', message = 'collection_cannot_be_canceled';
    end if;
    update public.collections
      set status = 'canceled', row_version = collection_record.row_version + 1,
          canceled_at = now(), canceled_by = actor_id, cancel_reason = p_reason,
          previous_status_before_cancellation = collection_record.status
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    insert into public.collection_events (
      organization_id, collection_id, actor_user_id,
      event_type, previous_status, new_status, reason
    ) values (
      collection_record.organization_id, p_collection_id, actor_id,
      'collection.canceled', collection_record.status, 'canceled', p_reason
    );
  else
    if collection_record.status <> 'canceled' then
      raise exception using errcode = 'P0001', message = 'collection_not_canceled';
    end if;
    update public.collections
      set status = collection_record.previous_status_before_cancellation,
          row_version = collection_record.row_version + 1,
          reopened_at = now(), reopened_by = actor_id, reopen_reason = p_reason,
          canceled_at = null, canceled_by = null, cancel_reason = null,
          previous_status_before_cancellation = null
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    insert into public.collection_events (
      organization_id, collection_id, actor_user_id,
      event_type, previous_status, new_status, reason
    ) values (
      collection_record.organization_id, p_collection_id, actor_id,
      'collection.reopened', 'canceled', collection_record.previous_status_before_cancellation, p_reason
    );
  end if;

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', (select status from public.collections where id = p_collection_id),
    'rowVersion', next_version
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = operation_value
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 10. Re-concede os grants de execução sobre as RPCs atualizadas
grant execute on function public.workshop_check_in to authenticated;
grant execute on function public.create_technical_budget to authenticated;
grant execute on function public.approve_technical_budget to authenticated;
grant execute on function public.update_service_progress to authenticated;
grant execute on function public.register_invoice_reference to authenticated;
grant execute on function public.deliver_to_customer to authenticated;
grant execute on function public.cancel_or_reopen_collection to authenticated;
