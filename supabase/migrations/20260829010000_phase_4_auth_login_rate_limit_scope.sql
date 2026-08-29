-- Fase 4 Chat 3 residual: permitir scope auth_login no rate limit.
-- Aditiva: CREATE OR REPLACE da mesma RPC; nao apaga dados nem janelas.
-- O app (signInAction) envia p_scope = 'auth_login' desde o Chat 3, mas a
-- allowlist da Fase 2 nao incluia esse valor — toda tentativa de login
-- falhava fechada com document_rate_limit_scope_invalid.

create or replace function public.consume_document_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  window_start_value timestamptz;
  window_record private.document_rate_limit_windows%rowtype;
begin
  if p_scope not in (
    'public_verification',
    'document_share_create',
    'document_email_administrator',
    'document_email_organization',
    'document_share_download',
    'auth_login'
  ) then
    raise exception using errcode = '22023', message = 'document_rate_limit_scope_invalid';
  end if;
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'document_rate_limit_subject_invalid';
  end if;
  if p_window_seconds not between 60 and 86400 then
    raise exception using errcode = '22023', message = 'document_rate_limit_window_invalid';
  end if;
  if p_limit not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'document_rate_limit_limit_invalid';
  end if;

  window_start_value := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds
  );

  -- Limpeza é deliberadamente pequena e concorrente; falhas de limpeza nunca
  -- ampliam o acesso. A TTL da própria janela mantém os dados pseudônimos
  -- minimizados quando não houver tráfego posterior.
  delete from private.document_rate_limit_windows as stale_window
  where stale_window.ctid in (
    select candidate.ctid
    from private.document_rate_limit_windows as candidate
    where candidate.expires_at <= observed_at
    order by candidate.expires_at
    limit 100
    for update skip locked
  );

  insert into private.document_rate_limit_windows (
    scope, subject_hash, window_seconds, window_started_at, expires_at,
    request_count
  ) values (
    p_scope, p_subject_hash, p_window_seconds, window_start_value,
    window_start_value + make_interval(secs => p_window_seconds), 1
  )
  on conflict (scope, subject_hash, window_seconds, window_started_at)
  do update
  set request_count = private.document_rate_limit_windows.request_count + 1,
      updated_at = observed_at
  where private.document_rate_limit_windows.request_count < p_limit
  returning * into window_record;

  if found then
    return query select true, 0::integer;
    return;
  end if;

  select * into window_record
  from private.document_rate_limit_windows
  where scope = p_scope
    and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds
    and window_started_at = window_start_value;
  if not found then
    raise exception using errcode = 'P0001', message = 'document_rate_limit_window_missing';
  end if;

  return query select
    false,
    greatest(1, ceil(extract(epoch from window_record.expires_at - observed_at))::integer);
end;
$$;

revoke execute on function public.consume_document_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_document_rate_limit(text, text, integer, integer) to service_role;
