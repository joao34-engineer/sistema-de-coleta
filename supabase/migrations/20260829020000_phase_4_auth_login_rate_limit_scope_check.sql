-- Fase 4 residual: CHECK da tabela de rate limit tambem precisa aceitar auth_login.
-- A migration 20260829010000 atualizou a allowlist da RPC, mas a constraint
-- private.document_rate_limit_windows_scope_check ainda rejeitava o insert.
-- Aditiva: drop/add CHECK; nao apaga linhas existentes.

alter table private.document_rate_limit_windows
  drop constraint document_rate_limit_windows_scope_check;

alter table private.document_rate_limit_windows
  add constraint document_rate_limit_windows_scope_check
  check (
    scope = any (
      array[
        'public_verification'::text,
        'document_share_create'::text,
        'document_email_administrator'::text,
        'document_email_organization'::text,
        'document_share_download'::text,
        'auth_login'::text
      ]
    )
  );
