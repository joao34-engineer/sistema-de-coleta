-- Fase 5 / PR 4: recusar cancel de draft e cancelar/restaurar a OS.
-- Aditiva: coluna nullable em service_orders + CHECK que aceita NULL (linhas
-- existentes passam). CREATE OR REPLACE nas mesmas assinaturas de
-- cancel_or_reopen_collection (6 args) e reopen_collection (5 args);
-- preserva grants. Sem DROP FUNCTION/TABLE. Sem DELETE. Sem alterar
-- service_orders_status_check nem
-- collections_previous_status_before_cancellation_check.
-- Corpos partem de 20260906180000 (definição vigente de ambas; nenhum
-- arquivo posterior as redefine).

-- 4b — memória do status da OS antes do cancelamento (tudo excepto canceled).
alter table public.service_orders
  add column if not exists previous_status_before_cancellation text;

alter table public.service_orders
  drop constraint if exists service_orders_previous_status_before_cancellation_check;
alter table public.service_orders
  add constraint service_orders_previous_status_before_cancellation_check
  check (
    previous_status_before_cancellation is null
    or previous_status_before_cancellation in (
      'draft', 'budgeted', 'approved', 'in_service', 'ready', 'rejected', 'delivered'
    )
  );

-- Lifecycle reopen_collection also needed REPLACE: cancel now marks the OS
-- canceled and stores previous_status_before_cancellation, and this RPC is
-- a second reopen path (HTTP / collection-lifecycle DAL). Leaving it
-- untouched would leave the OS stuck at canceled after reopen.
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
  -- collected / in_workshop não têm OS: no-op, não cria linha.
  -- CASE idêntico ao ramo reopen de cancel_or_reopen_collection.
  if service_order_record.id is not null then
    restored_os_status := service_order_record.previous_status_before_cancellation;
    if restored_os_status is null then
      restored_os_status := case coalesce(
        collection_record.previous_status_before_cancellation, 'collected'
      )
        when 'in_budget' then 'budgeted'
        when 'approved' then 'approved'
        when 'in_service' then 'in_service'
        when 'ready' then 'ready'
        when 'invoiced' then 'ready'
        when 'partial_delivery' then 'ready'
        when 'rejected' then 'rejected'
        else null
      end;
    end if;
    if restored_os_status is not null then
      update public.service_orders
        set status = restored_os_status,
            previous_status_before_cancellation = null,
            updated_at = now()
      where id = service_order_record.id
        and organization_id = collection_record.organization_id;
    end if;
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
    -- collected / in_workshop não têm OS: no-op, não cria linha.
    if service_order_record.id is not null then
      restored_os_status := service_order_record.previous_status_before_cancellation;
      if restored_os_status is null then
        restored_os_status := case coalesce(
          collection_record.previous_status_before_cancellation, 'collected'
        )
          when 'in_budget' then 'budgeted'
          when 'approved' then 'approved'
          when 'in_service' then 'in_service'
          when 'ready' then 'ready'
          when 'invoiced' then 'ready'
          when 'partial_delivery' then 'ready'
          when 'rejected' then 'rejected'
          else null
        end;
      end if;
      if restored_os_status is not null then
        update public.service_orders
          set status = restored_os_status,
              previous_status_before_cancellation = null,
              updated_at = now()
        where id = service_order_record.id
          and organization_id = collection_record.organization_id;
      end if;
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

-- Garante que os grants permanecem (CREATE OR REPLACE os preserva, mas a
-- declaração explícita deixa a intenção clara no diff e protege contra
-- divergências de deploy).
grant execute on function public.reopen_collection(uuid, integer, text, uuid, text) to authenticated;
grant execute on function public.cancel_or_reopen_collection(uuid, integer, text, text, uuid, text) to authenticated;
