-- Fase 2 (incremento 1): infraestrutura documental.
--
-- Esta migration e aditiva: os registros de public.documents da Fase 1A
-- continuam sendo a fonte do snapshot/versionamento inicial. Os registros
-- abaixo guardam os artefatos produzidos, o trabalho assíncrono de render,
-- os links privados e a relação explícita entre versões corrigidas.
-- Aplicação remota exige revisão e db push --dry-run; não há dados removidos.

-- O worker publica PDF e QR PNG no bucket privado já criado na Fase 1A.
-- Ampliar apenas os MIME types permitidos mantém o bucket privado e torna o
-- contrato de document_artifacts compatível com ambos os artefatos.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png']
where id = 'collection-documents';

-- The existing idempotency ledger is retained for lifecycle commands and is
-- extended with the additive document-revision operation.
alter table public.idempotency_requests
  drop constraint if exists idempotency_requests_operation_check;
alter table public.idempotency_requests
  add constraint idempotency_requests_operation_check
  check (operation in ('finalize', 'cancel', 'reopen', 'revise'));

create table public.organization_brand_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  asset_type text not null check (asset_type in ('logo')),
  storage_path text not null unique check (storage_path ~ '^[0-9]+/company-logo/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 2097152),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, asset_type, sha256)
);

alter table public.organization_settings
  add column logo_asset_id uuid references public.organization_brand_assets(id) on delete restrict;

create table public.document_issuer_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  legal_name text not null check (length(trim(legal_name)) between 1 and 160),
  tax_id text not null check (tax_id ~ '^[0-9]{14}$'),
  phone text not null check (length(trim(phone)) between 10 and 30),
  street text not null check (length(trim(street)) between 1 and 160),
  street_number text not null check (length(trim(street_number)) between 1 and 20),
  address_complement text check (address_complement is null or length(trim(address_complement)) <= 120),
  district text check (district is null or length(trim(district)) <= 100),
  city text not null check (length(trim(city)) between 1 and 100),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  postal_code text not null check (postal_code ~ '^[0-9]{8}$'),
  receipt_legal_text text not null check (length(trim(receipt_legal_text)) between 1 and 2000),
  signer_name text not null check (length(trim(signer_name)) between 1 and 160),
  signer_title text not null check (length(trim(signer_title)) between 1 and 120),
  logo_asset_id uuid references public.organization_brand_assets(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  template_version text not null default 'mjt-receipt-v1',
  profile_hash text check (profile_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

alter table public.documents
  add column issuer_profile_id uuid references public.document_issuer_profiles(id) on delete restrict;

create table public.document_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  artifact_type text not null check (artifact_type in ('pdf', 'qr')),
  storage_path text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png)$'),
  content_type text not null check (content_type in ('application/pdf', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, artifact_type),
  check ((artifact_type = 'pdf' and content_type = 'application/pdf') or (artifact_type = 'qr' and content_type = 'image/png'))
);

create table public.document_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  job_type text not null check (job_type in ('render_pdf', 'render_qr')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  idempotency_key uuid not null,
  -- O contrato operacional da Fase 2 fixa cinco tentativas. A coluna fica
  -- registrada por job para auditoria, mas não é configurável pelo cliente.
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 5 check (max_attempts = 5),
  available_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  claimed_at timestamptz,
  claimed_by text check (claimed_by is null or length(trim(claimed_by)) between 1 and 120),
  last_error_code text check (last_error_code is null or length(trim(last_error_code)) <= 120),
  last_error_message text check (last_error_message is null or length(trim(last_error_message)) <= 2000),
  completed_at timestamptz,
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, job_type),
  check ((status = 'queued' and lease_token is null and leased_until is null and claimed_at is null and claimed_by is null and completed_at is null) or status <> 'queued'),
  check ((status = 'running' and lease_token is not null and leased_until is not null and claimed_at is not null and claimed_by is not null and completed_at is null) or status <> 'running'),
  check ((status in ('succeeded', 'failed') and completed_at is not null and lease_token is null and leased_until is null and claimed_at is null and claimed_by is null) or status in ('queued', 'running')),
  check ((status = 'failed' and nullif(trim(last_error_message), '') is not null) or status <> 'failed')
);

create table public.document_render_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  job_id uuid not null references public.document_jobs(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('started', 'succeeded', 'failed')),
  worker_id text not null check (length(trim(worker_id)) between 1 and 120),
  lease_token uuid not null,
  artifact_id uuid references public.document_artifacts(id) on delete restrict,
  error_code text check (error_code is null or length(trim(error_code)) <= 120),
  error_message text check (error_message is null or length(trim(error_message)) <= 2000),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_number),
  check ((status = 'started' and completed_at is null) or (status in ('succeeded', 'failed') and completed_at is not null)),
  check ((status = 'failed' and nullif(trim(error_message), '') is not null) or status <> 'failed'),
  check ((status = 'succeeded' and artifact_id is not null) or status <> 'succeeded')
);

create table private.document_render_upload_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  job_id uuid not null references public.document_jobs(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  artifact_type text not null check (artifact_type in ('pdf', 'qr')),
  storage_path text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png)$'),
  content_type text not null check (content_type in ('application/pdf', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'committed', 'canceled', 'expired')),
  artifact_id uuid references public.document_artifacts(id) on delete restrict,
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  canceled_at timestamptz,
  cleanup_acknowledged_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'committed' and artifact_id is not null and committed_at is not null) or status <> 'committed'),
  check ((status in ('canceled', 'expired') and canceled_at is not null) or status not in ('canceled', 'expired')),
  check (cleanup_acknowledged_at is null or (status in ('canceled', 'expired') and artifact_id is null))
);

create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  share_type text not null default 'pdf' check (share_type in ('pdf', 'verification')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  max_downloads integer not null default 20 check (max_downloads between 1 and 20),
  download_count integer not null default 0 check (download_count >= 0),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (download_count <= max_downloads)
);

create table public.share_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  share_id uuid not null references public.document_shares(id) on delete restrict,
  channel text not null check (channel in ('email', 'native_share', 'whatsapp', 'other')),
  recipient_masked text check (recipient_masked is null or length(trim(recipient_masked)) <= 254),
  result text not null check (result in ('queued', 'sent', 'failed')),
  error_code text check (error_code is null or length(trim(error_code)) <= 120),
  provider_reference text check (provider_reference is null or length(trim(provider_reference)) <= 200),
  idempotency_hash text check (idempotency_hash is null or idempotency_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.document_share_email_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  share_id uuid not null references public.document_shares(id) on delete restrict,
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  reservation_token uuid not null unique,
  status text not null default 'reserved' check (status in ('reserved', 'queued', 'sent', 'failed')),
  delivery_id uuid references public.share_deliveries(id) on delete restrict,
  lease_expires_at timestamptz not null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (share_id, idempotency_hash),
  check ((status = 'reserved' and delivery_id is null) or (status <> 'reserved' and delivery_id is not null))
);

-- Janela efêmera e pseudonimizada para os limites de abuso da Fase 2. Não há
-- IP, e-mail, URL, token nem conteúdo documental em texto puro: o chamador
-- server-only entrega apenas o hash SHA-256 do sujeito já normalizado.
create table private.document_rate_limit_windows (
  scope text not null check (scope in (
    'public_verification',
    'document_share_create',
    'document_email_administrator',
    'document_email_organization',
    'document_share_download'
  )),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_seconds integer not null check (window_seconds between 60 and 86400),
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_seconds, window_started_at),
  check (expires_at = window_started_at + make_interval(secs => window_seconds))
);

create table public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  previous_document_id uuid not null references public.documents(id) on delete restrict,
  replacement_document_id uuid not null references public.documents(id) on delete restrict,
  revision_type text not null check (revision_type in ('correction', 'reissue', 'reopen')),
  reason text not null check (length(trim(reason)) between 1 and 2000),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (replacement_document_id),
  check (previous_document_id <> replacement_document_id),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create index organization_brand_assets_org_idx on public.organization_brand_assets (organization_id, asset_type, created_at desc, id desc);
