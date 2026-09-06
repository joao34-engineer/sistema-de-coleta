-- Fase 5: list_collections busca unificada + totalCount + collection_dashboard_summary (5.1, 5.3).
-- Aditiva no dado: DROP so da assinatura de 9 argumentos (PostgreSQL nao adiciona parametros).
-- Corpo de list_collections parte de 20260829220000 (snapshot do cliente em todo status emitido).
-- Re-GRANT obrigatorio apos o DROP: authenticated EXECUTE; revoke public/anon/service_role.
-- Preserva guias finalizadas, PDFs, assinaturas e eventos.
-- Timestamp 20260906190000: ascendente apos Wave 1 (PR 10 CHECK 20260906160000) e arquivos irmaos ja neste tree.
-- Tipos gerados: nao inventar database.generated.ts a mao; overlay em database.types.ts ate `npm run db:types:remote` apos o push.

drop function if exists public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer);

create or replace function public.list_collections(
  p_code text default null, p_customer text default null, p_tax_id text default null,
  p_phone text default null, p_status text default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_cursor text default null, p_limit integer default null,
  p_q text default null, p_statuses text[] default null
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
    with sourced as (
      select
        collection_record.*,
        customer_record.legal_name as current_legal_name,
        customer_record.tax_id as current_tax_id,
        customer_record.phone as current_phone,
        case
          when collection_record.status = 'draft' then customer_record.legal_name
          else collection_record.customer_snapshot->>'legal_name'
        end as display_legal_name,
        case
          when collection_record.status = 'draft' then customer_record.tax_id
          else collection_record.customer_snapshot->>'tax_id'
        end as display_tax_id,
        case
          when collection_record.status = 'draft' then customer_record.phone
          else collection_record.customer_snapshot->>'phone'
        end as display_phone
      from public.collections as collection_record
      left join public.customers as customer_record
        on customer_record.id = collection_record.customer_id
       and customer_record.organization_id = collection_record.organization_id
      where private.current_user_is_admin(collection_record.organization_id)
    ),
    filtered as (
      select * from sourced as collection_record
      where (p_code is null or collection_record.official_code ilike '%' || p_code || '%')
        and (p_customer is null or collection_record.display_legal_name ilike '%' || p_customer || '%')
        and (p_tax_id is null or collection_record.display_tax_id = p_tax_id)
        and (p_phone is null or collection_record.display_phone = p_phone)
        and (p_status is null or collection_record.status = p_status)
        and (p_statuses is null or collection_record.status = any (p_statuses))
        and (p_q is null or (
               collection_record.official_code ilike '%' || p_q || '%'
            or collection_record.display_legal_name ilike '%' || p_q || '%'
            or collection_record.display_tax_id = regexp_replace(p_q, '\D', '', 'g')
            or collection_record.display_phone  = regexp_replace(p_q, '\D', '', 'g')
            or (length(regexp_replace(p_q, '\D', '', 'g')) >= 7 and (
                   collection_record.display_tax_id like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'
                or collection_record.display_phone  like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'))))
        and (p_from is null or collection_record.created_at >= p_from)
        and (p_to is null or collection_record.created_at <= p_to)
    ),
    filtered_count as (
      select count(*)::integer as total from filtered
    ),
    permitted as (
      select * from filtered as collection_record
      where (
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
      ) else null end,
      'totalCount',
      (select filtered_count.total from filtered_count)
    )
  );
end;
$$;

revoke execute on function public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])
  from public, anon, service_role;
grant execute on function public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])
  to authenticated;

create or replace function public.collection_dashboard_summary(
  p_in_progress text[],
  p_ready_for_delivery text[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'inProgress', count(*) filter (where collection_record.status = any (p_in_progress))::integer,
    'readyForDelivery', count(*) filter (where collection_record.status = any (p_ready_for_delivery))::integer
  )
  from public.collections as collection_record
  where private.current_user_is_admin(collection_record.organization_id);
$$;

revoke execute on function public.collection_dashboard_summary(text[], text[])
  from public, anon, service_role;
grant execute on function public.collection_dashboard_summary(text[], text[])
  to authenticated;
