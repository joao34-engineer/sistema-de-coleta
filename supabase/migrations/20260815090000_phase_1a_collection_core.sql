-- Fase 1A e exclusivamente aditiva. Nao aplicar por reset ou em dados reais.
create extension if not exists pgcrypto with schema extensions;

create or replace function private.is_valid_cpf_cnpj(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  value_digits text := coalesce(p_value, '');
  sum_value integer;
  first_digit integer;
  second_digit integer;
  index_value integer;
  weight_value integer;
begin
  if value_digits !~ '^[0-9]{11}([0-9]{3})?$' or value_digits ~ '^([0-9])\1+$' then
    return false;
  end if;

  if length(value_digits) = 11 then
    sum_value := 0;
    for index_value in 1..9 loop
      sum_value := sum_value + substring(value_digits from index_value for 1)::integer * (11 - index_value);
    end loop;
    first_digit := case when (sum_value * 10) % 11 = 10 then 0 else (sum_value * 10) % 11 end;
    sum_value := 0;
    for index_value in 1..10 loop
      sum_value := sum_value + substring(value_digits from index_value for 1)::integer * (12 - index_value);
    end loop;
    second_digit := case when (sum_value * 10) % 11 = 10 then 0 else (sum_value * 10) % 11 end;
    return first_digit = substring(value_digits from 10 for 1)::integer
      and second_digit = substring(value_digits from 11 for 1)::integer;
  end if;

  sum_value := 0;
  weight_value := 5;
  for index_value in 1..12 loop
    sum_value := sum_value + substring(value_digits from index_value for 1)::integer * weight_value;
    weight_value := case when weight_value = 2 then 9 else weight_value - 1 end;
  end loop;
  first_digit := case when sum_value % 11 < 2 then 0 else 11 - (sum_value % 11) end;
  sum_value := 0;
  weight_value := 6;
  for index_value in 1..13 loop
    sum_value := sum_value + substring(value_digits from index_value for 1)::integer * weight_value;
    weight_value := case when weight_value = 2 then 9 else weight_value - 1 end;
  end loop;
  second_digit := case when sum_value % 11 < 2 then 0 else 11 - (sum_value % 11) end;
  return first_digit = substring(value_digits from 13 for 1)::integer
    and second_digit = substring(value_digits from 14 for 1)::integer;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  legal_name text not null check (length(trim(legal_name)) between 1 and 160),
  tax_id text not null check (private.is_valid_cpf_cnpj(tax_id)),
  phone text not null check (phone ~ '^[1-9][0-9]{9,10}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  updated_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tax_id),
  unique (id, organization_id)
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  phone text check (phone is null or phone ~ '^[1-9][0-9]{9,10}$'),
  email text check (email is null or length(trim(email)) <= 254),
  job_title text check (job_title is null or length(trim(job_title)) <= 120),
  is_primary boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  label text check (label is null or length(trim(label)) <= 80),
  street text not null check (length(trim(street)) between 1 and 160),
  street_number text check (street_number is null or length(trim(street_number)) <= 20),
  address_complement text check (address_complement is null or length(trim(address_complement)) <= 120),
  district text check (district is null or length(trim(district)) <= 100),
  city text not null check (length(trim(city)) between 1 and 100),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  is_primary boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  plate text check (plate is null or plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  description text check (description is null or length(trim(description)) <= 160),
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, plate),
  foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  customer_id uuid,
  status text not null default 'draft' check (status in ('draft', 'collected', 'canceled')),
  official_code text unique check (official_code is null or official_code ~ '^MJT-[0-9]{4}-[0-9]{6}$'),
  issued_year integer check (issued_year is null or issued_year between 2020 and 9999),
  sequence_number integer check (sequence_number is null or sequence_number between 1 and 999999),
  collection_location text,
  responsible_name text,
  responsible_tax_id text check (responsible_tax_id is null or private.is_valid_cpf_cnpj(responsible_tax_id)),
  collected_at timestamptz,
  row_version integer not null default 1 check (row_version > 0),
  canceled_at timestamptz,
  canceled_by uuid references public.profiles(user_id) on delete restrict,
  cancel_reason text,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(user_id) on delete restrict,
  reopen_reason text,
  previous_status_before_cancellation text check (previous_status_before_cancellation is null or previous_status_before_cancellation in ('draft', 'collected')),
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  updated_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issued_year, sequence_number),
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict,
  check ((status = 'draft' and official_code is null and issued_year is null and sequence_number is null) or (status in ('collected', 'canceled') and official_code is not null and issued_year is not null and sequence_number is not null)),
  check ((status <> 'canceled') or (canceled_at is not null and canceled_by is not null and length(trim(coalesce(cancel_reason, ''))) > 0))
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 1000),
  quantity numeric(12, 3) not null check (quantity > 0),
  condition_note text check (condition_note is null or length(trim(condition_note)) <= 1000),
  observation text check (observation is null or length(trim(observation)) <= 2000),
  position integer not null default 0 check (position >= 0),
  removed_at timestamptz,
  removed_by uuid references public.profiles(user_id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  collection_item_id uuid,
  storage_path text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict,
  foreign key (collection_item_id, organization_id) references public.collection_items(id, organization_id) on delete restrict
);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  signer_name text not null check (length(trim(signer_name)) between 1 and 160),
  signer_tax_id text not null check (private.is_valid_cpf_cnpj(signer_tax_id)),
  acceptance_text text not null check (length(trim(acceptance_text)) between 1 and 2000),
  storage_path text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'),
  byte_size integer not null check (byte_size between 1 and 2097152),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create table public.collection_sequences (
  organization_id bigint not null references public.organizations(id) on delete restrict,
  issued_year integer not null check (issued_year between 2020 and 9999),
  last_value integer not null default 0 check (last_value between 0 and 999999),
  updated_at timestamptz not null default now(),
  primary key (organization_id, issued_year)
);

