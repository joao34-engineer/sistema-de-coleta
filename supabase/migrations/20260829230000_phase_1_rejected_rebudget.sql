-- Fase 1 / B14: reorçamento a partir de rejected sem violar unique de service_orders / service_order_items.
-- Aditiva: CREATE OR REPLACE na mesma assinatura (preserva grants Chat 3 / SECURITY DEFINER / search_path).
-- Sem DROP, wipe ou reset. Nao aplicar automaticamente ao remoto nesta entrega.
--
-- Comportamento:
--   - Aceita collections.status in ('in_workshop', 'rejected').
--   - Se ja existir service_orders para a coleta: UPDATE (status budgeted + totais) e upsert de itens.
--   - Se nao existir: INSERT da OS + itens (caminho do primeiro orçamento).
--   - Evento collection.budget.created usa o previous_status real (rejected | in_workshop).
--
-- pgTAP: cobertura de matriz de UI em tests/unit/operational-actions.test.ts;
--        RPC rejeitada/upsert exige fixture de auth — validar no dry-run / remoto controlado.

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
  existing_order public.service_orders%rowtype;
  next_version integer;
  total_labor numeric(12,2) := 0;
  total_parts numeric(12,2) := 0;
  budget_id uuid;
  previous_status text;
  item_record record;
  item_exists boolean;
  item_updated integer;
  due_days_value integer;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
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

  if collection_record.status not in ('in_workshop', 'rejected') then
    raise exception using errcode = 'P0001', message = 'collection_not_in_workshop';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  previous_status := collection_record.status;

  select *
    into existing_order
  from public.service_orders
  where organization_id = collection_record.organization_id
    and collection_id = p_collection_id
  for update;

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
    select 1 into item_exists
    from public.collection_items
    where id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'collection_item_not_found';
    end if;
    total_labor := total_labor + coalesce(item_record.labor_cost_brl, 0);
    total_parts := total_parts + coalesce(item_record.parts_cost_brl, 0);

    if existing_order.id is not null then
      update public.service_order_items
        set labor_cost_brl = coalesce(item_record.labor_cost_brl, 0),
            parts_cost_brl = coalesce(item_record.parts_cost_brl, 0),
            estimated_days = item_record.estimated_days,
            notes = nullif(trim(item_record.notes), ''),
            status = 'em_reparo',
            updated_at = now()
      where organization_id = collection_record.organization_id
        and collection_id = p_collection_id
        and collection_item_id = item_record.item_id;
      get diagnostics item_updated = row_count;
      if item_updated = 0 then
        insert into public.service_order_items (
          organization_id, collection_id, collection_item_id,
          labor_cost_brl, parts_cost_brl, estimated_days, notes
        ) values (
          collection_record.organization_id, p_collection_id, item_record.item_id,
          coalesce(item_record.labor_cost_brl, 0), coalesce(item_record.parts_cost_brl, 0),
          item_record.estimated_days, nullif(trim(item_record.notes), '')
        );
      end if;
    else
      insert into public.service_order_items (
        organization_id, collection_id, collection_item_id,
        labor_cost_brl, parts_cost_brl, estimated_days, notes
      ) values (
        collection_record.organization_id, p_collection_id, item_record.item_id,
        coalesce(item_record.labor_cost_brl, 0), coalesce(item_record.parts_cost_brl, 0),
        item_record.estimated_days, nullif(trim(item_record.notes), '')
      );
    end if;
  end loop;

  select coalesce(max(estimated_days), 1)
    into due_days_value
  from public.service_order_items
  where organization_id = collection_record.organization_id
    and collection_id = p_collection_id;

  if existing_order.id is not null then
    budget_id := existing_order.id;
    update public.service_orders
      set administrator_id = actor_id,
          labor_brl = total_labor,
          parts_brl = total_parts,
          due_days = due_days_value,
          status = 'budgeted',
          approval_signer_name = null,
          approval_signer_tax_id = null,
          check_in_signature_path = coalesce(
            collection_record.check_in_signature_path,
            existing_order.check_in_signature_path
          ),
          updated_at = now()
    where id = budget_id;
  else
    budget_id := gen_random_uuid();
    insert into public.service_orders (
      id, organization_id, collection_id, administrator_id,
      labor_brl, parts_brl, due_days, status, check_in_signature_path
    ) values (
      budget_id, collection_record.organization_id, p_collection_id, actor_id,
      total_labor, total_parts, due_days_value, 'budgeted',
      collection_record.check_in_signature_path
    );
  end if;

  next_version := collection_record.row_version + 1;

  update public.collections
    set status = 'in_budget', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.budget.created', previous_status, 'in_budget',
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
