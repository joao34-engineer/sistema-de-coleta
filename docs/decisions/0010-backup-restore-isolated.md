# ADR 0010 — Backup e restore isolado (Chat 5)

- Status: aceito para a Fase 4, Chat 5
- Data: 2026-08-29
- Escopo: dump lógico do Postgres + objetos dos buckets privados; restore somente em projeto throwaway

## Contexto

Chats 1–4 entregaram PWA, fila offline, segurança e observabilidade. Sem backup e restore comprovados de **banco e Storage**, o MVP remoto não pode autorizar coletas reais (ADR 0002). Dump só de Postgres não recupera PDF nem assinatura.

O plano free do Supabase na conta do MVP já usa outro projeto; o alvo de restore é um projeto vazio em **conta/organização separada**, não um staging permanente e não o projeto linkado ao app.

## Decisões

1. **Dois destinos distintos.** Export lê o MVP (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` + `SUPABASE_CONFIRM_PROJECT_REF` + `supabase link`). Restore escreve só no throwaway (`RESTORE_SUPABASE_URL` + `RESTORE_SUPABASE_SECRET_KEY` + `RESTORE_CONFIRM_PROJECT_REF` + `RESTORE_DATABASE_URL`). O script **recusa** restore quando o ref do alvo coincide com o do MVP.

2. **Bundle off-repo.** O diretório de saída (`BACKUP_OUTPUT_DIR`) fica fora do Git. Contém `dump.sql`, `storage/<bucket>/…`, `manifest.json`. Paths e hashes apenas — sem nomes de cliente, CPF ou tokens no manifesto.

3. **Buckets canônicos.** `organization-assets`, `collection-evidences`, `collection-signatures`, `collection-documents`. Integridade = SHA-256 dos bytes vs manifesto (e metadados quando existirem).

4. **Auth fora do drill.** Usuários Auth não fazem parte do dump de Storage/public. No throwaway o admin é recriado se necessário. Recuperação de Auth na conta do MVP permanece nota de painel/suporte Supabase.

5. **Humano executa o restore.** A LLM entrega scripts + runbook. Prova de aceite = abrir um PDF e uma assinatura no throwaway e registrar no runbook / fase 4. Depois, apagar o throwaway.

6. **Sem UI, sem migration, sem religar o app.** Não há Route Handler de backup. Não se aponta `.env.local` de app nem Vercel ao throwaway. Não se conecta GitHub ao throwaway.

## Consequências

- Chat 5 fecha o passo 7 da Fase 4 quando o humano cola a prova do drill.
- Chats 6–7 continuam bloqueados até essa prova.
- PITR pago do painel Supabase é opcional e complementar; o caminho versionado do repo é dump + Storage portátil.

## Fora do escopo

Service Worker, UI de oficina, testes de campo, go-live, `db reset` no MVP, transferir o projeto live entre contas, Sentry.
