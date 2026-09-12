-- PR 5: check-in “não chegou”.
-- arrival_status arrived|missing + CHECK composto + unique.
-- remaining herda L4 e exclui missing via EXISTS.
-- 100% missing → delivered na mesma transação do check-in.
-- CREATE OR REPLACE nas assinaturas atuais. Sem DROP FUNCTION. Sem GRANT.

do $$
begin
  if exists (
    select 1
    from public.workshop_checkin_items
    group by organization_id, collection_id, collection_item_id
    having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_workshop_checkin_items_exist';
  end if;
end $$;

alter table public.workshop_checkin_items
  add column if not exists arrival_status text not null default 'arrived';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workshop_checkin_items'::regclass
      and conname = 'workshop_checkin_items_arrival_status_check'
  ) then
    alter table public.workshop_checkin_items
      add constraint workshop_checkin_items_arrival_status_check
      check (arrival_status in ('arrived', 'missing'));
  end if;
end $$;

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint as con
  where con.conrelid = 'public.workshop_checkin_items'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%quantity_observed > 0%'
    and con.conname <> 'workshop_checkin_items_arrival_invariant_check';
  if constraint_name is not null then
    execute format('alter table public.workshop_checkin_items drop constraint %I', constraint_name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workshop_checkin_items'::regclass
      and conname = 'workshop_checkin_items_arrival_invariant_check'
  ) then
    alter table public.workshop_checkin_items
      add constraint workshop_checkin_items_arrival_invariant_check
      check (
        quantity_observed >= 0
        and (
          (arrival_status = 'arrived' and quantity_observed > 0)
          or (
            arrival_status = 'missing'
            and quantity_observed = 0
            and condition_observed = 'nao_recebido'
            and length(trim(coalesce(divergence_notes, ''))) > 0
          )
        )
      );
  end if;
end $$;

create unique index if not exists workshop_checkin_items_collection_item_uidx
  on public.workshop_checkin_items (organization_id, collection_id, collection_item_id);

create or replace function private.count_remaining_deliverable_items(
  p_organization_id bigint,
  p_collection_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.collection_items as ci
  where ci.collection_id = p_collection_id
    and ci.organization_id = p_organization_id
    and ci.removed_at is null
    and exists (
      select 1
      from public.service_order_items as soi
      where soi.collection_id = p_collection_id
        and soi.organization_id = p_organization_id
        and soi.collection_item_id = ci.id
    )
    and not exists (
      select 1
      from public.delivery_items as di
      where di.collection_id = p_collection_id
        and di.organization_id = p_organization_id
        and di.collection_item_id = ci.id
    )
    and not exists (
      select 1
      from public.workshop_checkin_items as wci
      where wci.collection_id = p_collection_id
        and wci.organization_id = p_organization_id
        and wci.collection_item_id = ci.id
        and wci.arrival_status = 'missing'
    );
$$;

create or replace function private.any_remaining_in_repair(
  p_organization_id bigint,
  p_collection_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.collection_items as ci
    where ci.collection_id = p_collection_id
      and ci.organization_id = p_organization_id
      and ci.removed_at is null
      and exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = p_organization_id
          and soi.collection_item_id = ci.id
      )
      and not exists (
        select 1
        from public.delivery_items as di
        where di.collection_id = p_collection_id
          and di.organization_id = p_organization_id
          and di.collection_item_id = ci.id
      )
      and not exists (
        select 1
        from public.workshop_checkin_items as wci
        where wci.collection_id = p_collection_id
          and wci.organization_id = p_organization_id
          and wci.collection_item_id = ci.id
          and wci.arrival_status = 'missing'
      )
      and exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = p_organization_id
          and soi.collection_item_id = ci.id
          and soi.status = 'em_reparo'
      )
  );
