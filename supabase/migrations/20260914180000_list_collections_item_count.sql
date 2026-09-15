-- Lista M06: itemCount no JSON de list_collections (linhas vivas de collection_items).
-- Mesma assinatura de 11 argumentos; sem DROP; sem denorm; sem alterar dados.
-- Re-GRANT apos REPLACE: authenticated EXECUTE; revoke public/anon/service_role.
-- Overlay: list_collections continua Returns Json; Zod valida itemCount.

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
            'rowVersion', page.row_version,
            'itemCount', (
              select count(*)::integer
              from public.collection_items as item_record
              where item_record.collection_id = page.id
                and item_record.organization_id = page.organization_id
                and item_record.removed_at is null
            )
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
