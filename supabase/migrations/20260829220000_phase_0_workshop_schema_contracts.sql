-- Fase 0: schema e contratos de oficina (B01–B08).
-- Aditiva: nao apaga dados, eventos, PDFs, assinaturas nem termos.
-- Sem DROP FUNCTION: CREATE OR REPLACE nas mesmas assinaturas (preserva grants Chat 3).
-- Corpos de create_technical_budget / update_service_progress partem da 3b (idempotencia).
-- get_collection_detail / list_collections partem da 1A.

-- 0.1 — identidade emitida em qualquer status pos-rascunho
alter table public.collections drop constraint if exists collections_check;
alter table public.collections
  add constraint collections_issued_identity_check
  check (
    (
      status = 'draft'
      and official_code is null
      and issued_year is null
      and sequence_number is null
      and customer_snapshot is null
    )
    or (
      status in (
        'collected', 'canceled',
        'in_workshop', 'in_budget', 'awaiting_approval', 'approved',
        'in_service', 'ready', 'invoiced', 'partial_delivery', 'delivered',
        'rejected', 'reopened'
      )
      and official_code is not null
      and issued_year is not null
      and sequence_number is not null
      and customer_snapshot is not null
    )
  );

-- 0.2 — caminho da assinatura de check-in no cabecalho (SO ainda nao existe)
alter table public.collections
  add column if not exists check_in_signature_path text
  check (check_in_signature_path is null or check_in_signature_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$');

-- 0.3 — cancelar a partir de estados de oficina
alter table public.collections drop constraint if exists collections_previous_status_before_cancellation_check;
alter table public.collections
  add constraint collections_previous_status_before_cancellation_check
  check (
    previous_status_before_cancellation is null
    or previous_status_before_cancellation in (
      'draft', 'collected',
      'in_workshop', 'in_budget', 'awaiting_approval', 'approved',
      'in_service', 'ready', 'invoiced', 'partial_delivery',
      'rejected', 'reopened'
    )
  );

-- 0.4 — recusar orcamento grava service_orders.status = rejected
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders
  add constraint service_orders_status_check
  check (status in ('draft', 'budgeted', 'approved', 'in_service', 'ready', 'canceled', 'rejected'));

-- 0.6 — varias entregas parciais (um termo por entrega, nao por coleta)
alter table public.delivery_terms drop constraint if exists delivery_terms_organization_id_collection_id_key;

-- 0.2 + validacao de item — create_technical_budget (corpo 3b)
create or replace function public.create_technical_budget(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb,
  p_general_notes text,
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
  next_version integer;
  total_labor numeric(12,2) := 0;
  total_parts numeric(12,2) := 0;
  budget_id uuid;
  item_record record;
  item_exists boolean;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_budget_request';
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
    and operation = 'save_technical_budget'
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
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'save_technical_budget',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status <> 'in_workshop' then
    raise exception using errcode = 'P0001', message = 'collection_not_in_workshop';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    item_description text,
    labor_cost_brl numeric,
    parts_cost_brl numeric,
    estimated_days integer,
    notes text
  ) loop
    if length(trim(coalesce(item_record.item_description, ''))) < 1
      or item_record.labor_cost_brl < 0 or item_record.parts_cost_brl < 0
      or item_record.estimated_days < 1 then
      raise exception using errcode = 'P0001', message = 'invalid_budget_item';
    end if;
    select 1 into item_exists
    from public.collection_items
    where id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'collection_item_not_found';
    end if;
    total_labor := total_labor + coalesce(item_record.labor_cost_brl, 0);
    total_parts := total_parts + coalesce(item_record.parts_cost_brl, 0);
    insert into public.service_order_items (
      organization_id, collection_id, collection_item_id,
      labor_cost_brl, parts_cost_brl, estimated_days, notes
    ) values (
      collection_record.organization_id, p_collection_id, item_record.item_id,
      coalesce(item_record.labor_cost_brl, 0), coalesce(item_record.parts_cost_brl, 0),
      item_record.estimated_days, nullif(trim(item_record.notes), '')
    );
  end loop;

  next_version := collection_record.row_version + 1;
  budget_id := gen_random_uuid();
  insert into public.service_orders (
    id, organization_id, collection_id, administrator_id,
    labor_brl, parts_brl, due_days, status, check_in_signature_path
  ) values (
    budget_id, collection_record.organization_id, p_collection_id, actor_id,
    total_labor, total_parts,
    (select max(estimated_days) from public.service_order_items where collection_id = p_collection_id),
    'budgeted',
    collection_record.check_in_signature_path
  );

  update public.collections
    set status = 'in_budget', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.budget.created', 'in_workshop', 'in_budget',
    jsonb_build_object(
      'row_version', next_version,
      'serviceOrderId', budget_id,
      'laborBrl', total_labor,
      'partsBrl', total_parts,
      'generalNotes', nullif(trim(p_general_notes), '')
    )
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'in_budget',
    'rowVersion', next_version,
    'serviceOrderId', budget_id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'save_technical_budget'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 0.5 + 0.7 — progresso por collection_item_id; all_ready olha a tabela
create or replace function public.update_service_progress(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb,
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
  service_order_record public.service_orders%rowtype;
  request_record public.idempotency_requests%rowtype;
  next_version integer;
  any_ready boolean := false;
  all_ready boolean := false;
  item_record record;
  item_found boolean;
  response_value jsonb;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_progress_request';
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
    and operation = 'update_service_progress'
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
      organization_id, collection_id, operation, idempotency_key, request_hash, created_by
    )
    values (
      collection_record.organization_id, p_collection_id, 'update_service_progress',
      p_idempotency_key, p_request_hash, actor_id
    );
  end if;

  if collection_record.status not in ('approved', 'in_service') then
    raise exception using errcode = 'P0001', message = 'collection_not_in_service';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  select * into service_order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_order_not_found';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    status text,
    notes text
  ) loop
    if item_record.status not in ('em_reparo', 'pronto') then
      raise exception using errcode = 'P0001', message = 'invalid_item_progress_status';
    end if;
    select 1 into item_found
    from public.service_order_items
    where collection_item_id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'service_order_item_not_found';
    end if;
    update public.service_order_items
      set status = item_record.status,
          notes = nullif(trim(item_record.notes), '')
    where collection_item_id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
  end loop;

  select
    coalesce(bool_and(status = 'pronto'), false),
    coalesce(bool_or(status = 'pronto'), false)
  into all_ready, any_ready
  from public.service_order_items
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id;

  next_version := collection_record.row_version + 1;
  if any_ready and all_ready then
    update public.service_orders set status = 'ready' where id = service_order_record.id;
    update public.collections
      set status = 'ready', row_version = next_version, updated_by = actor_id
    where id = p_collection_id;
  else
    if collection_record.status = 'approved' then
      update public.service_orders set status = 'in_service' where id = service_order_record.id;
      update public.collections
        set status = 'in_service', row_version = next_version, updated_by = actor_id
      where id = p_collection_id;
    else
      update public.collections set row_version = next_version, updated_by = actor_id where id = p_collection_id;
    end if;
  end if;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.service.progress_updated', collection_record.status,
    (select status from public.collections where id = p_collection_id),
    jsonb_build_object('row_version', next_version)
  );

  response_value := jsonb_build_object(
    'collectionId', p_collection_id,
    'status', (select status from public.collections where id = p_collection_id),
    'rowVersion', next_version,
    'serviceOrderId', service_order_record.id
  );
  update public.idempotency_requests
    set response = response_value, completed_at = now()
  where organization_id = collection_record.organization_id
    and operation = 'update_service_progress'
    and idempotency_key = p_idempotency_key;
  return response_value;
