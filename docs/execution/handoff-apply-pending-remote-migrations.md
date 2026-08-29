# Prompt — aplicar migrations pendentes no remoto MJT

Cole o bloco abaixo numa sessão nova. Esta página é só handoff; **não** é uma fase nova e **não** autoriza Chat 4 (observabilidade).

---

## Prompt para a próxima sessão

```text
Você é o agente do repo afiliado-shopee, mas o trabalho é SOMENTE `sistema-coleta` (Coleta MJT). Não misture com o stack de afiliados Shopee, `backend/`, `frontend/`, `my-collection-page/` ou `affiliate-vitrine/`.

COMO APLICAR (MUST — não negociar)
- Único comando de apply: `npx supabase db push` a partir de `sistema-coleta` (cwd obrigatório).
- Primeiro: `npx supabase db push --dry-run`. Só depois, sem flags destrutivas: `npx supabase db push`.
- PROIBIDO: `apply_migration` do plugin/MCP Supabase. Ele cria outro timestamp e dessincroniza `schema_migrations` dos arquivos locais.
- PROIBIDO: `supabase db reset`, `db reset --linked`, SQL solto no plugin para criar as 4 migrations.
- Plugin só para LEITURA depois (list_migrations, execute_sql, advisors).

TAREFA
1. Corrigir o SQL das duas migrations da Fase 3b (os bugs abaixo). Não reescrever a lógica de negócio das RPCs.
2. Aplicar as 4 migrations locais ainda NÃO aplicadas no remoto, nesta ordem, com `npx supabase db push` em `sistema-coleta`. Nunca `apply_migration`.
3. Conferir o remoto depois. Não commitar. Não começar Chat 4. Nunca `db reset`.

PRE-FLIGHT
- Ler `docs/feature-first-posture.md` (raiz do monorepo).
- Ler `sistema-coleta/AGENTS.md`, `sistema-coleta/docs/README.md`, `sistema-coleta/docs/supabase.md`.
- Skill: `sistema-coleta/.agents/skills/mjt-supabase/SKILL.md` se existir.
- Migrations só aditivas. Zero data loss. Sem DROP TABLE / wipe / recreate de `app.db` (isso nem é deste projeto).

PROJETO REMOTO (único destino)
- Nome: sistema-coleta-mjt
- Ref / project_id: ngmkzmhkybspkwoqibha
- Região: sa-east-1
- Postgres 17 (engine 17.6.1.155 no plugin)
- Link local já aponta para esse ref: `sistema-coleta/supabase/.temp/project-ref`
- NUNCA aplicar em `vrxyaecvsjbealwgxpsj` (joao34-engineer's Project). O plugin lista os dois.

PLUGIN SUPABASE
Já conectado e útil só para LEITURA: list_projects, list_migrations, execute_sql, advisors.
PROIBIDO apply_migration / qualquer DDL via plugin. Apply = somente `npx supabase db push` em `sistema-coleta`.

ESTADO REMOTO (lido em 2026-08-28, plugin)
Última migration aplicada:
- 20260822125100_phase_3_operations_workshop

Ainda NÃO aplicadas (existem só no disco):
1. 20260823000000_phase_3_idempotency_intents_delivery_terms.sql   ← Fase 3b schema
2. 20260823000001_phase_3_rpcs_idempotency.sql                     ← Fase 3b RPCs
3. 20260827120000_phase_4_chat2_client_item_id.sql                 ← Chat 2
4. 20260828120000_phase_4_chat3_security_acl.sql                   ← Chat 3

Confirmado no remoto:
- Sem `public.delivery_terms`, `public.delivery_term_items`, `private.delivery_signature_intents`.
- Sem coluna `collection_items.client_item_id`.
- `create_collection_item` ainda é a de 7 args (sem p_client_item_id).
- Sem RPCs `prepare/commit/cancel_delivery_signature_intent`.
- CHECK vivo de `idempotency_requests.operation`:
  ('finalize','cancel','reopen','revise')
- Uniques vivos necessários aos FKs da 3b:
  - collections: UNIQUE (id, organization_id)
  - collection_items: UNIQUE (id, collection_id, organization_id)
- Storage `collection-signatures` já tem:
  - collection_signatures_select_admin (SELECT)
  - collection_signatures_insert_draft_admin (INSERT)
  - collection_signatures_delete_unconfirmed_intent (DELETE)
  As duas policies novas da 3b são ADITIVAS (RLS permissivo = OR). Não dropar as antigas.

Assinaturas 3a VIVAS (Postgres trata CREATE OR REPLACE com args novos como OVERLOAD, não substituição):

workshop_check_in(uuid, integer, text, text, jsonb, text)
  -- último arg = p_signature text
create_technical_budget(uuid, integer, jsonb, text)
approve_technical_budget(uuid, integer, boolean, text, text, text)
update_service_progress(uuid, integer, jsonb)
register_invoice_reference(uuid, integer, text, text, date, numeric, text)
deliver_to_customer(uuid, integer, uuid[], text, text, text, text)
  -- último arg = p_signature text
cancel_or_reopen_collection(uuid, integer, text, text)

Assinaturas 3b NOVAS (já no arquivo local):

workshop_check_in(uuid, integer, text, text, jsonb, uuid, uuid, text)
  -- p_signature_intent_id, p_idempotency_key, p_request_hash
create_technical_budget(uuid, integer, jsonb, text, uuid, text)
approve_technical_budget(uuid, integer, boolean, text, text, text, uuid, text)
update_service_progress(uuid, integer, jsonb, uuid, text)
register_invoice_reference(uuid, integer, text, text, date, numeric, text, uuid, text)
deliver_to_customer(uuid, integer, uuid[], text, text, text, uuid, uuid, text)
  -- p_signature_intent_id uuid no lugar de p_signature text
cancel_or_reopen_collection(uuid, integer, text, text, uuid, text)

ORDEM OBRIGATÓRIA
Chat 3 NÃO é “a migration que falta sozinha”. Ela DROP POLICY em delivery_terms / delivery_term_items e revoga EXECUTE das RPCs de intent. Se rodar Chat 3 antes da 3b, falha ou deixa PUBLIC execute nas RPCs que a 3b criar depois.
Não aplicar Chat 2 isolada. `db push` empurra a fila inteira.

BUGS A CORRIGIR ANTES DO PUSH (só arquivos 1 e 2)

Arquivo 1 — 20260823000000_phase_3_idempotency_intents_delivery_terms.sql

A) `CREATE POLICY IF NOT EXISTS` é inválido no Postgres 17. Trocar por `DROP POLICY IF EXISTS` + `CREATE POLICY` nestas 4:
   - delivery_terms_admin_all
   - delivery_term_items_admin_all
   - collection_signatures_read_delivery_or_checkin
   - collection_signatures_insert_delivery_intent
   (`CREATE TRIGGER IF NOT EXISTS` é válido no PG 14+; pode ficar.)

B) Wrappers públicos `prepare/commit/cancel_delivery_signature_intent` estão `language plpgsql` com SELECT solto. Isso quebra com “query has no destination for result data”. Trocar para `language sql` (ou plpgsql com BEGIN RETURN ... END). Não mudar os private.*.

C) `delivery_term_items` tem
   FOREIGN KEY (delivery_term_id, organization_id) REFERENCES public.delivery_terms(id, organization_id)
   mas `delivery_terms` só tem PK (id) e UNIQUE (organization_id, collection_id).
   Antes desse FK, adicionar UNIQUE (id, organization_id) em delivery_terms.
   Os FKs para collections e collection_items já têm unique no remoto — ok.

D) O DROP/CREATE do CHECK de idempotency_requests REMOVE 'revise'. O remoto hoje tem
   operation IN ('finalize','cancel','reopen','revise').
   A lista nova deve MANTER 'revise' e SOMAR as ops de oficina:
   workshop_check_in, save_technical_budget, budget_approval,
   update_service_progress, register_invoice_reference, customer_delivery,
   cancel_collection, reopen_collection.
   Mesmo padrão aditivo da 3a (DROP CONSTRAINT + ADD CHECK mais largo). Sem wipe.

Arquivo 2 — 20260823000001_phase_3_rpcs_idempotency.sql

E) CREATE OR REPLACE com assinatura nova NÃO substitui a 3a — cria overload. Chat 3 depois dá GRANT authenticated nas duas. DROPAR as 7 assinaturas 3a ANTES de criar as 3b (lista viva acima). Não dropar as assinaturas novas.

Arquivo 3 — 20260827120000_phase_4_chat2_client_item_id.sql
Já revisado. Seguro DEPOIS da 3b: coluna nullable, índice único parcial, DROP só da de 7 args, CREATE da de 8 args com p_client_item_id opcional, GRANT só authenticated. Tipos TS em src/shared/api/database.types.ts já têm p_client_item_id.

Arquivo 4 — 20260828120000_phase_4_chat3_security_acl.sql
Consistente SE a 3b rodou antes. Loop por proname (todas as overloads). FOR ALL → SELECT/INSERT/UPDATE, sem DELETE. Não reescrever.

COMO APLICAR (repetição explícita)
cwd obrigatório: sistema-coleta
CLI pinada: supabase 2.114.0 no package.json.

  npx supabase db push --dry-run
  npx supabase db push

Se o perfil global Windows faltar:
  $env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-cli'

Antes do push: confirmar que o link é ngmkzmhkybspkwoqibha (ler supabase/.temp/project-ref).
Dry-run deve listar exatamente os 4 arquivos, nessa ordem.

PROIBIDO de novo: apply_migration do plugin, db reset, db reset --linked, drop de dados.

DEPOIS DO PUSH
1. list_migrations no plugin: as 4 versões (20260823000000, 20260823000001, 20260827120000, 20260828120000) têm de aparecer.
2. execute_sql (só leitura):
   - create_collection_item tem 8 args (inclui p_client_item_id).
   - As 7 RPCs 3a antigas sumiram; só as assinaturas 3b.
   - EXECUTE das RPCs de oficina + intent só para authenticated (não PUBLIC/anon).
   - delivery_terms existe com UNIQUE (id, organization_id).
   - client_item_id existe em collection_items.
3. Opcional: npm run db:types:remote e revisar o diff.
4. Auth > Password Security: leaked-password protection continua checklist MANUAL. Não bloqueia este push.
5. Advisor pode flagar RLS off em private.* (padrão Fase 1). Não ligar RLS em private sem policies. Só reportar.

FORA DE ESCOPO
- Chat 4 observabilidade, Chat 5 backup, gates remotos da Fase 1A.
- Commit / PR, a menos que o humano peça.
- Reescrever RPCs 3b além dos DROPs e dos 4 bugs do arquivo 1.
```

---

## Notas para o humano

- Apply na próxima sessão: **`npx supabase db push` em `sistema-coleta`**. Plugin só para leitura. Sem `apply_migration`.
- O plugin está ok. O remoto saudável é **sistema-coleta-mjt** (`ngmkzmhkybspkwoqibha`).
- Chat 3 já está no código e no ADR 0007; a migration **não** foi aplicada. As da Fase 3b e do Chat 2 também não.
- Esta sessão só investigou. Nenhum SQL foi editado e nada foi aplicado.
- Depois que a outra sessão terminar o push, este handoff pode ser apagado ou arquivado — não é documento de fase.
