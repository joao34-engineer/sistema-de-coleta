-- Dedicated machine code for invalid signer/responsible CPF/CNPJ.
-- CREATE OR REPLACE nas mesmas assinaturas (preserva grants Chat 3).
-- Sem DROP FUNCTION. Sem GRANT. Sem alteração de CHECK nem de dados.
-- Corpos partem de 20260815090000 (únicas definições vigentes).

create or replace function public.update_collection_draft(
  p_collection_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  next_version integer;
  patch_key text;
  next_customer_id uuid;
begin
  if actor_id is null or p_expected_version < 1 or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_draft_patch';
  end if;
  if p_patch = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'empty_draft_patch';
  end if;
  for patch_key in select jsonb_object_keys(p_patch) loop
    if patch_key not in ('customer_id', 'collection_location', 'responsible_name', 'responsible_tax_id', 'collected_at') then
      raise exception using errcode = 'P0001', message = 'invalid_draft_field';
    end if;
  end loop;

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

  if p_patch ? 'responsible_tax_id'
    and p_patch->>'responsible_tax_id' is not null
    and not private.is_valid_cpf_cnpj(p_patch->>'responsible_tax_id') then
    raise exception using errcode = 'P0001', message = 'invalid_signer_tax_id';
  end if;

  next_customer_id := collection_record.customer_id;
  if p_patch ? 'customer_id' then
    if p_patch->>'customer_id' is null or p_patch->>'customer_id' = '' then
      next_customer_id := null;
    elsif p_patch->>'customer_id' !~ '^[0-9a-f-]{36}$' then
      raise exception using errcode = 'P0001', message = 'invalid_customer_id';
    else
      next_customer_id := (p_patch->>'customer_id')::uuid;
      if not exists (
        select 1
        from public.customers as customer_record
        where customer_record.id = next_customer_id
          and customer_record.organization_id = collection_record.organization_id
      ) then
        raise exception using errcode = 'P0001', message = 'customer_not_found';
      end if;
    end if;
  end if;

  next_version := collection_record.row_version + 1;
  update public.collections
    set customer_id = next_customer_id,
        collection_location = case when p_patch ? 'collection_location' then p_patch->>'collection_location' else collection_location end,
        responsible_name = case when p_patch ? 'responsible_name' then p_patch->>'responsible_name' else responsible_name end,
        responsible_tax_id = case when p_patch ? 'responsible_tax_id' then p_patch->>'responsible_tax_id' else responsible_tax_id end,
        collected_at = case when p_patch ? 'collected_at' then (p_patch->>'collected_at')::timestamptz else collected_at end,
        row_version = next_version,
        updated_by = actor_id
  where id = collection_record.id;

  insert into public.collection_events (
    organization_id,
    collection_id,
    actor_user_id,
    event_type,
    previous_status,
    new_status,
    metadata
  )
  values (
    collection_record.organization_id,
    collection_record.id,
    actor_id,
    'collection.draft.updated',
    'draft',
    'draft',
    jsonb_build_object('row_version', next_version)
  );

  return jsonb_build_object(
    'collectionId', collection_record.id,
    'status', 'draft',
    'rowVersion', next_version,
    'customerId', next_customer_id,
    'collectionLocation', case when p_patch ? 'collection_location' then p_patch->>'collection_location' else collection_record.collection_location end,
    'responsibleName', case when p_patch ? 'responsible_name' then p_patch->>'responsible_name' else collection_record.responsible_name end,
    'responsibleTaxId', case when p_patch ? 'responsible_tax_id' then p_patch->>'responsible_tax_id' else collection_record.responsible_tax_id end,
    'collectedAt', case when p_patch ? 'collected_at' then p_patch->>'collected_at' else collection_record.collected_at::text end
  );
end;
$$;

create or replace function public.prepare_collection_upload(
  p_collection_id uuid,
  p_expected_version integer,
  p_kind text,
  p_item_id uuid,
  p_content_type text,
  p_byte_size integer,
  p_sha256 text,
  p_extension text default null,
  p_signer_name text default null,
  p_signer_tax_id text default null,
  p_acceptance_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  intent_id uuid := extensions.gen_random_uuid();
  extension_value text;
  storage_path_value text;
  expires_at_value timestamptz := now() + interval '15 minutes';
begin
  if actor_id is null or p_expected_version < 1
    or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_kind not in ('evidence', 'signature')
    or (p_extension is not null and p_extension not in ('png', 'jpg', 'jpeg', 'webp')) then
    raise exception using errcode = 'P0001', message = 'invalid_upload_metadata';
  end if;
  if p_kind = 'signature' and not private.is_valid_cpf_cnpj(coalesce(p_signer_tax_id, '')) then
    raise exception using errcode = 'P0001', message = 'invalid_signer_tax_id';
  end if;
  if p_kind = 'signature' and (
    p_content_type <> 'image/png'
    or p_byte_size not between 1 and 2097152
    or p_item_id is not null
    or length(trim(coalesce(p_signer_name, ''))) not between 1 and 160
    or length(trim(coalesce(p_acceptance_text, ''))) not between 1 and 2000
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_signature_metadata';
  end if;
  if p_kind = 'evidence'
    and (p_content_type not in ('image/png', 'image/jpeg', 'image/webp') or p_byte_size not between 1 and 10485760) then
    raise exception using errcode = 'P0001', message = 'invalid_evidence_metadata';
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
  if p_kind = 'evidence' and p_item_id is not null and not exists (
    select 1
    from public.collection_items as item_record
    where item_record.id = p_item_id
      and item_record.collection_id = p_collection_id
      and item_record.organization_id = collection_record.organization_id
      and item_record.removed_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'collection_item_mismatch';
  end if;

  extension_value := case p_content_type
    when 'image/png' then 'png'
    when 'image/jpeg' then 'jpg'
    when 'image/webp' then 'webp'
  end;
  if p_extension is not null
    and p_extension <> extension_value
    and not (p_content_type = 'image/jpeg' and p_extension = 'jpeg') then
    raise exception using errcode = 'P0001', message = 'invalid_upload_extension';
  end if;
  intent_id := extensions.gen_random_uuid();
  -- O objeto recebe o caminho definitivo desde o upload. Ele continua invisível
  -- enquanto o intent estiver pendente porque a policy de leitura exige um
  -- registro confirmado em evidences/signatures; isso evita renomear Storage
  -- fora da transação e mantém o objeto rastreável pelo cleanup.
  storage_path_value := format('%s/%s/%s.%s', collection_record.organization_id, collection_record.id, intent_id, extension_value);

  insert into private.collection_upload_intents (
    id,
    organization_id,
    collection_id,
    collection_item_id,
    kind,
    storage_path,
    content_type,
    byte_size,
    sha256,
    expected_version,
    signer_name,
    signer_tax_id,
    acceptance_text,
    expires_at,
    created_by
  )
  values (
    intent_id,
    collection_record.organization_id,
    collection_record.id,
    p_item_id,
    p_kind,
    storage_path_value,
    p_content_type,
    p_byte_size,
    p_sha256,
    p_expected_version,
    nullif(trim(p_signer_name), ''),
    p_signer_tax_id,
    nullif(trim(p_acceptance_text), ''),
    expires_at_value,
    actor_id
  );

  return jsonb_build_object(
    'intentId', intent_id,
    'collectionId', collection_record.id,
    'kind', p_kind,
    'bucketId', case when p_kind = 'signature' then 'collection-signatures' else 'collection-evidences' end,
    'storagePath', storage_path_value,
    'contentType', p_content_type,
    'byteSize', p_byte_size,
    'sha256', p_sha256,
    'expectedVersion', p_expected_version,
    'expiresAt', expires_at_value
  );
end;
$$;
