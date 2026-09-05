-- B28: read-only share inspection before signed URL mint and consume.
-- Does not increment download_count; row lock happens only in consume_document_share.

create or replace function public.inspect_document_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share_record public.document_shares%rowtype;
  document_record public.documents%rowtype;
begin
  if length(trim(coalesce(p_token, ''))) <> 64 or trim(p_token) !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('valid', false, 'code', 'share_token_invalid');
  end if;
  select share_row.* into share_record
  from public.document_shares as share_row
  where share_row.token_hash = encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('valid', false, 'code', 'share_not_found');
  end if;
  if share_record.revoked_at is not null or share_record.expires_at <= now() or share_record.download_count >= share_record.max_downloads then
    return jsonb_build_object('valid', false, 'code', 'share_unavailable');
  end if;
  select * into document_record from public.documents where id = share_record.document_id;
  if not exists (
    select 1
    from public.document_artifacts as artifact_record
    where artifact_record.document_id = document_record.id
      and artifact_record.artifact_type = 'pdf'
  ) then
    return jsonb_build_object('valid', false, 'code', 'share_unavailable');
  end if;
  return jsonb_build_object(
    'valid', true,
    'shareId', share_record.id,
    'shareType', share_record.share_type,
    'documentId', document_record.id,
    'organizationId', document_record.organization_id,
    'collectionId', document_record.collection_id,
    'documentVersion', document_record.version,
    'issuedAt', document_record.issued_at,
    'maxDownloads', share_record.max_downloads,
    'downloadCount', share_record.download_count
  );
end;
$$;

revoke all on function public.inspect_document_share(text) from public;
grant execute on function public.inspect_document_share(text) to anon, authenticated;
