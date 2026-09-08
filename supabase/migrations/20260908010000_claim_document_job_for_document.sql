-- Additive: claim the pdf/qr jobs of one document. The existing
-- claim_document_job(text, integer) FIFO remains for cron/retry-all.
-- Finalize/cancel/reopen/revise must not spend their in-process kick on
-- leftover jobs from another guia.

create or replace function public.claim_document_job_for_document(
  p_worker_id text,
  p_lease_seconds integer,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_jobs%rowtype;
  lease_value uuid;
  attempt_value integer;
  reclaimed_attempt_count integer;
begin
  if length(trim(coalesce(p_worker_id, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'worker_id_invalid';
  end if;
  if p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'lease_seconds_invalid';
  end if;
  if p_document_id is null then
    raise exception using errcode = '22023', message = 'document_id_invalid';
  end if;

  <<claim_loop>>
  loop
  select * into job_record
  from public.document_jobs
  where document_id = p_document_id
    and (
      (status = 'queued' and available_at <= now())
      or (status = 'running' and leased_until <= now())
    )
    and (status = 'running' or attempt_count < max_attempts)
  order by
    case when status = 'running' then leased_until else available_at end,
    created_at,
    id
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  if job_record.status = 'running' then
    update public.document_render_attempts
    set status = 'failed',
        error_code = 'document_job_lease_expired',
        error_message = 'Document render lease expired before completion.',
        completed_at = now()
    where job_id = job_record.id
      and attempt_number = job_record.attempt_count
      and lease_token = job_record.lease_token
      and status = 'started';
    get diagnostics reclaimed_attempt_count = row_count;
    if reclaimed_attempt_count <> 1 then
      raise exception using errcode = 'P0001', message = 'document_job_attempt_inconsistent';
    end if;

    if job_record.attempt_count >= job_record.max_attempts then
      update public.document_jobs
      set status = 'failed',
          lease_token = null,
          leased_until = null,
          claimed_at = null,
          claimed_by = null,
          completed_at = now(),
          last_error_code = 'document_job_lease_expired',
          last_error_message = 'Document render lease expired before completion.'
      where id = job_record.id;
      continue claim_loop;
    end if;
  end if;

  lease_value := extensions.gen_random_uuid();
  attempt_value := job_record.attempt_count + 1;
  update public.document_jobs
  set status = 'running',
      attempt_count = attempt_value,
      lease_token = lease_value,
      leased_until = now() + make_interval(secs => p_lease_seconds),
      claimed_at = now(),
      claimed_by = trim(p_worker_id),
      available_at = case when job_record.status = 'running' then now() else job_record.available_at end
  where id = job_record.id;

  insert into public.document_render_attempts (
    organization_id, job_id, document_id, attempt_number, status, worker_id,
    lease_token
  ) values (
    job_record.organization_id, job_record.id, job_record.document_id,
    attempt_value, 'started', trim(p_worker_id), lease_value
  );

  return jsonb_build_object(
    'jobId', job_record.id,
    'documentId', job_record.document_id,
    'jobType', job_record.job_type,
    'attemptNumber', attempt_value,
    'leaseToken', lease_value,
    'leaseExpiresAt', now() + make_interval(secs => p_lease_seconds)
  );
  end loop;
end;
$$;

revoke execute on function public.claim_document_job_for_document(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_document_job_for_document(text, integer, uuid) to service_role;
