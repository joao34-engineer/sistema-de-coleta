-- Fase 1A: núcleo da coleta.
-- Esta migration é aditiva e deve ser revisada/aplicada somente fora de produção.
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
  customer_snapshot jsonb,
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
  check ((status = 'draft' and official_code is null and issued_year is null and sequence_number is null and customer_snapshot is null) or (status in ('collected', 'canceled') and official_code is not null and issued_year is not null and sequence_number is not null and customer_snapshot is not null)),
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
  updated_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, collection_id, organization_id),
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
  foreign key (collection_item_id, collection_id, organization_id) references public.collection_items(id, collection_id, organization_id) on delete restrict
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

-- Intents ficam no schema privado: não são expostos pela Data API e são acessíveis
-- somente pelos RPCs de upload/limpeza.
create table private.collection_upload_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  collection_item_id uuid,
  kind text not null check (kind in ('evidence', 'signature')),
  storage_path text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  expected_version integer not null check (expected_version > 0),
  status text not null default 'pending' check (status in ('pending', 'committed', 'canceled', 'expired')),
  signer_name text,
  signer_tax_id text,
  acceptance_text text,
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  canceled_at timestamptz,
  foreign key (collection_item_id, collection_id, organization_id) references public.collection_items(id, collection_id, organization_id) on delete restrict,
  check (
    (kind = 'signature'
      and content_type = 'image/png'
      and byte_size <= 2097152
      and collection_item_id is null
      and signer_name is not null
      and signer_tax_id is not null
      and acceptance_text is not null)
    or kind = 'evidence'
  )
);

create index customers_search_idx on public.customers (organization_id, legal_name);
create index customers_phone_idx on public.customers (organization_id, phone);
create index customer_contacts_customer_idx on public.customer_contacts (organization_id, customer_id);
create index customer_addresses_customer_idx on public.customer_addresses (organization_id, customer_id);
create unique index customer_addresses_primary_unique_idx
  on public.customer_addresses (organization_id, customer_id)
  where is_primary;
create index vehicles_customer_idx on public.vehicles (organization_id, customer_id);
create index collections_list_idx on public.collections (organization_id, status, created_at desc, id desc);
create index collections_customer_idx on public.collections (organization_id, customer_id, created_at desc, id desc);
create index collection_items_collection_idx on public.collection_items (organization_id, collection_id, position, created_at, id);
create index evidences_collection_idx on public.evidences (organization_id, collection_id, created_at, id);
create index signatures_collection_idx on public.signatures (organization_id, collection_id, signed_at desc, created_at desc, id desc);
create index collection_events_timeline_idx on public.collection_events (organization_id, collection_id, created_at desc, id desc);
create index documents_current_idx on public.documents (organization_id, collection_id, version desc);
create index collection_upload_intents_cleanup_idx on private.collection_upload_intents (status, expires_at);

create or replace function private.set_collection_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create or replace function private.set_item_updated_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create or replace function private.set_item_removed_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    new.removed_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create or replace function private.ensure_single_primary_customer_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_primary then
    update public.customer_addresses as address_record
      set is_primary = false,
          updated_at = now()
    where address_record.organization_id = new.organization_id
      and address_record.customer_id = new.customer_id
      and address_record.id is distinct from new.id
      and address_record.is_primary;
  end if;
  return new;
end;
$$;