create index document_issuer_profiles_org_idx on public.document_issuer_profiles (organization_id, status, created_at desc, id desc);
create unique index document_issuer_profiles_active_idx on public.document_issuer_profiles (organization_id) where status = 'active';
create index document_artifacts_document_idx on public.document_artifacts (organization_id, document_id, created_at desc, id desc);
create index document_jobs_queue_idx on public.document_jobs (status, available_at, leased_until, created_at, id);
create index document_jobs_document_idx on public.document_jobs (organization_id, document_id, created_at desc, id desc);
create index document_render_attempts_job_idx on public.document_render_attempts (organization_id, job_id, attempt_number desc, id desc);
create index document_shares_document_idx on public.document_shares (organization_id, document_id, created_at desc, id desc);
create index share_deliveries_share_idx on public.share_deliveries (organization_id, share_id, created_at desc, id desc);
create unique index share_deliveries_email_idempotency_idx on public.share_deliveries (share_id, channel, idempotency_hash) where idempotency_hash is not null;
create index document_revisions_collection_idx on public.document_revisions (organization_id, collection_id, created_at desc, id desc);
create index document_render_upload_intents_cleanup_idx on private.document_render_upload_intents (status, expires_at);
create index document_share_email_reservations_lease_idx on private.document_share_email_reservations (status, lease_expires_at);
create index document_rate_limit_windows_expiry_idx on private.document_rate_limit_windows (expires_at);

-- Documentos, artefatos, entregas e revisões são evidências append-only.
-- Jobs, tentativas e shares só mudam por RPCs server-side controladas.
create trigger organization_brand_assets_are_immutable
before update or delete on public.organization_brand_assets
for each row execute function private.prevent_immutable_record_mutation();

-- Issuer profiles are frozen once active. The only allowed lifecycle change is
-- active -> retired, and only while the controlled settings RPC sets the
-- transaction-local retirement guard.
create or replace function private.prevent_issuer_profile_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.status = 'active'
    and new.status = 'retired'
    and current_setting('app.allow_issuer_profile_retire', true) = 'on' then
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'immutable_record';
end;
$$;

drop trigger if exists document_issuer_profiles_are_immutable on public.document_issuer_profiles;
create trigger document_issuer_profiles_are_immutable
before update or delete on public.document_issuer_profiles
for each row execute function private.prevent_issuer_profile_mutation();
create trigger document_artifacts_are_immutable
before update or delete on public.document_artifacts
for each row execute function private.prevent_immutable_record_mutation();
create trigger share_deliveries_are_immutable
before update or delete on public.share_deliveries
for each row execute function private.prevent_immutable_record_mutation();
create trigger document_revisions_are_immutable
before update or delete on public.document_revisions
for each row execute function private.prevent_immutable_record_mutation();

alter table public.organization_brand_assets enable row level security;
alter table public.document_issuer_profiles enable row level security;
alter table public.document_artifacts enable row level security;
alter table public.document_jobs enable row level security;
alter table public.document_render_attempts enable row level security;
alter table public.document_shares enable row level security;
alter table public.share_deliveries enable row level security;
alter table public.document_revisions enable row level security;

revoke all on table public.organization_brand_assets, public.document_issuer_profiles, public.document_artifacts, public.document_jobs, public.document_render_attempts, public.document_shares, public.share_deliveries, public.document_revisions from anon, authenticated;
revoke all on table private.document_render_upload_intents, private.document_share_email_reservations, private.document_rate_limit_windows from public, anon, authenticated;
grant select on public.organization_brand_assets, public.document_issuer_profiles, public.document_artifacts, public.document_jobs, public.document_render_attempts, public.document_shares, public.share_deliveries, public.document_revisions to authenticated;
grant select, insert, update on public.document_jobs to service_role;
grant select, insert on public.organization_brand_assets, public.document_issuer_profiles, public.document_artifacts, public.share_deliveries, public.document_revisions to service_role;
grant select, insert, update on public.document_render_attempts to service_role;
grant select, insert, update on public.document_shares to service_role;
grant select, insert, update on private.document_render_upload_intents to service_role;
grant select, insert, update on private.document_share_email_reservations to service_role;

create policy organization_brand_assets_select_admin
on public.organization_brand_assets for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy document_issuer_profiles_select_admin
on public.document_issuer_profiles for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy document_artifacts_select_admin
on public.document_artifacts for select to authenticated
using (private.current_user_can_access_collection((select document.collection_id from public.documents as document where document.id = document_id), organization_id, false));

create policy document_jobs_select_admin
on public.document_jobs for select to authenticated
using (private.current_user_can_access_collection((select document.collection_id from public.documents as document where document.id = document_id), organization_id, false));

create policy document_render_attempts_select_admin
on public.document_render_attempts for select to authenticated
using (private.current_user_can_access_collection((select document.collection_id from public.documents as document where document.id = document_id), organization_id, false));

create policy document_shares_select_admin
on public.document_shares for select to authenticated
using (private.current_user_can_access_collection((select document.collection_id from public.documents as document where document.id = document_id), organization_id, false));

create policy share_deliveries_select_admin
on public.share_deliveries for select to authenticated
using (private.current_user_can_access_collection((select document.collection_id from public.documents as document join public.document_shares as share on share.document_id = document.id where share.id = share_id), organization_id, false));

create policy document_revisions_select_admin
on public.document_revisions for select to authenticated
using (private.current_user_can_access_collection(collection_id, organization_id, false));

-- Fase 1A deixou o helper de documento imutável sem contexto institucional.
-- O núcleo abaixo sempre congela o issuer no novo snapshot. Somente quem
-- deriva uma versão de documento já emitido pode aceitar o perfil aposentado
-- que aquele documento já referenciava; uma emissão nova continua exigindo um
-- perfil institucional ativo.
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
  document_id uuid;
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
  ) returning id into document_id;
  return document_id;
end;
$$;

-- Finalização e revisão deliberada usam somente o perfil institucional ativo.
create or replace function private.append_document_version_with_issuer(
  p_collection_id uuid,
  p_actor_user_id uuid,
  p_issuer_profile_id uuid
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.append_document_version_using_issuer(
    p_collection_id,
    p_actor_user_id,
    p_issuer_profile_id,
    false
  );
$$;

-- Cancel/reopen da Fase 1A continuam usando o helper legado. Nesta migration
-- ele reutiliza o mesmo issuer congelado do documento mais recente quando
-- houver um, mas preserva a compatibilidade com documentos Fase 1A antigos
-- cujo issuer_profile_id é nulo.
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
  ) returning id into document_id;

  return document_id;
end;
$$;

-- As transições cancel/reopen criam uma nova evidência documental pelos
-- helpers da Fase 1A. O trigger enfileira o render na mesma transação; a
-- finalização usa sua chave de idempotência própria e insere o job diretamente.
create or replace function private.enqueue_lifecycle_document_render_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection_record public.collections%rowtype;
begin
  select * into collection_record
  from public.collections
  where id = new.collection_id;
  if found and (collection_record.canceled_at is not null or collection_record.reopened_at is not null) then
    insert into public.document_jobs (
      organization_id, document_id, job_type, idempotency_key, requested_by
    ) values
      (new.organization_id, new.id, 'render_pdf', new.id, new.created_by),
      (new.organization_id, new.id, 'render_qr', new.id, new.created_by)
    on conflict (document_id, job_type) do nothing;
  end if;
  return new;
end;
$$;

create trigger documents_lifecycle_render_job
after insert on public.documents
for each row execute function private.enqueue_lifecycle_document_render_job();

-- Compatibilidade do contrato HTTP da Fase 1A: mesma assinatura e mesma
-- resposta, agora com validação institucional e job criado atomicamente.
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
  document_id uuid;
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

  document_id := private.append_document_version_with_issuer(p_collection_id, actor_id, issuer_profile_record.id);
  insert into public.document_jobs (
    organization_id, document_id, job_type, idempotency_key, requested_by
  ) values
    (collection_record.organization_id, document_id, 'render_pdf', p_idempotency_key, actor_id),
    (collection_record.organization_id, document_id, 'render_qr', p_idempotency_key, actor_id)
  on conflict (document_id, job_type) do nothing;
  insert into public.collection_events (organization_id, collection_id, actor_user_id, event_type, previous_status, new_status, metadata)
  values (collection_record.organization_id, p_collection_id, actor_id, 'collection.finalized', 'draft', 'collected', jsonb_build_object('document_id', document_id, 'issuer_profile_id', issuer_profile_record.id, 'row_version', next_version));

  response_value := jsonb_build_object('collectionId', p_collection_id, 'officialCode', format('MJT-%s-%s', issued_year_value, lpad(sequence_value::text, 6, '0')), 'status', 'collected', 'rowVersion', next_version, 'document', jsonb_build_object('id', document_id, 'version', 1, 'status', 'snapshot_ready'));
  update public.idempotency_requests set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id and operation = 'finalize' and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- Saves company settings and publishes a new immutable issuer profile. The
