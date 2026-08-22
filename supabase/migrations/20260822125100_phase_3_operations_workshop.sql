-- Fase 3: operação de oficina, orçamento, aprovação, reparo, NF-e, entrega e cancelamento/reabertura.
-- Esta migration é ADITIVA: não apaga nem reseta dados existentes.
-- Amplia constraints de status existentes (draft|collected|canceled) para liberar
-- a máquina de estados completa; cria tabelas e RPCs para a Onda 3a (só migration).
-- Os comandos server-side e telas consumirão os contratos Zod preservados em
-- src/_pages/collection-operations/model/contracts.ts na Sessão 3b/3c.

-- 1. Ampliação aditiva de constraints existentes
--    Libera a escrita dos novos status para a máquina de estados da Fase 3.
alter table public.collections
  drop constraint if exists collections_status_check,
  add constraint collections_status_check
  check (status in (
    'draft', 'collected', 'canceled',
    'in_workshop', 'in_budget', 'awaiting_approval', 'approved',
    'in_service', 'ready', 'invoiced', 'partial_delivery', 'delivered',
    'rejected', 'reopened'
  ));

alter table public.collection_events
  drop constraint if exists collection_events_previous_status_check,
  add constraint collection_events_previous_status_check
  check (previous_status is null or previous_status in (
    'draft', 'collected', 'canceled',
    'in_workshop', 'in_budget', 'awaiting_approval', 'approved',
    'in_service', 'ready', 'invoiced', 'partial_delivery', 'delivered',
    'rejected', 'reopened'
  ));
alter table public.collection_events
  drop constraint if exists collection_events_new_status_check,
  add constraint collection_events_new_status_check
  check (new_status is null or new_status in (
    'draft', 'collected', 'canceled',
    'in_workshop', 'in_budget', 'awaiting_approval', 'approved',
    'in_service', 'ready', 'invoiced', 'partial_delivery', 'delivered',
    'rejected', 'reopened'
  ));

-- 2. Tabela de ordem de serviço (orcamento + custo do reparo da oficina própria)
create table public.service_orders (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     bigint not null references public.organizations(id) on delete restrict,
  collection_id       uuid not null,
  administrator_id    uuid not null references public.profiles(user_id) on delete restrict,
  labor_brl           numeric(12,2) not null check (labor_brl >= 0),
  parts_brl           numeric(12,2) not null check (parts_brl >= 0),
  due_days            integer not null check (due_days between 1 and 90),
  status              text not null default 'draft'
                      check (status in ('draft', 'budgeted', 'approved', 'in_service', 'ready', 'canceled')),
  approval_signer_name  text check (approval_signer_name is null or length(trim(approval_signer_name)) between 1 and 160),
  approval_signer_tax_id text check (approval_signer_tax_id is null or private.is_valid_cpf_cnpj(approval_signer_tax_id)),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, collection_id),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

-- 3. Referência manual de NF-e (não emite a nota — apenas registra)
create table public.invoice_references (
  id           uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete restrict,
  collection_id uuid not null,
  number       text not null check (length(trim(number)) between 1 and 32),
  series       text not null check (length(trim(series)) between 1 and 10),
  issued_at    date not null,
  total_brl    numeric(14,2) not null check (total_brl > 0),
  notes        text check (notes is null or length(trim(notes)) <= 1000),
  created_by   uuid not null default auth.uid() references public.profiles(user_id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (organization_id, series, number),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

-- 4. Itens entregues por entrega parcial (reaproveita assinatura do cliente já existente)
create table public.delivery_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  bigint not null references public.organizations(id) on delete restrict,
  collection_id    uuid not null,
  collection_item_id uuid not null,
  quantity         numeric(12,3) not null check (quantity > 0),
  created_at       timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict,
  foreign key (collection_item_id, collection_id, organization_id)
    references public.collection_items(id, collection_id, organization_id) on delete restrict
);

-- 5. RPCs de transição (security definer, validam transição + row_version)
-- Todas compartilham: auth.uid() como ator, current_user_is_admin, row_version otimista,
-- gravação de evento append-only em collection_events (metadata com dados do comando).
-- Seguem o padrão de finalize_collection (15/08): errcode 42501 not_authorized,
-- P0001 para violação de negócio, 40001 stale_version.

-- 5a. Check-in de oficina (O02): collected -> in_workshop
create or replace function public.workshop_check_in(
  p_collection_id uuid,
  p_expected_version integer,
  p_administrator_name text,
  p_administrator_tax_id text,
  p_items jsonb,
  p_signature text
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
  item_record record;
  item_exists boolean;
begin
  if actor_id is null or p_expected_version < 1
    or length(trim(coalesce(p_administrator_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_administrator_tax_id, ''))
    or length(trim(coalesce(p_signature, ''))) < 10
    or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_workshop_checkin_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status <> 'collected' then
    raise exception using errcode = 'P0001', message = 'collection_not_collected';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  for item_record in select * from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    item_description text,
    quantity_observed numeric,
    condition_observed text,
    divergence_notes text
  ) loop
    if length(trim(coalesce(item_record.item_description, ''))) < 1
      or item_record.quantity_observed is null or item_record.quantity_observed <= 0
      or length(trim(coalesce(item_record.condition_observed, ''))) < 1 then
      raise exception using errcode = 'P0001', message = 'invalid_workshop_item';
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
    insert into public.workshop_checkin_items (
      organization_id, collection_id, collection_item_id,
      quantity_observed, condition_observed, divergence_notes
    ) values (
      collection_record.organization_id, p_collection_id, item_record.item_id,
      item_record.quantity_observed, item_record.condition_observed,
      nullif(trim(item_record.divergence_notes), '')
    );
  end loop;

  next_version := collection_record.row_version + 1;
  update public.collections
    set status = 'in_workshop', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.workshop.checked_in', 'collected', 'in_workshop',
    jsonb_build_object(
      'row_version', next_version,
      'administrator_name', p_administrator_name,
      'administrator_tax_id', p_administrator_tax_id,
      'signature', p_signature
    )
  );

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'in_workshop',
    'rowVersion', next_version,
    'administratorName', p_administrator_name
  );
