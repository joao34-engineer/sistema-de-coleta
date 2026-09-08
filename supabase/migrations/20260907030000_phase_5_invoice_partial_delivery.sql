-- L2: NF-e em entrega parcial (A1+A9).
-- CREATE OR REPLACE nas mesmas assinaturas (preserva grants Chat 3).
-- Sem DROP FUNCTION. Sem GRANT. Sem alteração de CHECK nem de dados.
-- Corpos partem de:
--   register_invoice_reference  ← 20260823000001
--   deliver_to_customer         ← 20260907000000
--   update_service_progress     ← 20260907020000
-- Decisão 07/09/2026: NF-e em ready | partial_delivery; invoiced não rebaixa
-- para partial_delivery; progresso aceita invoiced e não o puxa para ready.

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

  if collection_record.status not in ('ready', 'partial_delivery') then
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
  where id = p_collection_id
    and organization_id = collection_record.organization_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.invoice.registered', collection_record.status, 'invoiced',
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
  item record;
  item_exists boolean;
  remaining integer;
  any_remaining_in_repair boolean;
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

  if collection_record.status not in ('in_service', 'ready', 'invoiced', 'partial_delivery') then
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

  if exists (
    select 1
    from unnest(p_delivered_item_ids) as delivered_id
    where not exists (
      select 1
      from public.service_order_items as soi
      where soi.collection_id = p_collection_id
        and soi.organization_id = collection_record.organization_id
        and soi.collection_item_id = delivered_id
        and soi.status = 'pronto'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'item_not_ready';
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

  select exists (
    select 1
    from public.collection_items as ci
    where ci.collection_id = p_collection_id
      and ci.organization_id = collection_record.organization_id
      and ci.removed_at is null
      and ci.id not in (
        select collection_item_id from public.delivery_items
        where collection_id = p_collection_id
          and organization_id = collection_record.organization_id
      )
      and exists (
        select 1
        from public.service_order_items as soi
        where soi.collection_id = p_collection_id
          and soi.organization_id = collection_record.organization_id
          and soi.collection_item_id = ci.id
          and soi.status = 'em_reparo'
      )
  ) into any_remaining_in_repair;

  next_version := collection_record.row_version + 1;
  next_status := case
    when remaining = 0 then 'delivered'
    when collection_record.status = 'invoiced' then 'invoiced'
    else 'partial_delivery'
  end;

  if order_record.id is not null then
    update public.service_orders
      set status = case
            when remaining = 0 then 'delivered'
            when any_remaining_in_repair then 'in_service'
            else 'ready'
          end,
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
  from public.service_order_items
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
    and (
      collection_item_id is null
      or collection_item_id not in (
        select collection_item_id
        from public.delivery_items
        where collection_id = p_collection_id
          and organization_id = collection_record.organization_id
      )
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
          and (
            soi.collection_item_id is null
            or soi.collection_item_id not in (
              select collection_item_id from public.delivery_items
              where collection_id = p_collection_id
                and organization_id = collection_record.organization_id
            )
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