create or replace function private.create_customer_with_address_for_organization(
  p_organization_id bigint,
  p_legal_name text,
  p_tax_id text,
  p_phone text,
  p_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  legal_name_value text := trim(coalesce(p_legal_name, ''));
  tax_id_value text := regexp_replace(trim(coalesce(p_tax_id, '')), '[^0-9]', '', 'g');
  phone_value text := regexp_replace(trim(coalesce(p_phone, '')), '[^0-9]', '', 'g');
  customer_record public.customers%rowtype;
  address_record public.customer_addresses%rowtype;
  address_street text;
  address_number text;
  address_complement text;
  address_district text;
  address_city text;
  address_state_code text;
  address_postal_code text;
  address_label text;
  address_is_primary boolean := false;
  address_is_primary_text text;
begin
  if actor_id is null or p_organization_id is null
    or not private.current_user_is_admin(p_organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if legal_name_value !~ '^.{1,160}$'
    or not private.is_valid_cpf_cnpj(tax_id_value)
    or phone_value !~ '^[1-9][0-9]{9,10}$' then
    raise exception using errcode = 'P0001', message = 'invalid_customer_metadata';
  end if;

  if p_address is not null and jsonb_typeof(p_address) <> 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_address_metadata';
  end if;
  if p_address is not null then
    address_label := nullif(trim(coalesce(p_address->>'label', '')), '');
    address_street := trim(coalesce(p_address->>'street', ''));
    address_number := nullif(trim(coalesce(p_address->>'street_number', p_address->>'streetNumber', '')), '');
    address_complement := nullif(trim(coalesce(p_address->>'address_complement', p_address->>'complement', '')), '');
    address_district := nullif(trim(coalesce(p_address->>'district', '')), '');
    address_city := trim(coalesce(p_address->>'city', ''));
    address_state_code := upper(trim(coalesce(p_address->>'state_code', p_address->>'stateCode', '')));
    address_postal_code := nullif(regexp_replace(trim(coalesce(p_address->>'postal_code', p_address->>'postalCode', '')), '[^0-9]', '', 'g'), '');
    address_is_primary_text := lower(coalesce(p_address->>'is_primary', p_address->>'isPrimary', 'false'));
    if address_is_primary_text not in ('true', 'false') then
      raise exception using errcode = 'P0001', message = 'invalid_address_metadata';
    end if;
    address_is_primary := address_is_primary_text = 'true';
    if address_street !~ '^.{1,160}$'
      or address_city !~ '^.{1,100}$'
      or address_state_code !~ '^[A-Z]{2}$'
      or (address_label is not null and length(address_label) > 80)
      or (address_number is not null and length(address_number) > 20)
      or (address_complement is not null and length(address_complement) > 120)
      or (address_district is not null and length(address_district) > 100)
      or (address_postal_code is not null and address_postal_code !~ '^[0-9]{8}$') then
      raise exception using errcode = 'P0001', message = 'invalid_address_metadata';
    end if;
  end if;

  insert into public.customers (
    organization_id,
    legal_name,
    tax_id,
    phone,
    status,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    legal_name_value,
    tax_id_value,
    phone_value,
    'active',
    actor_id,
    actor_id
  )
  returning * into customer_record;

  if p_address is not null then
    insert into public.customer_addresses (
      organization_id,
      customer_id,
      label,
      street,
      street_number,
      address_complement,
      district,
      city,
      state_code,
      postal_code,
      is_primary,
      created_by
    )
    values (
      p_organization_id,
      customer_record.id,
      address_label,
      address_street,
      address_number,
      address_complement,
      address_district,
      address_city,
      address_state_code,
      address_postal_code,
      address_is_primary,
      actor_id
    )
    returning * into address_record;
  end if;

  return jsonb_build_object(
    'customer', jsonb_build_object(
      'id', customer_record.id,
      'organization_id', customer_record.organization_id,
      'legal_name', customer_record.legal_name,
      'tax_id', customer_record.tax_id,
      'phone', customer_record.phone,
      'status', customer_record.status,
      'created_at', customer_record.created_at,
      'updated_at', customer_record.updated_at
    ),
    'address', case when p_address is null then null else jsonb_build_object(
      'id', address_record.id,
      'organization_id', address_record.organization_id,
      'customer_id', address_record.customer_id,
      'label', address_record.label,
      'street', address_record.street,
      'street_number', address_record.street_number,
      'address_complement', address_record.address_complement,
      'district', address_record.district,
      'city', address_record.city,
      'state_code', address_record.state_code,
      'postal_code', address_record.postal_code,
      'is_primary', address_record.is_primary,
      'created_at', address_record.created_at,
      'updated_at', address_record.updated_at
    ) end
  );
end;
$$;

create or replace function public.create_customer_with_address_for_organization(
  p_organization_id bigint,
  p_legal_name text,
  p_tax_id text,
  p_phone text,
  p_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_customer_with_address_for_organization(
    p_organization_id,
    p_legal_name,
    p_tax_id,
    p_phone,
    p_address
  );
end;
$$;

create or replace function public.create_customer_with_address(
  p_legal_name text,
  p_tax_id text,
  p_phone text,
  p_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  organization_id_value bigint;
  organization_count integer;
begin
  select count(*)::integer, min(membership.organization_id)
    into organization_count, organization_id_value
  from public.organization_memberships as membership
  join public.profiles as profile on profile.user_id = membership.user_id
  where membership.user_id = actor_id
    and membership.role_code = 'administrator'
    and membership.status = 'active'
    and profile.status = 'active';
  if organization_count <> 1 then
    raise exception using errcode = 'P0001', message = 'organization_context_required';
  end if;
  return public.create_customer_with_address_for_organization(
    organization_id_value,
    p_legal_name,
    p_tax_id,
    p_phone,
    p_address
  );
end;
$$;

create or replace function private.require_collection_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.row_version <> old.row_version + 1 then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;
  return new;
end;
$$;

create or replace function private.guard_customer_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.customer_snapshot is not null and new.customer_snapshot is distinct from old.customer_snapshot then
    raise exception using errcode = 'P0001', message = 'customer_snapshot_immutable';
  end if;
  if old.customer_snapshot is null and new.customer_snapshot is not null and new.status <> 'collected' then
    raise exception using errcode = 'P0001', message = 'customer_snapshot_requires_finalization';
  end if;
  return new;
end;
$$;

create or replace function private.current_user_can_access_collection(
  p_collection_id uuid,
  p_organization_id bigint,
  p_require_draft boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_is_admin(p_organization_id)
    and exists (
      select 1
      from public.collections as collection_record
      where collection_record.id = p_collection_id
        and collection_record.organization_id = p_organization_id
        and (not p_require_draft or collection_record.status = 'draft')
    );
$$;

create or replace function private.current_user_can_access_customer(
  p_customer_id uuid,
  p_organization_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_is_admin(p_organization_id)
    and exists (
      select 1
      from public.customers as customer_record
      where customer_record.id = p_customer_id
        and customer_record.organization_id = p_organization_id
    );
$$;

create or replace function private.current_user_can_access_collection_path(
  p_organization_id bigint,
  p_collection_text text,
  p_require_draft boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_collection_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, p_require_draft);
end;
$$;

create or replace function private.current_user_can_upload_document_path(
  p_organization_id bigint,
  p_collection_text text,
  p_document_text text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_collection_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_document_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, false)
    and exists (
      select 1
      from public.documents as document_record
      where document_record.id = p_document_text::uuid
        and document_record.organization_id = p_organization_id
        and document_record.collection_id = p_collection_text::uuid
        and document_record.storage_path is null
    );
end;
$$;

create or replace function private.current_user_can_upload_intent_path(
  p_bucket text,
  p_organization_id bigint,
  p_collection_text text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  intent_id_text text;
  intent_id_value uuid;
  expected_kind text;
begin
  if p_collection_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_name !~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$' then
    return false;
  end if;

  expected_kind := case
    when p_bucket = 'collection-signatures' then 'signature'
    when p_bucket = 'collection-evidences' then 'evidence'
    else null
  end;
  if expected_kind is null then
    return false;
  end if;

  intent_id_text := split_part(split_part(p_name, '/', 3), '.', 1);
  begin
    intent_id_value := intent_id_text::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, true)
    and exists (
      select 1
      from private.collection_upload_intents as intent_record
      where intent_record.id = intent_id_value
        and intent_record.organization_id = p_organization_id
        and intent_record.collection_id = p_collection_text::uuid
        and intent_record.storage_path = p_name
        and intent_record.kind = expected_kind
        and intent_record.status = 'pending'
        and intent_record.expires_at > now()
        and intent_record.created_by = (select auth.uid())
    );
end;
$$;

create or replace function private.current_user_can_read_storage_object(
  p_bucket text,
  p_organization_id bigint,
  p_collection_text text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_collection_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or not (p_name !~ '(^|/)staging(/|$)') then
    return false;
  end if;

  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, false)
    and case p_bucket
      when 'collection-evidences' then exists (
        select 1 from public.evidences as evidence_record
        where evidence_record.organization_id = p_organization_id
          and evidence_record.collection_id = p_collection_text::uuid
          and evidence_record.storage_path = p_name
      )
      when 'collection-signatures' then exists (
        select 1 from public.signatures as signature_record
        where signature_record.organization_id = p_organization_id
          and signature_record.collection_id = p_collection_text::uuid
          and signature_record.storage_path = p_name
      )
      when 'collection-documents' then exists (
        select 1 from public.documents as document_record
        where document_record.organization_id = p_organization_id
          and document_record.collection_id = p_collection_text::uuid
          and document_record.storage_path = p_name
      )
      else false
    end;
end;
$$;

create or replace function private.current_user_can_delete_upload_intent_path(
  p_bucket text,
  p_organization_id bigint,
  p_collection_text text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  intent_id_text text;
  intent_id_value uuid;
  expected_kind text;
begin
  if p_collection_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_name !~ '^[0-9]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$' then
    return false;
  end if;

  expected_kind := case
    when p_bucket = 'collection-signatures' then 'signature'
    when p_bucket = 'collection-evidences' then 'evidence'
    else null
  end;
  if expected_kind is null then
    return false;
  end if;

  intent_id_text := split_part(split_part(p_name, '/', 3), '.', 1);
  begin
    intent_id_value := intent_id_text::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return private.current_user_can_access_collection(p_collection_text::uuid, p_organization_id, true)
    and exists (
      select 1
      from private.collection_upload_intents as intent_record
      where intent_record.id = intent_id_value
        and intent_record.organization_id = p_organization_id
        and intent_record.collection_id = p_collection_text::uuid
        and intent_record.storage_path = p_name
        and intent_record.kind = expected_kind
        and intent_record.status in ('pending', 'canceled', 'expired')
        and intent_record.created_by = (select auth.uid())
    );
end;
$$;

create or replace function private.collection_snapshot(p_collection_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'collection', jsonb_build_object(
      'id', collection_record.id,
      'official_code', collection_record.official_code,
      'status', collection_record.status,
      'location', collection_record.collection_location,
      'responsible_name', collection_record.responsible_name,
      'responsible_tax_id', collection_record.responsible_tax_id,
      'collected_at', collection_record.collected_at,
      'issued_year', collection_record.issued_year,
      'sequence_number', collection_record.sequence_number,
      'row_version', collection_record.row_version
    ),
    'customer', case
      when collection_record.customer_snapshot is not null then collection_record.customer_snapshot
      else jsonb_build_object(
        'id', customer_record.id,
        'legal_name', customer_record.legal_name,
        'tax_id', customer_record.tax_id,
        'phone', customer_record.phone
      )
    end,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item_record.id,
          'description', item_record.description,
          'quantity', item_record.quantity,
          'condition_note', item_record.condition_note,
          'observation', item_record.observation,
          'position', item_record.position,
          'created_at', item_record.created_at,
          'updated_at', item_record.updated_at
        )
        order by item_record.position, item_record.created_at, item_record.id
      )
      from public.collection_items as item_record
      where item_record.collection_id = collection_record.id
        and item_record.organization_id = collection_record.organization_id
        and item_record.removed_at is null
    ), '[]'::jsonb),
    'evidences', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence_record.id,
          'item_id', evidence_record.collection_item_id,
          'storage_path', evidence_record.storage_path,
          'content_type', evidence_record.content_type,
          'byte_size', evidence_record.byte_size,
          'sha256', evidence_record.sha256,
          'created_at', evidence_record.created_at
        )
        order by evidence_record.created_at, evidence_record.id
      )
      from public.evidences as evidence_record
      where evidence_record.collection_id = collection_record.id
        and evidence_record.organization_id = collection_record.organization_id
    ), '[]'::jsonb),
    'signature', (
      select jsonb_build_object(
        'id', signature_record.id,
        'signer_name', signature_record.signer_name,
        'signer_tax_id', signature_record.signer_tax_id,
        'acceptance_text', signature_record.acceptance_text,
        'storage_path', signature_record.storage_path,
        'byte_size', signature_record.byte_size,
        'sha256', signature_record.sha256,
        'signed_at', signature_record.signed_at
      )
      from public.signatures as signature_record
      where signature_record.collection_id = collection_record.id
        and signature_record.organization_id = collection_record.organization_id
      order by signature_record.signed_at desc, signature_record.created_at desc, signature_record.id desc
      limit 1
    ),
    'organization', jsonb_build_object(
      'id', organization_record.id,
      'display_name', organization_record.display_name
    )
  )
  from public.collections as collection_record
  left join public.customers as customer_record
    on customer_record.id = collection_record.customer_id
   and customer_record.organization_id = collection_record.organization_id
  join public.organizations as organization_record
    on organization_record.id = collection_record.organization_id
  where collection_record.id = p_collection_id;
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
  snapshot_value jsonb;
  next_version integer;
  document_id uuid;
