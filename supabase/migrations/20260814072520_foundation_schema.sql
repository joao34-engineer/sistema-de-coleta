create schema if not exists private;

create table if not exists public.organizations (
  id bigint generated always as identity primary key,
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9-]+$'),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  full_name text check (full_name is null or length(trim(full_name)) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  code text primary key check (code = lower(code)),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  role_code text not null references public.roles(code) on delete restrict,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_settings (
  organization_id bigint primary key references public.organizations(id) on delete restrict,
  legal_name text check (legal_name is null or length(trim(legal_name)) <= 160),
  tax_id text check (tax_id is null or tax_id ~ '^[0-9]{14}$'),
  phone text check (phone is null or length(phone) <= 30),
  street text check (street is null or length(trim(street)) <= 160),
  street_number text check (street_number is null or length(trim(street_number)) <= 20),
  address_complement text check (address_complement is null or length(trim(address_complement)) <= 120),
  district text check (district is null or length(trim(district)) <= 100),
  city text check (city is null or length(trim(city)) <= 100),
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  receipt_legal_text text check (receipt_legal_text is null or length(receipt_legal_text) <= 2000),
  signer_name text check (signer_name is null or length(trim(signer_name)) <= 160),
  signer_title text check (signer_title is null or length(trim(signer_title)) <= 120),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9]+/company-logo/[0-9a-f-]+\.(png|jpg|webp)$'),
  setup_complete boolean generated always as (
    nullif(trim(legal_name), '') is not null and
    tax_id is not null and
    nullif(trim(street), '') is not null and
    nullif(trim(city), '') is not null and
    state_code is not null and
    postal_code is not null and
    nullif(trim(signer_name), '') is not null and
    nullif(trim(signer_title), '') is not null and
    nullif(trim(receipt_legal_text), '') is not null
  ) stored,
  updated_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references public.profiles(user_id) on delete restrict,
  event_type text not null check (length(trim(event_type)) between 1 and 120),
  subject_type text not null check (length(trim(subject_type)) between 1 and 120),
  subject_id text not null check (length(trim(subject_id)) between 1 and 160),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_memberships_user_id_idx on public.organization_memberships(user_id);
