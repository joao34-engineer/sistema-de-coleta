-- Fase 5: PR 8 — 5.4 timeline labels + actorName.
-- Aditiva: CREATE OR REPLACE de public.list_collection_events com mesma assinatura.
-- Preserva: event_type históricos, grants existentes, RLS e comportamento de paginação.
-- Altera: resolve actorName via LEFT JOIN profiles e metadata (administratorName/signerName/receiverName).

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
    ),
    page_with_actor as (
      select
        page.id,
        page.event_type,
        page.previous_status,
        page.new_status,
        page.reason,
        page.created_at,
        nullif(trim(coalesce(
          profile_record.full_name,
          page.metadata->>'administratorName',
          page.metadata->>'signerName',
          page.metadata->>'receiverName'
        )), '') as actor_name
      from page
      left join public.profiles as profile_record
        on profile_record.user_id = page.actor_user_id
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
            'actorName', page.actor_name,
            'createdAt', page.created_at
          )
          order by page.created_at desc, page.id desc
        )
        from page_with_actor as page
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