begin
  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'collection_not_found';
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
  )
  values (
    collection_record.organization_id,
    p_collection_id,
    next_version,
    snapshot_value,
    encode(extensions.digest(convert_to(snapshot_value::text, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex'),
    p_actor_user_id
  )
  returning id into document_id;

  return document_id;
end;
$$;

create or replace function private.record_collection_draft_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.collection_events as event_record
    where event_record.collection_id = new.id
      and event_record.organization_id = new.organization_id
      and event_record.event_type = 'collection.draft.created'
  ) then
    insert into public.collection_events (
      organization_id,
      collection_id,
      actor_user_id,
      event_type,
      new_status
    )
    values (
      new.organization_id,
      new.id,
      new.created_by,
      'collection.draft.created',
      new.status
    );
  end if;
  return new;
end;
$$;

create or replace function private.prevent_immutable_record_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'immutable_record';
end;
$$;

create or replace function private.encode_collection_cursor(
  p_created_at timestamptz,
  p_id uuid
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select translate(
    rtrim(
      encode(
        convert_to(
          jsonb_build_object(
            'createdAt', p_created_at,
            'id', p_id
          )::text,
          'UTF8'
        ),
        'base64'
      ),
      '='
    ),
    '+/',
    '-_'
  );
$$;

create or replace function private.decode_collection_cursor(p_cursor text)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  padded text;
begin
  if p_cursor is null or length(p_cursor) = 0 or length(p_cursor) > 512 or p_cursor !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;
  padded := translate(p_cursor, '-_', '+/');
  padded := padded || repeat('=', (4 - length(padded) % 4) % 4);
  begin
    return convert_from(decode(padded, 'base64'), 'UTF8')::jsonb;
  exception when others then
    return null;
  end;
end;
$$;

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
      and storage_object.metadata->>'mimetype' = intent_record.content_type
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

create or replace function public.create_collection_item(
  p_collection_id uuid,
  p_expected_version integer,
  p_description text,
  p_quantity numeric,
  p_condition_note text default null,
  p_observation text default null,
  p_position integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
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
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  insert into public.collection_items (
    organization_id,
    collection_id,
    description,
    quantity,
    condition_note,
    observation,
    position,
    created_by,
    updated_by
  )
  values (
    collection_record.organization_id,
    collection_record.id,
    trim(p_description),
    p_quantity,
    nullif(trim(p_condition_note), ''),
    nullif(trim(p_observation), ''),
    p_position,
    actor_id,
    actor_id
  )
  returning id into item_id;

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

create or replace function public.update_collection_item(
  p_collection_id uuid,
  p_item_id uuid,
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
  item_record public.collection_items%rowtype;
  patch_key text;
  next_version integer;
  next_description text;
  next_quantity numeric;
  next_condition_note text;
  next_observation text;
  next_position integer;
begin
  if actor_id is null or p_expected_version < 1 or p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'invalid_collection_item_patch';
  end if;
  for patch_key in select jsonb_object_keys(p_patch) loop
    if patch_key not in ('description', 'quantity', 'condition_note', 'observation', 'position') then
      raise exception using errcode = 'P0001', message = 'invalid_collection_item_field';
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

  select *
    into item_record
  from public.collection_items
  where id = p_item_id
    and collection_id = p_collection_id
    and organization_id = collection_record.organization_id
    and removed_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'collection_item_not_found';
  end if;

  next_description := case when p_patch ? 'description' then p_patch->>'description' else item_record.description end;
  next_quantity := case when p_patch ? 'quantity' then (p_patch->>'quantity')::numeric else item_record.quantity end;
  next_condition_note := case when p_patch ? 'condition_note' then p_patch->>'condition_note' else item_record.condition_note end;
  next_observation := case when p_patch ? 'observation' then p_patch->>'observation' else item_record.observation end;
  next_position := case when p_patch ? 'position' then (p_patch->>'position')::integer else item_record.position end;

  if length(trim(coalesce(next_description, ''))) not between 1 and 1000
    or next_quantity is null
    or next_quantity <= 0
    or next_position is null
    or next_position < 0
    or (next_condition_note is not null and length(trim(next_condition_note)) > 1000)
    or (next_observation is not null and length(trim(next_observation)) > 2000) then
    raise exception using errcode = 'P0001', message = 'invalid_collection_item';
  end if;

  next_version := collection_record.row_version + 1;
  update public.collection_items
    set description = trim(next_description),
        quantity = next_quantity,
        condition_note = nullif(trim(next_condition_note), ''),
        observation = nullif(trim(next_observation), ''),
        position = next_position,
        updated_by = actor_id
  where id = item_record.id;

  update public.collections
    set row_version = next_version, updated_by = actor_id
  where id = collection_record.id;

  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, metadata)
  values (
    collection_record.organization_id,
    collection_record.id,
    actor_id,
    'collection.item.updated',
    jsonb_build_object('item_id', item_record.id, 'row_version', next_version)
  );

  return jsonb_build_object(
    'collectionId', collection_record.id,
    'rowVersion', next_version,
    'item', jsonb_build_object(
      'id', item_record.id,
      'description', trim(next_description),
      'quantity', next_quantity,
      'conditionNote', nullif(trim(next_condition_note), ''),
      'observation', nullif(trim(next_observation), ''),
      'position', next_position
    )
  );
end;
$$;

create or replace function public.update_collection_item(
  p_collection_id uuid,
  p_item_id uuid,
  p_expected_version integer,
  p_description text default null,
  p_quantity numeric default null,
  p_condition_note text default null,
  p_observation text default null,
  p_position integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  patch_value jsonb;
begin
  patch_value := jsonb_strip_nulls(jsonb_build_object(
    'description', p_description,
    'quantity', p_quantity,
    'condition_note', p_condition_note,
    'observation', p_observation,
    'position', p_position
  ));
  return public.update_collection_item(p_collection_id, p_item_id, p_expected_version, patch_value);
end;
$$;

create or replace function public.remove_collection_item(
  p_collection_id uuid,
  p_item_id uuid,
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
  item_record public.collection_items%rowtype;
  next_version integer;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_expected_version';
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

  select *
    into item_record
  from public.collection_items
  where id = p_item_id
    and collection_id = p_collection_id
    and organization_id = collection_record.organization_id
    and removed_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'collection_item_not_found';
  end if;

  update public.collection_items
    set removed_at = now(), removed_by = actor_id, updated_by = actor_id
  where id = item_record.id;

  next_version := collection_record.row_version + 1;
  update public.collections
    set row_version = next_version, updated_by = actor_id
  where id = collection_record.id;

  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, metadata)
  values (
    collection_record.organization_id,
    collection_record.id,
    actor_id,
    'collection.item.removed',
    jsonb_build_object('item_id', item_record.id, 'row_version', next_version)
  );

  return jsonb_build_object('collectionId', collection_record.id, 'rowVersion', next_version, 'itemId', item_record.id);
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
  if p_kind = 'signature' and (
    p_content_type <> 'image/png'
    or p_byte_size not between 1 and 2097152
    or p_item_id is not null
    or length(trim(coalesce(p_signer_name, ''))) not between 1 and 160
    or not private.is_valid_cpf_cnpj(p_signer_tax_id)
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

create or replace function public.commit_collection_upload(
  p_upload_intent_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O intent já contém o final_storage_path; a policy de leitura só o libera
  -- depois que evidences/signatures confirmam o commit.
  return private.commit_collection_upload(p_upload_intent_id, p_expected_version);
end;
$$;

create or replace function public.cancel_collection_upload(p_upload_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  intent_record private.collection_upload_intents%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  select *
    into intent_record
  from private.collection_upload_intents
  where id = p_upload_intent_id
  for update;
  if not found or intent_record.created_by <> actor_id or not private.current_user_is_admin(intent_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if intent_record.status = 'committed' then
    raise exception using errcode = 'P0001', message = 'upload_already_committed';
  end if;
  if intent_record.status = 'pending' then
    update private.collection_upload_intents
      set status = 'canceled', canceled_at = now()
    where id = p_upload_intent_id;
    intent_record.status := 'canceled';
  end if;
  return jsonb_build_object(
    'intentId', p_upload_intent_id,
    'kind', intent_record.kind,
    'bucketId', case when intent_record.kind = 'signature' then 'collection-signatures' else 'collection-evidences' end,
    'status', intent_record.status,
    'storagePath', intent_record.storage_path
  );
end;
$$;

-- Compatibilidade de nome: o comando antigo só funciona quando a chamada está
-- ligada a um intent pendente criado pelo novo prepare/commit.
create or replace function public.save_collection_signature(
  p_collection_id uuid,
  p_expected_version integer,
  p_signer_name text,
  p_signer_tax_id text,
  p_acceptance_text text,
  p_storage_path text,
  p_file_sha256 text,
  p_byte_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  intent_id uuid;
  result_value jsonb;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_expected_version';
  end if;
  select id
    into intent_id
  from private.collection_upload_intents
  where collection_id = p_collection_id
    and created_by = actor_id
    and kind = 'signature'
    and status = 'pending'
    and storage_path = p_storage_path
    and content_type = 'image/png'
    and byte_size = p_byte_size
    and sha256 = p_file_sha256
    and signer_name = trim(p_signer_name)
    and signer_tax_id = p_signer_tax_id
    and acceptance_text = trim(p_acceptance_text)
  order by created_at desc
  limit 1;
  if intent_id is null then
    raise exception using errcode = 'P0001', message = 'upload_intent_required';
  end if;
  result_value := private.commit_collection_upload(intent_id, p_expected_version);
  return jsonb_build_object(
    'collectionId', result_value->>'collectionId',
    'rowVersion', (result_value->>'rowVersion')::integer,
    'signatureId', result_value->>'signatureId'
  );
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
  issued_year_value integer;
  sequence_value integer;
  document_id uuid;
  response_value jsonb;
  customer_snapshot_value jsonb;
  next_version integer;
begin
  if actor_id is null or p_expected_version < 1 or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_finalize_request';
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
    insert into public.idempotency_requests (
      organization_id,
      collection_id,
      operation,
      idempotency_key,
      request_hash,
      created_by
    )
    values (
      collection_record.organization_id,
      p_collection_id,
      'finalize',
      p_idempotency_key,
      p_request_hash,
      actor_id
    );
  end if;

  if collection_record.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'collection_not_draft';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;
  if collection_record.customer_id is null
    or length(trim(coalesce(collection_record.collection_location, ''))) = 0
    or length(trim(coalesce(collection_record.responsible_name, ''))) = 0
    or collection_record.collected_at is null then
    raise exception using errcode = 'P0001', message = 'collection_incomplete';
  end if;
  if not exists (
    select 1
    from public.collection_items
    where collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'collection_requires_item';
  end if;
  if not exists (
    select 1
    from public.signatures
    where collection_id = p_collection_id
      and organization_id = collection_record.organization_id
  ) then
    raise exception using errcode = 'P0001', message = 'collection_requires_signature';
  end if;

  select *
    into customer_record
  from public.customers
  where id = collection_record.customer_id
    and organization_id = collection_record.organization_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'customer_not_found';
  end if;
  customer_snapshot_value := jsonb_build_object(
    'id', customer_record.id,
    'legal_name', customer_record.legal_name,
    'tax_id', customer_record.tax_id,
    'phone', customer_record.phone
  );

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
    set status = 'collected',
        customer_snapshot = customer_snapshot_value,
        issued_year = issued_year_value,
        sequence_number = sequence_value,
        official_code = format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')),
        row_version = next_version,
        updated_by = actor_id
  where id = p_collection_id;

  document_id := private.append_document_version(p_collection_id, actor_id);
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
    p_collection_id,
    actor_id,
    'collection.finalized',
    'draft',
    'collected',
    jsonb_build_object('document_id', document_id, 'row_version', next_version)
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'officialCode', format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')),
    'status', 'collected',
    'rowVersion', next_version,
    'document', jsonb_build_object(
      'id', document_id,
      'version', 1,
      'status', 'snapshot_ready'
    )
  );
  update public.idempotency_requests
    set response = response_value,
        completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'finalize'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

create or replace function public.cancel_collection(
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
  response_value jsonb;
  next_version integer;
  document_version integer;
begin
  if actor_id is null or p_expected_version < 1
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid_cancel_request';
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
    and operation = 'cancel'
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
    values (collection_record.organization_id, p_collection_id, 'cancel', p_idempotency_key, p_request_hash, actor_id);
  end if;
  if collection_record.status <> 'collected' then
    raise exception using errcode = 'P0001', message = 'collection_cannot_cancel';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  next_version := collection_record.row_version + 1;
  update public.collections
    set status = 'canceled',
        previous_status_before_cancellation = collection_record.status,
        canceled_at = now(),
        canceled_by = actor_id,
        cancel_reason = trim(p_reason),
        row_version = next_version,
        updated_by = actor_id
  where id = p_collection_id;

  document_id := private.append_document_version(p_collection_id, actor_id);
  select version into document_version from public.documents where id = document_id;
  insert into public.collection_events (
    organization_id, collection_id, actor_user_id, event_type,
    previous_status, new_status, reason, metadata
  )
  values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.canceled', collection_record.status, 'canceled',
    trim(p_reason), jsonb_build_object('document_id', document_id, 'row_version', next_version)
  );
  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'officialCode', collection_record.official_code,
    'status', 'canceled',
    'rowVersion', next_version,
    'document', jsonb_build_object('id', document_id, 'version', document_version, 'status', 'snapshot_ready')
  );
  update public.idempotency_requests
    set response = response_value,
        completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'cancel'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

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
        updated_by = actor_id
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

create or replace function public.list_collections(
  p_code text,
  p_customer text,
  p_tax_id text,
  p_phone text,
  p_status text,
  p_from timestamptz,
  p_to timestamptz,
  p_cursor text,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cursor_value jsonb;
  cursor_created_at timestamptz;
  cursor_id uuid;
  page_size integer := greatest(1, least(coalesce(p_limit, 25), 50));
begin
  if p_cursor is not null then
    cursor_value := private.decode_collection_cursor(p_cursor);
    if cursor_value is null or cursor_value->>'createdAt' is null or cursor_value->>'id' is null then
      raise exception using errcode = 'P0001', message = 'invalid_cursor';
    end if;
    begin
      cursor_created_at := (cursor_value->>'createdAt')::timestamptz;
      cursor_id := (cursor_value->>'id')::uuid;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_cursor';
    end;
  end if;

  return (
    with permitted as (
      select
        collection_record.*,
        customer_record.legal_name as current_legal_name,
        customer_record.tax_id as current_tax_id,
        customer_record.phone as current_phone,
        case
          when collection_record.status = 'draft' then customer_record.legal_name
          when collection_record.status in ('collected', 'canceled') then collection_record.customer_snapshot->>'legal_name'
        end as display_legal_name,
        case
          when collection_record.status = 'draft' then customer_record.tax_id
          when collection_record.status in ('collected', 'canceled') then collection_record.customer_snapshot->>'tax_id'
        end as display_tax_id,
        case
          when collection_record.status = 'draft' then customer_record.phone
          when collection_record.status in ('collected', 'canceled') then collection_record.customer_snapshot->>'phone'
        end as display_phone
      from public.collections as collection_record
      left join public.customers as customer_record
        on customer_record.id = collection_record.customer_id
       and customer_record.organization_id = collection_record.organization_id
      where private.current_user_is_admin(collection_record.organization_id)
        and (p_code is null or collection_record.official_code ilike '%' || p_code || '%')
        and (p_customer is null or (
          case when collection_record.status = 'draft' then customer_record.legal_name else collection_record.customer_snapshot->>'legal_name' end
          ilike '%' || p_customer || '%'
        ))
        and (p_tax_id is null or (
          case when collection_record.status = 'draft' then customer_record.tax_id else collection_record.customer_snapshot->>'tax_id' end
          = p_tax_id
        ))
        and (p_phone is null or (
          case when collection_record.status = 'draft' then customer_record.phone else collection_record.customer_snapshot->>'phone' end
          = p_phone
        ))
        and (p_status is null or collection_record.status = p_status)
        and (p_from is null or collection_record.created_at >= p_from)
        and (p_to is null or collection_record.created_at <= p_to)
        and (
          p_cursor is null
          or collection_record.created_at < cursor_created_at
          or (collection_record.created_at = cursor_created_at and collection_record.id < cursor_id)
        )
      order by collection_record.created_at desc, collection_record.id desc
      limit page_size + 1
    ),
    page as (
      select * from permitted order by created_at desc, id desc limit page_size
    )
    select jsonb_build_object(
      'items',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'officialCode', page.official_code,
            'status', page.status,
            'customerName', page.display_legal_name,
            'customerTaxId', page.display_tax_id,
            'customerPhone', page.display_phone,
            'collectedAt', page.collected_at,
            'createdAt', page.created_at,
            'rowVersion', page.row_version
          )
          order by page.created_at desc, page.id desc
        )
        from page
      ), '[]'::jsonb),
      'nextCursor',
      case when (select count(*) from permitted) > page_size then (
        select private.encode_collection_cursor(page.created_at, page.id)
        from permitted as page
        order by page.created_at desc, page.id desc
        offset page_size - 1
        limit 1
      ) else null end
    )
  );
end;
$$;

create or replace function public.get_collection_detail(p_collection_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', collection_record.id,
    'officialCode', collection_record.official_code,
    'status', collection_record.status,
    'rowVersion', collection_record.row_version,
    'customer', case
      when collection_record.status in ('collected', 'canceled') and collection_record.customer_snapshot is not null then jsonb_build_object(
        'name', collection_record.customer_snapshot->>'legal_name',
        'taxId', collection_record.customer_snapshot->>'tax_id',
        'phone', collection_record.customer_snapshot->>'phone'
      )
      when collection_record.status = 'draft' and customer_record.id is not null then jsonb_build_object(
        'name', customer_record.legal_name,
        'taxId', customer_record.tax_id,
        'phone', customer_record.phone
      )
      else null
    end,
    'collectionLocation', case when collection_record.collection_location is null then null else jsonb_build_object('description', collection_record.collection_location) end,
    'responsibleName', collection_record.responsible_name,
    'collectedAt', collection_record.collected_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item_record.id,
          'description', item_record.description,
          'quantity', item_record.quantity,
          'condition', item_record.condition_note,
          'notes', item_record.observation
        )
        order by item_record.position, item_record.created_at, item_record.id
      )
      from public.collection_items as item_record
      where item_record.collection_id = collection_record.id
        and item_record.organization_id = collection_record.organization_id
        and item_record.removed_at is null
    ), '[]'::jsonb),
    'signature', (
      select jsonb_build_object(
        'signerName', signature_record.signer_name,
        'signerTaxId', signature_record.signer_tax_id,
        'acceptedAt', signature_record.signed_at
      )
      from public.signatures as signature_record
      where signature_record.collection_id = collection_record.id
        and signature_record.organization_id = collection_record.organization_id
      order by signature_record.signed_at desc, signature_record.created_at desc, signature_record.id desc
      limit 1
    ),
    'evidences', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence_record.id,
          'itemId', evidence_record.collection_item_id,
          'mimeType', evidence_record.content_type,
          'sizeBytes', evidence_record.byte_size,
          'sha256', evidence_record.sha256,
          'createdAt', evidence_record.created_at
        )
        order by evidence_record.created_at, evidence_record.id
      )
      from public.evidences as evidence_record
      where evidence_record.collection_id = collection_record.id
        and evidence_record.organization_id = collection_record.organization_id
    ), '[]'::jsonb),
    'currentDocument', (
      select jsonb_build_object(
        'id', document_record.id,
        'version', document_record.version,
        'status', document_record.status,
        'issuedAt', document_record.issued_at
      )
      from public.documents as document_record
      where document_record.collection_id = collection_record.id
        and document_record.organization_id = collection_record.organization_id
      order by document_record.version desc
      limit 1
    )
  )
  from public.collections as collection_record
  left join public.customers as customer_record
    on customer_record.id = collection_record.customer_id
   and customer_record.organization_id = collection_record.organization_id
  where collection_record.id = p_collection_id
    and private.current_user_is_admin(collection_record.organization_id);
