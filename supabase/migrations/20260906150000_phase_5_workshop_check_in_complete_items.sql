-- Fase 5: 5.8 check-in de oficina exige todos os itens da coleta.
-- Esta migration é ADITIVA: usa CREATE OR REPLACE FUNCTION para ampliar
-- public.workshop_check_in com validações de duplicidade e completude.
-- Não apaga, reseta ou modifica dados existentes, guias, assinaturas ou eventos.
-- O corpo parte da migration 20260823000001_phase_3_rpcs_idempotency.sql
-- (workshop_check_in, linhas ~22-176).

-- 5a. workshop_check_in — collected -> in_workshop
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

  -- array vazio permanece invalid_workshop_checkin_request
  if jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid_workshop_checkin_request';
  end if;

  -- nenhum id de item pode aparecer mais de uma vez
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(item_id uuid)
    group by item_id having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate_workshop_item';
  end if;

  -- todos os itens não removidos da coleta devem estar no check-in
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
