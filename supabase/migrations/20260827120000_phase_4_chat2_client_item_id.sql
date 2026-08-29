-- Fase 4 Chat 2: idempotência de item com UUID do cliente.
-- Aditivo: coluna nullable, índice único parcial e parâmetro opcional no RPC.
-- DROP abaixo remove só a assinatura de 7 argumentos. Postgres não permite
-- acrescentar parâmetro com CREATE OR REPLACE na mesma identidade.
-- Sem DELETE/TRUNCATE/RESET. Linhas existentes ficam com client_item_id null.

alter table public.collection_items
  add column if not exists client_item_id uuid;

create unique index if not exists collection_items_client_item_id_uidx
  on public.collection_items (collection_id, client_item_id)
  where client_item_id is not null;

drop function if exists public.create_collection_item(uuid, integer, text, numeric, text, text, integer);

create or replace function public.create_collection_item(
  p_collection_id uuid,
  p_expected_version integer,
  p_description text,
  p_quantity numeric,
  p_condition_note text default null,
  p_observation text default null,
  p_position integer default 0,
  p_client_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  item_record public.collection_items%rowtype;
  item_id uuid;
  next_version integer;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_expected_version';
  end if;
  if length(trim(coalesce(p_description, ''))) not between 1 and 1000
    or p_quantity is null
    or p_quantity <= 0
    or p_position is null
    or p_position < 0
    or (p_condition_note is not null and length(trim(p_condition_note)) > 1000)
    or (p_observation is not null and length(trim(p_observation)) > 2000) then
    raise exception using errcode = 'P0001', message = 'invalid_collection_item';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;

  if p_client_item_id is not null then
    select *
      into item_record
    from public.collection_items
    where collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and (id = p_client_item_id or client_item_id = p_client_item_id)
      and removed_at is null;
    if found then
      return jsonb_build_object(
        'collectionId', collection_record.id,
        'rowVersion', collection_record.row_version,
        'idempotent', true,
        'item', jsonb_build_object(
          'id', item_record.id,
          'description', item_record.description,
          'quantity', item_record.quantity,
          'conditionNote', item_record.condition_note,
          'observation', item_record.observation,
          'position', item_record.position
        )
      );
    end if;
  end if;

  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  item_id := coalesce(p_client_item_id, gen_random_uuid());

  insert into public.collection_items (
    id,
    organization_id,
    collection_id,
    client_item_id,
    description,
    quantity,
    condition_note,
    observation,
    position,
    created_by,
    updated_by
  )
  values (
    item_id,
    collection_record.organization_id,
    collection_record.id,
    p_client_item_id,
    trim(p_description),
    p_quantity,
    nullif(trim(p_condition_note), ''),
    nullif(trim(p_observation), ''),
    p_position,
    actor_id,
    actor_id
  );

  next_version := collection_record.row_version + 1;
  update public.collections
    set row_version = next_version, updated_by = actor_id
  where id = collection_record.id;

  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, metadata)
  values (
    collection_record.organization_id,
    collection_record.id,
    actor_id,
    'collection.item.created',
    jsonb_build_object('item_id', item_id, 'row_version', next_version)
  );

  return jsonb_build_object(
    'collectionId', collection_record.id,
    'rowVersion', next_version,
    'item', jsonb_build_object(
      'id', item_id,
      'description', trim(p_description),
      'quantity', p_quantity,
      'conditionNote', nullif(trim(p_condition_note), ''),
      'observation', nullif(trim(p_observation), ''),
      'position', p_position
    )
  );
end;
$$;

revoke execute on function public.create_collection_item(uuid, integer, text, numeric, text, text, integer, uuid)
  from public, anon, service_role;

grant execute on function public.create_collection_item(uuid, integer, text, numeric, text, text, integer, uuid)
  to authenticated;
