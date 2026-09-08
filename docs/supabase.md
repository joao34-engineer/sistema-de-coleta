# Supabase: Auth, banco, RLS e Storage

## Modelo de uso

Supabase fornece Auth, PostgreSQL e Storage. O Next.js e a camada de aplicacao para comandos de alto risco: finalizar coleta, gerar codigo, emitir PDF, alterar estado, cancelar e compartilhar documento.

O projeto usara, nesta etapa, um unico projeto Supabase remoto proprio para desenvolvimento integrado, validacao controlada e publicacao do MVP. O Supabase local em Docker esta adiado e nao faz parte do fluxo operacional atual. Nao havera staging remoto nesta etapa.

Migrations vivem em `supabase/migrations/`, entram no Git e sao a unica forma normal de mudar schema. Elas sao revisadas no Git, verificadas com `supabase db push --dry-run` e aplicadas manualmente ao projeto remoto. Nunca usar `db reset`, `db reset --linked`, `drop` ou limpeza de dados nesse projeto.

## Ambiente remoto unico do MVP

O projeto remoto e a producao tecnica do MVP, mas ainda nao e autorizado para coletas reais, documentos insubstituiveis ou dados pessoais de clientes. Os testes de Joao e sua irma usam somente dados sinteticos e reversiveis no nivel da aplicacao, sem apagar migrations, buckets ou historico.

Antes de uma mudanca que alcance o banco remoto:

1. Revisar a migration e confirmar que e aditiva.
2. Executar validacoes estaticas e testes que nao dependam do Supabase local.
3. Conferir o projeto remoto vinculado e executar `supabase db push --dry-run`.
4. Aplicar a migration manualmente, sem comandos destrutivos.
5. Validar RLS, Auth e Storage com usuarios e dados sinteticos autorizados.
6. Registrar o resultado e manter o projeto pronto para a revisao de backup/restauracao da Fase 4.

Na validacao de 28/08/2026 (`supabase migration list --linked`), as 11 migrations locais estavam aplicadas no remoto, inclusive Fase 1A–3, Chat 2 (`p_client_item_id`) e Chat 3 (`phase_4_chat3_security_acl`). Chat 4 (observabilidade) nao altera schema. O advisor de seguranca ainda pode reportar `auth_leaked_password_protection`; essa opcao deve ser ativada manualmente em Auth > Password Security antes do gate final da Fase 0. Indices sem uso em banco pequeno permanecem se suportam consultas previstas. Em 29/08/2026 foi aplicada `20260829220000_phase_0_workshop_schema_contracts.sql` (Fase 0 B01–B09: CHECKs de oficina, `collections.check_in_signature_path`, REPLACE 3b de budget/progress e snapshot em status emitidos). Em 04/09/2026 foi aplicada `20260829230000_phase_1_rejected_rebudget.sql` (Fase 1 B14: `create_technical_budget` aceita `rejected` e faz upsert da OS existente). Em 05/09/2026 foi aplicada `20260905010000_signature_storage_insert_intent_only.sql` (INSERT de `collection-signatures` autorizado pelo intent pendente, sem exigir `metadata.mimetype` no WITH CHECK; commit aceita objeto no path certo se o MIME vier vazio). No mesmo dia, `20260905133628_signature_storage_delivery_intent_definer.sql` substituiu o `EXISTS` direto em `private.delivery_signature_intents` (e a leitura de intents private no SELECT) por helpers `SECURITY DEFINER`; `authenticated` ganhou `USAGE` no schema `private` e `EXECUTE` nos helpers, sem `SELECT` nas tabelas private. Também ficou aplicada `20260905020000_discard_collection_draft.sql` (RPC de descarte de rascunho, já no Git). Em 06/09/2026 o remoto recebeu as migrations Fase 5 `20260906120000`–`20260906190000` e `20260906210000` (entrega desde Pronto) e, no mesmo dia, `20260906220000` (cursor RFC 4648 compacto). Em 07/09/2026 o remoto já tinha `20260907000000`/`07010000` (PR 3/4); `db push` aplicou `20260907020000` (L1), `20260907030000` (L2) e `20260907220000` (`invalid_signer_tax_id`). `migration list` local = remoto até `20260907230000` (L4 invariantes de item aplicada 07/09/2026).

O Supabase CLI fica fixado no lockfile (`2.114.0`). O estado global da CLI nao e versionado. Quando o perfil global do Windows estiver ausente, a sessao pode usar um `SUPABASE_HOME` local ignorado pelo Git:

```powershell
$env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-cli'
```

O Docker Desktop pode continuar instalado para outros projetos, mas nenhum comando `supabase start`, `supabase stop --no-backup` ou `supabase db reset` integra o fluxo desta fase. Se o Supabase local voltar a ser considerado, esta decisao devera ser revisada antes de adiciona-lo novamente ao CI ou ao processo de desenvolvimento.

## Credenciais e clients

| Credencial/client | Onde pode existir | Uso |
| --- | --- | --- |
| URL e publishable key | servidor e navegador | Client com RLS e sessao do usuario |
| Client SSR com cookies | servidor | Ler sessao e operar como usuario autenticado |
| Secret/service role | modulo `server-only` | Excecao administrativa curta e auditada |

Chaves secret/service role ignoram RLS e nunca entram em `NEXT_PUBLIC_*`, bundle, log, erro, URL ou resposta HTTP. Usar client administrativo somente quando RLS nao puder cumprir um trabalho interno e a autorizacao estiver verificada antes.

## Schema e migrations

- Migrations sao aditivas, pequenas e revisaveis; nao usar comandos destrutivos ou reset em producao.
- Toda tabela exposta recebe RLS explicitamente e policies para `SELECT`, `INSERT`, `UPDATE` e `DELETE` conforme necessidade. Ausencia de policy deve negar acesso.
- Gravar `organization_id` nas entidades operacionais desde o inicio e conferir o vinculo em cada policy.
- Policies verificam acesso de leitura e escrita; `WITH CHECK` impede inserir/alterar linha fora do escopo do usuario.
- Funcoes RPC usam `SECURITY INVOKER` por padrao. `SECURITY DEFINER` exige justificativa, autorizacao propria, grants minimos e `search_path` explicitamente definido.
- Gerar tipos do banco depois de cada migration aprovada e revisar o diff junto da migration.

## Storage de evidencias

Assinaturas, fotos e PDFs ficam em buckets privados separados ou prefixos de finalidade clara. O caminho e gerado pela aplicacao com UUID interno, organizacao e coleta; nunca confiar em nome informado pelo usuario.

Antes do upload, validar tamanho, MIME permitido e assinatura de arquivo quando a biblioteca permitir. Permitir apenas formatos necessarios; servir download por URL temporaria e autorizada. Nao tornar um bucket publico para simplificar PDF ou foto.

O banco guarda metadata, hash, dono, objetivo e referencia do objeto. O backup operacional inclui banco e objetos do Storage: backup do Postgres sozinho nao recupera assinaturas ou PDFs.

## Backup operacional (Chat 5)

- Procedimento: [`runbook-backup-restore.md`](runbook-backup-restore.md). Decisao: [ADR 0010](decisions/0010-backup-restore-isolated.md).
- Export do MVP: `npm run backup:export` + `npm run backup:verify` (bundle fora do Git).
- Restore somente em projeto throwaway (`RESTORE_*`), nunca no projeto linkado. Conta free pode usar um segundo projeto em outra conta/org; nao conectar GitHub ao throwaway.
- Humano executa o drill (PDF + assinatura) e apaga o throwaway. Scripts nao apontam o app nem a Vercel ao alvo de restore.
- Auth users ficam fora do dump de Storage; admin no throwaway e recriado no painel se necessario.

## Auth e autorizacao

Na Fase 0, Auth atende somente um administrador criado manualmente no painel do Supabase e autenticado por e-mail e senha. Convites, criacao de outros usuarios, recuperacao de senha por e-mail e SMTP transacional ficam adiados. `profiles` e roles ja preservam uma modelagem segura para expansao futura, mas a sessao, os comandos e as policies continuam sendo a fonte de autorizacao. Testar sempre administrador, usuario autenticado sem papel e anonimo.

## Checklist de alteracao

1. Ler a migration e o schema atual; nunca supor estado de producao.
2. Declarar impacto, rollback seguro e dados afetados.
3. Criar migration aditiva e tipos atualizados.
4. Escrever/revisar RLS, grants e Storage policies em conjunto.
5. Testar permissoes positivas e negativas no projeto remoto controlado, somente com usuarios e dados sinteticos autorizados.
6. Depois de CI e revisao, aplicar manualmente no projeto remoto e registrar o resultado. Nunca executar reset ou comando destrutivo no remoto.

Fontes: [Supabase SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [dados seguros](https://supabase.com/docs/guides/database/secure-data) e [seguranca da Data API](https://supabase.com/docs/guides/api/securing-your-api).
