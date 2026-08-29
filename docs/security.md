# Seguranca, privacidade e evidencias

Este documento complementa a visao operacional em `security-and-compliance.md` e e leitura obrigatoria para qualquer alteracao de autenticacao, documento, QR, arquivo, API, dado pessoal ou integracao.

## Nivel de rigor

O sistema guarda identificacao de clientes, contatos, assinatura e documentos operacionais. Adotar OWASP ASVS nivel 2 como guia proporcional, com foco em autenticacao, controle de acesso, validacao, protecao de dados, arquivos, logging, logica de negocio e configuracao.

## Ameaças prioritarias

| Ameaça | Controle exigido |
| --- | --- |
| Usuario acessa coleta de outro papel/organizacao | RLS, autorizacao no comando e testes negativos |
| Documento ou QR enumeravel vaza dados | Token imprevisivel, dados mascarados, expiracao/revogacao |
| Upload malicioso ou excessivo | Allowlist de MIME/tamanho, caminho interno, bucket privado |
| Reenvio de finalizacao duplica guia | Chave de idempotencia e transacao no banco |
| Alteracao posterior invalida prova | Snapshot, hash, versao e eventos append-only |
| Secret no navegador ou log | `server-only`, env validada e redacao em logs |
| Abuso de login/QR/API | Rate limit, limites de payload e alertas |

## Regras de implementacao

- Validar toda entrada no limite do servidor, incluindo `FormData`, params, JSON, cabeçalhos e metadados de upload. TypeScript nao valida dados em runtime.
- Reautenticar e reautorizar toda Server Action, Route Handler e comando que le dados sensiveis ou muda estado.
- URLs externas, redirects e destinos de e-mail devem ser validados por protocolo e allowlist quando aplicavel; nunca buscar URL arbitraria enviada pelo cliente.
- Usar UUID interno para armazenamento e nomes de arquivo servidos seguros; nao montar path a partir de entrada do usuario.
- Comparar segredo de integracao com funcao de tempo constante quando houver token compartilhado.
- Nao usar cache publico para dados autenticados, links assinados, erros ou documentos.
- Logs registram evento, request id, usuario pseudonimizado e resultado; nunca payload pessoal integral, assinatura, PDF, CPF, telefone, token ou chave.

## Assinatura, PDF e QR

A assinatura desenhada e apenas parte da evidencia. Ao finalizar, congelar snapshot, signatario declarado, texto de aceite, data/hora do servidor, coletor, hash e identificador da versao. PDF e QR devem refletir essa versao.

QR de verificacao e publico somente para status de autenticidade, codigo, data e dados mascarados. Acesso ao documento completo exige sessao autorizada ou token privado de alta entropia, com possibilidade de revogacao. Uma guia cancelada continua verificavel como cancelada.

## Privacidade e LGPD

Coletar somente o necessario para a coleta e vinculo comercial, documentar finalidade e manter canal para titulares. Antes do lancamento, definir retencao, operador/fornecedor, responsavel por acessos e resposta a incidente. Exportacao, descarte ou anonimização nunca podem apagar evidencias mantidas por obrigacao legal ou defesa de direitos sem decisao formal.

## Review antes de producao

Revisar permissao por papel, migration/RLS, Storage, env, CSP/cabecalhos, rate limit, upload, logs, cache, backup/restore e cenario de usuario malicioso. OWASP ASVS e referencia de verificacao, nao uma checklist copiada sem contexto.

## Matriz por comando (Chat 3)

| Superficie | Auth no comando | RLS/RPC | Rate limit | Log 500 |
| --- | --- | --- | --- | --- |
| Clientes, rascunho, itens, evidencias, settings | `requireAuthenticatedAdministrator` | sessao + org | n/a | sim, sem PII |
| Finalize / cancel / reopen | idem | RPC 1A | n/a | ator quando conhecido |
| Oficina (7 RPCs + 3 intents de assinatura) | idem | apos revoke Chat 3 | n/a | ator quando conhecido |
| Shares / e-mail / revisao | idem | Fase 2 | ja existe | ator quando conhecido |
| `GET /api/public/collections/[token]` | anon | `verify_collection_document` | ja existe | 404 generico |
| `GET /d/{token}/download` | token | `consume_document_share` | HTTP 429 | 404 generico |
| `signInAction` | n/a | Auth | estado da action, nao 429 | `unexpected_error` via logger |
| `GET`/`HEAD /api/health` | anon | n/a (Auth+REST probe) | nenhum | n/a; corpo minimo |
| `onRequestError` | n/a | n/a | n/a | so `routePath` template |
| Worker interno | secret 32+ timing-safe | service_role | n/a | sem segredo |

Login usa `auth_login` (5 tentativas / 15 min por IP+e-mail HMAC). Download publico de share usa `document_share_download` (30 / 5 min por IP), o mesmo RPC `consume_document_rate_limit`. A pagina `/d/{token}` nao consome quota. `/verificar` ja era limitado e nao foi duplicado.

Observabilidade (Chat 4 / ADR 0008): 500 disparam o mesmo `transaction_failure` allow-listed e, se `ERROR_ALERT_WEBHOOK_URL` for `https:`, um webhook fail-open. `onRequestError` nunca registra path/query/headers (tokens de `/d/` e `/verificar/`). Health nao usa service role nem SELECT em tabela de coleta.

Login depende de `DOCUMENT_RATE_LIMIT_SECRET` (>=32), `SUPABASE_SECRET_KEY` e `SUPABASE_CONFIRM_PROJECT_REF` no servidor. A RPC `consume_document_rate_limit` precisa aceitar o scope `auth_login` (migration `20260829010000_phase_4_auth_login_rate_limit_scope.sql`); sem isso o login falha fechado com "Não foi possível concluir o login agora."

## Checklist operacional ainda humano

- Ativar leaked-password protection no painel Auth (Fase 0, ainda aberto).
- MFA continua adiado (administrador unico).
- Os 4 gates remotos da Fase 1A (RLS cruzada, concorrencia, Storage privado, cleanup real) permanecem adiados ate existir projeto isolado.
- Chat 4: apontar monitor de uptime para `GET /api/health` e, se quiser alerta ativo, configurar `ERROR_ALERT_WEBHOOK_URL` (somente `https:`) no deploy.
- Chat 5: ferramentas de backup/restore entregues (ADR 0010 + runbook). **Prova humana de restore isolado: ADIADA** (29/08/2026). Sem essa prova o app funciona; o criterio de lancamento “backup/restauracao comprovados” e a autorizacao plena de evidencias reais permanecem abertos. Nunca restore no MVP.

## Estado das migrations (remoto)

Conferido em 28/08/2026 com `supabase migration list --linked`: as migrations ate `20260828120000_phase_4_chat3_security_acl.sql` estavam aplicadas. Em 29/08/2026 foram aplicadas `20260829010000_phase_4_auth_login_rate_limit_scope.sql` (allowlist `auth_login` na RPC), `20260829020000_phase_4_auth_login_rate_limit_scope_check.sql` (CHECK da tabela `private.document_rate_limit_windows`) e `20260829220000_phase_0_workshop_schema_contracts.sql` (Fase 0 oficina: CHECKs, `collections.check_in_signature_path`, REPLACE 3b; sem grant extra de UPDATE em `collections`; RPCs continuam SECURITY DEFINER). Chat 4 (observabilidade) nao cria migration de schema de negocio.

Fontes: [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), [ASVS para desenvolvedores](https://devguide.owasp.org/en/03-requirements/05-asvs/) e [seguranca de dados Next.js](https://nextjs.org/docs/app/guides/data-security).