end;
$$;

-- 0.8 — cliente do snapshot em todo status emitido
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
      when collection_record.status <> 'draft' and collection_record.customer_snapshot is not null then jsonb_build_object(
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

-- 0.2 — leitura de Storage tambem pelo path gravado em collections
drop policy if exists collection_signatures_read_delivery_or_checkin on storage.objects;
create policy collection_signatures_read_delivery_or_checkin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (
    exists (
      select 1 from public.signatures as signature_record
      where signature_record.organization_id = split_part(name, '/', 1)::bigint
        and signature_record.storage_path = name
    )
    or exists (
      select 1 from public.service_orders as order_record
      where order_record.organization_id = split_part(name, '/', 1)::bigint
        and order_record.check_in_signature_path = name
    )
    or exists (
      select 1 from public.collections as collection_record
      where collection_record.organization_id = split_part(name, '/', 1)::bigint
        and collection_record.check_in_signature_path = name
    )
    or exists (
      select 1 from private.delivery_signature_intents as intent_record
      where intent_record.organization_id = split_part(name, '/', 1)::bigint
        and intent_record.storage_path = name
        and intent_record.status = 'committed'
    )
    or exists (
      select 1 from private.collection_upload_intents as upload_intent
      where upload_intent.organization_id = split_part(name, '/', 1)::bigint
        and upload_intent.storage_path = name
        and upload_intent.status = 'committed'
    )
  )
);
