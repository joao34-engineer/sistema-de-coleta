-- Fase 3 B25: peek + reset da janela de rate limit (login failure-only quota).
-- Aditiva: CREATE de duas RPCs novas; nao substitui consume_document_rate_limit.
-- Preserva janelas existentes e a allowlist com 'auth_login'.
-- consume continua o passo que grava; reset so e chamado apos login bem-sucedido.

create or replace function public.peek_document_rate_limit(
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

  select * into window_record
  from private.document_rate_limit_windows
  where scope = p_scope
    and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds
    and window_started_at = window_start_value;

  if not found or window_record.request_count < p_limit then
    return query select true, 0::integer;
    return;
  end if;

  return query select
    false,
    greatest(1, ceil(extract(epoch from window_record.expires_at - observed_at))::integer);
end;
$$;

create or replace function public.reset_document_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  window_start_value timestamptz;
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

  window_start_value := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds
  );

  delete from private.document_rate_limit_windows
  where scope = p_scope
    and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds
    and window_started_at = window_start_value;
end;
$$;

revoke execute on function public.peek_document_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.reset_document_rate_limit(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.peek_document_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.reset_document_rate_limit(text, text, integer) to service_role;