create table public.collection_events (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  actor_user_id uuid references public.profiles(user_id) on delete restrict,
  event_type text not null check (length(trim(event_type)) between 1 and 120),
  previous_status text check (previous_status is null or previous_status in ('draft', 'collected', 'canceled')),
  new_status text check (new_status is null or new_status in ('draft', 'collected', 'canceled')),
  reason text check (reason is null or length(trim(reason)) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'snapshot_ready' check (status in ('snapshot_ready', 'rendered', 'failed')),
  snapshot jsonb not null,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  verification_token text not null unique check (verification_token ~ '^[0-9a-f]{64}$'),
  storage_path text unique check (storage_path is null or storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  issued_at timestamptz not null default now(),
  unique (collection_id, version),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create table public.idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  operation text not null check (operation in ('finalize', 'cancel', 'reopen')),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, operation, idempotency_key),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create index customers_search_idx on public.customers (organization_id, legal_name);
create index customers_phone_idx on public.customers (organization_id, phone);
create index customer_contacts_customer_idx on public.customer_contacts (organization_id, customer_id);
create index customer_addresses_customer_idx on public.customer_addresses (organization_id, customer_id);
create index vehicles_customer_idx on public.vehicles (organization_id, customer_id);
create index collections_list_idx on public.collections (organization_id, status, created_at desc);
create index collections_customer_idx on public.collections (organization_id, customer_id, created_at desc);
create index collection_items_collection_idx on public.collection_items (organization_id, collection_id, position);
create index evidences_collection_idx on public.evidences (organization_id, collection_id, created_at);
create index signatures_collection_idx on public.signatures (organization_id, collection_id, signed_at desc);
create index collection_events_timeline_idx on public.collection_events (organization_id, collection_id, created_at desc);
create index documents_current_idx on public.documents (organization_id, collection_id, version desc);

create or replace function private.set_collection_updated_by()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_by := (select auth.uid()); return new; end;
$$;

create or replace function private.require_collection_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'draft' and new.status = 'draft' and new.row_version <> old.row_version + 1 then
    raise exception using errcode = 'P0001', message = 'stale_version';
  end if;
  return new;
end;
$$;

create or replace function private.set_item_removed_by()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.removed_at is not null and old.removed_at is null then new.removed_by := (select auth.uid()); end if;
  return new;
end;
$$;

create or replace function private.current_user_can_access_collection(p_collection_id uuid, p_organization_id bigint, p_require_draft boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_admin(p_organization_id)
    and exists (
      select 1 from public.collections as collection_record
      where collection_record.id = p_collection_id
        and collection_record.organization_id = p_organization_id
        and (not p_require_draft or collection_record.status = 'draft')
    );
$$;

create or replace function private.current_user_can_access_customer(p_customer_id uuid, p_organization_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_is_admin(p_organization_id)
    and exists (select 1 from public.customers as customer_record where customer_record.id = p_customer_id and customer_record.organization_id = p_organization_id);
$$;

create or replace function private.current_user_can_access_collection_path(p_organization_id bigint, p_collection_text text, p_require_draft boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_collection_text !~ '^[0-9a-f-]{36}$' then return false; end if;
  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, p_require_draft);
end;
$$;

create or replace function private.current_user_can_upload_document_path(p_organization_id bigint, p_collection_text text, p_document_text text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_collection_text !~ '^[0-9a-f-]{36}$' or p_document_text !~ '^[0-9a-f-]{36}$' then return false; end if;
  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, false)
    and exists (
      select 1 from public.documents as document_record
      where document_record.id = p_document_text::uuid
        and document_record.organization_id = p_organization_id
        and document_record.collection_id = p_collection_text::uuid
        and document_record.storage_path is null
    );
end;
$$;

create or replace function private.collection_snapshot(p_collection_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'collection', jsonb_build_object('id', collection_record.id, 'official_code', collection_record.official_code, 'status', collection_record.status, 'location', collection_record.collection_location, 'responsible_name', collection_record.responsible_name, 'responsible_tax_id', collection_record.responsible_tax_id, 'collected_at', collection_record.collected_at, 'issued_year', collection_record.issued_year, 'sequence_number', collection_record.sequence_number),
    'customer', jsonb_build_object('id', customer_record.id, 'legal_name', customer_record.legal_name, 'tax_id', customer_record.tax_id, 'phone', customer_record.phone),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', item_record.id, 'description', item_record.description, 'quantity', item_record.quantity, 'condition_note', item_record.condition_note, 'observation', item_record.observation, 'position', item_record.position) order by item_record.position, item_record.created_at) from public.collection_items as item_record where item_record.collection_id = collection_record.id and item_record.removed_at is null), '[]'::jsonb),
    'signature', (select jsonb_build_object('id', signature_record.id, 'signer_name', signature_record.signer_name, 'signer_tax_id', signature_record.signer_tax_id, 'acceptance_text', signature_record.acceptance_text, 'storage_path', signature_record.storage_path, 'sha256', signature_record.sha256, 'signed_at', signature_record.signed_at) from public.signatures as signature_record where signature_record.collection_id = collection_record.id order by signature_record.signed_at desc, signature_record.created_at desc limit 1),
    'organization', jsonb_build_object('id', organization_record.id, 'display_name', organization_record.display_name)
  )
  from public.collections as collection_record
  join public.customers as customer_record on customer_record.id = collection_record.customer_id
  join public.organizations as organization_record on organization_record.id = collection_record.organization_id
  where collection_record.id = p_collection_id;
$$;

create or replace function private.append_document_version(p_collection_id uuid, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  collection_record public.collections%rowtype;
  snapshot_value jsonb;
  next_version integer;
  document_id uuid;
begin
  select * into collection_record from public.collections where id = p_collection_id for update;
  snapshot_value := private.collection_snapshot(p_collection_id);
  select coalesce(max(version), 0) + 1 into next_version from public.documents where collection_id = p_collection_id;
  insert into public.documents (organization_id, collection_id, version, snapshot, snapshot_hash, verification_token, created_by)
  values (collection_record.organization_id, p_collection_id, next_version, snapshot_value, encode(extensions.digest(convert_to(snapshot_value::text, 'UTF8'), 'sha256'), 'hex'), encode(extensions.gen_random_bytes(32), 'hex'), p_actor_user_id)
  returning id into document_id;
  return document_id;
end;
$$;

create or replace function private.record_collection_draft_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, new_status)
    values (new.organization_id, new.id, new.created_by, 'collection.draft.created', new.status);
  elsif old.status = 'draft' and new.status = 'draft' and old.row_version is distinct from new.row_version then
    insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status)
    values (new.organization_id, new.id, coalesce(new.updated_by, (select auth.uid())), 'collection.draft.updated', old.status, new.status);
  end if;
  return new;
end;
$$;

create or replace function public.save_collection_signature(p_collection_id uuid, p_expected_version integer, p_signer_name text, p_signer_tax_id text, p_acceptance_text text, p_storage_path text, p_file_sha256 text, p_byte_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  collection_record public.collections%rowtype;
  actor_id uuid := (select auth.uid());
  signature_id uuid;
begin
  if actor_id is null or p_expected_version < 1 or p_file_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 2097152 then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  if collection_record.status <> 'draft' then raise exception using errcode = 'P0001', message = 'collection_not_draft'; end if;
  if collection_record.row_version <> p_expected_version then raise exception using errcode = '40001', message = 'stale_version'; end if;
  insert into public.signatures (organization_id, collection_id, signer_name, signer_tax_id, acceptance_text, storage_path, byte_size, sha256, created_by)
  values (collection_record.organization_id, p_collection_id, trim(p_signer_name), p_signer_tax_id, trim(p_acceptance_text), p_storage_path, p_byte_size, p_file_sha256, actor_id)
  returning id into signature_id;
  update public.collections set row_version = row_version + 1, updated_by = actor_id where id = p_collection_id;
  return jsonb_build_object('collectionId', p_collection_id, 'rowVersion', collection_record.row_version + 1, 'signatureId', signature_id);
end;
$$;

create or replace function public.finalize_collection(p_collection_id uuid, p_expected_version integer, p_idempotency_key uuid, p_request_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  collection_record public.collections%rowtype;
  request_record public.idempotency_requests%rowtype;
  actor_id uuid := (select auth.uid());
  issued_year_value integer;
  sequence_value integer;
  document_id uuid;
  response_value jsonb;
begin
  if actor_id is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into request_record from public.idempotency_requests where organization_id = collection_record.organization_id and operation = 'finalize' and idempotency_key = p_idempotency_key for update;
  if found then
    if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then raise exception using errcode = 'P0001', message = 'idempotency_conflict'; end if;
    if request_record.completed_at is not null then return request_record.response; end if;
  else
    insert into public.idempotency_requests (organization_id, collection_id, operation, idempotency_key, request_hash, created_by) values (collection_record.organization_id, p_collection_id, 'finalize', p_idempotency_key, p_request_hash, actor_id);
  end if;
  if collection_record.status <> 'draft' then raise exception using errcode = 'P0001', message = 'collection_not_draft'; end if;
  if collection_record.row_version <> p_expected_version then raise exception using errcode = '40001', message = 'stale_version'; end if;
  if collection_record.customer_id is null or length(trim(coalesce(collection_record.collection_location, ''))) = 0 or length(trim(coalesce(collection_record.responsible_name, ''))) = 0 or collection_record.collected_at is null then raise exception using errcode = 'P0001', message = 'collection_incomplete'; end if;
  if not exists (select 1 from public.collection_items where collection_id = p_collection_id and removed_at is null) then raise exception using errcode = 'P0001', message = 'collection_requires_item'; end if;
  if not exists (select 1 from public.signatures where collection_id = p_collection_id) then raise exception using errcode = 'P0001', message = 'collection_requires_signature'; end if;
  issued_year_value := extract(year from timezone('America/Sao_Paulo', now()))::integer;
  insert into public.collection_sequences (organization_id, issued_year, last_value) values (collection_record.organization_id, issued_year_value, 1)
  on conflict (organization_id, issued_year) do update set last_value = public.collection_sequences.last_value + 1, updated_at = now()
  returning last_value into sequence_value;
  if sequence_value > 999999 then raise exception using errcode = 'P0001', message = 'sequence_exhausted'; end if;
  update public.collections set status = 'collected', issued_year = issued_year_value, sequence_number = sequence_value, official_code = format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')), row_version = row_version + 1, updated_by = actor_id where id = p_collection_id;
  document_id := private.append_document_version(p_collection_id, actor_id);
  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status, metadata) values (collection_record.organization_id, p_collection_id, actor_id, 'collection.finalized', 'draft', 'collected', jsonb_build_object('document_id', document_id));
  response_value := jsonb_build_object('collectionId', p_collection_id, 'officialCode', format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')), 'status', 'collected', 'rowVersion', collection_record.row_version + 1, 'document', jsonb_build_object('id', document_id, 'version', 1, 'status', 'snapshot_ready'));
  update public.idempotency_requests set response = response_value, completed_at = now() where organization_id = collection_record.organization_id and operation = 'finalize' and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

create or replace function public.cancel_collection(p_collection_id uuid, p_expected_version integer, p_reason text, p_idempotency_key uuid, p_request_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare collection_record public.collections%rowtype; request_record public.idempotency_requests%rowtype; actor_id uuid := (select auth.uid()); document_id uuid; response_value jsonb;
begin
  if actor_id is null or p_request_hash !~ '^[0-9a-f]{64}$' or length(trim(coalesce(p_reason, ''))) = 0 then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into request_record from public.idempotency_requests where organization_id = collection_record.organization_id and operation = 'cancel' and idempotency_key = p_idempotency_key for update;
  if found then if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then raise exception using errcode = 'P0001', message = 'idempotency_conflict'; end if; if request_record.completed_at is not null then return request_record.response; end if; else insert into public.idempotency_requests (organization_id, collection_id, operation, idempotency_key, request_hash, created_by) values (collection_record.organization_id, p_collection_id, 'cancel', p_idempotency_key, p_request_hash, actor_id); end if;
  if collection_record.status <> 'collected' then raise exception using errcode = 'P0001', message = 'collection_cannot_cancel'; end if;
  if collection_record.row_version <> p_expected_version then raise exception using errcode = '40001', message = 'stale_version'; end if;
  update public.collections set status = 'canceled', previous_status_before_cancellation = collection_record.status, canceled_at = now(), canceled_by = actor_id, cancel_reason = trim(p_reason), row_version = row_version + 1, updated_by = actor_id where id = p_collection_id;
  document_id := private.append_document_version(p_collection_id, actor_id);
  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status, reason, metadata) values (collection_record.organization_id, p_collection_id, actor_id, 'collection.canceled', collection_record.status, 'canceled', trim(p_reason), jsonb_build_object('document_id', document_id));
  response_value := jsonb_build_object('collectionId', p_collection_id, 'officialCode', collection_record.official_code, 'status', 'canceled', 'rowVersion', collection_record.row_version + 1, 'document', jsonb_build_object('id', document_id, 'version', (select version from public.documents where id = document_id), 'status', 'snapshot_ready'));
  update public.idempotency_requests set response = response_value, completed_at = now() where organization_id = collection_record.organization_id and operation = 'cancel' and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

create or replace function public.reopen_collection(p_collection_id uuid, p_expected_version integer, p_reason text, p_idempotency_key uuid, p_request_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare collection_record public.collections%rowtype; request_record public.idempotency_requests%rowtype; actor_id uuid := (select auth.uid()); document_id uuid; restored_status text; response_value jsonb;
begin
  if actor_id is null or p_request_hash !~ '^[0-9a-f]{64}$' or length(trim(coalesce(p_reason, ''))) = 0 then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into collection_record from public.collections where id = p_collection_id for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into request_record from public.idempotency_requests where organization_id = collection_record.organization_id and operation = 'reopen' and idempotency_key = p_idempotency_key for update;
  if found then if request_record.collection_id <> p_collection_id or request_record.request_hash <> p_request_hash then raise exception using errcode = 'P0001', message = 'idempotency_conflict'; end if; if request_record.completed_at is not null then return request_record.response; end if; else insert into public.idempotency_requests (organization_id, collection_id, operation, idempotency_key, request_hash, created_by) values (collection_record.organization_id, p_collection_id, 'reopen', p_idempotency_key, p_request_hash, actor_id); end if;
  if collection_record.status <> 'canceled' then raise exception using errcode = 'P0001', message = 'collection_not_canceled'; end if;
  if collection_record.row_version <> p_expected_version then raise exception using errcode = '40001', message = 'stale_version'; end if;
  restored_status := coalesce(collection_record.previous_status_before_cancellation, 'collected');
  update public.collections set status = restored_status, reopened_at = now(), reopened_by = actor_id, reopen_reason = trim(p_reason), row_version = row_version + 1, updated_by = actor_id where id = p_collection_id;
  document_id := private.append_document_version(p_collection_id, actor_id);
  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status, reason, metadata) values (collection_record.organization_id, p_collection_id, actor_id, 'collection.reopened', 'canceled', restored_status, trim(p_reason), jsonb_build_object('document_id', document_id));
  response_value := jsonb_build_object('collectionId', p_collection_id, 'officialCode', collection_record.official_code, 'status', restored_status, 'rowVersion', collection_record.row_version + 1, 'document', jsonb_build_object('id', document_id, 'version', (select version from public.documents where id = document_id), 'status', 'snapshot_ready'));
  update public.idempotency_requests set response = response_value, completed_at = now() where organization_id = collection_record.organization_id and operation = 'reopen' and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

create or replace function public.list_collections(p_code text, p_customer text, p_tax_id text, p_phone text, p_status text, p_from timestamptz, p_to timestamptz, p_cursor uuid, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with permitted as (
    select collection_record.*, customer_record.legal_name, customer_record.tax_id, customer_record.phone
    from public.collections as collection_record
    join public.customers as customer_record on customer_record.id = collection_record.customer_id
    where private.current_user_is_admin(collection_record.organization_id)
      and (p_code is null or collection_record.official_code ilike '%' || p_code || '%')
      and (p_customer is null or customer_record.legal_name ilike '%' || p_customer || '%')
      and (p_tax_id is null or customer_record.tax_id = p_tax_id)
      and (p_phone is null or customer_record.phone = p_phone)
      and (p_status is null or collection_record.status = p_status)
      and (p_from is null or collection_record.created_at >= p_from)
      and (p_to is null or collection_record.created_at <= p_to)
      and (p_cursor is null or collection_record.id > p_cursor)
    order by collection_record.id
    limit greatest(1, least(coalesce(p_limit, 25), 50)) + 1
  ), page as (select * from permitted limit greatest(1, least(coalesce(p_limit, 25), 50)))
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'officialCode', official_code, 'status', status, 'customerName', legal_name, 'customerTaxId', tax_id, 'customerPhone', phone, 'collectedAt', collected_at, 'createdAt', created_at, 'rowVersion', row_version) order by id) from page), '[]'::jsonb),
    'nextCursor', (select case when count(*) > greatest(1, least(coalesce(p_limit, 25), 50)) then (array_agg(id order by id))[greatest(1, least(coalesce(p_limit, 25), 50))] else null end from permitted)
  );
$$;

create or replace function public.get_collection_detail(p_collection_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', collection_record.id, 'officialCode', collection_record.official_code, 'status', collection_record.status, 'rowVersion', collection_record.row_version,
    'customer', jsonb_build_object('name', customer_record.legal_name, 'taxId', customer_record.tax_id, 'phone', customer_record.phone),
    'collectionLocation', case when collection_record.collection_location is null then null else jsonb_build_object('description', collection_record.collection_location) end,
    'responsibleName', collection_record.responsible_name, 'collectedAt', collection_record.collected_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', item_record.id, 'description', item_record.description, 'quantity', item_record.quantity, 'condition', item_record.condition_note, 'notes', item_record.observation) order by item_record.position, item_record.created_at) from public.collection_items as item_record where item_record.collection_id = collection_record.id and item_record.removed_at is null), '[]'::jsonb),
    'signature', (select jsonb_build_object('signerName', signature_record.signer_name, 'signerTaxId', signature_record.signer_tax_id, 'acceptedAt', signature_record.signed_at) from public.signatures as signature_record where signature_record.collection_id = collection_record.id order by signature_record.signed_at desc, signature_record.created_at desc limit 1),
    'evidences', coalesce((select jsonb_agg(jsonb_build_object('id', evidence_record.id, 'createdAt', evidence_record.created_at) order by evidence_record.created_at) from public.evidences as evidence_record where evidence_record.collection_id = collection_record.id), '[]'::jsonb),
    'currentDocument', (select jsonb_build_object('id', document_record.id, 'version', document_record.version, 'status', document_record.status, 'issuedAt', document_record.issued_at) from public.documents as document_record where document_record.collection_id = collection_record.id order by document_record.version desc limit 1)
  )
  from public.collections as collection_record
  join public.customers as customer_record on customer_record.id = collection_record.customer_id
  where collection_record.id = p_collection_id and private.current_user_is_admin(collection_record.organization_id);
$$;

create or replace function public.list_collection_events(p_collection_id uuid, p_cursor uuid, p_limit integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  with permitted as (
    select event_record.* from public.collection_events as event_record
    join public.collections as collection_record on collection_record.id = event_record.collection_id
    where event_record.collection_id = p_collection_id and private.current_user_is_admin(collection_record.organization_id)
      and (p_cursor is null or event_record.id < p_cursor)
    order by event_record.id desc limit greatest(1, least(coalesce(p_limit, 50), 100)) + 1
  ), page as (select * from permitted limit greatest(1, least(coalesce(p_limit, 50), 100)))
  select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'type', event_type, 'previousStatus', previous_status, 'nextStatus', new_status, 'reason', reason, 'actorName', null, 'createdAt', created_at) order by id desc) from page), '[]'::jsonb), 'nextCursor', (select case when count(*) > greatest(1, least(coalesce(p_limit, 50), 100)) then (array_agg(id order by id desc))[greatest(1, least(coalesce(p_limit, 50), 100))] else null end from permitted));