end;
$$;

-- 5b. Orçamento técnico (O03): in_workshop -> in_budget
create or replace function public.create_technical_budget(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb,
  p_general_notes text
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
  total_labor numeric(12,2) := 0;
  total_parts numeric(12,2) := 0;
  budget_id uuid;
  item_record record;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_budget_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
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
    labor_brl, parts_brl, due_days, status
  ) values (
    budget_id, collection_record.organization_id, p_collection_id, actor_id,
    total_labor, total_parts, (select max(estimated_days) from public.service_order_items where collection_id = p_collection_id), 'budgeted'
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

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'in_budget',
    'rowVersion', next_version,
    'serviceOrderId', budget_id
  );
end;
$$;

-- 5c. Aprovação / rejeição de orçamento (M13): in_budget -> approved | rejected
create or replace function public.approve_technical_budget(
  p_collection_id uuid,
  p_expected_version integer,
  p_approved boolean,
  p_rejection_reason text,
  p_signer_name text,
  p_signer_tax_id text
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
  next_version integer;
  next_status text;
begin
  if actor_id is null or p_expected_version < 1
    or p_approved is null
    or length(trim(coalesce(p_signer_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_signer_tax_id, ''))
    or (not p_approved and length(trim(coalesce(p_rejection_reason, ''))) < 5) then
    raise exception using errcode = 'P0001', message = 'invalid_approval_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status <> 'in_budget' then
    raise exception using errcode = 'P0001', message = 'collection_not_in_budget';
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

  next_version := collection_record.row_version + 1;
  next_status := case when p_approved then 'approved' else 'rejected' end;

  update public.service_orders
    set approval_signer_name = p_signer_name,
        approval_signer_tax_id = p_signer_tax_id,
        status = next_status
  where id = service_order_record.id;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.budget.' || case when p_approved then 'approved' else 'rejected' end,
    'in_budget', next_status,
    jsonb_build_object(
      'row_version', next_version,
      'approved', p_approved,
      'rejectionReason', case when not p_approved then p_rejection_reason else null end,
      'signerName', p_signer_name
    )
  );

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', next_status,
    'rowVersion', next_version,
    'serviceOrderId', service_order_record.id
  );
end;
$$;

-- 5d. Progresso de reparo (M14): approved -> in_service -> ready
create or replace function public.update_service_progress(
  p_collection_id uuid,
  p_expected_version integer,
  p_items jsonb
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
  next_version integer;
  any_ready boolean := false;
  all_ready boolean := true;
  item_record record;
  item_found boolean;
begin
  if actor_id is null or p_expected_version < 1
    or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_progress_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
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
    where id = item_record.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'service_order_item_not_found';
    end if;
    update public.service_order_items
      set status = item_record.status,
          notes = nullif(trim(item_record.notes), '')
    where id = item_record.item_id;
    if item_record.status = 'pronto' then
      any_ready := true;
    else
      all_ready := false;
    end if;
  end loop;

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

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', (select status from public.collections where id = p_collection_id),
    'rowVersion', next_version,
    'serviceOrderId', service_order_record.id
  );
end;
$$;

