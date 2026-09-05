-- Fix the authenticated issuer-settings wrapper. Its original local variable
-- names collided with table column names, so PostgreSQL raised 42702 before
-- the full, validated publisher could run.
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
  v_actor_id uuid := (select auth.uid());
  v_organization_id bigint;
  v_logo_path text;
  v_address_complement text;
begin
  select membership.organization_id
    into v_organization_id
  from public.organization_memberships as membership
  join public.profiles as profile on profile.user_id = membership.user_id
  join public.organizations as organization_record on organization_record.id = membership.organization_id
  where membership.user_id = v_actor_id
    and membership.role_code = 'administrator'
    and membership.status = 'active'
    and profile.status = 'active'
  order by membership.organization_id
  limit 1;

  if v_actor_id is null or v_organization_id is null then
    raise exception using errcode = '42501', message = 'issuer_settings_forbidden';
  end if;

  select asset.storage_path
    into v_logo_path
  from public.organization_brand_assets as asset
  where asset.id = p_logo_asset_id
    and asset.organization_id = v_organization_id
    and asset.asset_type = 'logo';
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_settings_incomplete';
  end if;

  select settings.address_complement
    into v_address_complement
  from public.organization_settings as settings
  where settings.organization_id = v_organization_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'issuer_settings_incomplete';
  end if;

  return public.save_company_issuer_settings(
    v_organization_id,
    p_legal_name,
    p_tax_id,
    p_phone,
    p_street,
    p_street_number,
    v_address_complement,
    p_district,
    p_city,
    p_state_code,
    p_postal_code,
    p_receipt_legal_text,
    p_signer_name,
    p_signer_title,
    p_logo_asset_id,
    v_logo_path,
    'mjt-receipt-v1'
  );
end;
$$;

revoke execute on function public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid) to authenticated;
