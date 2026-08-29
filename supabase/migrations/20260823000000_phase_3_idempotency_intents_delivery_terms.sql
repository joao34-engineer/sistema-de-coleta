-- Fase 3b: idempotência, intents de assinatura de oficina/entrega e termos de entrega formais.
-- Esta migration é ADITIVA: não apaga, reseta ou modifica dados existentes.
-- Amplia a tabela de idempotência, cria intents privados para assinaturas de oficina/entrega,
-- cria tabelas imutáveis de termos de entrega e estende as políticas de Storage.

-- 1. Ampliação aditiva do CHECK de operation em idempotency_requests
--    Usa DROP/CREATE sobre o constraint existente (mesma técnica da migration 3a para collections_status_check).
--    Sem DROP de dados: apenas ampliamos a lista de operações permitidas.
alter table public.idempotency_requests
  drop constraint if exists idempotency_requests_operation_check;
alter table public.idempotency_requests
  add constraint idempotency_requests_operation_check
  check (operation in (
    'finalize', 'cancel', 'reopen', 'revise',
    'workshop_check_in', 'save_technical_budget', 'budget_approval',
    'update_service_progress', 'register_invoice_reference', 'customer_delivery',
    'cancel_collection', 'reopen_collection'
  ));

-- 2. Coluna de referência de assinatura no check-in de oficina (storage path)
--    service_orders não possui check_in_signature_path na 3a; adicionamos aqui, nullable,
--    para que a policy de leitura de Storage resolva o caminho da assinatura do check-in.
--    O formato do storage_path no bucket collection-signatures é: org_id/collection_uuid/intent_uuid.png
--    onde intent_uuid usa o padrão simplificado [0-9a-f-]{36} adotado na 1a.
alter table public.service_orders
  add column if not exists check_in_signature_path text
  check (check_in_signature_path is null or check_in_signature_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$');

-- 3. Tabela de intents privados de assinatura de oficina/entrega
--    Espelha private.collection_upload_intents, mas com kind restringido a
--    ('workshop_check_in', 'delivery_term') e PNG obrigatório.
create table if not exists private.delivery_signature_intents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  bigint not null references public.organizations(id) on delete restrict,
  collection_id    uuid not null,
  kind             text not null check (kind in ('workshop_check_in', 'delivery_term')),
  storage_path     text not null unique check (storage_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'),
  content_type     text not null check (content_type = 'image/png'),
  byte_size        integer not null check (byte_size between 1 and 2097152),
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  expected_version integer not null check (expected_version > 0),
  signer_name      text not null check (length(trim(signer_name)) between 1 and 160),
  signer_tax_id    text not null check (private.is_valid_cpf_cnpj(signer_tax_id)),
  acceptance_text  text not null check (length(trim(acceptance_text)) between 1 and 2000),
  status           text not null default 'pending' check (status in ('pending', 'committed', 'canceled', 'expired')),
  expires_at       timestamptz not null,
  created_by       uuid not null references public.profiles(user_id) on delete restrict,
  created_at       timestamptz not null default now(),
  committed_at     timestamptz,
  canceled_at      timestamptz,
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create index if not exists delivery_signature_intents_cleanup_idx
  on private.delivery_signature_intents (status, expires_at);

-- 4. Tabelas imutáveis de termos de entrega formal
--    delivery_terms é o cabeçalho (imutável após criação); delivery_term_items são os itens.
create table if not exists public.delivery_terms (
  id               uuid primary key default gen_random_uuid(),
  organization_id  bigint not null references public.organizations(id) on delete restrict,
  collection_id    uuid not null,
  service_order_id uuid references public.service_orders(id) on delete restrict,
  receiver_name    text not null check (length(trim(receiver_name)) between 1 and 160),
  receiver_tax_id  text not null check (private.is_valid_cpf_cnpj(receiver_tax_id)),
  signature_path   text not null check (signature_path ~ '^[0-9]+/[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'),
  notes            text check (notes is null or length(trim(notes)) <= 1000),
  created_by       uuid not null references public.profiles(user_id) on delete restrict,
  created_at       timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, collection_id),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict
);

create table if not exists public.delivery_term_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   bigint not null references public.organizations(id) on delete restrict,
  delivery_term_id  uuid not null references public.delivery_terms(id) on delete cascade,
  collection_item_id uuid not null,
  collection_id     uuid not null,
  quantity          numeric(12,3) not null check (quantity > 0),
  created_at        timestamptz not null default now(),
  unique (organization_id, collection_id, collection_item_id),
  foreign key (collection_id, organization_id) references public.collections(id, organization_id) on delete restrict,
  foreign key (collection_item_id, collection_id, organization_id)
    references public.collection_items(id, collection_id, organization_id) on delete restrict,
  foreign key (delivery_term_id, organization_id) references public.delivery_terms(id, organization_id) on delete restrict
);

