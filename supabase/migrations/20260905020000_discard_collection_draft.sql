-- Fase 2 (B20): descarte de rascunho pelo criador/admin.
-- Aditiva: nao apaga coletas emitidas, clientes, PDFs nem documentos.

create or replace function public.discard_collection_draft(
  p_collection_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_discard_request';
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

  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  if exists (
    select 1
      from public.documents
     where collection_id = p_collection_id
  ) then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;

  if to_regclass('public.collection_upload_intents') is not null then
    execute 'delete from public.collection_upload_intents where collection_id = $1'
      using p_collection_id;
  end if;

  delete from public.evidences
   where collection_id = p_collection_id
     and organization_id = collection_record.organization_id;

  delete from public.signatures
   where collection_id = p_collection_id
     and organization_id = collection_record.organization_id;

  delete from public.collection_items
   where collection_id = p_collection_id
     and organization_id = collection_record.organization_id;

  delete from public.collection_events
   where collection_id = p_collection_id
     and organization_id = collection_record.organization_id;

  delete from public.idempotency_requests
   where collection_id = p_collection_id
     and organization_id = collection_record.organization_id;

  delete from public.collections
   where id = p_collection_id
     and organization_id = collection_record.organization_id
     and status = 'draft';

  if not found then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;

  return jsonb_build_object('ok', true, 'collectionId', p_collection_id);
end;
$$;

revoke execute on function public.discard_collection_draft(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function public.discard_collection_draft(uuid, integer)
to authenticated;