create index if not exists organization_memberships_organization_id_idx on public.organization_memberships(organization_id);
create index if not exists organization_memberships_role_code_idx on public.organization_memberships(role_code);
create index if not exists audit_events_organization_created_at_idx on public.audit_events(organization_id, created_at desc);
create index if not exists audit_events_actor_user_id_idx on public.audit_events(actor_user_id);
create index if not exists audit_events_event_type_idx on public.audit_events(event_type);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function private.current_user_is_active_member(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.current_user_is_admin(target_organization_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    join public.profiles as profile on profile.user_id = membership.user_id
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role_code = 'administrator'
      and membership.status = 'active'
      and profile.status = 'active'
  );
$$;

create or replace function private.audit_organization_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_fields jsonb;
begin
  select coalesce(jsonb_agg(new_value.key order by new_value.key), '[]'::jsonb)
    into changed_fields
  from jsonb_each(to_jsonb(new)) as new_value
  join jsonb_each(to_jsonb(old)) as old_value on old_value.key = new_value.key
  where new_value.key not in ('updated_at', 'updated_by')
    and new_value.value is distinct from old_value.value;

  if jsonb_array_length(changed_fields) > 0 then
    insert into public.audit_events (organization_id, actor_user_id, event_type, subject_type, subject_id, metadata)
    values (
      new.organization_id,
      coalesce(new.updated_by, (select auth.uid())),
      'organization.settings.updated',
      'organization_settings',
      new.organization_id::text,
      jsonb_build_object('changed_fields', changed_fields)
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.handle_new_auth_user() from public;
revoke execute on function private.set_updated_at() from public;
revoke execute on function private.audit_organization_settings_update() from public;
revoke execute on function private.current_user_is_active_member(bigint) from public;
revoke execute on function private.current_user_is_admin(bigint) from public;
grant execute on function private.current_user_is_active_member(bigint) to authenticated;
grant execute on function private.current_user_is_admin(bigint) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists memberships_set_updated_at on public.organization_memberships;
create trigger memberships_set_updated_at before update on public.organization_memberships for each row execute function private.set_updated_at();
drop trigger if exists settings_set_updated_at on public.organization_settings;
create trigger settings_set_updated_at before update on public.organization_settings for each row execute function private.set_updated_at();
drop trigger if exists settings_audit_update on public.organization_settings;
create trigger settings_audit_update after update on public.organization_settings for each row execute function private.audit_organization_settings_update();

insert into public.organizations (code, display_name)
values ('mjt', 'MJT')
on conflict (code) do nothing;

insert into public.roles (code, display_name)
values ('administrator', 'Administrador')
on conflict (code) do nothing;

insert into public.organization_settings (organization_id)
select organization.id from public.organizations as organization where organization.code = 'mjt'
on conflict (organization_id) do nothing;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_settings enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.organizations, public.profiles, public.roles, public.organization_memberships, public.organization_settings, public.audit_events from anon;
revoke all on table public.organizations, public.profiles, public.roles, public.organization_memberships, public.organization_settings, public.audit_events from authenticated;
grant select on public.organizations, public.profiles, public.roles, public.organization_memberships, public.organization_settings, public.audit_events to authenticated;
grant update (legal_name, tax_id, phone, street, street_number, address_complement, district, city, state_code, postal_code, receipt_legal_text, signer_name, signer_title, logo_path) on public.organization_settings to authenticated;
grant select on public.organizations, public.profiles, public.roles, public.organization_memberships, public.organization_settings, public.audit_events to service_role;
grant insert, update on public.organization_memberships, public.audit_events to service_role;
grant usage, select on sequence public.organization_memberships_id_seq, public.audit_events_id_seq to service_role;

drop policy if exists organizations_select_admin on public.organizations;
create policy organizations_select_admin on public.organizations for select to authenticated using (private.current_user_is_admin(id));
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists roles_select_member on public.roles;
create policy roles_select_member on public.roles for select to authenticated using (exists (select 1 from public.organization_memberships as membership where membership.role_code = roles.code and membership.user_id = (select auth.uid()) and membership.status = 'active'));
drop policy if exists memberships_select_self on public.organization_memberships;
create policy memberships_select_self on public.organization_memberships for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists settings_select_admin on public.organization_settings;
create policy settings_select_admin on public.organization_settings for select to authenticated using (private.current_user_is_admin(organization_id));
drop policy if exists settings_update_admin on public.organization_settings;
create policy settings_update_admin on public.organization_settings for update to authenticated using (private.current_user_is_admin(organization_id)) with check (private.current_user_is_admin(organization_id));
drop policy if exists audit_select_admin on public.audit_events;
create policy audit_select_admin on public.audit_events for select to authenticated using (private.current_user_is_admin(organization_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-assets', 'organization-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('collection-evidences', 'collection-evidences', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('collection-signatures', 'collection-signatures', false, 2097152, array['image/png']),
  ('collection-documents', 'collection-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_assets_select_admin on storage.objects;
create policy organization_assets_select_admin on storage.objects for select to authenticated using (bucket_id = 'organization-assets' and split_part(name, '/', 1) ~ '^[0-9]+$' and private.current_user_is_admin((split_part(name, '/', 1))::bigint));
drop policy if exists organization_assets_insert_admin on storage.objects;
create policy organization_assets_insert_admin on storage.objects for insert to authenticated with check (bucket_id = 'organization-assets' and split_part(name, '/', 1) ~ '^[0-9]+$' and split_part(name, '/', 2) = 'company-logo' and split_part(name, '/', 3) ~ '^[0-9a-f-]+\.(png|jpg|webp)$' and private.current_user_is_admin((split_part(name, '/', 1))::bigint) and (metadata->>'mimetype') in ('image/png', 'image/jpeg', 'image/webp'));
