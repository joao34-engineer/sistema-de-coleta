-- L6: fallback de reopen da OS (A7+A8).
-- partial_delivery / invoiced derivam o status da OS pelos helpers L4
-- (não achatar para ready). awaiting_approval → budgeted. else RAISE.
-- Nunca deixar a OS canceled após reopen quando a linha existe.
-- CREATE OR REPLACE nas mesmas assinaturas. Sem DROP FUNCTION.
-- GRANT só nas duas RPCs públicas de reopen (padrão PR 4). Helper private
-- sem GRANT. deliver_to_customer só troca next_os_status para o helper (SSOT).
-- Corpos partem de:
--   reopen_collection / cancel_or_reopen_collection ← 20260907010000
--   deliver_to_customer ← 20260907230000

create or replace function private.service_order_status_from_remaining(
  p_organization_id bigint,
  p_collection_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when private.count_remaining_deliverable_items(p_organization_id, p_collection_id) = 0
      then 'delivered'
    when private.any_remaining_in_repair(p_organization_id, p_collection_id)
      then 'in_service'
    else 'ready'
  end;
$$;

create or replace function public.reopen_collection(
  p_collection_id uuid,
  p_expected_version integer,
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
  service_order_record public.service_orders%rowtype;
  document_id uuid;
  restored_status text;
  restored_os_status text;
  response_value jsonb;
  next_version integer;
  document_version integer;
begin
  if actor_id is null or p_expected_version < 1
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid_reopen_request';
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
    and operation = 'reopen'
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
    insert into public.idempotency_requests (organization_id, collection_id, operation, idempotency_key, request_hash, created_by)
    values (collection_record.organization_id, p_collection_id, 'reopen', p_idempotency_key, p_request_hash, actor_id);
  end if;
  if collection_record.status <> 'canceled' then
    raise exception using errcode = 'P0001', message = 'collection_not_canceled';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  -- Mesma ordem de lock que cancel_or_reopen_collection /
  -- update_service_progress / deliver_to_customer:
  -- collections -> idempotency_requests -> service_orders.
  select *
    into service_order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;

  restored_status := coalesce(collection_record.previous_status_before_cancellation, 'collected');
  next_version := collection_record.row_version + 1;
  update public.collections
    set status = restored_status,
        reopened_at = now(),
        reopened_by = actor_id,
        reopen_reason = trim(p_reason),
        row_version = next_version,
        updated_by = actor_id,
        canceled_at = null,
        canceled_by = null,
        cancel_reason = null,
        previous_status_before_cancellation = null
  where id = p_collection_id;

  -- Restaura a OS e limpa a coluna. Sem DELETE. Sem deixar canceled.
  -- collected / in_workshop sem OS: no-op, não cria linha.
  -- Fallback só quando previous da OS é null (pré-PR4). Happy path não
  -- consulta remaining. CASE idêntico ao ramo reopen de
  -- cancel_or_reopen_collection.
  if service_order_record.id is not null then
    restored_os_status := service_order_record.previous_status_before_cancellation;
    if restored_os_status is null then
      restored_os_status := case coalesce(
        collection_record.previous_status_before_cancellation, 'collected'
      )
        when 'in_budget' then 'budgeted'
        when 'awaiting_approval' then 'budgeted'
        when 'approved' then 'approved'
        when 'in_service' then 'in_service'
        when 'ready' then 'ready'
        when 'rejected' then 'rejected'
        when 'partial_delivery' then
          private.service_order_status_from_remaining(
            collection_record.organization_id, p_collection_id)
        when 'invoiced' then
          private.service_order_status_from_remaining(
            collection_record.organization_id, p_collection_id)
        else null
      end;
    end if;
    if restored_os_status is null then
      raise exception using errcode = 'P0001',
        message = 'service_order_reopen_status_unknown';
    end if;
    update public.service_orders
      set status = restored_os_status,
          previous_status_before_cancellation = null,
          updated_at = now()
    where id = service_order_record.id
      and organization_id = collection_record.organization_id;
  end if;

  document_id := private.append_document_version(p_collection_id, actor_id);
  select version into document_version from public.documents where id = document_id;
  insert into public.collection_events (
    organization_id, collection_id, actor_user_id, event_type,
    previous_status, new_status, reason, metadata
  )
  values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.reopened', 'canceled', restored_status, trim(p_reason),
    jsonb_build_object('document_id', document_id, 'row_version', next_version)
  );
  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'officialCode', collection_record.official_code,
    'status', restored_status,
    'rowVersion', next_version,
    'document', jsonb_build_object('id', document_id, 'version', document_version, 'status', 'snapshot_ready')
  );
  update public.idempotency_requests
    set response = response_value,
        completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'reopen'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

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
  service_order_record public.service_orders%rowtype;
  next_version integer;
  operation_value text;
  response_value jsonb;
  restored_os_status text;
  restored_status text;
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

  -- Mesma ordem de lock que update_service_progress / deliver_to_customer:
  -- collections -> idempotency_requests -> service_orders.
  select *
    into service_order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;

  if p_action = 'cancel' then
    -- Drafts são descartados por public.discard_collection_draft
    -- (20260905020000), não cancelados. Sem este guard o UPDATE para
    -- canceled viola collections_issued_identity_check (23514): draft não
    -- tem official_code / issued_year / sequence_number / customer_snapshot.
    if collection_record.status = 'draft' then
      raise exception using errcode = 'P0001', message = 'collection_not_cancelable_draft';
    end if;
    if collection_record.status in ('delivered', 'canceled') then
      raise exception using errcode = 'P0001', message = 'collection_cannot_be_canceled';
    end if;
    update public.collections
      set status = 'canceled', row_version = collection_record.row_version + 1,
          canceled_at = now(), canceled_by = actor_id, cancel_reason = p_reason,
          previous_status_before_cancellation = collection_record.status
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    -- Nunca cancelar OS draft. Nunca gravar 'canceled' em
    -- previous_status_before_cancellation (o CHECK da coluna não o permite).
    if service_order_record.id is not null
      and service_order_record.status is distinct from 'draft'
      and service_order_record.status is distinct from 'canceled' then
      update public.service_orders
        set previous_status_before_cancellation = service_order_record.status,
            status = 'canceled',
            updated_at = now()
      where id = service_order_record.id
        and organization_id = collection_record.organization_id;
    end if;
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
    restored_status := coalesce(collection_record.previous_status_before_cancellation, 'collected');
    update public.collections
      set status = restored_status,
          row_version = collection_record.row_version + 1,
          reopened_at = now(), reopened_by = actor_id, reopen_reason = p_reason,
          canceled_at = null, canceled_by = null, cancel_reason = null,
          previous_status_before_cancellation = null
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    -- Restaura a OS e limpa a coluna. Sem DELETE. Sem deixar canceled.
    -- collected / in_workshop sem OS: no-op, não cria linha.
    -- Fallback só quando previous da OS é null. Happy path não consulta remaining.
    if service_order_record.id is not null then
      restored_os_status := service_order_record.previous_status_before_cancellation;
      if restored_os_status is null then
        restored_os_status := case coalesce(
          collection_record.previous_status_before_cancellation, 'collected'
        )
          when 'in_budget' then 'budgeted'
          when 'awaiting_approval' then 'budgeted'
          when 'approved' then 'approved'
          when 'in_service' then 'in_service'
          when 'ready' then 'ready'
          when 'rejected' then 'rejected'
          when 'partial_delivery' then
            private.service_order_status_from_remaining(
              collection_record.organization_id, p_collection_id)
          when 'invoiced' then
            private.service_order_status_from_remaining(
              collection_record.organization_id, p_collection_id)
          else null
        end;
      end if;
      if restored_os_status is null then
        raise exception using errcode = 'P0001',
          message = 'service_order_reopen_status_unknown';
      end if;
      update public.service_orders
        set status = restored_os_status,
            previous_status_before_cancellation = null,
            updated_at = now()
      where id = service_order_record.id
        and organization_id = collection_record.organization_id;
    end if;
    insert into public.collection_events (
      organization_id, collection_id, actor_user_id,
      event_type, previous_status, new_status, reason
    ) values (
      collection_record.organization_id, p_collection_id, actor_id,
      'collection.reopened', 'canceled', restored_status, p_reason
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

-- Garante que os grants permanecem (CREATE OR REPLACE os preserva, mas a
-- declaração explícita deixa a intenção clara no diff e protege contra
-- divergências de deploy).
grant execute on function public.reopen_collection(uuid, integer, text, uuid, text) to authenticated;
grant execute on function public.cancel_or_reopen_collection(uuid, integer, text, text, uuid, text) to authenticated;