$$;

create or replace function public.verify_collection_document(p_verification_token text)
returns table (is_authentic boolean, official_code text, issued_at timestamptz, collection_status text, organization_name text, document_version integer)
language sql stable security definer set search_path = '' as $$
  select true, collection_record.official_code, document_record.issued_at, collection_record.status, organization_record.display_name, document_record.version
  from public.documents as document_record
  join public.collections as collection_record on collection_record.id = document_record.collection_id
  join public.organizations as organization_record on organization_record.id = document_record.organization_id
  where document_record.verification_token = p_verification_token
  limit 1;
$$;

revoke all on function private.is_valid_cpf_cnpj(text), private.set_collection_updated_by(), private.require_collection_version(), private.set_item_removed_by(), private.current_user_can_access_collection(uuid, bigint, boolean), private.current_user_can_access_customer(uuid, bigint), private.current_user_can_access_collection_path(bigint, text, boolean), private.current_user_can_upload_document_path(bigint, text, text), private.collection_snapshot(uuid), private.append_document_version(uuid, uuid), private.record_collection_draft_event() from public;
revoke all on function public.save_collection_signature(uuid, integer, text, text, text, text, text, integer), public.finalize_collection(uuid, integer, uuid, text), public.cancel_collection(uuid, integer, text, uuid, text), public.reopen_collection(uuid, integer, text, uuid, text), public.list_collections(text, text, text, text, text, timestamptz, timestamptz, uuid, integer), public.get_collection_detail(uuid), public.list_collection_events(uuid, uuid, integer), public.verify_collection_document(text) from public;
grant execute on function public.save_collection_signature(uuid, integer, text, text, text, text, text, integer), public.finalize_collection(uuid, integer, uuid, text), public.cancel_collection(uuid, integer, text, uuid, text), public.reopen_collection(uuid, integer, text, uuid, text), public.list_collections(text, text, text, text, text, timestamptz, timestamptz, uuid, integer), public.get_collection_detail(uuid), public.list_collection_events(uuid, uuid, integer) to authenticated;
grant execute on function public.verify_collection_document(text) to anon, authenticated;
grant execute on function private.is_valid_cpf_cnpj(text), private.current_user_can_access_collection(uuid, bigint, boolean), private.current_user_can_access_customer(uuid, bigint), private.current_user_can_access_collection_path(bigint, text, boolean), private.current_user_can_upload_document_path(bigint, text, text) to authenticated;

