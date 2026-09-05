-- Wave 3 leftover #5: authenticated admin retry for document render jobs.

create or replace function public.retry_document_job(
  p_collection_id uuid,
  p_document_id uuid,
  p_job_type text default 'render_pdf'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_record public.documents%rowtype;
  v_job_record public.document_jobs%rowtype;
  v_artifact_type text;
  v_has_artifact boolean;
begin
  if p_job_type not in ('render_pdf', 'render_qr') then
    raise exception using errcode = '22023', message = 'document_job_type_invalid';
  end if;

  v_artifact_type := replace(p_job_type, 'render_', '');

  select doc_row.* into v_document_record
  from public.documents as doc_row
  where doc_row.id = p_document_id
    and doc_row.collection_id = p_collection_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'document_not_found';
  end if;

  if auth.uid() is not null
    and not private.current_user_is_admin(v_document_record.organization_id)
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  select exists (
    select 1
    from public.document_artifacts as artifact_row
    where artifact_row.document_id = v_document_record.id
      and artifact_row.artifact_type = v_artifact_type
  ) into v_has_artifact;

  if v_has_artifact then
    select job_row.* into v_job_record
    from public.document_jobs as job_row
    where job_row.document_id = p_document_id
      and job_row.job_type = p_job_type;

    return jsonb_build_object(
      'jobId', v_job_record.id,
      'documentId', p_document_id,
      'jobType', p_job_type,
      'status', 'succeeded',
      'alreadyReady', true
    );
  end if;

  select job_row.* into v_job_record
  from public.document_jobs as job_row
  where job_row.document_id = p_document_id
    and job_row.job_type = p_job_type
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'document_job_not_found';
  end if;

  if v_job_record.status = 'running' and v_job_record.leased_until > now() then
    raise exception using errcode = 'P0001', message = 'document_job_in_progress';
  end if;

  if v_job_record.status = 'running' and v_job_record.leased_until <= now() then
    return jsonb_build_object(
      'jobId', v_job_record.id,
      'documentId', p_document_id,
      'jobType', p_job_type,
      'status', 'queued',
      'alreadyReady', false
    );
  end if;

  if v_job_record.status = 'queued' and v_job_record.available_at <= now() then
    return jsonb_build_object(
      'jobId', v_job_record.id,
      'documentId', p_document_id,
      'jobType', p_job_type,
      'status', 'queued',
      'alreadyReady', false
    );
  end if;

  if v_job_record.status = 'queued' and v_job_record.available_at > now() then
    update public.document_jobs as job_row
    set available_at = now()
    where job_row.id = v_job_record.id;

    return jsonb_build_object(
      'jobId', v_job_record.id,
      'documentId', p_document_id,
      'jobType', p_job_type,
      'status', 'queued',
      'alreadyReady', false
    );
  end if;

  if v_job_record.status = 'failed'
    or (v_job_record.status = 'succeeded' and not v_has_artifact) then
    update public.document_jobs as job_row
    set status = 'queued',
        attempt_count = 0,
        available_at = now(),
        lease_token = null,
        leased_until = null,
        claimed_at = null,
        claimed_by = null,
        completed_at = null,
        last_error_code = null,
        last_error_message = null
    where job_row.id = v_job_record.id;

    return jsonb_build_object(
      'jobId', v_job_record.id,
      'documentId', p_document_id,
      'jobType', p_job_type,
      'status', 'queued',
      'alreadyReady', false
    );
  end if;

  return jsonb_build_object(
    'jobId', v_job_record.id,
    'documentId', p_document_id,
    'jobType', p_job_type,
    'status', v_job_record.status,
    'alreadyReady', false
  );
end;
$$;

revoke all on function public.retry_document_job(uuid, uuid, text) from public;
revoke all on function public.retry_document_job(uuid, uuid, text) from anon;
grant execute on function public.retry_document_job(uuid, uuid, text) to authenticated, service_role;
