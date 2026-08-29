-- Fase 4 Chat 3: endurecimento de ACLs da oficina (mesmo padrao da Fase 1A).
-- Aditiva: nao apaga dados, evidencias, documentos nem eventos.
-- Remove EXECUTE implicito de PUBLIC/anon/service_role em todas as sobrecargas
-- das RPCs de oficina e de intent de assinatura; policies FOR ALL passam a
-- SELECT/INSERT/UPDATE sem DELETE.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'workshop_check_in',
        'create_technical_budget',
        'approve_technical_budget',
        'update_service_progress',
        'register_invoice_reference',
        'deliver_to_customer',
        'cancel_or_reopen_collection',
        'prepare_delivery_signature_intent',
        'commit_delivery_signature_intent',
        'cancel_delivery_signature_intent'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end
$$;

drop policy if exists service_orders_admin_all on public.service_orders;
create policy service_orders_admin_select
on public.service_orders for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy service_orders_admin_insert
on public.service_orders for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy service_orders_admin_update
on public.service_orders for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists invoice_references_admin_all on public.invoice_references;
create policy invoice_references_admin_select
on public.invoice_references for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy invoice_references_admin_insert
on public.invoice_references for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy invoice_references_admin_update
on public.invoice_references for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists delivery_items_admin_all on public.delivery_items;
create policy delivery_items_admin_select
on public.delivery_items for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy delivery_items_admin_insert
on public.delivery_items for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy delivery_items_admin_update
on public.delivery_items for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists service_order_items_admin_all on public.service_order_items;
create policy service_order_items_admin_select
on public.service_order_items for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy service_order_items_admin_insert
on public.service_order_items for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy service_order_items_admin_update
on public.service_order_items for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists workshop_checkin_items_admin_all on public.workshop_checkin_items;
create policy workshop_checkin_items_admin_select
on public.workshop_checkin_items for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy workshop_checkin_items_admin_insert
on public.workshop_checkin_items for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy workshop_checkin_items_admin_update
on public.workshop_checkin_items for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists delivery_terms_admin_all on public.delivery_terms;
create policy delivery_terms_admin_select
on public.delivery_terms for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy delivery_terms_admin_insert
on public.delivery_terms for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy delivery_terms_admin_update
on public.delivery_terms for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

drop policy if exists delivery_term_items_admin_all on public.delivery_term_items;
create policy delivery_term_items_admin_select
on public.delivery_term_items for select to authenticated
using (private.current_user_is_admin(organization_id));
create policy delivery_term_items_admin_insert
on public.delivery_term_items for insert to authenticated
with check (private.current_user_is_admin(organization_id));
create policy delivery_term_items_admin_update
on public.delivery_term_items for update to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));
