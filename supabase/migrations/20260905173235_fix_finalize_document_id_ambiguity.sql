-- Fix PL/pgSQL locals named document_id. They collided with
-- document_jobs.document_id in ON CONFLICT (42702) and blocked finalize.
-- Same pattern as 20260905151120_fix_company_issuer_settings_rpc.sql.

create or replace function private.append_document_version_using_issuer(
  p_collection_id uuid,
  p_actor_user_id uuid,
  p_issuer_profile_id uuid,
  p_allow_retired_issuer boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection_record public.collections%rowtype;
  issuer_record public.document_issuer_profiles%rowtype;
  asset_record public.organization_brand_assets%rowtype;
  snapshot_value jsonb;
  issuer_snapshot jsonb;
  next_version integer;
  v_document_id uuid;
begin
  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'collection_not_found';
  end if;
  select * into issuer_record
  from public.document_issuer_profiles
  where id = p_issuer_profile_id
    and organization_id = collection_record.organization_id
    and (
      status = 'active'
      or (p_allow_retired_issuer and status = 'retired')
    );
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;
  select * into asset_record
  from public.organization_brand_assets
  where id = issuer_record.logo_asset_id
    and organization_id = collection_record.organization_id
    and asset_type = 'logo';
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;

  snapshot_value := private.collection_snapshot(p_collection_id);
  issuer_snapshot := jsonb_build_object(
    'id', issuer_record.id,
    'legal_name', issuer_record.legal_name,
    'tax_id', issuer_record.tax_id,
    'phone', issuer_record.phone,
    'street', issuer_record.street,
    'street_number', issuer_record.street_number,
    'address_complement', issuer_record.address_complement,
    'district', issuer_record.district,
    'city', issuer_record.city,
    'state_code', issuer_record.state_code,
    'postal_code', issuer_record.postal_code,
    'receipt_legal_text', issuer_record.receipt_legal_text,
    'signer_name', issuer_record.signer_name,
    'signer_title', issuer_record.signer_title,
    'logo_asset_id', asset_record.id,
    'logo_storage_path', asset_record.storage_path,
    'logo_sha256', asset_record.sha256
  );
  snapshot_value := snapshot_value || jsonb_build_object('issuer', issuer_snapshot);
  select coalesce(max(version), 0) + 1 into next_version from public.documents where collection_id = p_collection_id;

  insert into public.documents (
    organization_id, collection_id, version, snapshot, snapshot_hash,
    verification_token, issuer_profile_id, created_by
  ) values (
    collection_record.organization_id, p_collection_id, next_version, snapshot_value,
    encode(extensions.digest(convert_to(snapshot_value::text, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex'), p_issuer_profile_id, p_actor_user_id
  ) returning id into v_document_id;
  return v_document_id;
end;
$$;

create or replace function private.append_document_version(
  p_collection_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection_record public.collections%rowtype;
  issuer_profile_id_value uuid;
  snapshot_value jsonb;
  next_version integer;
  v_document_id uuid;
begin
  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'collection_not_found';
  end if;

  select document_record.issuer_profile_id
    into issuer_profile_id_value
  from public.documents as document_record
  where document_record.collection_id = p_collection_id
  order by document_record.version desc
  limit 1;
  if issuer_profile_id_value is not null then
    -- Cancelamento/reabertura não pode passar a depender do perfil atualmente
    -- ativo: o perfil original pode ter sido aposentado após a emissão. Ele
    -- permanece imutável e é congelado novamente no snapshot da nova versão.
    return private.append_document_version_using_issuer(
      p_collection_id,
      p_actor_user_id,
      issuer_profile_id_value,
      true
    );
  end if;

  snapshot_value := private.collection_snapshot(p_collection_id);
  select coalesce(max(version), 0) + 1
    into next_version
  from public.documents
  where collection_id = p_collection_id;

  insert into public.documents (
    organization_id,
    collection_id,
    version,
    snapshot,
    snapshot_hash,
    verification_token,
    created_by
  ) values (
    collection_record.organization_id,
    p_collection_id,
    next_version,
    snapshot_value,
    encode(extensions.digest(convert_to(snapshot_value::text, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex'),
    p_actor_user_id
  ) returning id into v_document_id;

  return v_document_id;
end;
$$;

create or replace function public.finalize_collection(
  p_collection_id uuid,
  p_expected_version integer,
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
  customer_record public.customers%rowtype;
  issuer_profile_record public.document_issuer_profiles%rowtype;
  issued_year_value integer;
  sequence_value integer;
  v_document_id uuid;
  response_value jsonb;
  customer_snapshot_value jsonb;
  next_version integer;
begin
  if actor_id is null or p_expected_version < 1 or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_finalize_request';
  end if;

  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  select * into request_record
  from public.idempotency_requests
  where organization_id = collection_record.organization_id
    and operation = 'finalize'
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
    values (collection_record.organization_id, p_collection_id, 'finalize', p_idempotency_key, p_request_hash, actor_id);
  end if;

  if collection_record.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;
  select * into issuer_profile_record
  from public.document_issuer_profiles
  where organization_id = collection_record.organization_id and status = 'active';
  if not found or issuer_profile_record.logo_asset_id is null or not exists (
    select 1 from public.organization_brand_assets as asset_record
    where asset_record.id = issuer_profile_record.logo_asset_id
      and asset_record.organization_id = collection_record.organization_id
      and asset_record.asset_type = 'logo'
  ) then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;
  if collection_record.customer_id is null
    or length(trim(coalesce(collection_record.collection_location, ''))) = 0
    or length(trim(coalesce(collection_record.responsible_name, ''))) = 0
    or collection_record.collected_at is null then
    raise exception using errcode = 'P0001', message = 'collection_incomplete';
  end if;
  if not exists (select 1 from public.collection_items where collection_id = p_collection_id and organization_id = collection_record.organization_id and removed_at is null) then
    raise exception using errcode = 'P0001', message = 'collection_requires_item';
  end if;
  if not exists (select 1 from public.signatures where collection_id = p_collection_id and organization_id = collection_record.organization_id) then
    raise exception using errcode = 'P0001', message = 'collection_requires_signature';
  end if;

  select * into customer_record from public.customers where id = collection_record.customer_id and organization_id = collection_record.organization_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'customer_not_found';
  end if;
  customer_snapshot_value := jsonb_build_object('id', customer_record.id, 'legal_name', customer_record.legal_name, 'tax_id', customer_record.tax_id, 'phone', customer_record.phone);

  issued_year_value := extract(year from timezone('America/Sao_Paulo', now()))::integer;
  insert into public.collection_sequences (organization_id, issued_year, last_value)
  values (collection_record.organization_id, issued_year_value, 1)
  on conflict (organization_id, issued_year)
  do update set last_value = public.collection_sequences.last_value + 1, updated_at = now()
  returning last_value into sequence_value;
  if sequence_value > 999999 then
    raise exception using errcode = 'P0001', message = 'sequence_exhausted';
  end if;

  next_version := collection_record.row_version + 1;
  update public.collections
  set status = 'collected', customer_snapshot = customer_snapshot_value,
      issued_year = issued_year_value, sequence_number = sequence_value,
      official_code = format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')),
      row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  v_document_id := private.append_document_version_with_issuer(
    p_collection_id, actor_id, issuer_profile_record.id
  );
  insert into public.document_jobs (
    organization_id, document_id, job_type, idempotency_key, requested_by
  ) values
    (collection_record.organization_id, v_document_id, 'render_pdf', p_idempotency_key, actor_id),
    (collection_record.organization_id, v_document_id, 'render_qr', p_idempotency_key, actor_id)
  on conflict on constraint document_jobs_document_id_job_type_key do nothing;
  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status, metadata)
  values (collection_record.organization_id, p_collection_id, actor_id, 'collection.finalized', 'draft', 'collected', jsonb_build_object('document_id', v_document_id, 'issuer_profile_id', issuer_profile_record.id, 'row_version', next_version));

  response_value := jsonb_build_object('collectionId', p_collection_id, 'officialCode', format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')), 'status', 'collected', 'rowVersion', next_version, 'document', jsonb_build_object('id', v_document_id, 'version', 1, 'status', 'snapshot_ready'));
  update public.idempotency_requests set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id and operation = 'finalize' and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;