create index if not exists delivery_terms_collection_idx
  on public.delivery_terms (organization_id, collection_id);
create index if not exists delivery_term_items_term_idx
  on public.delivery_term_items (organization_id, delivery_term_id);

-- 5. Trigger de imutabilidade sobre delivery_terms (antes de UPDATE/DELETE)
--    Reaproveita o helper private.prevent_immutable_record_mutation da 1a.
drop trigger if exists delivery_terms_are_immutable on public.delivery_terms;
create trigger delivery_terms_are_immutable
before update or delete on public.delivery_terms
for each row execute function private.prevent_immutable_record_mutation();

-- 6. RPCs privadas de lifecycle de delivery_signature_intents
--    prepare_delivery_signature_intent / commit_delivery_signature_intent / cancel_delivery_signature_intent
--    Espelham prepare_collection_upload / commit_collection_upload / cancel_collection_upload,
--    mas com validação de kind ('workshop_check_in' | 'delivery_term') e bucket 'collection-signatures'.

create or replace function private.prepare_delivery_signature_intent(
  p_collection_id   uuid,
  p_expected_version integer,
  p_kind            text,
  p_signer_name     text,
  p_signer_tax_id   text,
  p_acceptance_text text,
  p_sha256          text,
  p_byte_size       integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id          uuid := (select auth.uid());
  collection_record public.collections%rowtype;
  intent_id         uuid := extensions.gen_random_uuid();
  storage_path_value text;
  expires_at_value  timestamptz := now() + interval '15 minutes';
begin
  if actor_id is null or p_expected_version < 1
    or p_kind not in ('workshop_check_in', 'delivery_term')
    or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_byte_size not between 1 and 2097152
    or length(trim(coalesce(p_signer_name, ''))) not between 1 and 160
    or not private.is_valid_cpf_cnpj(coalesce(p_signer_tax_id, ''))
    or length(trim(coalesce(p_acceptance_text, ''))) not between 1 and 2000 then
    raise exception using errcode = 'P0001', message = 'invalid_delivery_signature_request';
  end if;

  select *
    into collection_record
  from public.collections
  where id = p_collection_id
  for update;
  if not found or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  -- workshop_check_in exige status 'collected'; delivery_term exige 'invoiced' ou 'partial_delivery'
  if p_kind = 'workshop_check_in' and collection_record.status <> 'collected' then
    raise exception using errcode = 'P0001', message = 'collection_not_collected';
  end if;
  if p_kind = 'delivery_term' and collection_record.status not in ('invoiced', 'partial_delivery') then
    raise exception using errcode = 'P0001', message = 'collection_not_invoiced';
  end if;
  if collection_record.row_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  -- storage_path herda o formato org_id/collection_id/uuid.png do bucket collection-signatures
  storage_path_value := format('%s/%s/%s.png', collection_record.organization_id, collection_record.id, intent_id);

  insert into private.delivery_signature_intents (
    id, organization_id, collection_id, kind,
    storage_path, content_type, byte_size, sha256, expected_version,
    signer_name, signer_tax_id, acceptance_text,
    expires_at, created_by
  )
  values (
    intent_id, collection_record.organization_id, collection_record.id, p_kind,
    storage_path_value, 'image/png', p_byte_size, p_sha256, p_expected_version,
    nullif(trim(p_signer_name), ''), p_signer_tax_id, nullif(trim(p_acceptance_text), ''),
    expires_at_value, actor_id
  );

  return jsonb_build_object(
    'intentId', intent_id,
    'collectionId', collection_record.id,
    'kind', p_kind,
    'bucketId', 'collection-signatures',
    'storagePath', storage_path_value,
    'contentType', 'image/png',
    'byteSize', p_byte_size,
    'sha256', p_sha256,
    'expectedVersion', p_expected_version,
    'expiresAt', expires_at_value
  );
end;
$$;

create or replace function private.commit_delivery_signature_intent(
  p_intent_id      uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id          uuid := (select auth.uid());
  intent_record     private.delivery_signature_intents%rowtype;
  collection_record public.collections%rowtype;
begin
  if actor_id is null or p_expected_version < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_expected_version';
  end if;

  select *
    into intent_record
  from private.delivery_signature_intents
  where id = p_intent_id
  for update;

  if not found or intent_record.created_by <> actor_id then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if intent_record.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'upload_intent_not_pending';
  end if;
  if intent_record.expires_at <= now() then
    update private.delivery_signature_intents
      set status = 'expired', canceled_at = now()
    where id = p_intent_id;
    raise exception using errcode = 'P0001', message = 'upload_intent_expired';
  end if;

  select *
    into collection_record
  from public.collections
  where id = intent_record.collection_id
  for update;

  if not found or collection_record.organization_id <> intent_record.organization_id
    or not private.current_user_is_admin(collection_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if collection_record.row_version <> p_expected_version
    or intent_record.expected_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_version';
  end if;

  -- O arquivo deve estar presente no Storage antes do commit (mesmo padrão da 1a).
  if not exists (
    select 1
    from storage.objects as storage_object
    where storage_object.bucket_id = 'collection-signatures'
      and storage_object.name = intent_record.storage_path
  ) then
    raise exception using errcode = 'P0001', message = 'signature_object_missing';
  end if;

  update private.delivery_signature_intents
    set status = 'committed', committed_at = now()
  where id = p_intent_id;

  return jsonb_build_object(
    'intentId', intent_record.id,
    'kind', intent_record.kind,
    'storagePath', intent_record.storage_path
  );
end;
$$;

create or replace function private.cancel_delivery_signature_intent(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id      uuid := (select auth.uid());
  intent_record private.delivery_signature_intents%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  select *
    into intent_record
  from private.delivery_signature_intents
  where id = p_intent_id
  for update;
  if not found or intent_record.created_by <> actor_id
    or not private.current_user_is_admin(intent_record.organization_id) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if intent_record.status = 'committed' then
    raise exception using errcode = 'P0001', message = 'upload_already_committed';
  end if;
  if intent_record.status = 'pending' then
    update private.delivery_signature_intents
      set status = 'canceled', canceled_at = now()
    where id = p_intent_id;
    intent_record.status := 'canceled';
  end if;
  return jsonb_build_object(
    'intentId', p_intent_id,
    'kind', intent_record.kind,
    'status', intent_record.status
  );
end;
$$;

-- RPCs públicos de lifecycle de delivery_signature_intents (segurança via RPCs private + policy de Storage)
create or replace function public.prepare_delivery_signature_intent(
  p_collection_id   uuid,
  p_expected_version integer,
  p_kind            text,
  p_signer_name     text,
  p_signer_tax_id   text,
  p_acceptance_text text,
  p_sha256          text,
  p_byte_size       integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.prepare_delivery_signature_intent(
    p_collection_id, p_expected_version, p_kind,
    p_signer_name, p_signer_tax_id, p_acceptance_text, p_sha256, p_byte_size
  );
$$;

create or replace function public.commit_delivery_signature_intent(
  p_intent_id      uuid,
  p_expected_version integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.commit_delivery_signature_intent(p_intent_id, p_expected_version);
$$;

create or replace function public.cancel_delivery_signature_intent(p_intent_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.cancel_delivery_signature_intent(p_intent_id);
$$;

grant execute on function public.prepare_delivery_signature_intent to authenticated;
grant execute on function public.commit_delivery_signature_intent to authenticated;
grant execute on function public.cancel_delivery_signature_intent to authenticated;

-- 7. Extensão do cleanup de intents para delivery_signature_intents
--    Replica a política de expire_collection_upload_intents (15 min) sobre os novos intents.
create or replace function private.expire_delivery_signature_intents()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.delivery_signature_intents
    set status = 'expired', canceled_at = now()
  where status = 'pending'
    and expires_at <= now();
end;
$$;

-- 8. RLS + Grants sobre as novas tabelas públicas
alter table public.delivery_terms enable row level security;
drop policy if exists delivery_terms_admin_all on public.delivery_terms;
create policy delivery_terms_admin_all
on public.delivery_terms for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

alter table public.delivery_term_items enable row level security;
drop policy if exists delivery_term_items_admin_all on public.delivery_term_items;
create policy delivery_term_items_admin_all
on public.delivery_term_items for all to authenticated
using (private.current_user_is_admin(organization_id))
with check (private.current_user_is_admin(organization_id));

-- service_orders já tem RLS na 3a; reforçamos o grant de update sobre check_in_signature_path
grant select on public.delivery_terms, public.delivery_term_items to authenticated;
grant update (check_in_signature_path) on public.service_orders to authenticated;

-- 9. Storage policies para assinaturas de workshop/check-in e delivery_term
--    READ: usa current_user_can_access_collection para resolver org a partir do collection_id
--    embutido no storage_path (org_id/collection_uuid/intent_uuid.png).
drop policy if exists collection_signatures_read_delivery_or_checkin on storage.objects;
create policy collection_signatures_read_delivery_or_checkin
on storage.objects for select to authenticated
using (
  bucket_id = 'collection-signatures'
  and split_part(name, '/', 1) ~ '^[0-9]+$'
  and (
    -- assinatura de coleta já registrada na tabela signatures
    exists (
      select 1 from public.signatures as signature_record
      where signature_record.organization_id = split_part(name, '/', 1)::bigint
        and signature_record.storage_path = name
    )
    -- assinatura de check-in já registrada em service_orders.check_in_signature_path
    or exists (
      select 1 from public.service_orders as order_record
      where order_record.organization_id = split_part(name, '/', 1)::bigint
        and order_record.check_in_signature_path = name
    )
    -- assinatura de delivery_term commitada via delivery_signature_intents
    or exists (
      select 1 from private.delivery_signature_intents as intent_record
      where intent_record.organization_id = split_part(name, '/', 1)::bigint
        and intent_record.storage_path = name
        and intent_record.status = 'committed'
    )
    -- assinatura de coleta já registrada via collection_upload_intents committed
    or exists (
      select 1 from private.collection_upload_intents as upload_intent
      where upload_intent.organization_id = split_part(name, '/', 1)::bigint
        and upload_intent.storage_path = name
        and upload_intent.status = 'committed'
    )
  )
);

--    INSERT: só via intent pending (delivery_signature_intents ou collection_upload_intents)
drop policy if exists collection_signatures_insert_delivery_intent on storage.objects;
create policy collection_signatures_insert_delivery_intent
on storage.objects for insert to authenticated
with check (
  bucket_id = 'collection-signatures'
  and (metadata->>'mimetype') = 'image/png'
  and (
    -- upload via delivery_signature_intent pending
    exists (
      select 1 from private.delivery_signature_intents as intent_record
      where intent_record.organization_id = split_part(name, '/', 1)::bigint
        and intent_record.storage_path = name
        and intent_record.status = 'pending'
        and intent_record.created_by = (select auth.uid())
    )
    -- upload via collection_upload_intent pending (assinatura de coleta)
    or private.current_user_can_upload_intent_path(
      bucket_id,
      case when split_part(name, '/', 1) ~ '^[0-9]+$' then split_part(name, '/', 1)::bigint else null end,
      split_part(name, '/', 2),
      name
    )
  )
);
