-- Fase 5: recusar mutação de progresso em item já entregue.
-- CREATE OR REPLACE na mesma assinatura de update_service_progress
-- (5 args). Sem DROP FUNCTION. Sem GRANT. Corpo parte de 20260907000000;
-- o único delta é o guard item_already_delivered no loop de escrita.

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

  if collection_record.status not in ('approved', 'in_service', 'partial_delivery') then
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
    update public.service_orders set status = 'ready' where id = service_order_record.id;
    if collection_record.status = 'partial_delivery' then
      update public.collections
        set row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
    else
      update public.collections
        set status = 'ready', row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
    end if;
  else
    if collection_record.status = 'approved' then
      update public.service_orders set status = 'in_service' where id = service_order_record.id;
      update public.collections
        set status = 'in_service', row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
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
        update public.service_orders set status = 'in_service' where id = service_order_record.id;
      end if;
      update public.collections
        set row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
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