-- 5e. Referência de NF-e (M15): ready -> invoiced
create or replace function public.register_invoice_reference(
  p_collection_id uuid,
  p_expected_version integer,
  p_number text,
  p_series text,
  p_issued_at date,
  p_total_brl numeric,
  p_notes text
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
  invoice_id uuid;
begin
  if actor_id is null or p_expected_version < 1
    or length(trim(coalesce(p_number, ''))) < 1
    or length(trim(coalesce(p_series, ''))) < 1
    or p_issued_at is null
    or p_total_brl <= 0 then
    raise exception using errcode = 'P0001', message = 'invalid_invoice_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'collection_not_ready';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  invoice_id := gen_random_uuid();
  insert into public.invoice_references (
    id, organization_id, collection_id, number, series, issued_at, total_brl, notes, created_by
  ) values (
    invoice_id, collection_record.organization_id, p_collection_id,
    p_number, p_series, p_issued_at, p_total_brl,
    nullif(trim(p_notes), ''), actor_id
  );

  next_version := collection_record.row_version + 1;
  update public.collections
    set status = 'invoiced', row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.invoice.registered', 'ready', 'invoiced',
    jsonb_build_object(
      'row_version', next_version,
      'invoiceId', invoice_id,
      'number', p_number,
      'series', p_series,
      'issuedAt', p_issued_at::text,
      'totalBrl', p_total_brl
    )
  );

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', 'invoiced',
    'rowVersion', next_version,
    'invoiceId', invoice_id
  );
end;
$$;

-- 5f. Entrega de cliente (O04): invoiced -> partial_delivery | delivered
create or replace function public.deliver_to_customer(
  p_collection_id uuid,
  p_expected_version integer,
  p_delivered_item_ids uuid[],
  p_receiver_name text,
  p_receiver_tax_id text,
  p_notes text,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  order_record public.service_orders%rowtype;
  next_version integer;
  next_status text;
  item record;
  item_exists boolean;
  remaining integer;
begin
  if actor_id is null or p_expected_version < 1
    or array_length(p_delivered_item_ids, 1) < 1
    or length(trim(coalesce(p_receiver_name, ''))) < 2
    or not private.is_valid_cpf_cnpj(coalesce(p_receiver_tax_id, ''))
    or length(trim(coalesce(p_signature, ''))) < 10 then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.status not in ('invoiced', 'partial_delivery') then
    raise exception using errcode = 'P0001', message = 'collection_not_invoiced';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  for item in select unnest(p_delivered_item_ids) as item_id loop
    select 1 into item_exists
    from public.collection_items
    where id = item.item_id
      and collection_id = p_collection_id
      and organization_id = collection_record.organization_id
      and removed_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'collection_item_not_found';
    end if;
    insert into public.delivery_items (
      organization_id, collection_id, collection_item_id, quantity
    ) select collection_record.organization_id, p_collection_id, item.item_id, quantity
      from public.collection_items
      where id = item.item_id
        and collection_id = p_collection_id
        and organization_id = collection_record.organization_id;
  end loop;

  select * into order_record
  from public.service_orders
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
  for update;

  select count(*) into remaining
  from public.collection_items
  where collection_id = p_collection_id
    and organization_id = collection_record.organization_id
    and removed_at is null
    and id not in (
      select collection_item_id from public.delivery_items
      where collection_id = p_collection_id
        and organization_id = collection_record.organization_id
    );

  next_version := collection_record.row_version + 1;
  next_status := case when remaining = 0 then 'delivered' else 'partial_delivery' end;

  if order_record.id is not null then
    update public.service_orders set status = 'ready' where id = order_record.id;
  end if;
  update public.collections
    set status = next_status, row_version = next_version, updated_by = actor_id
  where id = p_collection_id;

  insert into public.collection_events (
    organization_id, collection_id, actor_user_id,
    event_type, previous_status, new_status, metadata
  ) values (
    collection_record.organization_id, p_collection_id, actor_id,
    'collection.delivered', collection_record.status, next_status,
    jsonb_build_object(
      'row_version', next_version,
      'deliveredItemIds', p_delivered_item_ids,
      'receiverName', p_receiver_name,
      'receiverTaxId', p_receiver_tax_id,
      'signature', p_signature,
      'notes', nullif(trim(p_notes), ''),
      'partial', remaining > 0
    )
  );

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', next_status,
    'rowVersion', next_version,
    'delivered', true,
    'partial', remaining > 0
  );
end;
$$;