$$;

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
  next_status text;
  item_record record;
  item_exists boolean;
  signature_path text;
  response_value jsonb;
  arrival_value text;
  observed_qty numeric;
  observed_condition text;
  observed_notes text;
  arrived_count integer := 0;
  missing_count integer := 0;
  missing_item_ids uuid[] := array[]::uuid[];
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

  if jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid_workshop_checkin_request';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(item_id uuid)
    group by item_id having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_workshop_item';
  end if;

  if exists (
    select 1 from public.collection_items as ci
    where ci.collection_id = p_collection_id
      and ci.organization_id = collection_record.organization_id
      and ci.removed_at is null
      and ci.id not in (select x.item_id from jsonb_to_recordset(p_items) as x(item_id uuid))
  ) then
    raise exception using errcode = 'P0001', message = 'workshop_checkin_items_incomplete';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    item_description text,
    quantity_observed numeric,
    condition_observed text,
    divergence_notes text,
    arrival_status text
  ) loop
    if length(trim(coalesce(item_record.item_description, ''))) < 1 then
      raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
    end if;
    arrival_value := coalesce(nullif(trim(item_record.arrival_status), ''), 'arrived');
    if arrival_value not in ('arrived', 'missing') then
      raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
    end if;
    if arrival_value = 'missing' then
      if length(trim(coalesce(item_record.divergence_notes, ''))) < 1 then
        raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
      end if;
      observed_qty := 0;
      observed_condition := 'nao_recebido';
      observed_notes := trim(item_record.divergence_notes);
      missing_count := missing_count + 1;
      missing_item_ids := array_append(missing_item_ids, item_record.item_id);
    else
      if item_record.quantity_observed is null or item_record.quantity_observed <= 0
        or length(trim(coalesce(item_record.condition_observed, ''))) < 1
        or trim(item_record.condition_observed) = 'nao_recebido' then
        raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
      end if;
      observed_qty := item_record.quantity_observed;
      observed_condition := trim(item_record.condition_observed);
      observed_notes := nullif(trim(item_record.divergence_notes), '');
      arrived_count := arrived_count + 1;
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
      quantity_observed, condition_observed, divergence_notes, arrival_status
    ) values (
      collection_record.organization_id, p_collection_id, item_record.item_id,
      observed_qty, observed_condition, observed_notes, arrival_value
    );
  end loop;

  next_status := case when arrived_count = 0 then 'delivered' else 'in_workshop' end;
  next_version := collection_record.row_version + 1;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id,
        check_in_signature_path = signature_path
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.workshop.checked_in', 'collected', next_status,
    jsonb_build_object(
      'row_version', next_version,
      'administratorName', p_administrator_name,
      'administratorTaxId', p_administrator_tax_id,
      'checkInSignaturePath', signature_path,
      'itemCount', jsonb_array_length(p_items),
      'arrivedCount', arrived_count,
      'missingCount', missing_count,
      'missingItemIds', to_jsonb(missing_item_ids)
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', next_status,
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

  if (select count(*) from jsonb_to_recordset(p_items) as x(item_id uuid))
     <> (select count(distinct item_id) from jsonb_to_recordset(p_items) as x(item_id uuid)) then
    raise exception using errcode = 'P0001', message = 'duplicate_budget_item';
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
    if exists (
      select 1
      from public.workshop_checkin_items as wci
      where wci.collection_id = p_collection_id
        and wci.organization_id = collection_record.organization_id
        and wci.collection_item_id = item_record.item_id
        and wci.arrival_status = 'missing'
    ) then
      raise exception using errcode = 'P0001', message = 'item_not_received';
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
  request_record public.idempotency_requests%rowtype;
  order_record public.service_orders%rowtype;
  next_version integer;
  next_status text;
  next_os_status text;
  item record;
  item_exists boolean;
  remaining integer;
  remaining_in_repair_item_ids jsonb;
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

  if collection_record.status not in ('in_service', 'ready', 'invoiced', 'partial_delivery') then
    raise exception using errcode = 'P0001', message = 'collection_not_invoiced';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

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

  if (select count(*) from unnest(p_delivered_item_ids))
     <> (select count(distinct d) from unnest(p_delivered_item_ids) as d) then
    raise exception using errcode = 'P0001', message = 'duplicate_delivery_item';
  end if;

  if exists (
    select 1 from public.delivery_term_items as dti
    where dti.collection_id = p_collection_id
      and dti.organization_id = collection_record.organization_id
      and dti.collection_item_id = any (p_delivered_item_ids)
  ) then
    raise exception using errcode = 'P0001', message = 'item_already_delivered';
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
  end loop;

  if exists (
    select 1
    from unnest(p_delivered_item_ids) as delivered_id
    where exists (
      select 1
      from public.workshop_checkin_items as wci
      where wci.collection_id = p_collection_id
        and wci.organization_id = collection_record.organization_id
        and wci.collection_item_id = delivered_id
        and wci.arrival_status = 'missing'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'item_not_received';
  end if;

  if exists (
    select 1
    from unnest(p_delivered_item_ids) as delivered_id
    where not (
      exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = collection_record.organization_id
          and soi.collection_item_id = delivered_id
      )
      and not exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = collection_record.organization_id
          and soi.collection_item_id = delivered_id
          and soi.status is distinct from 'pronto'
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'item_not_ready';
  end if;

  for item in select unnest(p_delivered_item_ids) as item_id loop
    insert into public.delivery_items (
      organization_id, collection_id, collection_item_id, quantity
    ) select collection_record.organization_id, p_collection_id, item.item_id, quantity
      from public.collection_items
      where id = item.item_id
        and collection_id = p_collection_id
        and organization_id = collection_record.organization_id;
  end loop;

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

  remaining := private.count_remaining_deliverable_items(
    collection_record.organization_id, p_collection_id
  );

  select coalesce(jsonb_agg(ci.id), '[]'::jsonb)
    into remaining_in_repair_item_ids
  from public.collection_items as ci
  where ci.collection_id = p_collection_id
    and ci.organization_id = collection_record.organization_id
    and ci.removed_at is null
    and exists (
      select 1
      from public.service_order_items as soi
      where soi.collection_id = p_collection_id
        and soi.organization_id = collection_record.organization_id
        and soi.collection_item_id = ci.id
    )
    and not exists (
      select 1
      from public.delivery_items as di
      where di.collection_id = p_collection_id
        and di.organization_id = collection_record.organization_id
        and di.collection_item_id = ci.id
    )
    and not exists (
      select 1
      from public.workshop_checkin_items as wci
      where wci.collection_id = p_collection_id
        and wci.organization_id = collection_record.organization_id
        and wci.collection_item_id = ci.id
        and wci.arrival_status = 'missing'
    )
    and exists (
      select 1
      from public.service_order_items as soi
      where soi.collection_id = p_collection_id
        and soi.organization_id = collection_record.organization_id
        and soi.collection_item_id = ci.id
        and soi.status = 'em_reparo'
    );

  next_version := collection_record.row_version + 1;
  next_status := case
    when remaining = 0 then 'delivered'
    when collection_record.status = 'invoiced' then 'invoiced'
    else 'partial_delivery'
  end;
  next_os_status := private.service_order_status_from_remaining(
    collection_record.organization_id, p_collection_id
  );

  if order_record.id is not null then
    update public.service_orders
      set status = next_os_status,
          updated_at = now()
    where id = order_record.id
      and organization_id = collection_record.organization_id;
  end if;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id
  where id = p_collection_id
    and organization_id = collection_record.organization_id;

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
      'partial', remaining > 0,
      'remaining', remaining,
      'serviceOrderStatus', case
        when order_record.id is not null then next_os_status
        else null
      end,
      'remainingInRepairItemIds', remaining_in_repair_item_ids
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
  all_ready boolean := false;
  item_record record;
  item_found boolean;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
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

  if collection_record.status not in ('approved', 'in_service', 'partial_delivery', 'invoiced') then
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
    where collection_item_id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'service_order_item_not_found';
    end if;
    if exists (
      select 1
      from public.workshop_checkin_items as wci
      where wci.collection_id = p_collection_id
        and wci.organization_id = collection_record.organization_id
        and wci.collection_item_id = item_record.item_id
        and wci.arrival_status = 'missing'
    ) then
      raise exception using errcode = 'P0001', message = 'item_not_received';
    end if;
    if exists (
      select 1
      from public.delivery_items as di
      where di.collection_id = p_collection_id
        and di.organization_id = collection_record.organization_id
        and di.collection_item_id = item_record.item_id
    ) then
      raise exception using errcode = 'P0001', message = 'item_already_delivered';
    end if;
    update public.service_order_items
      set status = item_record.status,
          notes = nullif(trim(item_record.notes), '')
    where collection_item_id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
  end loop;

  select
    coalesce(bool_and(status = 'pronto'), false),
    coalesce(bool_or(status = 'pronto'), false)
  into all_ready, any_ready
  from public.service_order_items as soi
  where soi.collection_id = p_collection_id
    and soi.organization_id = collection_record.organization_id
    and soi.collection_item_id is not null
    and not exists (
      select 1
      from public.delivery_items as di
      where di.collection_id = p_collection_id
        and di.organization_id = collection_record.organization_id
        and di.collection_item_id = soi.collection_item_id
    );

  next_version := collection_record.row_version + 1;
  if any_ready and all_ready then
    update public.service_orders
      set status = 'ready', updated_at = now()
    where id = service_order_record.id
      and organization_id = collection_record.organization_id;
    if collection_record.status in ('partial_delivery', 'invoiced') then
      update public.collections
        set row_version = next_version, updated_by = actor_id
      where id = p_collection_id
        and organization_id = collection_record.organization_id;
    else
      update public.collections
        set status = 'ready', row_version = next_version, updated_by = actor_id
      where id = p_collection_id
        and organization_id = collection_record.organization_id;
    end if;
  else
    if collection_record.status = 'approved' then
      update public.service_orders
        set status = 'in_service', updated_at = now()
      where id = service_order_record.id
        and organization_id = collection_record.organization_id;
      update public.collections
        set status = 'in_service', row_version = next_version, updated_by = actor_id
      where id = p_collection_id
        and organization_id = collection_record.organization_id;
    else
      if exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = collection_record.organization_id
          and soi.status = 'em_reparo'
          and soi.collection_item_id is not null
          and not exists (
            select 1
            from public.delivery_items as di
            where di.collection_id = p_collection_id
              and di.organization_id = collection_record.organization_id
              and di.collection_item_id = soi.collection_item_id
          )
      ) then
        update public.service_orders
          set status = 'in_service', updated_at = now()
        where id = service_order_record.id
          and organization_id = collection_record.organization_id;
      end if;
      update public.collections
        set row_version = next_version, updated_by = actor_id
      where id = p_collection_id
        and organization_id = collection_record.organization_id;
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