create trigger customers_set_updated_at before update on public.customers for each row execute function private.set_updated_at();
create trigger contacts_set_updated_at before update on public.customer_contacts for each row execute function private.set_updated_at();
create trigger addresses_set_updated_at before update on public.customer_addresses for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles for each row execute function private.set_updated_at();
create trigger collections_set_updated_at before update on public.collections for each row execute function private.set_updated_at();
create trigger collections_set_updated_by before update on public.collections for each row execute function private.set_collection_updated_by();
create trigger collections_require_version before update on public.collections for each row execute function private.require_collection_version();
create trigger collection_items_set_updated_at before update on public.collection_items for each row execute function private.set_updated_at();
create trigger collection_items_set_removed_by before update on public.collection_items for each row execute function private.set_item_removed_by();
create trigger collections_record_draft_event after insert or update on public.collections for each row execute function private.record_collection_draft_event();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.vehicles enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.evidences enable row level security;
alter table public.signatures enable row level security;
alter table public.collection_sequences enable row level security;
alter table public.collection_events enable row level security;
alter table public.documents enable row level security;
alter table public.idempotency_requests enable row level security;

revoke all on table public.customers, public.customer_contacts, public.customer_addresses, public.vehicles, public.collections, public.collection_items, public.evidences, public.signatures, public.collection_sequences, public.collection_events, public.documents, public.idempotency_requests from anon, authenticated;
grant select, insert, update on public.customers, public.customer_contacts, public.customer_addresses, public.vehicles to authenticated;
grant select, insert on public.collections to authenticated;
grant update (customer_id, collection_location, responsible_name, responsible_tax_id, collected_at, row_version) on public.collections to authenticated;
grant select, insert, update (description, quantity, condition_note, observation, position, removed_at) on public.collection_items to authenticated;
grant select, insert on public.evidences, public.signatures to authenticated;
grant select on public.collection_events, public.documents to authenticated;