-- 5g. Cancelamento / reabertura (O05) com motivo e auditoria
create or replace function public.cancel_or_reopen_collection(
  p_collection_id uuid,
  p_expected_version integer,
  p_action text,
  p_reason text
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
begin
  if actor_id is null or p_expected_version < 1
    or p_action not in ('cancel', 'reopen')
    or length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = 'P0001', message = 'invalid_cancel_reopen_request';
  end if;

  select * into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  if p_action = 'cancel' then
    if collection_record.status in ('delivered', 'canceled') then
      raise exception using errcode = 'P0001', message = 'collection_cannot_be_canceled';
    end if;
    update public.collections
      set status = 'canceled', row_version = collection_record.row_version + 1,
          canceled_at = now(), canceled_by = actor_id, cancel_reason = p_reason,
          previous_status_before_cancellation = collection_record.status
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    insert into public.collection_events (
      organization_id, collection_id, actor_user_id,
      event_type, previous_status, new_status, reason
    ) values (
      collection_record.organization_id, p_collection_id, actor_id,
      'collection.canceled', collection_record.status, 'canceled', p_reason
    );
  else
    if collection_record.status <> 'canceled' then
      raise exception using errcode = 'P0001', message = 'collection_not_canceled';
    end if;
    update public.collections
      set status = collection_record.previous_status_before_cancellation,
          row_version = collection_record.row_version + 1,
          reopened_at = now(), reopened_by = actor_id, reopen_reason = p_reason,
          canceled_at = null, canceled_by = null, cancel_reason = null,
          previous_status_before_cancellation = null
    where id = p_collection_id;
    next_version := collection_record.row_version + 1;
    insert into public.collection_events (
      organization_id, collection_id, actor_user_id,
      event_type, previous_status, new_status, reason
    ) values (
      collection_record.organization_id, p_collection_id, actor_id,
      'collection.reopened', 'canceled', collection_record.previous_status_before_cancellation, p_reason
    );
  end if;

  return jsonb_build_object(
    'collectionId', p_collection_id,
    'status', (select status from public.collections where id = p_collection_id),
    'rowVersion', next_version
  );
end;
$$;

-- 6. Tabela de itens do orçamento (detalha cada item do serviço)
create table public.service_order_items (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    bigint not null references public.organizations(id) on delete restrict,
  collection_id      uuid not null,
  collection_item_id uuid,
  labor_cost_brl     numeric(12,2) not null check (labor_cost_brl >= 0),
  parts_cost_brl     numeric(12,2) not null check (parts_cost_brl >= 0),
  estimated_days     integer not null check (estimated_days between 1 and 90),
  status             text not null default 'em_reparo' check (status in ('em_reparo', 'pronto')),
  notes              text check (notes is null or length(trim(notes)) <= 1000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict,
  foreign key (collection_item_id, collection_id, organization_id)
    references public.collection_items(id, collection_id, organization_id) on delete restrict
);

-- 7. Tabela de itens do check-in de oficina (conferência item a item)
create table public.workshop_checkin_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     bigint not null references public.organizations(id) on delete restrict,
  collection_id       uuid not null,
  collection_item_id  uuid not null,
  quantity_observed   numeric(12,3) not null check (quantity_observed > 0),
  condition_observed  text not null check (length(trim(condition_observed)) between 1 and 1000),
  divergence_notes    text check (divergence_notes is null or length(trim(divergence_notes)) <= 1000),
  created_at          timestamptz not null default now(),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict,
  foreign key (collection_item_id, collection_id, organization_id)
    references public.collection_items(id, collection_id, organization_id) on delete restrict
);

-- 8. RLS + Grants: replica política admin da Fase 1A em todas as novas tabelas/RPCs
alter table public.service_orders enable row level security;
create policy service_orders_admin_all
on public.service_orders for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

alter table public.invoice_references enable row level security;
create policy invoice_references_admin_all
on public.invoice_references for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

alter table public.delivery_items enable row level security;
create policy delivery_items_admin_all
on public.delivery_items for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

alter table public.service_order_items enable row level security;
create policy service_order_items_admin_all
on public.service_order_items for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

alter table public.workshop_checkin_items enable row level security;
create policy workshop_checkin_items_admin_all
on public.workshop_checkin_items for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

grant select, insert, update on public.service_orders to authenticated;
grant select, insert, update on public.invoice_references to authenticated;
grant select, insert, update on public.delivery_items to authenticated;
grant select, insert, update on public.service_order_items to authenticated;
grant select, insert, update on public.workshop_checkin_items to authenticated;

grant execute on function public.workshop_check_in to authenticated;
grant execute on function public.create_technical_budget to authenticated;
grant execute on function public.approve_technical_budget to authenticated;
grant execute on function public.update_service_progress to authenticated;
grant execute on function public.register_invoice_reference to authenticated;
grant execute on function public.deliver_to_customer to authenticated;
grant execute on function public.cancel_or_reopen_collection to authenticated;
