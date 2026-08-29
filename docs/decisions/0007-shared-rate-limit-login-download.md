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

## Fora do escopo

Aplicacao remota da migration de ACL, MFA, observabilidade, backup e os 4 gates remotos da Fase 1A.