create policy customers_admin_all on public.customers for all to authenticated using (private.current_user_is_admin(organization_id)) with check (private.current_user_is_admin(organization_id));
create policy customer_contacts_admin_all on public.customer_contacts for all to authenticated using (private.current_user_can_access_customer(customer_id, organization_id)) with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy customer_addresses_admin_all on public.customer_addresses for all to authenticated using (private.current_user_can_access_customer(customer_id, organization_id)) with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy vehicles_admin_all on public.vehicles for all to authenticated using (private.current_user_can_access_customer(customer_id, organization_id)) with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy collections_select_admin on public.collections for select to authenticated using (private.current_user_is_admin(organization_id));
create policy collections_insert_admin on public.collections for insert to authenticated with check (private.current_user_is_admin(organization_id) and status = 'draft' and created_by = (select auth.uid()));
create policy collections_update_draft_admin on public.collections for update to authenticated using (private.current_user_can_access_collection(id, organization_id, true)) with check (private.current_user_can_access_collection(id, organization_id, true));
create policy collection_items_select_admin on public.collection_items for select to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy collection_items_write_draft_admin on public.collection_items for all to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, true)) with check (private.current_user_can_access_collection(collection_id, organization_id, true));
create policy evidences_select_admin on public.evidences for select to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy evidences_insert_draft_admin on public.evidences for insert to authenticated with check (private.current_user_can_access_collection(collection_id, organization_id, true) and created_by = (select auth.uid()));
create policy signatures_select_admin on public.signatures for select to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy signatures_insert_draft_admin on public.signatures for insert to authenticated with check (private.current_user_can_access_collection(collection_id, organization_id, true) and created_by = (select auth.uid()));
create policy collection_events_select_admin on public.collection_events for select to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy documents_select_admin on public.documents for select to authenticated using (private.current_user_can_access_collection(collection_id, organization_id, false));

