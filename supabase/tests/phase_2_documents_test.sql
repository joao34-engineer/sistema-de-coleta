begin;
select plan(154);

select has_table('public', 'organization_brand_assets', 'brand assets table exists');
select has_table('public', 'document_issuer_profiles', 'issuer profiles table exists');
select has_table('public', 'document_artifacts', 'document artifacts table exists');
select has_table('public', 'document_jobs', 'document jobs table exists');
select has_table('public', 'document_render_attempts', 'render attempts table exists');
select has_table('private', 'document_render_upload_intents', 'render intents remain private');
select has_table('private', 'document_share_email_reservations', 'email reservations remain private');
select has_table('private', 'document_rate_limit_windows', 'rate-limit windows remain private');
select has_table('public', 'document_shares', 'document shares table exists');
select has_table('public', 'share_deliveries', 'share deliveries table exists');
select has_table('public', 'document_revisions', 'document revisions table exists');

select has_column('public', 'organization_settings', 'logo_asset_id', 'settings reference immutable brand asset');
select has_column('public', 'documents', 'issuer_profile_id', 'documents pin issuer profile');
select has_column('public', 'document_issuer_profiles', 'template_version', 'issuer profiles pin the receipt template version');
select has_column('public', 'document_issuer_profiles', 'profile_hash', 'issuer profiles carry a profile hash');
select has_column('public', 'document_jobs', 'lease_token', 'jobs carry a lease token');
select has_column('public', 'document_jobs', 'leased_until', 'jobs carry a lease expiry');
select is((select count(*)::integer from pg_constraint where conrelid = 'public.document_jobs'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%(document_id, job_type)%'), 1, 'jobs are unique per document and job type');
select has_column('public', 'document_shares', 'token_hash', 'shares store only token hashes');
select has_column('public', 'document_shares', 'max_downloads', 'shares carry a bounded download limit');
select has_column('public', 'document_shares', 'download_count', 'shares carry an atomic download counter');
select has_column('public', 'share_deliveries', 'idempotency_hash', 'email delivery ledger carries an idempotency hash without raw email/token');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'document_shares' and column_name = 'recipient_email'), 0, 'raw recipient email is not stored');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'document_shares' and column_name = 'one_time'), 0, 'legacy one-time flag is not stored');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'document_shares' and column_name = 'consumed_at'), 0, 'legacy consumed timestamp is not stored');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'document_shares' and column_name = 'max_downloads'), '20', 'share limit defaults to 20 downloads');
select is((select column_default like '%7 days%' from information_schema.columns where table_schema = 'public' and table_name = 'document_shares' and column_name = 'expires_at'), true, 'share expiry defaults to seven days');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'document_jobs' and column_name = 'max_attempts'), '5', 'document jobs always use exactly five attempts');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'document_artifacts' and column_name = 'status'), 0, 'artifact status is not mutable metadata');

select is((select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in ('organization_brand_assets', 'document_issuer_profiles', 'document_artifacts', 'document_jobs', 'document_render_attempts', 'document_shares', 'share_deliveries', 'document_revisions') and relrowsecurity), 8, 'all phase 2 public tables enable RLS');
select is((select count(*)::integer from pg_class where relnamespace = 'private'::regnamespace and relname = 'document_render_upload_intents' and relrowsecurity), 0, 'private intent is not exposed through Data API');
select is((select public from storage.buckets where id = 'collection-documents'), false, 'document storage remains private');
select is((select allowed_mime_types @> array['application/pdf', 'image/png']::text[] from storage.buckets where id = 'collection-documents'), true, 'document storage accepts PDF and QR PNG artifacts');
select is(has_table_privilege('anon', 'public.document_artifacts', 'select'), false, 'anon cannot read artifacts');
select is(has_table_privilege('authenticated', 'public.document_artifacts', 'insert'), false, 'authenticated cannot insert artifacts directly');
select is(has_table_privilege('authenticated', 'public.document_artifacts', 'update'), false, 'authenticated cannot mutate artifacts');
select is(has_table_privilege('authenticated', 'public.document_artifacts', 'delete'), false, 'authenticated cannot delete artifacts');
select is(has_table_privilege('authenticated', 'public.document_revisions', 'delete'), false, 'authenticated cannot delete revisions');
select is(has_table_privilege('authenticated', 'public.share_deliveries', 'insert'), false, 'authenticated cannot forge delivery history');

