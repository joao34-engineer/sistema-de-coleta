# ADR 0008 — Observabilidade: healthcheck e alerta sem Sentry

- Status: aceito para a Fase 4, Chat 4
- Data: 2026-08-28
- Escopo: erro visível ao operador, alerta de 500, `GET`/`HEAD /api/health`

## Contexto

Chats 1–3 entregaram PWA, fila offline e segurança. Sem tela de erro, alerta e healthcheck, o uptime e o suporte não distinguem app no ar de Supabase degradado, nem correlacionam falha com o operador.

Sentry exigiria pacote novo, CSP e DSN. O projeto já tem `logTransactionFailure` allow-listed. Um segundo SDK seria write path paralelo.

## Decisões

1. **Sem Sentry neste chat.** Alerta = o mesmo JSON `transaction_failure` no log (Vercel) + webhook opcional `ERROR_ALERT_WEBHOOK_URL` (somente `https:`). Fail-open, fire-and-forget, dedupe por `requestId` no processo.

2. **Um gancho.** O webhook dispara dentro de `logTransactionFailure` quando `status >= 500`. Lifecycle, customers, drafts, operations e cleanup já passam por aí. Não criar evento `unexpected_failure` nem religar `apiErrorResponse` à parte.

3. **Health público.** `GET`/`HEAD /api/health` responde `200`/`503` com `{ ok, status, checks: { app, supabase } }`. `supabase` = Auth `/auth/v1/health` e REST `/rest/v1/` em paralelo, publishable key, timeout curto. Corpos upstream são descartados. Sem rate limit (429 = falso downtime). Proxy faz early-return sem `getClaims`.

4. **Erro visível.** `app/error.tsx` e `app/global-error.tsx` mostram mensagem segura, `error.digest` e retry. Sem `error.message`/stack. `global-error` importa `globals.css` porque substitui o root layout.

5. **`onRequestError`.** Usa só `context.routePath` (template). Nunca path, query, headers ou `error.message` — `/d/{token}` e `/verificar/{token}` vazariam segredo.

## Consequências

- Operador recupera a tela; suporte correlaciona pelo digest/requestId.
- Monitor externo aponta para `/api/health`.
- Humano configura o webhook se quiser alerta ativo. Backup, testes de campo e go-live ficam nos chats 5–7.
- Sem migration: schema remoto permanece o de Chat 3 (ACL). Em 28/08/2026, `migration list --linked` estava 11/11 alinhado.

## Fora do escopo

Sentry SDK, backup/restore, Service Worker, RLS, go-live, `POST` de erro de cliente, `not-found.tsx`.