create policy collection_evidences_select_admin on storage.objects for select to authenticated using (bucket_id = 'collection-evidences' and split_part(name, '/', 1) ~ '^[0-9]+$' and private.current_user_can_access_collection_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), false));
create policy collection_evidences_insert_draft_admin on storage.objects for insert to authenticated with check (bucket_id = 'collection-evidences' and name ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$' and (metadata->>'mimetype') in ('image/png', 'image/jpeg', 'image/webp') and private.current_user_can_access_collection_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), true));
create policy collection_signatures_select_admin on storage.objects for select to authenticated using (bucket_id = 'collection-signatures' and split_part(name, '/', 1) ~ '^[0-9]+$' and private.current_user_can_access_collection_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), false));
create policy collection_signatures_insert_draft_admin on storage.objects for insert to authenticated with check (bucket_id = 'collection-signatures' and name ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$' and (metadata->>'mimetype') = 'image/png' and private.current_user_can_access_collection_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), true));
create policy collection_documents_select_admin on storage.objects for select to authenticated using (bucket_id = 'collection-documents' and split_part(name, '/', 1) ~ '^[0-9]+$' and private.current_user_can_access_collection_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), false));
create policy collection_documents_insert_admin on storage.objects for insert to authenticated with check (bucket_id = 'collection-documents' and name ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and (metadata->>'mimetype') = 'application/pdf' and private.current_user_can_upload_document_path(split_part(name, '/', 1)::bigint, split_part(name, '/', 2), split_part(split_part(name, '/', 3), '.', 1)));