select has_function('public', 'validate_document_issuer_profile', array['bigint', 'uuid'], 'issuer validation RPC exists');
select has_function('public', 'save_company_issuer_settings', array['bigint', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid', 'text', 'text'], 'company issuer settings RPC exists');
select has_function('public', 'consume_document_rate_limit', array['text', 'text', 'integer', 'integer'], 'rate-limit RPC exists');
select has_function('public', 'claim_document_job', array['text', 'integer'], 'job claim RPC exists');
select has_function('public', 'claim_document_job_for_document', array['text', 'integer', 'uuid'], 'document-scoped job claim RPC exists');
select has_function('public', 'prepare_document_render_upload', array['uuid', 'uuid', 'text', 'text', 'integer', 'text'], 'render intent prepare RPC exists');
select has_function('public', 'commit_document_render_upload', array['uuid'], 'render intent commit RPC exists');
select has_function('public', 'cancel_document_render_upload', array['uuid'], 'render intent cancel RPC exists');
select has_function('public', 'cleanup_document_render_upload_intents', array['integer'], 'render intent cleanup RPC exists');
select has_function('public', 'ack_document_render_upload_cleanup', array['uuid'], 'render intent cleanup acknowledgement RPC exists');
select has_function('public', 'complete_document_job', array['uuid', 'uuid', 'text', 'uuid', 'text', 'text'], 'job completion RPC exists');
select has_function('public', 'create_document_share', array['uuid', 'text', 'timestamptz', 'integer'], 'share create RPC exists');
select has_function('public', 'revoke_document_share', array['uuid'], 'share revoke RPC exists');
select has_function('public', 'consume_document_share', array['text'], 'share consume RPC exists');
select has_function('public', 'reserve_document_share_email_delivery', array['uuid', 'text', 'integer'], 'email delivery reservation RPC exists');
select has_function('public', 'complete_document_share_email_delivery', array['uuid', 'uuid', 'text', 'text', 'text', 'text'], 'email delivery completion RPC exists');
select has_function('public', 'revise_collection_document', array['uuid', 'integer', 'jsonb', 'text', 'text', 'uuid', 'text'], 'typed document revision RPC exists');
select has_function('public', 'create_document_revision', array['uuid', 'uuid', 'text', 'text'], 'revision RPC exists');
select has_function('public', 'finalize_collection', array['uuid', 'integer', 'uuid', 'text'], 'finalize compatibility RPC exists');

select is(has_function_privilege('anon', 'public.consume_document_share(text)', 'execute'), true, 'anon can consume a high entropy share token');
select is(has_function_privilege('anon', 'public.consume_document_rate_limit(text, text, integer, integer)', 'execute'), false, 'anon cannot consume document rate limits');
select is(has_function_privilege('authenticated', 'public.consume_document_rate_limit(text, text, integer, integer)', 'execute'), false, 'authenticated cannot consume document rate limits directly');
select is(has_function_privilege('service_role', 'public.consume_document_rate_limit(text, text, integer, integer)', 'execute'), true, 'service role can consume document rate limits');
select is(has_function_privilege('anon', 'public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text)', 'execute'), false, 'anon cannot save issuer settings');
select is(has_function_privilege('authenticated', 'public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text)', 'execute'), true, 'administrator path can save issuer settings');
select is(has_function_privilege('anon', 'public.create_document_share(uuid, text, timestamptz, integer)', 'execute'), false, 'anon cannot create shares');
select is(has_function_privilege('authenticated', 'public.claim_document_job(text, integer)', 'execute'), false, 'authenticated cannot claim jobs');
select is(has_function_privilege('service_role', 'public.claim_document_job(text, integer)', 'execute'), true, 'service role can claim jobs');
select is(has_function_privilege('authenticated', 'public.claim_document_job_for_document(text, integer, uuid)', 'execute'), false, 'authenticated cannot claim jobs for a document');
select is(has_function_privilege('service_role', 'public.claim_document_job_for_document(text, integer, uuid)', 'execute'), true, 'service role can claim jobs for a document');
select is(has_function_privilege('authenticated', 'public.create_document_share(uuid, text, timestamptz, integer)', 'execute'), true, 'administrator path can create shares through RPC');
select is(has_function_privilege('authenticated', 'public.revoke_document_share(uuid)', 'execute'), true, 'administrator path can revoke shares through RPC');
select is(has_function_privilege('authenticated', 'public.create_document_revision(uuid, uuid, text, text)', 'execute'), true, 'administrator path can record revisions through RPC');
select is(has_function_privilege('anon', 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)', 'execute'), false, 'anon cannot revise documents');
select is(has_function_privilege('authenticated', 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)', 'execute'), true, 'administrator path can revise documents through RPC');
select is(has_function_privilege('service_role', 'public.commit_document_render_upload(uuid)', 'execute'), true, 'service role can commit render intents');
select is(has_function_privilege('authenticated', 'public.cleanup_document_render_upload_intents(integer)', 'execute'), false, 'authenticated cannot cleanup private render intents');
select is(has_function_privilege('service_role', 'public.cleanup_document_render_upload_intents(integer)', 'execute'), true, 'service role can cleanup private render intents');
select is(has_function_privilege('anon', 'public.ack_document_render_upload_cleanup(uuid)', 'execute'), false, 'anon cannot acknowledge render cleanup');
select is(has_function_privilege('service_role', 'public.ack_document_render_upload_cleanup(uuid)', 'execute'), true, 'service role can acknowledge render cleanup');
select is(has_function_privilege('authenticated', 'public.reserve_document_share_email_delivery(uuid, text, integer)', 'execute'), false, 'authenticated cannot reserve email delivery');
select is(has_function_privilege('service_role', 'public.reserve_document_share_email_delivery(uuid, text, integer)', 'execute'), true, 'service role can reserve email delivery');
select is(has_function_privilege('authenticated', 'public.complete_document_share_email_delivery(uuid, uuid, text, text, text, text)', 'execute'), false, 'authenticated cannot complete email delivery');
select is(has_function_privilege('service_role', 'public.complete_document_share_email_delivery(uuid, uuid, text, text, text, text)', 'execute'), true, 'service role can complete email delivery');

select is((select count(*)::integer from pg_trigger where tgname in ('organization_brand_assets_are_immutable', 'document_issuer_profiles_are_immutable', 'document_artifacts_are_immutable', 'share_deliveries_are_immutable', 'document_revisions_are_immutable')), 5, 'document evidence, asset, and issuer records are append-only');
select is((select count(*)::integer from pg_trigger where tgname = 'documents_lifecycle_render_job'), 1, 'cancel/reopen document inserts enqueue a render job');
select is((select coalesce(prosrc, '') like '%issuer_profile_incomplete%' from pg_proc where oid = 'public.finalize_collection(uuid, integer, uuid, text)'::regprocedure), true, 'finalize blocks incomplete issuer profiles');
select is((select coalesce(prosrc, '') like '%document_jobs%' from pg_proc where oid = 'public.finalize_collection(uuid, integer, uuid, text)'::regprocedure), true, 'finalize creates the render job atomically');
select is((select coalesce(prosrc, '') like '%append_document_version_with_issuer%' from pg_proc where oid = 'private.append_document_version(uuid, uuid)'::regprocedure), true, 'legacy lifecycle helper preserves issuer context');
select is((select coalesce(prosrc, '') like '%issuer_profile_id_value is not null%' and coalesce(prosrc, '') like '%private.collection_snapshot%' from pg_proc where oid = 'private.append_document_version(uuid, uuid)'::regprocedure), true, 'legacy lifecycle helper preserves issuer-less Phase 1A documents');
select is((select coalesce(prosrc, '') like '%p_allow_retired_issuer and status = ''retired''%' from pg_proc where oid = 'private.append_document_version_using_issuer(uuid, uuid, uuid, boolean)'::regprocedure), true, 'historical issuer helper accepts a retired profile only when explicitly requested');
select is((select coalesce(prosrc, '') like '%append_document_version_using_issuer%' and coalesce(prosrc, '') like '%true%' from pg_proc where oid = 'private.append_document_version(uuid, uuid)'::regprocedure), true, 'cancel and reopen derive a version from the retired issuer profile of the prior document');
select is((select coalesce(prosrc, '') like '%append_document_version_using_issuer%' and coalesce(prosrc, '') like '%false%' from pg_proc where oid = 'private.append_document_version_with_issuer(uuid, uuid, uuid)'::regprocedure), true, 'new issuance still requires an active issuer profile');
select is((select prosecdef from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'job claim is privileged');
select is((select coalesce(proconfig::text, '') like '%search_path=%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'job claim pins search path');
select is((select coalesce(prosrc, '') like '%skip locked%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'job claim uses row locking');
select is((select coalesce(prosrc, '') like '%status = ''running'' and leased_until <= now()%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'job claim reclaims expired running leases');
select is((select coalesce(prosrc, '') like '%insert into public.document_render_attempts%' and coalesce(prosrc, '') like '%''started''%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'job claim creates the append-only started attempt before returning work');
select is((select coalesce(prosrc, '') like '%document_job_lease_expired%' and coalesce(prosrc, '') like '%attempt_number = job_record.attempt_count%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'reclaim closes the expired attempt before issuing a new lease');
select is((select coalesce(prosrc, '') like '%attempt_count >= job_record.max_attempts%' and coalesce(prosrc, '') like '%status = ''failed''%' from pg_proc where oid = 'public.claim_document_job(text, integer)'::regprocedure), true, 'an expired fifth attempt becomes permanently failed without a sixth lease');
select is((select coalesce(prosrc, '') like '%interval ''1 minute''%' and coalesce(prosrc, '') like '%interval ''5 minutes''%' and coalesce(prosrc, '') like '%interval ''15 minutes''%' and coalesce(prosrc, '') like '%interval ''60 minutes''%' and coalesce(prosrc, '') like '%interval ''240 minutes''%' from pg_proc where oid = 'public.complete_document_job(uuid, uuid, text, uuid, text, text)'::regprocedure), true, 'job completion uses the fixed 1/5/15/60/240-minute backoff schedule');
select is((select coalesce(prosrc, '') like '%lease_token = p_lease_token%' and coalesce(prosrc, '') like '%document_job_attempt_inconsistent%' from pg_proc where oid = 'public.complete_document_job(uuid, uuid, text, uuid, text, text)'::regprocedure), true, 'completion closes only the attempt owned by the active lease');
select is((select coalesce(prosrc, '') like '%document_artifact_mismatch%' and coalesce(prosrc, '') like '%artifact_type = replace(job_record.job_type, ''render_'', '''')%' from pg_proc where oid = 'public.complete_document_job(uuid, uuid, text, uuid, text, text)'::regprocedure), true, 'completion accepts only the artifact type and document owned by the job');
select is((select coalesce(prosrc, '') like '%download_count = download_count + 1%' from pg_proc where oid = 'public.consume_document_share(text)'::regprocedure), true, 'share consume increments the counter atomically');
select is((select coalesce(prosrc, '') like '%download_count < max_downloads%' from pg_proc where oid = 'public.consume_document_share(text)'::regprocedure), true, 'share consume enforces the download limit');
select is((select position('artifact_type = ''pdf''' in coalesce(prosrc, '')) > 0 and position('artifact_type = ''pdf''' in coalesce(prosrc, '')) < position('download_count = download_count + 1' in coalesce(prosrc, '')) from pg_proc where oid = 'public.consume_document_share(text)'::regprocedure), true, 'share consume requires a PDF artifact before incrementing');
select is((select coalesce(prosrc, '') like '%render_qr%' from pg_proc where oid = 'private.enqueue_lifecycle_document_render_job()'::regprocedure), true, 'cancel/reopen enqueue both PDF and QR jobs');
select is((select coalesce(prosrc, '') like '%render_qr%' from pg_proc where oid = 'public.finalize_collection(uuid, integer, uuid, text)'::regprocedure), true, 'finalization enqueues the QR render job');
select is((select coalesce(prosrc, '') like '%render_qr%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'revision enqueues the QR render job');
select is((select coalesce(prosrc, '') like '%artifact_id is null%' from pg_proc where oid = 'public.cleanup_document_render_upload_intents(integer)'::regprocedure), true, 'intent cleanup excludes artifact-backed rows');
select is((select coalesce(prosrc, '') like '%cleanup_acknowledged_at is null%' and coalesce(prosrc, '') like '%status in (''canceled'', ''expired'')%' from pg_proc where oid = 'public.cleanup_document_render_upload_intents(integer)'::regprocedure), true, 'intent cleanup retries canceled and expired paths until acknowledgement');
select is((select coalesce(prosrc, '') like '%storage.objects%' and coalesce(prosrc, '') like '%artifact_id is null%' and coalesce(prosrc, '') like '%document_cleanup_committed_forbidden%' from pg_proc where oid = 'public.ack_document_render_upload_cleanup(uuid)'::regprocedure), true, 'cleanup acknowledgement verifies Storage removal and forbids committed artifacts');
select is((select coalesce(prosrc, '') like '%idempotency_hash%' and coalesce(prosrc, '') like '%for update%' from pg_proc where oid = 'public.reserve_document_share_email_delivery(uuid, text, integer)'::regprocedure), true, 'email reservation locks the share/hash key atomically');
select is((select coalesce(prosrc, '') like '%reservation_token%' and coalesce(prosrc, '') like '%share_deliveries%' from pg_proc where oid = 'public.complete_document_share_email_delivery(uuid, uuid, text, text, text, text)'::regprocedure), true, 'email completion requires reservation ownership and appends the delivery ledger');
select is((select count(*)::integer from pg_constraint where conrelid = 'public.idempotency_requests'::regclass and conname = 'idempotency_requests_operation_check' and pg_get_constraintdef(oid) like '%revise%'), 1, 'idempotency ledger accepts document revisions');
select is((select coalesce(prosrc, '') like '%document_revision_patch_forbidden_field%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed revision rejects prohibited fields');
select is((select coalesce(prosrc, '') like '%(''customer'', ''collection'', ''items'')%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed revision uses structured customer collection and item patches');
select is((select coalesce(prosrc, '') like '%item_patch_key not in (''id'', ''description'', ''quantity'', ''condition_note'', ''observation'')%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed item patch excludes identity and evidence fields');
select is((select coalesce(prosrc, '') like '%operation = ''revise''%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed revision is idempotent');
select is((select coalesce(prosrc, '') like '%document_jobs%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed revision creates a render job atomically');
select is((select coalesce(prosrc, '') like '%issuer_profile_id%' from pg_proc where oid = 'public.revise_collection_document(uuid, integer, jsonb, text, text, uuid, text)'::regprocedure), true, 'typed revision preserves issuer context');
select is((select coalesce(prosrc, '') like '%private.current_user_is_admin%' and coalesce(prosrc, '') like '%logo_asset_id%' and coalesce(prosrc, '') like '%profile_hash_value%' from pg_proc where oid = 'public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text)'::regprocedure), true, 'issuer settings validates admin, immutable logo, and profile hash');
select is((select coalesce(prosrc, '') like '%app.allow_issuer_profile_retire%' and coalesce(prosrc, '') like '%status = ''retired''%' from pg_proc where oid = 'public.save_company_issuer_settings(bigint, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text)'::regprocedure), true, 'issuer settings retires only the prior active profile');
select is((select coalesce(prosrc, '') like '%old.status = ''active''%' and coalesce(prosrc, '') like '%new.status = ''retired''%' from pg_proc where oid = 'private.prevent_issuer_profile_mutation()'::regprocedure), true, 'issuer profile mutation trigger allows only controlled retirement');
select has_function('public', 'save_company_issuer_settings', array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'], 'initial company issuer settings RPC exists');
select is(has_function_privilege('anon', 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)', 'execute'), false, 'anon cannot call initial issuer settings RPC');
select is(has_function_privilege('authenticated', 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)', 'execute'), true, 'authenticated can reach initial issuer settings RPC');
select is((select prosecdef from pg_proc where oid = 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)'::regprocedure), true, 'initial issuer settings RPC is security definer');
select is((select coalesce(proconfig::text, '') like '%search_path=%' from pg_proc where oid = 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)'::regprocedure), true, 'initial issuer settings RPC pins search path');
select is((select coalesce(prosrc, '') like '%actor_id uuid := (select auth.uid())%' from pg_proc where oid = 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)'::regprocedure), true, 'initial issuer settings RPC derives the caller');
select is((select coalesce(prosrc, '') like '%organization_memberships%' and coalesce(prosrc, '') like '%role_code = ''administrator''%' and coalesce(prosrc, '') like '%profile.status = ''active''%' from pg_proc where oid = 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)'::regprocedure), true, 'initial issuer settings RPC verifies an active administrator organization');
select is((select coalesce(prosrc, '') like '%organization_brand_assets%' and coalesce(prosrc, '') like '%organization_settings%' and coalesce(prosrc, '') like '%storage_path%' and coalesce(prosrc, '') like '%return public.save_company_issuer_settings%' from pg_proc where oid = 'public.save_company_issuer_settings(text, text, text, text, text, text, text, text, text, text, text, text, uuid)'::regprocedure), true, 'initial issuer settings RPC resolves prerequisites and delegates to the full contract');
select is((select coalesce(prosrc, '') like '%on conflict (scope, subject_hash, window_seconds, window_started_at)%' and coalesce(prosrc, '') like '%request_count < p_limit%' from pg_proc where oid = 'public.consume_document_rate_limit(text, text, integer, integer)'::regprocedure), true, 'rate-limit consumption atomically increments only below the configured limit');
select is((select coalesce(prosrc, '') like '%for update skip locked%' and coalesce(prosrc, '') like '%limit 100%' and coalesce(prosrc, '') like '%subject_hash !~ ''^[0-9a-f]{64}$''%' from pg_proc where oid = 'public.consume_document_rate_limit(text, text, integer, integer)'::regprocedure), true, 'rate-limit cleanup is bounded and accepts only pseudonymous subject hashes');

select has_function('public', 'retry_document_job', array['uuid', 'uuid', 'text'], 'document retry RPC exists');
select is(has_function_privilege('anon', 'public.retry_document_job(uuid, uuid, text)', 'execute'), false, 'anon cannot retry document jobs');
select is(has_function_privilege('authenticated', 'public.retry_document_job(uuid, uuid, text)', 'execute'), true, 'authenticated can retry document jobs through RPC');
select is(has_function_privilege('service_role', 'public.retry_document_job(uuid, uuid, text)', 'execute'), true, 'service role can retry document jobs');
select is((select prosecdef from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC is security definer');
select is((select coalesce(proconfig::text, '') like '%search_path=%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC pins search path');
select is((select coalesce(prosrc, '') like '%private.current_user_is_admin%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC verifies administrator access');
select is((select coalesce(prosrc, '') like '%attempt_count = 0%' and coalesce(prosrc, '') like '%status = ''failed''%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC resets failed jobs to queued with attempt_count zero');
select is((select coalesce(prosrc, '') like '%document_job_in_progress%' and coalesce(prosrc, '') like '%leased_until > now()%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC refuses live leases without stealing them');
select is((select coalesce(prosrc, '') like '%alreadyReady%' and coalesce(prosrc, '') like '%document_artifacts%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC short-circuits when the artifact already exists');
select is((select coalesce(prosrc, '') not like '%insert into public.document_jobs%' from pg_proc where oid = 'public.retry_document_job(uuid, uuid, text)'::regprocedure), true, 'document retry RPC never inserts a second job row');

savepoint retry_document_job_fixture;

create temp table retry_fixture_scratch (result jsonb not null);

set local role service_role;

do $$
declare
  v_org_id bigint;
  v_user_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_collection_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_document_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_job_id uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
begin
  select id into v_org_id from public.organizations where code = 'mjt' limit 1;
  if v_org_id is null then
    raise exception 'retry_fixture_org_missing';
  end if;

  insert into public.profiles (user_id, full_name, status)
  values (v_user_id, 'Retry Fixture Admin', 'active')
  on conflict (user_id) do update set status = 'active';

  insert into public.organization_memberships (organization_id, user_id, role_code, status)
  values (v_org_id, v_user_id, 'administrator', 'active')
  on conflict (organization_id, user_id) do update set role_code = 'administrator', status = 'active';

  insert into public.collections (
    id, organization_id, status, official_code, issued_year, sequence_number, row_version, created_by
  ) values (
    v_collection_id, v_org_id, 'collected', 'MJT-RETRY-000001', 2026, 990001, 1, v_user_id
  ) on conflict (id) do nothing;

  insert into public.documents (
    id, organization_id, collection_id, version, status, snapshot, snapshot_hash, verification_token, created_by, issued_at
  ) values (
    v_document_id,
    v_org_id,
    v_collection_id,
    1,
    'snapshot_ready',
    '{"collection":{"id":"' || v_collection_id || '"}}'::jsonb,
    repeat('a', 64),
    repeat('b', 64),
    v_user_id,
    now()
  ) on conflict (id) do nothing;

  insert into public.document_jobs (
    id, organization_id, document_id, job_type, status, idempotency_key, attempt_count, max_attempts,
    available_at, last_error_code, last_error_message, completed_at, requested_by
  ) values (
    v_job_id,
    v_org_id,
    v_document_id,
    'render_pdf',
    'failed',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    5,
    5,
    now(),
    'render_failed',
    'Render failed permanently.',
    now(),
    v_user_id
  ) on conflict (document_id, job_type) do update
    set status = 'failed',
        attempt_count = 5,
        available_at = now(),
        last_error_code = 'render_failed',
        last_error_message = 'Render failed permanently.',
        completed_at = now(),
        lease_token = null,
        leased_until = null,
        claimed_at = null,
        claimed_by = null;
end $$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into retry_fixture_scratch
select public.retry_document_job(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'render_pdf'
);

select is((select result->>'status' from retry_fixture_scratch), 'queued', 'retry requeues a failed job to queued');
select is((select result->>'alreadyReady' from retry_fixture_scratch), 'false', 'retry on a missing artifact is not already ready');

set local role service_role;

select is((select status from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'queued', 'retry persists queued status on the job row');
select is((select attempt_count from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 0, 'retry resets attempt_count to zero');
select is((select available_at <= now() from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'retry makes the job immediately available');
select is((select lease_token is null and leased_until is null and completed_at is null from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'retry clears lease and completion columns');
select is((select count(*)::integer from public.document_jobs where document_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and job_type = 'render_pdf'), 1, 'retry keeps the unique job row unchanged');

update public.document_jobs
set status = 'running',
    attempt_count = 1,
    lease_token = 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    leased_until = now() + interval '5 minutes',
    claimed_at = now(),
    claimed_by = 'fixture-worker',
    completed_at = null,
    last_error_code = null,
    last_error_message = null
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.retry_document_job(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
      'render_pdf'
    )$$,
  'P0001',
  'document_job_in_progress',
  'retry refuses a live lease without stealing it'
);

set local role service_role;

select is((select lease_token::text from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'retry leaves the live lease token untouched');
select is((select status from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'running', 'retry leaves a live running job untouched');
select is((select leased_until > now() from public.document_jobs where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'retry leaves the live lease expiry untouched');

update public.document_jobs
set status = 'queued',
    attempt_count = 0,
    lease_token = null,
    leased_until = null,
    claimed_at = null,
    claimed_by = null,
    completed_at = null,
    last_error_code = null,
    last_error_message = null,
    available_at = now()
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

insert into public.document_artifacts (
  id, organization_id, document_id, artifact_type, storage_path, content_type, byte_size, sha256, created_by
)
select
  '99999999-9999-4999-8999-999999999999',
  document_row.organization_id,
  document_row.id,
  'pdf',
  document_row.organization_id::text || '/' || document_row.id::text || '/99999999-9999-4999-8999-999999999999.pdf',
  'application/pdf',
  128,
  repeat('c', 64),
  document_row.created_by
from public.documents as document_row
where document_row.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
on conflict (document_id, artifact_type) do nothing;

truncate retry_fixture_scratch;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into retry_fixture_scratch
select public.retry_document_job(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'render_pdf'
);

select is((select result->>'status' from retry_fixture_scratch), 'succeeded', 'retry returns succeeded when the PDF artifact already exists');
select is((select result->>'alreadyReady' from retry_fixture_scratch), 'true', 'retry reports alreadyReady when the PDF artifact already exists');

rollback to savepoint retry_document_job_fixture;

select * from finish();
rollback;