$$;

create or replace function public.list_collection_events(
  p_collection_id uuid,
  p_cursor text,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cursor_value jsonb;
  cursor_created_at timestamptz;
  cursor_id uuid;
  page_size integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if p_cursor is not null then
    cursor_value := private.decode_collection_cursor(p_cursor);
    if cursor_value is null or cursor_value->>'createdAt' is null or cursor_value->>'id' is null then
      raise exception using errcode = 'P0001', message = 'invalid_cursor';
    end if;
    begin
      cursor_created_at := (cursor_value->>'createdAt')::timestamptz;
      cursor_id := (cursor_value->>'id')::uuid;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_cursor';
    end;
  end if;

  return (
    with permitted as (
      select event_record.*
      from public.collection_events as event_record
      where event_record.collection_id = p_collection_id
        and private.current_user_is_admin(event_record.organization_id)
        and (
          p_cursor is null
          or event_record.created_at < cursor_created_at
          or (event_record.created_at = cursor_created_at and event_record.id < cursor_id)
        )
      order by event_record.created_at desc, event_record.id desc
      limit page_size + 1
    ),
    page as (
      select * from permitted order by created_at desc, id desc limit page_size
    )
    select jsonb_build_object(
      'items',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'type', page.event_type,
            'previousStatus', page.previous_status,
            'nextStatus', page.new_status,
            'reason', page.reason,
            'actorName', null,
            'createdAt', page.created_at
          )
          order by page.created_at desc, page.id desc
        )
        from page
      ), '[]'::jsonb),
      'nextCursor',
      case when (select count(*) from permitted) > page_size then (
        select private.encode_collection_cursor(page.created_at, page.id)
        from permitted as page
        order by page.created_at desc, page.id desc
        offset page_size - 1
        limit 1
      ) else null end
    )
  );
