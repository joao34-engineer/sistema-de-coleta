begin;
select plan(16);

select has_function(
  'public',
  'peek_document_rate_limit',
  array['text', 'text', 'integer', 'integer'],
  'peek_document_rate_limit exists'
);
select has_function(
  'public',
  'reset_document_rate_limit',
  array['text', 'text', 'integer'],
  'reset_document_rate_limit exists'
);

select is(
  has_function_privilege('anon', 'public.peek_document_rate_limit(text, text, integer, integer)', 'execute'),
  false,
  'anon cannot peek document rate limits'
);
select is(
  has_function_privilege('authenticated', 'public.peek_document_rate_limit(text, text, integer, integer)', 'execute'),
  false,
  'authenticated cannot peek document rate limits'
);
select is(
  has_function_privilege('service_role', 'public.peek_document_rate_limit(text, text, integer, integer)', 'execute'),
  true,
  'service role can peek document rate limits'
);
select is(
  has_function_privilege('anon', 'public.reset_document_rate_limit(text, text, integer)', 'execute'),
  false,
  'anon cannot reset document rate limits'
);
select is(
  has_function_privilege('authenticated', 'public.reset_document_rate_limit(text, text, integer)', 'execute'),
  false,
  'authenticated cannot reset document rate limits'
);
select is(
  has_function_privilege('service_role', 'public.reset_document_rate_limit(text, text, integer)', 'execute'),
  true,
  'service role can reset document rate limits'
);

select is(
  (
    select coalesce(prosrc, '') like '%auth_login%'
    from pg_proc
    where oid = 'public.consume_document_rate_limit(text, text, integer, integer)'::regprocedure
  ),
  true,
  'consume still allowlists auth_login'
);
select is(
  (
    select coalesce(prosrc, '') like '%request_count < p_limit%'
    from pg_proc
    where oid = 'public.consume_document_rate_limit(text, text, integer, integer)'::regprocedure
  ),
  true,
  'consume still increments only below the limit'
);
select is(
  (
    select pg_get_constraintdef(oid) like '%auth_login%'
    from pg_constraint
    where conname = 'document_rate_limit_windows_scope_check'
  ),
  true,
  'window CHECK still allows auth_login'
);

-- Behavioral path: only on a disposable database (supabase test db).
select is(
  (
    select count(*) filter (where r.allowed)::integer
    from generate_series(1, 5) as attempt
    cross join lateral public.consume_document_rate_limit(
      'auth_login',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      900,
      5
    ) as r
  ),
  5,
  'five consumes in a fresh window are allowed'
);
select is(
  (
    select r.allowed
    from public.consume_document_rate_limit(
      'auth_login',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      900,
      5
    ) as r
  ),
  false,
  'sixth consume is refused'
);
select is(
  (
    select r.allowed
    from public.peek_document_rate_limit(
      'auth_login',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      900,
      5
    ) as r
  ),
  false,
  'peek reports lockout without incrementing'
);
select lives_ok(
  $$select public.reset_document_rate_limit(
    'auth_login',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    900
  )$$,
  'reset deletes the current window row'
);
select is(
  (
    select r.allowed
    from public.consume_document_rate_limit(
      'auth_login',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      900,
      5
    ) as r
  ),
  true,
  'consume after reset is allowed'
);

select * from finish();
rollback;
