# Supabase: Auth, banco, RLS e Storage

## Modelo de uso

Supabase fornece Auth, PostgreSQL e Storage. O Next.js e a camada de aplicacao para comandos de alto risco: finalizar coleta, gerar codigo, emitir PDF, alterar estado, cancelar e compartilhar documento.

O projeto tera ambientes Supabase separados para desenvolvimento, staging e producao. Migrations vivem em `supabase/migrations/`, entram no Git e sao a unica forma normal de mudar schema.

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

## Auth e autorizacao

Auth identifica quem fez login; `profiles` e roles definem o que pode fazer. A sessao orienta UX, mas o comando e as policies confirmam a permissao. Testar sempre cenarios de usuario correto, usuario autenticado sem papel e anonimo.

## Checklist de alteracao

1. Ler a migration e o schema atual; nunca supor estado de producao.
2. Declarar impacto, rollback seguro e dados afetados.
3. Criar migration aditiva e tipos atualizados.
4. Escrever/revisar RLS, grants e Storage policies em conjunto.
5. Testar permissoes positivas e negativas em ambiente isolado.
6. Aplicar primeiro em staging e registrar a decisao/resultado antes de producao.

Fontes: [Supabase SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [dados seguros](https://supabase.com/docs/guides/database/secure-data) e [seguranca da Data API](https://supabase.com/docs/guides/api/securing-your-api).
