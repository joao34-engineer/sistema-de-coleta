-- Fase 5: service_orders.status terminal `delivered` (5.9).
-- Aditiva: alarga o CHECK; nao apaga dados, eventos, PDFs, assinaturas nem termos.
-- Sem DROP FUNCTION: CREATE OR REPLACE na mesma assinatura de 9 argumentos (preserva grants Chat 3).
-- Corpo de deliver_to_customer parte da 3b (20260823000001). Entrega parcial permanece ready; entrega total -> delivered.
-- Nao adiciona invoiced na ordem de servico (faturamento e fato da coleta).

-- 5.9 — CHECK da OS ganha o estado terminal delivered (padrao Fase 0.4)
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders
  add constraint service_orders_status_check
  check (status in ('draft','budgeted','approved','in_service','ready','canceled','rejected','delivered'));

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
    update public.service_orders
      set status = case when remaining = 0 then 'delivered' else 'ready' end,
          updated_at = now()
    where id = order_record.id;
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