end;
$$;

create or replace function public.verify_collection_document(p_verification_token text)
returns table (
  is_authentic boolean,
  official_code text,
  issued_at timestamptz,
  collection_status text,
  organization_name text,
  document_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true,
    collection_record.official_code,
    document_record.issued_at,
    collection_record.status,
    organization_record.display_name,
    document_record.version
  from public.documents as document_record
  join public.collections as collection_record on collection_record.id = document_record.collection_id
  join public.organizations as organization_record on organization_record.id = document_record.organization_id
  where document_record.verification_token = p_verification_token
  limit 1;
$$;

create or replace function public.expire_collection_upload_intents(p_limit integer default 100)
returns table (intent_id uuid, bucket_id text, kind text, storage_path text, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select upload_intent.id
    from private.collection_upload_intents as upload_intent
    where (upload_intent.status = 'pending' and upload_intent.expires_at <= now())
      or upload_intent.status in ('canceled', 'expired')
    order by upload_intent.expires_at, upload_intent.id
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  )
  update private.collection_upload_intents as upload_intent
    set status = case when upload_intent.status = 'pending' then 'expired' else upload_intent.status end,
        canceled_at = case when upload_intent.status = 'pending' then coalesce(upload_intent.canceled_at, now()) else upload_intent.canceled_at end
  from candidates
  where upload_intent.id = candidates.id
  returning
    upload_intent.id,
    case when upload_intent.kind = 'signature' then 'collection-signatures' else 'collection-evidences' end,
    upload_intent.kind,
    upload_intent.storage_path,
    upload_intent.status;
end;
$$;

create or replace function public.ack_collection_upload_cleanup(p_intent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.collection_upload_intents%rowtype;
  bucket_id_value text;
begin
  select *
    into intent_record
  from private.collection_upload_intents
  where id = p_intent_id
  for update;
  if not found then
    return false;
  end if;
  if intent_record.status = 'committed' then
    raise exception using errcode = 'P0001', message = 'upload_already_committed';
  end if;
  if intent_record.status not in ('canceled', 'expired') then
    raise exception using errcode = 'P0001', message = 'upload_cleanup_not_ready';
  end if;
  bucket_id_value := case when intent_record.kind = 'signature' then 'collection-signatures' else 'collection-evidences' end;
  if exists (
    select 1
    from storage.objects as storage_object
    where storage_object.bucket_id = bucket_id_value
      and storage_object.name = intent_record.storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'upload_cleanup_object_present';
  end if;
  delete from private.collection_upload_intents
  where id = p_intent_id
    and status in ('canceled', 'expired');
  return found;
end;
$$;

revoke all on function private.is_valid_cpf_cnpj(text),
  private.set_collection_updated_by(),
  private.set_item_updated_by(),
  private.set_item_removed_by(),
  private.require_collection_version(),
  private.guard_customer_snapshot(),
  private.current_user_can_access_collection(uuid, bigint, boolean),
  private.current_user_can_access_customer(uuid, bigint),
  private.current_user_can_access_collection_path(bigint, text, boolean),
  private.current_user_can_upload_document_path(bigint, text, text),
  private.current_user_can_upload_intent_path(text, bigint, text, text),
  private.current_user_can_read_storage_object(text, bigint, text, text),
  private.current_user_can_delete_upload_intent_path(text, bigint, text, text),
  private.ensure_single_primary_customer_address(),
  private.create_customer_with_address_for_organization(bigint, text, text, text, jsonb),
  private.collection_snapshot(uuid),
  private.append_document_version(uuid, uuid),
  private.record_collection_draft_event(),
  private.prevent_immutable_record_mutation(),
  private.encode_collection_cursor(timestamptz, uuid),
  private.decode_collection_cursor(text),
  private.commit_collection_upload(uuid, integer)
from public;

revoke all on function public.update_collection_draft(uuid, integer, jsonb),
  public.create_customer_with_address(text, text, text, jsonb),
  public.create_customer_with_address_for_organization(bigint, text, text, text, jsonb),
  public.create_collection_item(uuid, integer, text, numeric, text, text, integer),
  public.update_collection_item(uuid, uuid, integer, jsonb),
  public.update_collection_item(uuid, uuid, integer, text, numeric, text, text, integer),
  public.remove_collection_item(uuid, uuid, integer),
  public.prepare_collection_upload(uuid, integer, text, uuid, text, integer, text, text, text, text, text),
  public.commit_collection_upload(uuid, integer),
  public.cancel_collection_upload(uuid),
  public.save_collection_signature(uuid, integer, text, text, text, text, text, integer),
  public.finalize_collection(uuid, integer, uuid, text),
  public.cancel_collection(uuid, integer, text, uuid, text),
  public.reopen_collection(uuid, integer, text, uuid, text),
  public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer),
  public.get_collection_detail(uuid),
  public.list_collection_events(uuid, text, integer),
  public.verify_collection_document(text),
  public.expire_collection_upload_intents(integer),
  public.ack_collection_upload_cleanup(uuid)
from public;

grant execute on function public.update_collection_draft(uuid, integer, jsonb),
  public.create_customer_with_address(text, text, text, jsonb),
  public.create_customer_with_address_for_organization(bigint, text, text, text, jsonb),
  public.create_collection_item(uuid, integer, text, numeric, text, text, integer),
  public.update_collection_item(uuid, uuid, integer, jsonb),
  public.update_collection_item(uuid, uuid, integer, text, numeric, text, text, integer),
  public.remove_collection_item(uuid, uuid, integer),
  public.prepare_collection_upload(uuid, integer, text, uuid, text, integer, text, text, text, text, text),
  public.commit_collection_upload(uuid, integer),
  public.cancel_collection_upload(uuid),
  public.save_collection_signature(uuid, integer, text, text, text, text, text, integer),
  public.finalize_collection(uuid, integer, uuid, text),
  public.cancel_collection(uuid, integer, text, uuid, text),
  public.reopen_collection(uuid, integer, text, uuid, text),
  public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer),
  public.get_collection_detail(uuid),
  public.list_collection_events(uuid, text, integer)
to authenticated;
grant execute on function public.verify_collection_document(text) to anon, authenticated;
grant execute on function public.expire_collection_upload_intents(integer),
  public.ack_collection_upload_cleanup(uuid)
to service_role;
grant execute on function private.is_valid_cpf_cnpj(text),
  private.current_user_can_access_collection(uuid, bigint, boolean),
  private.current_user_can_access_customer(uuid, bigint),
  private.current_user_can_access_collection_path(bigint, text, boolean),
  private.current_user_can_upload_document_path(bigint, text, text),
  private.current_user_can_upload_intent_path(text, bigint, text, text),
  private.current_user_can_read_storage_object(text, bigint, text, text),
  private.current_user_can_delete_upload_intent_path(text, bigint, text, text)
to authenticated;

create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at();
create trigger contacts_set_updated_at
before update on public.customer_contacts
for each row execute function private.set_updated_at();
create trigger addresses_enforce_single_primary
before insert or update on public.customer_addresses
for each row execute function private.ensure_single_primary_customer_address();
create trigger addresses_set_updated_at
before update on public.customer_addresses
for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function private.set_updated_at();
create trigger collections_set_updated_at
before update on public.collections
for each row execute function private.set_updated_at();
create trigger collections_set_updated_by
before update on public.collections
for each row execute function private.set_collection_updated_by();
create trigger collections_require_version
before update on public.collections
for each row execute function private.require_collection_version();
create trigger collections_guard_customer_snapshot
before update on public.collections
for each row execute function private.guard_customer_snapshot();
create trigger collection_items_set_updated_at
before update on public.collection_items
for each row execute function private.set_updated_at();
create trigger collection_items_set_updated_by
before update on public.collection_items
for each row execute function private.set_item_updated_by();
create trigger collection_items_set_removed_by
before update on public.collection_items
for each row execute function private.set_item_removed_by();
create trigger collections_record_draft_event
after insert on public.collections
for each row execute function private.record_collection_draft_event();

create trigger documents_are_immutable
before update or delete on public.documents
for each row execute function private.prevent_immutable_record_mutation();
create trigger collection_events_are_immutable
before update or delete on public.collection_events
for each row execute function private.prevent_immutable_record_mutation();
create trigger evidences_are_append_only
before update or delete on public.evidences
for each row execute function private.prevent_immutable_record_mutation();
create trigger signatures_are_append_only
before update or delete on public.signatures
for each row execute function private.prevent_immutable_record_mutation();

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
revoke all on table private.collection_upload_intents from public, anon, authenticated;
-- O grant é necessário para a compensação via Storage API; a policy abaixo
-- restringe DELETE ao próprio intent ainda não confirmado.
grant delete on table storage.objects to authenticated;

grant select, insert, update on public.customers, public.customer_contacts, public.customer_addresses, public.vehicles to authenticated;
grant select, insert (
  id, organization_id, customer_id, status, collection_location,
  responsible_name, responsible_tax_id, collected_at, created_by, updated_by
) on public.collections to authenticated;
grant select on public.collection_items, public.evidences, public.signatures, public.collection_events, public.documents to authenticated;

create policy customers_admin_all
on public.customers for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));
create policy customer_contacts_admin_all
on public.customer_contacts for all to authenticated
using (private.current_user_can_access_customer(customer_id, organization_id))
with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy customer_addresses_admin_all
on public.customer_addresses for all to authenticated
using (private.current_user_can_access_customer(customer_id, organization_id))
with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy vehicles_admin_all
on public.vehicles for all to authenticated
using (private.current_user_can_access_customer(customer_id, organization_id))
with check (private.current_user_can_access_customer(customer_id, organization_id));
create policy collections_select_admin
on public.collections for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy collections_insert_admin
on public.collections for insert to authenticated
with check (
  private.current_user_is_admin(organization_id)
  and status = 'draft'
  and row_version = 1
  and customer_snapshot is null
  and created_by = (select auth.uid())
  and (updated_by is null or updated_by = (select auth.uid()))
);
create policy collections_update_draft_admin
on public.collections for update to authenticated
using (private.current_user_can_access_collection(id, organization_id, true))
with check (private.current_user_can_access_collection(id, organization_id, true));
create policy collection_items_select_admin
on public.collection_items for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy collection_items_write_draft_admin
on public.collection_items for all to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, true))
with check (private.current_user_can_access_collection(collection_id, organization_id, true));
create policy evidences_select_admin
on public.evidences for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy evidences_insert_draft_admin
on public.evidences for insert to authenticated
with check (
  private.current_user_can_access_collection(collection_id, organization_id, true)
  and created_by = (select auth.uid())
);
create policy signatures_select_admin
on public.signatures for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy signatures_insert_draft_admin
on public.signatures for insert to authenticated
with check (
  private.current_user_can_access_collection(collection_id, organization_id, true)
  and created_by = (select auth.uid())
);
create policy collection_events_select_admin
on public.collection_events for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));
create policy documents_select_admin
on public.documents for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));

create policy collection_evidences_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-evidences'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_read_storage_object(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_evidences_insert_draft_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-evidences'
  and (metadata->>'mimetype') in ('image/png', 'image/jpeg', 'image/webp')
  and private.current_user_can_upload_intent_path(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_evidences_delete_unconfirmed_intent
on storage.objects for delete to authenticated
using (
  bucket_id = 'collection-evidences'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_delete_upload_intent_path(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_signatures_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_read_storage_object(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_signatures_insert_draft_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-signatures'
  and (metadata->>'mimetype') = 'image/png'
  and private.current_user_can_upload_intent_path(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_signatures_delete_unconfirmed_intent
on storage.objects for delete to authenticated
using (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_delete_upload_intent_path(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_documents_select_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-documents'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and private.current_user_can_read_storage_object(
    bucket_id,
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    name
  )
);
create policy collection_documents_insert_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-documents'
  and name ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
  and (metadata->>'mimetype') = 'application/pdf'
  and private.current_user_can_upload_document_path(
    case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
    split_part(name, '/', 2),
    split_part(split_part(name, '/', 3), '.', 1)
  )
);