-- previous active profile is retired through the guarded lifecycle trigger;
-- already-issued documents continue to reference their old profile.
create or replace function public.save_company_issuer_settings(
  p_organization_id bigint,
  p_legal_name text,
  p_tax_id text,
  p_phone text,
  p_street text,
  p_street_number text,
  p_address_complement text,
  p_district text,
  p_city text,
  p_state_code text,
  p_postal_code text,
  p_receipt_legal_text text,
  p_signer_name text,
  p_signer_title text,
  p_logo_asset_id uuid,
  p_logo_path text,
  p_template_version text default 'mjt-receipt-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  effective_actor uuid;
  caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  asset_record public.organization_brand_assets%rowtype;
  profile_id uuid;
  profile_payload jsonb;
  profile_hash_value text;
begin
  if p_organization_id is null
    or p_legal_name is null or length(trim(p_legal_name)) not between 1 and 160
    or p_tax_id is null or p_tax_id !~ '^[0-9]{14}$'
    or p_phone is null or length(trim(p_phone)) not between 10 and 30
    or p_street is null or length(trim(p_street)) not between 1 and 160
    or p_street_number is null or length(trim(p_street_number)) not between 1 and 20
    or (p_address_complement is not null and length(trim(p_address_complement)) > 120)
    or (p_district is not null and length(trim(p_district)) > 100)
    or p_city is null or length(trim(p_city)) not between 1 and 100
    or p_state_code is null or p_state_code !~ '^[A-Z]{2}$'
    or p_postal_code is null or p_postal_code !~ '^[0-9]{8}$'
    or p_receipt_legal_text is null or length(trim(p_receipt_legal_text)) not between 1 and 2000
    or p_signer_name is null or length(trim(p_signer_name)) not between 1 and 160
    or p_signer_title is null or length(trim(p_signer_title)) not between 1 and 120
    or p_logo_asset_id is null
    or p_logo_path is null
    or p_template_version is null
    or p_template_version !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception using errcode = '22023', message = 'issuer_settings_invalid';
  end if;
  if actor_id is null and caller_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'issuer_settings_forbidden';
  end if;
  if actor_id is not null and not private.current_user_is_admin(p_organization_id) then
    raise exception using errcode = '42501', message = 'issuer_settings_forbidden';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  effective_actor := coalesce(
    actor_id,
    (select membership.user_id
     from public.organization_memberships as membership
     where membership.organization_id = p_organization_id
     order by membership.created_at, membership.user_id
     limit 1)
  );
  if effective_actor is null then
    raise exception using errcode = 'P0001', message = 'issuer_settings_actor_missing';
  end if;

  select * into asset_record
  from public.organization_brand_assets
  where id = p_logo_asset_id
    and organization_id = p_organization_id
    and asset_type = 'logo';
  if not found or asset_record.storage_path <> p_logo_path then
    raise exception using errcode = 'P0001', message = 'issuer_logo_invalid';
  end if;

  profile_payload := jsonb_build_object(
    'organization_id', p_organization_id,
    'legal_name', trim(p_legal_name),
    'tax_id', p_tax_id,
    'phone', trim(p_phone),
    'street', trim(p_street),
    'street_number', trim(p_street_number),
    'address_complement', nullif(trim(coalesce(p_address_complement, '')), ''),
    'district', nullif(trim(coalesce(p_district, '')), ''),
    'city', trim(p_city),
    'state_code', p_state_code,
    'postal_code', p_postal_code,
    'receipt_legal_text', trim(p_receipt_legal_text),
    'signer_name', trim(p_signer_name),
    'signer_title', trim(p_signer_title),
    'logo_asset_id', asset_record.id,
    'logo_path', asset_record.storage_path,
    'template_version', p_template_version
  );
  profile_hash_value := encode(
    extensions.digest(convert_to(profile_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.organization_settings (
    organization_id, legal_name, tax_id, phone, street, street_number,
    address_complement, district, city, state_code, postal_code,
    receipt_legal_text, signer_name, signer_title, logo_path, logo_asset_id,
    updated_by
  ) values (
    p_organization_id, trim(p_legal_name), p_tax_id, trim(p_phone), trim(p_street),
    trim(p_street_number), nullif(trim(coalesce(p_address_complement, '')), ''),
    nullif(trim(coalesce(p_district, '')), ''), trim(p_city), p_state_code,
    p_postal_code, trim(p_receipt_legal_text), trim(p_signer_name),
    trim(p_signer_title), asset_record.storage_path, asset_record.id, effective_actor
  )
  on conflict (organization_id) do update set
    legal_name = excluded.legal_name,
    tax_id = excluded.tax_id,
    phone = excluded.phone,
    street = excluded.street,
    street_number = excluded.street_number,
    address_complement = excluded.address_complement,
    district = excluded.district,
    city = excluded.city,
    state_code = excluded.state_code,
    postal_code = excluded.postal_code,
    receipt_legal_text = excluded.receipt_legal_text,
    signer_name = excluded.signer_name,
    signer_title = excluded.signer_title,
    logo_path = excluded.logo_path,
    logo_asset_id = excluded.logo_asset_id,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform set_config('app.allow_issuer_profile_retire', 'on', true);
  update public.document_issuer_profiles
  set status = 'retired'
  where organization_id = p_organization_id and status = 'active';

  insert into public.document_issuer_profiles (
    organization_id, legal_name, tax_id, phone, street, street_number,
    address_complement, district, city, state_code, postal_code,
    receipt_legal_text, signer_name, signer_title, logo_asset_id, status,
    template_version, profile_hash, created_by
  ) values (
    p_organization_id, trim(p_legal_name), p_tax_id, trim(p_phone), trim(p_street),
    trim(p_street_number), nullif(trim(coalesce(p_address_complement, '')), ''),
    nullif(trim(coalesce(p_district, '')), ''), trim(p_city), p_state_code,
    p_postal_code, trim(p_receipt_legal_text), trim(p_signer_name),
    trim(p_signer_title), asset_record.id, 'active', p_template_version,
    profile_hash_value, effective_actor
  ) returning id into profile_id;

  return jsonb_build_object(
    'organizationId', p_organization_id,
    'issuerProfileId', profile_id,
    'logoAssetId', asset_record.id,
    'logoPath', asset_record.storage_path,
    'templateVersion', p_template_version,
    'profileHash', profile_hash_value
  );
end;
$$;

-- Initial settings RPC contract: resolve the caller's active administrator
-- organization before the remaining issuer validation/persistence is added.
create or replace function public.save_company_issuer_settings(
  p_legal_name text,
  p_tax_id text,
  p_phone text,
  p_street text,
  p_street_number text,
  p_district text,
  p_city text,
  p_state_code text,
  p_postal_code text,
  p_receipt_legal_text text,
  p_signer_name text,
  p_signer_title text,
  p_logo_asset_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  organization_id bigint;
  logo_path text;
  address_complement text;
begin
  select membership.organization_id
    into organization_id
  from public.organization_memberships as membership
  join public.profiles as profile on profile.user_id = membership.user_id
  join public.organizations as organization on organization.id = membership.organization_id
  where membership.user_id = actor_id
    and membership.role_code = 'administrator'
    and membership.status = 'active'
    and profile.status = 'active'
  order by membership.organization_id
  limit 1;

  if actor_id is null or organization_id is null then
    raise exception using errcode = '42501', message = 'issuer_settings_forbidden';
  end if;

  select asset.storage_path
    into logo_path
  from public.organization_brand_assets as asset
  where asset.id = p_logo_asset_id
    and asset.organization_id = organization_id
    and asset.asset_type = 'logo';
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_settings_incomplete';
  end if;

  select settings.address_complement
    into address_complement
  from public.organization_settings as settings
  where settings.organization_id = organization_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_settings_incomplete';
  end if;

  return public.save_company_issuer_settings(
    organization_id,
    p_legal_name,
    p_tax_id,
    p_phone,
    p_street,
    p_street_number,
    address_complement,
    p_district,
    p_city,
    p_state_code,
    p_postal_code,
    p_receipt_legal_text,
    p_signer_name,
    p_signer_title,
    p_logo_asset_id,
    logo_path,
    'mjt-receipt-v1'
  );
end;
$$;

-- Retorna somente o snapshot institucional validado. A função é usada pelo
-- renderer antes de emitir um documento; não expõe caminho de Storage.
create or replace function public.validate_document_issuer_profile(
  p_organization_id bigint,
  p_issuer_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_record public.document_issuer_profiles%rowtype;
  asset_record public.organization_brand_assets%rowtype;
  actor_id uuid := (select auth.uid());
  caller_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if actor_id is not null and caller_role <> 'service_role' and not private.current_user_is_admin(p_organization_id) then
    raise exception using errcode = '42501', message = 'issuer_profile_forbidden';
  end if;

  select * into profile_record
  from public.document_issuer_profiles
  where id = p_issuer_profile_id and organization_id = p_organization_id;
  if not found or profile_record.status <> 'active' then
    return jsonb_build_object('valid', false, 'code', 'issuer_profile_not_active');
  end if;

  if profile_record.logo_asset_id is null then
    return jsonb_build_object('valid', false, 'code', 'issuer_logo_required');
  end if;
  select * into asset_record
  from public.organization_brand_assets
  where id = profile_record.logo_asset_id
    and organization_id = p_organization_id
    and asset_type = 'logo';
  if not found then
    return jsonb_build_object('valid', false, 'code', 'issuer_logo_not_found');
  end if;

  return jsonb_build_object(
    'valid', true,
    'issuerProfileId', profile_record.id,
    'organizationId', profile_record.organization_id,
    'legalName', profile_record.legal_name,
    'taxId', profile_record.tax_id,
    'phone', profile_record.phone,
    'street', profile_record.street,
    'streetNumber', profile_record.street_number,
    'addressComplement', profile_record.address_complement,
    'district', profile_record.district,
    'city', profile_record.city,
    'stateCode', profile_record.state_code,
    'postalCode', profile_record.postal_code,
    'receiptLegalText', profile_record.receipt_legal_text,
    'signerName', profile_record.signer_name,
    'signerTitle', profile_record.signer_title,
    'logoAssetId', asset_record.id
  );
end;
$$;

-- Consome uma unidade de uma janela de rate limit sem expor a tabela ao
-- navegador. A chave é o hash pseudonimizado do sujeito e a atualização usa
-- UPSERT condicional para que concorrência nunca ultrapasse o limite.
create or replace function public.consume_document_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  window_start_value timestamptz;
  window_record private.document_rate_limit_windows%rowtype;
begin
  if p_scope not in (
    'public_verification',
    'document_share_create',
    'document_email_administrator',
    'document_email_organization',
    'document_share_download'
  ) then
    raise exception using errcode = '22023', message = 'document_rate_limit_scope_invalid';
  end if;
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'document_rate_limit_subject_invalid';
  end if;
  if p_window_seconds not between 60 and 86400 then
    raise exception using errcode = '22023', message = 'document_rate_limit_window_invalid';
  end if;
  if p_limit not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'document_rate_limit_limit_invalid';
  end if;

  window_start_value := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds
  );

  -- Limpeza é deliberadamente pequena e concorrente; falhas de limpeza nunca
  -- ampliam o acesso. A TTL da própria janela mantém os dados pseudônimos
  -- minimizados quando não houver tráfego posterior.
  delete from private.document_rate_limit_windows as stale_window
  where stale_window.ctid in (
    select candidate.ctid
    from private.document_rate_limit_windows as candidate
    where candidate.expires_at <= observed_at
    order by candidate.expires_at
    limit 100
    for update skip locked
  );

  insert into private.document_rate_limit_windows (
    scope, subject_hash, window_seconds, window_started_at, expires_at,
    request_count
  ) values (
    p_scope, p_subject_hash, p_window_seconds, window_start_value,
    window_start_value + make_interval(secs => p_window_seconds), 1
  )
  on conflict (scope, subject_hash, window_seconds, window_started_at)
  do update
  set request_count = private.document_rate_limit_windows.request_count + 1,
      updated_at = observed_at
  where private.document_rate_limit_windows.request_count < p_limit
  returning * into window_record;

  if found then
    return query select true, 0::integer;
    return;
  end if;

  select * into window_record
  from private.document_rate_limit_windows
  where scope = p_scope
    and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds
    and window_started_at = window_start_value;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_rate_limit_window_missing';
  end if;

  return query select
    false,
    greatest(1, ceil(extract(epoch from window_record.expires_at - observed_at))::integer);
end;
$$;

-- Claim atômico: o worker recebe um lease exclusivo e o job só pode avançar
-- com o lease_token devolvido por esta função.
create or replace function public.claim_document_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_jobs%rowtype;
  lease_value uuid;
  attempt_value integer;
  reclaimed_attempt_count integer;
begin
  if length(trim(coalesce(p_worker_id, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'worker_id_invalid';
  end if;
  if p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'lease_seconds_invalid';
  end if;

  <<claim_loop>>
  loop
  select * into job_record
  from public.document_jobs
  where (
      (status = 'queued' and available_at <= now())
      or (status = 'running' and leased_until <= now())
    )
    and (status = 'running' or attempt_count < max_attempts)
  order by
    case when status = 'running' then leased_until else available_at end,
    created_at,
    id
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  -- Uma lease expirada é uma tentativa concluída com falha, não um estado
  -- silencioso. Fechar a tentativa anterior antes de criar a próxima preserva
  -- o histórico append-only e impede que o worker antigo a conclua depois.
  if job_record.status = 'running' then
    update public.document_render_attempts
    set status = 'failed',
        error_code = 'document_job_lease_expired',
        error_message = 'Document render lease expired before completion.',
        completed_at = now()
    where job_id = job_record.id
      and attempt_number = job_record.attempt_count
      and lease_token = job_record.lease_token
      and status = 'started';
    get diagnostics reclaimed_attempt_count = row_count;
    if reclaimed_attempt_count <> 1 then
      raise exception using errcode = 'P0001', message = 'document_job_attempt_inconsistent';
    end if;

    -- A quinta tentativa também pode expirar. Ela é terminal e não recebe uma
    -- sexta lease; o próximo worker apenas torna a falha observável.
    if job_record.attempt_count >= job_record.max_attempts then
      update public.document_jobs
      set status = 'failed',
          lease_token = null,
          leased_until = null,
          claimed_at = null,
          claimed_by = null,
          completed_at = now(),
          last_error_code = 'document_job_lease_expired',
          last_error_message = 'Document render lease expired before completion.'
      where id = job_record.id;
      continue claim_loop;
    end if;
  end if;

  lease_value := extensions.gen_random_uuid();
  attempt_value := job_record.attempt_count + 1;
  update public.document_jobs
  set status = 'running',
      attempt_count = attempt_value,
      lease_token = lease_value,
      leased_until = now() + make_interval(secs => p_lease_seconds),
      claimed_at = now(),
      claimed_by = trim(p_worker_id),
      available_at = case when job_record.status = 'running' then now() else job_record.available_at end
  where id = job_record.id;

  insert into public.document_render_attempts (
    organization_id, job_id, document_id, attempt_number, status, worker_id,
    lease_token
  ) values (
    job_record.organization_id, job_record.id, job_record.document_id,
    attempt_value, 'started', trim(p_worker_id), lease_value
  );

  return jsonb_build_object(
    'jobId', job_record.id,
    'documentId', job_record.document_id,
    'jobType', job_record.job_type,
    'attemptNumber', attempt_value,
    'leaseToken', lease_value,
    'leaseExpiresAt', now() + make_interval(secs => p_lease_seconds)
  );
  end loop;
end;
$$;

create or replace function public.prepare_document_render_upload(
  p_job_id uuid,
  p_lease_token uuid,
  p_artifact_type text,
  p_content_type text,
  p_byte_size integer,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_jobs%rowtype;
  intent_id uuid := extensions.gen_random_uuid();
  extension_value text;
  path_value text;
  actor_id uuid;
begin
  select * into job_record
  from public.document_jobs
  where id = p_job_id
    and status = 'running'
    and lease_token = p_lease_token
    and leased_until > now()
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'document_job_lease_invalid';
  end if;
  if p_artifact_type not in ('pdf', 'qr') then
    raise exception using errcode = '22023', message = 'artifact_type_invalid';
  end if;
  if (p_artifact_type = 'pdf' and p_content_type <> 'application/pdf') or (p_artifact_type = 'qr' and p_content_type <> 'image/png') then
    raise exception using errcode = '22023', message = 'artifact_content_type_invalid';
  end if;
  if p_byte_size not between 1 and 52428800 or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'artifact_metadata_invalid';
  end if;

  extension_value := case when p_artifact_type = 'pdf' then 'pdf' else 'png' end;
  path_value := job_record.organization_id::text || '/' || job_record.document_id::text || '/' || intent_id::text || '.' || extension_value;
  actor_id := coalesce((select auth.uid()), job_record.requested_by);
  insert into private.document_render_upload_intents (
    id, organization_id, job_id, document_id, artifact_type, storage_path,
    content_type, byte_size, sha256, expires_at, created_by
  ) values (
    intent_id, job_record.organization_id, job_record.id, job_record.document_id,
    p_artifact_type, path_value, p_content_type, p_byte_size, p_sha256,
    now() + interval '30 minutes', actor_id
  );
  return jsonb_build_object('intentId', intent_id, 'storagePath', path_value, 'bucket', 'collection-documents');
end;
$$;

create or replace function public.commit_document_render_upload(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.document_render_upload_intents%rowtype;
  object_exists boolean;
  artifact_id_value uuid;
begin
  select * into intent_record
  from private.document_render_upload_intents
  where id = p_intent_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_upload_intent_not_found';
  end if;
  if intent_record.status = 'committed' then
    return jsonb_build_object('intentId', intent_record.id, 'artifactId', intent_record.artifact_id, 'status', 'committed');
  end if;
  if intent_record.status <> 'pending' or intent_record.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'document_upload_intent_not_pending';
  end if;
  select exists (
    select 1 from storage.objects as object_record
    where object_record.bucket_id = 'collection-documents'
      and object_record.name = intent_record.storage_path
      and object_record.metadata->>'mimetype' = intent_record.content_type
  ) into object_exists;
  if not object_exists then
    raise exception using errcode = 'P0001', message = 'document_artifact_object_missing';
  end if;

  insert into public.document_artifacts (
    organization_id, document_id, artifact_type, storage_path, content_type,
    byte_size, sha256, created_by
  ) values (
    intent_record.organization_id, intent_record.document_id, intent_record.artifact_type,
    intent_record.storage_path, intent_record.content_type, intent_record.byte_size,
    intent_record.sha256, intent_record.created_by
  ) returning id into artifact_id_value;
  update private.document_render_upload_intents
  set status = 'committed', artifact_id = artifact_id_value, committed_at = now()
  where id = intent_record.id;
  return jsonb_build_object('intentId', intent_record.id, 'artifactId', artifact_id_value, 'status', 'committed');
end;
$$;

create or replace function public.cancel_document_render_upload(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.document_render_upload_intents%rowtype;
begin
  select * into intent_record from private.document_render_upload_intents where id = p_intent_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_upload_intent_not_found';
  end if;
  if intent_record.status in ('committed', 'canceled', 'expired') then
    return jsonb_build_object('intentId', intent_record.id, 'status', intent_record.status, 'storagePath', intent_record.storage_path);
  end if;
  update private.document_render_upload_intents
  set status = 'canceled', canceled_at = now()
  where id = intent_record.id and status = 'pending';
  return jsonb_build_object('intentId', intent_record.id, 'status', 'canceled', 'storagePath', intent_record.storage_path);
end;
$$;

create or replace function public.complete_document_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_artifact_id uuid default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_jobs%rowtype;
  attempt_record public.document_render_attempts%rowtype;
  next_status text;
  retry_delay interval;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception using errcode = '22023', message = 'document_job_status_invalid';
  end if;
  select * into job_record from public.document_jobs where id = p_job_id for update;
  if not found or job_record.status <> 'running' or job_record.lease_token <> p_lease_token or job_record.leased_until <= now() then
    raise exception using errcode = '40001', message = 'document_job_lease_invalid';
  end if;
  if p_status = 'succeeded' and p_artifact_id is null then
    raise exception using errcode = '22023', message = 'document_artifact_required';
  end if;
  if p_status = 'succeeded' and not exists (
    select 1
    from public.document_artifacts as artifact_record
    where artifact_record.id = p_artifact_id
      and artifact_record.organization_id = job_record.organization_id
      and artifact_record.document_id = job_record.document_id
      and artifact_record.artifact_type = replace(job_record.job_type, 'render_', '')
  ) then
    raise exception using errcode = 'P0001', message = 'document_artifact_mismatch';
  end if;
  if p_status = 'failed' and p_artifact_id is not null then
    raise exception using errcode = '22023', message = 'document_artifact_forbidden_on_failure';
  end if;
  if p_status = 'failed' and nullif(trim(coalesce(p_error_message, '')), '') is null then
    raise exception using errcode = '22023', message = 'document_job_error_required';
  end if;

  select * into attempt_record from public.document_render_attempts
  where job_id = job_record.id
    and attempt_number = job_record.attempt_count
    and lease_token = p_lease_token
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_job_attempt_inconsistent';
  end if;
  if attempt_record.status <> 'started' then
    raise exception using errcode = '40001', message = 'document_job_lease_invalid';
  end if;

  update public.document_render_attempts
  set status = p_status, artifact_id = p_artifact_id, error_code = p_error_code,
      error_message = p_error_message, completed_at = now()
  where id = attempt_record.id
    and status = 'started'
    and lease_token = p_lease_token;
  if not found then
    raise exception using errcode = '40001', message = 'document_job_lease_invalid';
  end if;

  next_status := case
    when p_status = 'succeeded' then 'succeeded'
    when job_record.attempt_count < job_record.max_attempts then 'queued'
    else 'failed'
  end;
  retry_delay := case job_record.attempt_count
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    when 4 then interval '60 minutes'
    when 5 then interval '240 minutes'
    else interval '240 minutes'
  end;
  update public.document_jobs
  set status = next_status,
      available_at = case when next_status = 'queued' then now() + retry_delay else available_at end,
      lease_token = null,
      leased_until = null,
      claimed_at = null,
      claimed_by = null,
      completed_at = case when next_status in ('succeeded', 'failed') then now() else null end,
      last_error_code = p_error_code,
      last_error_message = p_error_message
  where id = job_record.id;
  return jsonb_build_object('jobId', job_record.id, 'status', next_status, 'attemptNumber', job_record.attempt_count);
end;
$$;

create or replace function public.create_document_share(
  p_document_id uuid,
  p_share_type text default 'pdf',
  p_expires_at timestamptz default null,
  p_max_downloads integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_record public.documents%rowtype;
  token_value text := encode(extensions.gen_random_bytes(32), 'hex');
  share_id_value uuid := extensions.gen_random_uuid();
  expires_value timestamptz := coalesce(p_expires_at, now() + interval '7 days');
begin
  select * into document_record from public.documents where id = p_document_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_not_found';
  end if;
  if auth.uid() is not null and not private.current_user_is_admin(document_record.organization_id) and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_share_forbidden';
  end if;
  if p_share_type not in ('pdf', 'verification') or p_max_downloads not between 1 and 20 or expires_value <= now() then
    raise exception using errcode = '22023', message = 'document_share_invalid';
  end if;
  insert into public.document_shares (
    id, organization_id, document_id, share_type, token_hash, max_downloads, expires_at, created_by
  ) values (
    share_id_value, document_record.organization_id, document_record.id, p_share_type,
    encode(extensions.digest(convert_to(token_value, 'UTF8'), 'sha256'), 'hex'),
    p_max_downloads, expires_value, coalesce((select auth.uid()), document_record.created_by)
  );
  return jsonb_build_object('shareId', share_id_value, 'token', token_value, 'shareType', p_share_type, 'expiresAt', expires_value, 'maxDownloads', p_max_downloads, 'downloadCount', 0);
end;
$$;

create or replace function public.revoke_document_share(p_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_record public.document_shares%rowtype;
begin
  select share_row.* into share_record
  from public.document_shares as share_row
  join public.documents as document_record on document_record.id = share_row.document_id
  where share_row.id = p_share_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_share_not_found';
  end if;
  if auth.uid() is not null and not private.current_user_is_admin(share_record.organization_id) and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_share_forbidden';
  end if;
  update public.document_shares
  set revoked_at = coalesce(revoked_at, now())
  where id = share_record.id;
  return jsonb_build_object('shareId', share_record.id, 'revokedAt', (select revoked_at from public.document_shares where id = share_record.id));
end;
$$;

-- A token bruto só existe na resposta de criação. Esta função aceita anonimo
-- para links privados e devolve apenas metadados mínimos do documento.
create or replace function public.consume_document_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_record public.document_shares%rowtype;
  document_record public.documents%rowtype;
  download_count_value integer;
begin
  if length(trim(coalesce(p_token, ''))) <> 64 or trim(p_token) !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('valid', false, 'code', 'share_token_invalid');
  end if;
  select share_row.* into share_record
  from public.document_shares as share_row
  where share_row.token_hash = encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex')
  for update;
  if not found then
    return jsonb_build_object('valid', false, 'code', 'share_not_found');
  end if;
  if share_record.revoked_at is not null or share_record.expires_at <= now() or share_record.download_count >= share_record.max_downloads then
    return jsonb_build_object('valid', false, 'code', 'share_unavailable');
  end if;
  select * into document_record from public.documents where id = share_record.document_id;
  if not exists (
    select 1
    from public.document_artifacts as artifact_record
    where artifact_record.document_id = document_record.id
      and artifact_record.artifact_type = 'pdf'
  ) then
    return jsonb_build_object('valid', false, 'code', 'share_unavailable');
  end if;
  -- The row lock above plus this guarded update makes consumption atomic per
  -- share: concurrent requests can never exceed max_downloads.
  update public.document_shares
  set download_count = download_count + 1
  where id = share_record.id
    and revoked_at is null
    and expires_at > now()
    and download_count < max_downloads
  returning download_count into download_count_value;
  if not found then
    return jsonb_build_object('valid', false, 'code', 'share_unavailable');
  end if;
  return jsonb_build_object(
    'valid', true,
    'shareId', share_record.id,
    'shareType', share_record.share_type,
    'documentId', document_record.id,
    'organizationId', document_record.organization_id,
    'collectionId', document_record.collection_id,
    'documentVersion', document_record.version,
    'issuedAt', document_record.issued_at,
    'maxDownloads', share_record.max_downloads,
    'downloadCount', download_count_value
  );
end;
$$;

-- E-mail delivery is reserved independently from the append-only delivery
-- ledger. The caller receives a short-lived reservation token only when it
-- owns the reservation; retries see the existing state without raw token or
-- recipient data.
create or replace function public.reserve_document_share_email_delivery(
  p_share_id uuid,
  p_idempotency_hash text,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_record public.document_shares%rowtype;
  reservation_record private.document_share_email_reservations%rowtype;
  reservation_token_value uuid;
  can_send_value boolean := false;
  delivery_record public.share_deliveries%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_email_reservation_forbidden';
  end if;
  if p_share_id is null or p_idempotency_hash is null or p_idempotency_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'document_email_reservation_invalid';
  end if;
  if p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'document_email_lease_invalid';
  end if;

  select * into share_record
  from public.document_shares
  where id = p_share_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_share_not_found';
  end if;

  select * into reservation_record
  from private.document_share_email_reservations
  where share_id = p_share_id
    and idempotency_hash = p_idempotency_hash
  for update;
  if not found then
    reservation_token_value := extensions.gen_random_uuid();
    insert into private.document_share_email_reservations (
      organization_id, share_id, idempotency_hash, reservation_token,
      status, lease_expires_at, created_by
    ) values (
      share_record.organization_id, share_record.id, p_idempotency_hash,
      reservation_token_value, 'reserved', now() + make_interval(secs => p_lease_seconds),
      share_record.created_by
    ) returning * into reservation_record;
    can_send_value := true;
  elsif reservation_record.status = 'reserved'
    and reservation_record.lease_expires_at <= now() then
    reservation_token_value := extensions.gen_random_uuid();
    update private.document_share_email_reservations
    set reservation_token = reservation_token_value,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = reservation_record.id;
    reservation_record.reservation_token := reservation_token_value;
    reservation_record.lease_expires_at := now() + make_interval(secs => p_lease_seconds);
    can_send_value := true;
  end if;

  if reservation_record.delivery_id is not null then
    select * into delivery_record
    from public.share_deliveries
    where id = reservation_record.delivery_id;
  end if;
  return jsonb_build_object(
    'reservationId', reservation_record.id,
    'reservationToken', case when can_send_value then reservation_record.reservation_token else null end,
    'canSend', can_send_value,
    'status', reservation_record.status,
    'deliveryId', reservation_record.delivery_id,
    'delivery', case when delivery_record.id is null then null else jsonb_build_object(
      'id', delivery_record.id,
      'shareId', delivery_record.share_id,
      'channel', delivery_record.channel,
      'result', delivery_record.result,
      'recipientMasked', delivery_record.recipient_masked,
      'providerReference', delivery_record.provider_reference,
      'createdAt', delivery_record.created_at
    ) end
  );
end;
$$;

create or replace function public.complete_document_share_email_delivery(
  p_reservation_id uuid,
  p_reservation_token uuid,
  p_result text,
  p_recipient_masked text default null,
  p_provider_reference text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_record private.document_share_email_reservations%rowtype;
  delivery_id_value uuid;
  delivery_record public.share_deliveries%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_email_reservation_forbidden';
  end if;
  if p_reservation_id is null or p_reservation_token is null
    or p_result not in ('queued', 'sent', 'failed')
    or p_recipient_masked is not null and length(trim(p_recipient_masked)) > 254
    or p_provider_reference is not null and length(trim(p_provider_reference)) > 200
    or p_error_code is not null and length(trim(p_error_code)) > 120 then
    raise exception using errcode = '22023', message = 'document_email_delivery_invalid';
  end if;

  select * into reservation_record
  from private.document_share_email_reservations
  where id = p_reservation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_email_reservation_not_found';
  end if;
  if reservation_record.reservation_token <> p_reservation_token then
    raise exception using errcode = '40001', message = 'document_email_reservation_lost';
  end if;
  if reservation_record.status <> 'reserved' then
    if reservation_record.delivery_id is null then
      raise exception using errcode = '40001', message = 'document_email_reservation_lost';
    end if;
    select * into delivery_record
    from public.share_deliveries
    where id = reservation_record.delivery_id;
    return jsonb_build_object(
      'reservationId', reservation_record.id,
      'deliveryId', delivery_record.id,
      'status', delivery_record.result,
      'providerReference', delivery_record.provider_reference
    );
  end if;
  if reservation_record.lease_expires_at <= now() then
    raise exception using errcode = '40001', message = 'document_email_reservation_lost';
  end if;

  insert into public.share_deliveries (
    organization_id, share_id, channel, recipient_masked, result,
    error_code, provider_reference, idempotency_hash, created_by
  ) values (
    reservation_record.organization_id, reservation_record.share_id, 'email',
    nullif(trim(p_recipient_masked), ''), p_result, nullif(trim(p_error_code), ''),
    nullif(trim(p_provider_reference), ''), reservation_record.idempotency_hash,
    reservation_record.created_by
  ) on conflict (share_id, channel, idempotency_hash) where idempotency_hash is not null do nothing
  returning id into delivery_id_value;
  if delivery_id_value is null then
    select id into delivery_id_value
    from public.share_deliveries
    where share_id = reservation_record.share_id
      and channel = 'email'
      and idempotency_hash = reservation_record.idempotency_hash;
  end if;
  update private.document_share_email_reservations
  set status = p_result, delivery_id = delivery_id_value, updated_at = now()
  where id = reservation_record.id and status = 'reserved';
  select * into delivery_record from public.share_deliveries where id = delivery_id_value;
  return jsonb_build_object(
    'reservationId', reservation_record.id,
    'deliveryId', delivery_record.id,
    'status', delivery_record.result,
    'providerReference', delivery_record.provider_reference
  );
end;
$$;

-- Cleanup is deliberately service-role-only: private intents are not exposed
-- through the Data API. It expires pending intents and re-returns every
-- canceled/expired, non-committed, artifact-less path until Storage removal
-- is acknowledged by the caller.
create or replace function public.cleanup_document_render_upload_intents(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_value jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode = '22023', message = 'cleanup_limit_invalid';
  end if;

  with candidates as (
    select intent_record.id, intent_record.storage_path
    from private.document_render_upload_intents as intent_record
    where intent_record.artifact_id is null
      and intent_record.cleanup_acknowledged_at is null
      and (
        intent_record.status in ('canceled', 'expired')
        or (intent_record.status = 'pending' and intent_record.expires_at <= now())
      )
    order by intent_record.expires_at, intent_record.id
    limit p_limit
    for update skip locked
  ), marked as (
    update private.document_render_upload_intents as intent_record
    set status = case when intent_record.status = 'pending' then 'expired' else intent_record.status end,
        canceled_at = coalesce(intent_record.canceled_at, now())
    from candidates
    where intent_record.id = candidates.id
    returning intent_record.id, intent_record.storage_path
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'intentId', marked.id,
        'storagePath', marked.storage_path,
        'bucket', 'collection-documents'
      ) order by marked.id
    ),
    '[]'::jsonb
  )
  into expired_value
  from marked;

  return expired_value;
end;
$$;

create or replace function public.ack_document_render_upload_cleanup(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_record private.document_render_upload_intents%rowtype;
  object_present boolean;
begin
  select * into intent_record
  from private.document_render_upload_intents
  where id = p_intent_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_upload_intent_not_found';
  end if;
  if intent_record.status = 'committed' or intent_record.artifact_id is not null then
    raise exception using errcode = 'P0001', message = 'document_cleanup_committed_forbidden';
  end if;
  if intent_record.cleanup_acknowledged_at is not null then
    return jsonb_build_object(
      'intentId', intent_record.id,
      'status', intent_record.status,
      'storagePath', intent_record.storage_path,
      'acknowledged', true
    );
  end if;
  if intent_record.status = 'pending' then
    if intent_record.expires_at > now() then
      raise exception using errcode = 'P0001', message = 'document_upload_intent_not_expired';
    end if;
    update private.document_render_upload_intents
    set status = 'expired', canceled_at = coalesce(canceled_at, now())
    where id = intent_record.id and status = 'pending';
    intent_record.status := 'expired';
  end if;
  if intent_record.status not in ('canceled', 'expired') then
    raise exception using errcode = 'P0001', message = 'document_cleanup_status_invalid';
  end if;
  select exists (
    select 1
    from storage.objects as object_record
    where object_record.bucket_id = 'collection-documents'
      and object_record.name = intent_record.storage_path
  ) into object_present;
  if object_present then
    raise exception using errcode = 'P0001', message = 'document_cleanup_object_present';
  end if;
  update private.document_render_upload_intents
  set cleanup_acknowledged_at = now()
  where id = intent_record.id
    and status in ('canceled', 'expired')
    and artifact_id is null
    and cleanup_acknowledged_at is null;
  return jsonb_build_object(
    'intentId', intent_record.id,
    'status', intent_record.status,
    'storagePath', intent_record.storage_path,
    'acknowledged', true
  );
end;
$$;

-- Creates a new immutable document from the requested source version. The
-- typed patch intentionally exposes only mutable collection presentation
-- fields; identity, issuer, customer, evidence, signature, official code,
-- status, and version remain inherited from the source snapshot.
create or replace function public.revise_collection_document(
  p_source_document_id uuid,
  p_expected_version integer,
  p_typed_document_patch jsonb,
  p_revision_type text,
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
  source_record public.documents%rowtype;
  request_record public.idempotency_requests%rowtype;
  issuer_profile_record public.document_issuer_profiles%rowtype;
  asset_record public.organization_brand_assets%rowtype;
  patch_key text;
  item_patch_key text;
  collection_patch jsonb;
  customer_patch jsonb;
  item_patch jsonb;
  patched_items jsonb;
  item_id_value uuid;
  seen_item_ids text[] := array[]::text[];
  snapshot_value jsonb;
  next_version integer;
  replacement_id uuid;
  revision_id uuid;
  job_id uuid;
  response_value jsonb;
  effective_actor uuid;
  latest_version integer;
begin
  if p_source_document_id is null
    or p_expected_version is null
    or p_expected_version < 1
    or p_idempotency_key is null
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_revision_type is null
    or p_revision_type not in ('correction', 'reissue', 'reopen')
    or length(trim(coalesce(p_reason, ''))) not between 1 and 2000
    or coalesce(jsonb_typeof(p_typed_document_patch), '') <> 'object'
    or p_typed_document_patch = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'document_revision_invalid';
  end if;

  select * into source_record
  from public.documents
  where id = p_source_document_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_revision_source_not_found';
  end if;

  select * into collection_record
  from public.collections
  where id = source_record.collection_id
    and organization_id = source_record.organization_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'document_revision_collection_not_found';
  end if;
  if actor_id is not null and not private.current_user_is_admin(source_record.organization_id)
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_revision_forbidden';
  end if;
  effective_actor := coalesce(actor_id, source_record.created_by);

  select * into request_record
  from public.idempotency_requests
  where organization_id = source_record.organization_id
    and operation = 'revise'
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if request_record.collection_id <> source_record.collection_id
      or request_record.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'idempotency_conflict';
    end if;
    if request_record.completed_at is not null then
      return request_record.response;
    end if;
  else
    insert into public.idempotency_requests (
      organization_id, collection_id, operation, idempotency_key,
      request_hash, created_by
    ) values (
      source_record.organization_id, source_record.collection_id, 'revise',
      p_idempotency_key, p_request_hash, effective_actor
    );
  end if;

  select coalesce(max(version), 0) into latest_version
  from public.documents
  where collection_id = source_record.collection_id;
  if source_record.version <> p_expected_version or latest_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;
  if source_record.issuer_profile_id is null or not (source_record.snapshot ? 'issuer') then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;
  select * into issuer_profile_record
  from public.document_issuer_profiles
  where id = source_record.issuer_profile_id
    and organization_id = source_record.organization_id;
  select * into asset_record
  from public.organization_brand_assets
  where id = issuer_profile_record.logo_asset_id
    and organization_id = source_record.organization_id
    and asset_type = 'logo';
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;

  for patch_key in select jsonb_object_keys(p_typed_document_patch) loop
    if patch_key not in ('customer', 'collection', 'items') then
      raise exception using errcode = '22023', message = 'document_revision_patch_forbidden_field';
    end if;
  end loop;

  snapshot_value := source_record.snapshot;

  if p_typed_document_patch ? 'customer' then
    customer_patch := p_typed_document_patch->'customer';
    if coalesce(jsonb_typeof(customer_patch), '') <> 'object' then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    for patch_key in select jsonb_object_keys(customer_patch) loop
      if patch_key not in ('legal_name', 'tax_id', 'phone') then
        raise exception using errcode = '22023', message = 'document_revision_patch_forbidden_field';
      end if;
    end loop;
    if customer_patch ? 'legal_name'
      and (jsonb_typeof(customer_patch->'legal_name') <> 'string'
        or length(trim(customer_patch->>'legal_name')) not between 1 and 160) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if customer_patch ? 'tax_id'
      and (jsonb_typeof(customer_patch->'tax_id') <> 'string'
        or not private.is_valid_cpf_cnpj(customer_patch->>'tax_id')) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if customer_patch ? 'phone'
      and (jsonb_typeof(customer_patch->'phone') <> 'string'
        or customer_patch->>'phone' !~ '^[0-9]{10,15}$') then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if customer_patch ? 'legal_name' then
      snapshot_value := jsonb_set(snapshot_value, '{customer,legal_name}', to_jsonb(trim(customer_patch->>'legal_name')), true);
    end if;
    if customer_patch ? 'tax_id' then
      snapshot_value := jsonb_set(snapshot_value, '{customer,tax_id}', to_jsonb(trim(customer_patch->>'tax_id')), true);
    end if;
    if customer_patch ? 'phone' then
      snapshot_value := jsonb_set(snapshot_value, '{customer,phone}', to_jsonb(customer_patch->>'phone'), true);
    end if;
  end if;

  if p_typed_document_patch ? 'collection' then
    collection_patch := p_typed_document_patch->'collection';
    if coalesce(jsonb_typeof(collection_patch), '') <> 'object' then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    for patch_key in select jsonb_object_keys(collection_patch) loop
      if patch_key not in ('location', 'responsible_name', 'responsible_tax_id', 'collected_at') then
        raise exception using errcode = '22023', message = 'document_revision_patch_forbidden_field';
      end if;
    end loop;
    if collection_patch ? 'location'
      and (jsonb_typeof(collection_patch->'location') <> 'string'
        or length(trim(collection_patch->>'location')) not between 1 and 1000) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if collection_patch ? 'responsible_name'
      and (jsonb_typeof(collection_patch->'responsible_name') <> 'string'
        or length(trim(collection_patch->>'responsible_name')) not between 1 and 160) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if collection_patch ? 'responsible_tax_id'
      and (jsonb_typeof(collection_patch->'responsible_tax_id') <> 'string'
        or not private.is_valid_cpf_cnpj(collection_patch->>'responsible_tax_id')) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if collection_patch ? 'collected_at'
      and (jsonb_typeof(collection_patch->'collected_at') <> 'string'
        or nullif(trim(collection_patch->>'collected_at'), '') is null) then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    if collection_patch ? 'collected_at' then
      perform (collection_patch->>'collected_at')::timestamptz;
    end if;
    if collection_patch ? 'location' then
      snapshot_value := jsonb_set(snapshot_value, '{collection,location}', to_jsonb(trim(collection_patch->>'location')), true);
    end if;
    if collection_patch ? 'responsible_name' then
      snapshot_value := jsonb_set(snapshot_value, '{collection,responsible_name}', to_jsonb(trim(collection_patch->>'responsible_name')), true);
    end if;
    if collection_patch ? 'responsible_tax_id' then
      snapshot_value := jsonb_set(snapshot_value, '{collection,responsible_tax_id}', to_jsonb(trim(collection_patch->>'responsible_tax_id')), true);
    end if;
    if collection_patch ? 'collected_at' then
      snapshot_value := jsonb_set(snapshot_value, '{collection,collected_at}', to_jsonb((collection_patch->>'collected_at')::timestamptz), true);
    end if;
  end if;

  if p_typed_document_patch ? 'items' then
    if coalesce(jsonb_typeof(p_typed_document_patch->'items'), '') <> 'array'
      or jsonb_array_length(p_typed_document_patch->'items') < 1 then
      raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
    end if;
    for item_patch in select value from jsonb_array_elements(p_typed_document_patch->'items') as item(value) loop
      if jsonb_typeof(item_patch) <> 'object'
        or jsonb_typeof(item_patch->'id') <> 'string'
        or item_patch->>'id' !~ '^[0-9a-f-]{36}$' then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      item_id_value := (item_patch->>'id')::uuid;
      if coalesce(item_id_value::text = any(seen_item_ids), false)
        or not exists (
          select 1 from jsonb_array_elements(coalesce(source_record.snapshot->'items', '[]'::jsonb)) as source_item(value)
          where (source_item.value->>'id')::uuid = item_id_value
        ) then
        raise exception using errcode = '22023', message = 'document_revision_item_not_found';
      end if;
      seen_item_ids := array_append(seen_item_ids, item_id_value::text);
      for item_patch_key in select jsonb_object_keys(item_patch) loop
        if item_patch_key not in ('id', 'description', 'quantity', 'condition_note', 'observation') then
          raise exception using errcode = '22023', message = 'document_revision_patch_forbidden_field';
        end if;
      end loop;
      if not (item_patch ? 'description' or item_patch ? 'quantity' or item_patch ? 'condition_note' or item_patch ? 'observation') then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'description'
        and (jsonb_typeof(item_patch->'description') <> 'string'
          or length(trim(item_patch->>'description')) not between 1 and 1000) then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'quantity'
        and (jsonb_typeof(item_patch->'quantity') <> 'number'
          or (item_patch->>'quantity')::numeric <= 0) then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'condition_note'
        and jsonb_typeof(item_patch->'condition_note') not in ('string', 'null') then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'condition_note' and jsonb_typeof(item_patch->'condition_note') = 'string'
        and length(item_patch->>'condition_note') > 1000 then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'observation'
        and jsonb_typeof(item_patch->'observation') not in ('string', 'null') then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      if item_patch ? 'observation' and jsonb_typeof(item_patch->'observation') = 'string'
        and length(item_patch->>'observation') > 2000 then
        raise exception using errcode = '22023', message = 'document_revision_patch_invalid';
      end if;
      select coalesce(jsonb_agg(
        case when source_item.value->>'id' = item_patch->>'id'
          then source_item.value || (item_patch - 'id')
          else source_item.value end
        order by source_item.ordinality
      ), '[]'::jsonb)
      into patched_items
      from jsonb_array_elements(snapshot_value->'items') with ordinality as source_item(value, ordinality);
      snapshot_value := jsonb_set(snapshot_value, '{items}', patched_items, true);
    end loop;
  end if;

  next_version := source_record.version + 1;
  insert into public.documents (
    organization_id, collection_id, version, snapshot, snapshot_hash,
    verification_token, issuer_profile_id, created_by
  ) values (
    source_record.organization_id, source_record.collection_id, next_version,
    snapshot_value,
    encode(extensions.digest(convert_to(snapshot_value::text, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex'), source_record.issuer_profile_id,
    effective_actor
  ) returning id into replacement_id;

  insert into public.document_revisions (
    organization_id, collection_id, previous_document_id, replacement_document_id,
    revision_type, reason, created_by
  ) values (
    source_record.organization_id, source_record.collection_id, source_record.id,
    replacement_id, p_revision_type, trim(p_reason), effective_actor
  ) returning id into revision_id;

  insert into public.document_jobs (
    organization_id, document_id, job_type, idempotency_key, requested_by
  ) values (
    source_record.organization_id, replacement_id, 'render_pdf', p_idempotency_key, effective_actor
  ) on conflict (document_id, job_type) do nothing
  returning id into job_id;
  if job_id is null then
    select id into job_id
    from public.document_jobs
    where document_id = replacement_id and job_type = 'render_pdf';
  end if;
  insert into public.document_jobs (
    organization_id, document_id, job_type, idempotency_key, requested_by
  ) values (
    source_record.organization_id, replacement_id, 'render_qr', p_idempotency_key, effective_actor
  ) on conflict (document_id, job_type) do nothing;

  response_value := jsonb_build_object(
    'revisionId', revision_id,
    'previousDocumentId', source_record.id,
    'replacementDocumentId', replacement_id,
    'document', jsonb_build_object('id', replacement_id, 'version', next_version, 'status', 'snapshot_ready'),
    'jobId', job_id
  );
  update public.idempotency_requests
  set response = response_value, completed_at = now()
  where organization_id = source_record.organization_id
    and operation = 'revise'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

create or replace function public.create_document_revision(
  p_previous_document_id uuid,
  p_replacement_document_id uuid,
  p_revision_type text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_record public.documents%rowtype;
  replacement_record public.documents%rowtype;
  revision_id uuid;
begin
  select * into previous_record from public.documents where id = p_previous_document_id;
  select * into replacement_record from public.documents where id = p_replacement_document_id;
  if not found or replacement_record.id is null or previous_record.id is null then
    raise exception using errcode = 'P0002', message = 'document_revision_document_not_found';
  end if;
  if previous_record.organization_id <> replacement_record.organization_id or previous_record.collection_id <> replacement_record.collection_id or replacement_record.version <= previous_record.version then
    raise exception using errcode = 'P0001', message = 'document_revision_link_invalid';
  end if;
  if p_revision_type not in ('correction', 'reissue', 'reopen') or length(trim(coalesce(p_reason, ''))) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'document_revision_invalid';
  end if;
  if auth.uid() is not null and not private.current_user_is_admin(previous_record.organization_id) and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'document_revision_forbidden';
  end if;
  insert into public.document_revisions (
    organization_id, collection_id, previous_document_id, replacement_document_id,
    revision_type, reason, created_by
  ) values (
    previous_record.organization_id, previous_record.collection_id, previous_record.id,
    replacement_record.id, p_revision_type, trim(p_reason), coalesce((select auth.uid()), replacement_record.created_by)
  ) returning id into revision_id;
  return jsonb_build_object('revisionId', revision_id, 'previousDocumentId', previous_record.id, 'replacementDocumentId', replacement_record.id);
end;
$$;

revoke execute on function public.validate_document_issuer_profile(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.consume_document_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_document_job(text, integer) from public, anon, authenticated;
revoke execute on function public.prepare_document_render_upload(uuid, uuid, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.commit_document_render_upload(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_document_render_upload(uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_document_render_upload_intents(integer) from public, anon, authenticated;
revoke execute on function public.ack_document_render_upload_cleanup(uuid) from public, anon, authenticated;
revoke execute on function public.complete_document_job(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_document_share(uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.revoke_document_share(uuid) from public, anon, authenticated;
revoke execute on function public.consume_document_share(text) from public;
revoke execute on function public.reserve_document_share_email_delivery(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.complete_document_share_email_delivery(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_document_revision(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.validate_document_issuer_profile(bigint, uuid) to authenticated, service_role;
grant execute on function public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.consume_document_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.claim_document_job(text, integer) to service_role;
grant execute on function public.prepare_document_render_upload(uuid, uuid, text, text, integer, text) to service_role;
grant execute on function public.commit_document_render_upload(uuid) to service_role;
grant execute on function public.cancel_document_render_upload(uuid) to service_role;
grant execute on function public.cleanup_document_render_upload_intents(integer) to service_role;
grant execute on function public.ack_document_render_upload_cleanup(uuid) to service_role;
grant execute on function public.complete_document_job(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.create_document_share(uuid, text, timestamptz, integer) to authenticated, service_role;
grant execute on function public.revoke_document_share(uuid) to authenticated, service_role;
grant execute on function public.consume_document_share(text) to anon, authenticated;
grant execute on function public.reserve_document_share_email_delivery(uuid, text, integer) to service_role;
grant execute on function public.complete_document_share_email_delivery(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text) to authenticated, service_role;
grant execute on function public.create_document_revision(uuid, uuid, text, text) to authenticated, service_role;
