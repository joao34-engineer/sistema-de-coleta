# Execução da Fase 2 — Delivery e compartilhamento

## Escopo entregue

- Página autenticada `/coletas/{id}/documentos` com versões preservadas, estado de artefatos e download.
- Listagem e download autenticados por sessão administrativa e URLs assinadas de curta duração.
- Criação, revogação e consumo de links por `create_document_share`, `revoke_document_share` e `consume_document_share`, com expiração padrão de 7 dias e limite de até 20 downloads.
- Página pública `/d/{shareToken}` sem dados pessoais, assinatura, caminho privado ou hash.
- Registro idempotente de preparação de e-mail em `share_deliveries`; o adaptador Resend permanece dry-run até habilitação operacional.
- Endpoint de revisão documental usando `create_document_revision`.
- Rota interna de execução do worker com segredo dedicado.

## Contratos de dados

Os DTOs de delivery usam somente as colunas existentes na migration `20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql`. `document_artifacts` é append-only e não recebe status inventado pela interface. Jobs e shares avançam pelas RPCs server-side da migration. Nenhuma migration é aplicada remotamente por este incremento.

## Segurança e operação

Respostas autenticadas, públicas e de erro usam `Cache-Control: no-store`. A autorização ocorre no servidor antes de consultar Storage. O token bruto só é entregue na criação; consumo não retorna o token nem caminho do arquivo. O contador de share é incrementado apenas no endpoint de download, nunca ao abrir a página. O worker exige `DOCUMENT_WORKER_SECRET` e `X-Document-Worker-Secret`, com mínimo de 32 caracteres.

Rate limiting é consumido por RPC atômica e distribuída, nunca por memória da instância: verificação pública usa 30 requisições por IP pseudonimizado em 5 minutos; criação de link 30 por administradora/hora; e-mail 10 por administradora/hora e 50 por organização/dia. `DOCUMENT_RATE_LIMIT_SECRET` (mínimo 32 caracteres) gera HMAC do IP, ID de administradora ou ID da organização; os valores brutos não são persistidos ou logados. Falta desse segredo ou da RPC falha fechada.

## Validação

Executar `npm run lint`, `npm run typecheck`, `npm run test` e `npm run test:e2e`. O E2E de share confirma que token inválido não redireciona para rotas protegidas. Testes remotos e aplicação de migration continuam opt-in e fora desta execução.
