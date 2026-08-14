create or replace function private.set_organization_settings_updated_by()
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

revoke all on function private.set_organization_settings_updated_by() from public;

drop trigger if exists a_settings_set_updated_by on public.organization_settings;
create trigger a_settings_set_updated_by
before update on public.organization_settings
for each row execute function private.set_organization_settings_updated_by();

grant update (legal_name, tax_id, phone, street, street_number, address_complement, district, city, state_code, postal_code, receipt_legal_text, signer_name, signer_title, logo_path, updated_by)
on public.organization_settings to authenticated;
