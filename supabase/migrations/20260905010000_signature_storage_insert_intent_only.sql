-- Assinatura de coleta: o WITH CHECK de Storage nao pode exigir metadata.mimetype.
-- O bucket ja restringe image/png; o intent pendente autoriza o caminho.
-- O commit aceita o objeto no path certo mesmo se o MIME vier vazio no insert.

drop policy if exists collection_signatures_insert_draft_admin on storage.objects;
create policy collection_signatures_insert_draft_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_upload_intent_path(
    bucket_id,
    (split_part(name, '/', 1))::bigint,
    split_part(name, '/', 2),
    name
  )
);

drop policy if exists collection_signatures_insert_delivery_intent on storage.objects;
create policy collection_signatures_insert_delivery_intent
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (
    exists (
      select 1 from private.delivery_signature_intents as intent_record
      where intent_record.organization_id = split_part(name, '/', 1)::bigint
        and intent_record.storage_path = name
        and intent_record.status = 'pending'
        and intent_record.created_by = (select auth.uid())
    )
    or private.current_user_can_upload_intent_path(
      bucket_id,
      (split_part(name, '/', 1))::bigint,
      split_part(name, '/', 2),
      name
    )
  )
);

create or replace function private.commit_collection_upload(
  p_intent_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  intent_record private.collection_upload_intents%rowtype;
  collection_record public.collections%rowtype;
  evidence_id uuid;
  signature_id uuid;
  next_version integer;
  bucket_name text;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_expected_version';
  end if;

  select *
    into intent_record
  from private.collection_upload_intents
  where id = p_intent_id
  for update;

  if not found or intent_record.created_by <> actor_id then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if intent_record.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'upload_intent_not_pending';
  end if;
  if intent_record.expires_at <= now() then
    update private.collection_upload_intents
      set status = 'expired', canceled_at = now()
    where id = p_intent_id;
    raise exception using errcode = 'P0001', message = 'upload_intent_expired';
  end if;

  select *
    into collection_record
  from public.collections
  where id = intent_record.collection_id
  for update;

  if not found or collection_record.organization_id <> intent_record.organization_id
    or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;
  if collection_record.row_version <> p_expected_version
    or intent_record.expected_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  if intent_record.kind = 'evidence' then
    if intent_record.collection_item_id is not null and not exists (
      select 1
      from public.collection_items as item_record
      where item_record.id = intent_record.collection_item_id
        and item_record.collection_id = collection_record.id
        and item_record.organization_id = collection_record.organization_id
        and item_record.removed_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'collection_item_mismatch';
    end if;
    bucket_name := 'collection-evidences';
  else
    bucket_name := 'collection-signatures';
  end if;

  if not exists (
    select 1
    from storage.objects as storage_object
    where storage_object.bucket_id = bucket_name
      and storage_object.name = intent_record.storage_path
      and (
        storage_object.metadata->>'mimetype' is null
        or storage_object.metadata->>'mimetype' = intent_record.content_type
      )
  ) then
    raise exception using errcode = 'P0001', message = 'upload_object_missing';
  end if;

  next_version := collection_record.row_version + 1;
  if intent_record.kind = 'evidence' then
    insert into public.evidences (
      organization_id,
      collection_id,
      collection_item_id,
      storage_path,
      content_type,
      byte_size,
      sha256,
      created_by
    )
    values (
      collection_record.organization_id,
      collection_record.id,
      intent_record.collection_item_id,
      intent_record.storage_path,
      intent_record.content_type,
      intent_record.byte_size,
      intent_record.sha256,
      actor_id
    )
    returning id into evidence_id;
  else
    insert into public.signatures (
      organization_id,
      collection_id,
      signer_name,
      signer_tax_id,
      acceptance_text,
      storage_path,
      byte_size,
      sha256,
      created_by
    )
    values (
      collection_record.organization_id,
      collection_record.id,
      trim(intent_record.signer_name),
      intent_record.signer_tax_id,
      trim(intent_record.acceptance_text),
      intent_record.storage_path,
      intent_record.byte_size,
      intent_record.sha256,
      actor_id
    )
    returning id into signature_id;
  end if;

  update public.collections
    set row_version = next_version,
        updated_by = actor_id
  where id = collection_record.id;

  update private.collection_upload_intents
    set status = 'committed',
        committed_at = now()
  where id = intent_record.id;

  insert into public.collection_events (
    organization_id,
    collection_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    collection_record.organization_id,
    collection_record.id,
    actor_id,
    case when intent_record.kind = 'evidence' then 'collection.evidence.committed' else 'collection.signature.committed' end,
    jsonb_build_object(
      'intent_id', intent_record.id,
      'evidence_id', evidence_id,
      'signature_id', signature_id,
      'row_version', next_version
    )
  );

  return jsonb_build_object(
    'collectionId', collection_record.id,
    'rowVersion', next_version,
    'kind', intent_record.kind,
    'bucketId', bucket_name,
    'intentId', intent_record.id,
    'evidenceId', evidence_id,
    'signatureId', signature_id,
    'storagePath', intent_record.storage_path
  );
end;
$$;
