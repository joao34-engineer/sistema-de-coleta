-- Fase 5.11: lifecycle reopen limpa colunas de cancelamento.
-- Esta migration é ADITIVA: usa CREATE OR REPLACE FUNCTION para corrigir
-- reopen_collection (Fase 1A) e cancel_or_reopen_collection (Fase 3b) sem
-- alterar assinaturas, perder grants nem apagar dados.
-- Corpo de reopen_collection copiado de 20260815090000_phase_1a_collection_core.sql.
-- Corpo de cancel_or_reopen_collection copiado de 20260823000001_phase_3_rpcs_idempotency.sql.
-- Não altera private.enqueue_lifecycle_document_render_job, não dropa
-- cancel_collection/reopen_collection e não remove as rotas HTTP.

-- 1. Lifecycle stack: reopen_collection agora limpa canceled_at, canceled_by,
--    cancel_reason e previous_status_before_cancellation, preservando
--    reopened_at/reopened_by/reopen_reason e o append de documento.
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
  document_id uuid;
  restored_status text;
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

-- 2. Workshop stack: cancel_or_reopen_collection recebe coalesce no status de
--    reabertura para nunca escrever NULL quando previous_status_before_cancellation
--    for nulo. As colunas de cancelamento já eram limpas nesta função.
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
      set status = coalesce(collection_record.previous_status_before_cancellation, 'collected'),
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

-- Garante que os grants permanecem (CREATE OR REPLACE os preserva, mas a
-- declaração explícita deixa a intenção clara no diff e protege contra
-- divergências de deploy).
grant execute on function public.reopen_collection(uuid, integer, text, uuid, text) to authenticated;
grant execute on function public.cancel_or_reopen_collection(uuid, integer, text, text, uuid, text) to authenticated;
