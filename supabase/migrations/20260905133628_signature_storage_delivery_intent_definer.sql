-- Assinatura de coleta: a policy de INSERT de delivery nao pode consultar
-- private.delivery_signature_intents como authenticated. Sem SELECT, o EXISTS
-- levanta permission denied e o Postgres aborta o INSERT inteiro, mesmo quando
-- collection_signatures_insert_draft_admin passaria via helper DEFINER.
-- O mesmo vale para branches de SELECT que leem tabelas private.

grant usage on schema private to authenticated;

create or replace function private.current_user_can_upload_delivery_intent_path(
  p_bucket text,
  p_organization_id bigint,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket <> 'collection-signatures'
    or p_name !~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$' then
    return false;
  end if;

  return exists (
    select 1
    from private.delivery_signature_intents as intent_record
    where intent_record.organization_id = p_organization_id
      and intent_record.storage_path = p_name
      and intent_record.status = 'pending'
      and intent_record.expires_at > now()
      and intent_record.created_by = (select auth.uid())
  );
end;
$$;

create or replace function private.current_user_can_read_committed_private_signature_path(
  p_bucket text,
  p_organization_id bigint,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket <> 'collection-signatures'
    or p_name !~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$' then
    return false;
  end if;

  return exists (
    select 1
    from private.delivery_signature_intents as intent_record
    where intent_record.organization_id = p_organization_id
      and intent_record.storage_path = p_name
      and intent_record.status = 'committed'
  )
  or exists (
    select 1
    from private.collection_upload_intents as upload_intent
    where upload_intent.organization_id = p_organization_id
      and upload_intent.storage_path = p_name
      and upload_intent.status = 'committed'
  );
end;
$$;

revoke all on function
  private.current_user_can_upload_delivery_intent_path(text, bigint, text),
  private.current_user_can_read_committed_private_signature_path(text, bigint, text)
from public;

grant execute on function
  private.current_user_can_upload_delivery_intent_path(text, bigint, text),
  private.current_user_can_read_committed_private_signature_path(text, bigint, text)
to authenticated;

drop policy if exists collection_signatures_insert_delivery_intent on storage.objects;
create policy collection_signatures_insert_delivery_intent
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_upload_delivery_intent_path(
    bucket_id,
    (split_part(name, '/', 1))::bigint,
    name
  )
);

drop policy if exists collection_signatures_read_delivery_or_checkin on storage.objects;
create policy collection_signatures_read_delivery_or_checkin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (
    exists (
      select 1 from public.signatures as signature_record
      where signature_record.organization_id = split_part(name, '/', 1)::bigint
        and signature_record.storage_path = name
    )
    or exists (
      select 1 from public.service_orders as order_record
      where order_record.organization_id = split_part(name, '/', 1)::bigint
        and order_record.check_in_signature_path = name
    )
    or exists (
      select 1 from public.collections as collection_record
      where collection_record.organization_id = split_part(name, '/', 1)::bigint
        and collection_record.check_in_signature_path = name
    )
    or private.current_user_can_read_committed_private_signature_path(
      bucket_id,
      (split_part(name, '/', 1))::bigint,
      name
    )
  )
);
