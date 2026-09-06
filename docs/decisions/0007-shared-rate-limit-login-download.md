# ADR 0007 — Rate limit compartilhado para login e download de share

- Status: aceito para a Fase 4, Chat 3
- Data: 2026-08-28
- Escopo: extracao do limitador para `src/shared/lib`, scopes `auth_login` e `document_share_download`

## Contexto

O rate limit da Fase 2 vive em `_pages/collection-documents`. Login e download publico de share precisam do mesmo RPC `consume_document_rate_limit`. `_pages/login` nao pode importar `_pages/collection-documents` (FSD). Server Actions nao devolvem HTTP 429.

## Decisoes

1. **Um modulo `server-only` em `shared/lib`.** `rate-limit.server.ts` concentra regras, HMAC do sujeito e o cliente de servico. A fatia de documentos reexporta o modulo antigo para nao quebrar imports internos.

2. **Reuso do RPC existente.** Nao ha produto novo de quota. `p_scope` continua texto livre; as regras de aplicacao passam a incluir `auth_login` (5 / 15 min, IP+e-mail HMAC) e `document_share_download` (30 / 5 min, IP). Segredo ausente falha fechado.

3. **Login devolve estado da action.** `signInAction` limita antes de `signInWithPassword` e responde `rate_limit_exceeded` ou `temporarily_unavailable`, nunca HTTP 429. Credencial invalida permanece generica.

4. **429 so no download.** `GET /d/{token}/download` espelha a API publica de verificacao (`Retry-After`). A pagina `/d/{token}` nao consome quota (ADR 0004).

## Consequencias

- Login e share passam pelo mesmo backend de janela, testavel localmente sem projeto isolado.
- A casca autenticada de `/coletas` fica no proxy; a autorizacao continua no comando + RLS.

## Fora do escopo (na epoca do Chat 3)

MFA, observabilidade, backup e os 4 gates remotos da Fase 1A.

## Atualizacao (28/08/2026)

A migration `20260828120000_phase_4_chat3_security_acl.sql` foi aplicada no remoto (`migration list --linked` alinhado). Observabilidade ficou no Chat 4 (ADR 0008).

## Atualizacao (06/09/2026) — B24/B25

Login permanece fail-closed. `SUPABASE_CONFIRM_PROJECT_REF` passou a ser confrontado com o project ref de `NEXT_PUBLIC_SUPABASE_URL` em `getServiceEnvironment`; o mesmo assert vale para o cliente de rate limit e o cliente de serviço da Fase 2. `SUPABASE_SECRET_KEY` é obrigatória no servidor Vercel (nunca `NEXT_PUBLIC_*`, nunca commitada).

A quota `auth_login` (5 / 900 s) continua consumindo atomicamente antes de `signInWithPassword`. Credencial inválida mantém o slot. Login bem-sucedido chama `reset_document_rate_limit`, que apaga a linha da janela corrente — cinco logins corretos no mesmo slot não bloqueiam o administrador. Lockout ativo não chega no Auth. Peek existe para testes/escopos futuros; consume não muda. Reset com falha não impede o redirect; o log usa `rate_limit_reset_failed`. Falhas de ambiente/RPC no login usam `logTransactionFailure` com códigos allow-listed e somente nomes de variável.
