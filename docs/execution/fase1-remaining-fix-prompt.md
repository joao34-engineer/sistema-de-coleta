# Fix prompt — Sistema Coleta MJT (remaining Fase 1 gate)

Copy this whole file into a new session. Application work from the prior handoff is **done**. This session exists to unblock **finalize + PDF + share** on the protected walk draft. Do **not** mark Fase 1 closed until all three pass.

## Role

Continue only what the 2026-09-05 afternoon live walk still failed. Stay in `sistema-coleta/`. Feature-first. No architecture rewrite. No Fase 2 leftovers as the close.

App: `http://localhost:3000` (`npm run dev` in `sistema-coleta/`). If port 3000 is already taken, use that existing server — do not start a second Next on 3002.

Linked remote Supabase only.

## Hard constraints

- Work only inside `sistema-coleta/`.
- Never `db reset` / wipe / drop.
- Do **not** discard draft `4bf31deb-d0db-4793-84da-a047f84fd203`.
- Do not create a second collection to prove Fase 1.
- Do not print `.env`, service role, CPF, CNPJ, phone, signature bytes, or share tokens/URLs.
- Do not set `DOCUMENT_EMAIL_SEND_ENABLED=true`. Do not send email/WhatsApp.
- Do not loosen PNG/JPEG/WebP ≤ 2 MB private buckets.
- Do not `service_role` user uploads.
- Do not re-diagnose Storage 403 on `collection-signatures` (already fixed).
- Do not redo issuer RPC, controlled empresa form, dashboard date hydration, or retry-button UX (already implemented and walked).
- Do not commit unless the human asks.
- Seed guias `MJT-2026-900001`–`900004` prove hub CTAs only. They have **no document rows** and cannot prove PDF.

## Current truth (do not re-litigate)

Walk collection: `4bf31deb-d0db-4793-84da-a047f84fd203`  
Customer: `3a963d66-de94-4108-86de-da21c0f2f97e` (Joao Marcelo Walk)

| Check | Last live value |
| --- | --- |
| Signature | committed |
| Status | `draft` |
| Official code | none (hub title is **Coleta**, not `MJT-2026-……`) |
| PDF | none |
| Issuer settings + logo | complete. Dashboard: “Dados jurídicos e logo institucional confirmados.” |
| `/configuracoes/empresa` save | “Configurações e perfil de emissão salvos.” Form keeps submitted values. |
| Finalize retry | **no 403**. UI: **Falha ao sincronizar**. Not `issuer_profile_incomplete`. Not “Salvo neste aparelho.” |
| Button UX | **Tentar de novo** → **Tentando novamente…** (disabled) → same PT fail, still clickable |
| Last known `row_version` | **5** (re-read before finalize; do not assume) |

Prior session diagnosed the remaining RPC error as:

```text
column reference "document_id" is ambiguous
```

Called from `finalize_collection` when assigning:

```sql
document_id := private.append_document_version(...);
-- Phase 2 path actually uses:
document_id := private.append_document_version_with_issuer(...);
```

The queue maps unknown SQL text to generic Portuguese `Falha ao sincronizar` via `messageForQueueError`. Do not “fix” that by showing raw SQL to the user.

---

## P0 — Fix (this is the Fase 1 blocker)

### 1. Qualify ambiguous `document_id` in document append / finalize

**Symptom.** After issuer publish succeeded, **Tentar de novo** still fails. Hub stays **Coleta**. Documentos stays “Rascunho sem guia emitida.”

**Where (local contract — remote may already differ; inspect live `prosrc` before writing).**

- `private.append_document_version` — `supabase/migrations/20260815090000_phase_1a_collection_core.sql` (~942)
- Phase 2 replacements — `supabase/migrations/20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql`
  - `private.append_document_version_using_issuer` (~349) — local `document_id uuid` + `returning id into document_id`
  - `private.append_document_version` (~451)
  - `private.append_document_version_with_issuer`
  - `public.finalize_collection` (~660): `document_id := private.append_document_version_with_issuer(...)` then `insert into public.document_jobs (... document_id ...)` and `on conflict (document_id, job_type)`

**Fix.** Additive migration only. Same pattern as `20260905151120_fix_company_issuer_settings_rpc.sql`:

- Rename PL/pgSQL locals that collide with columns (`v_document_id`, not `document_id`).
- Qualify every column (`document_jobs.document_id`, `documents.id`).
- Do **not** replace unrelated finalize / snapshot / sequence logic.
- Apply to linked remote: `supabase db push --linked --yes` (never reset).

**Accept.** `finalize_collection` on the walk draft returns an official code. No `42702`. UI is no longer stuck on **Falha ao sincronizar** for this cause.

### 2. Retry the same draft (do not re-sign unless pad is empty)

1. Confirm an **active** `document_issuer_profiles` row still exists. If save is needed: `/configuracoes/empresa` → **Salvar** (values are already filled).
2. Pending banner or `/coletas/4bf31deb-d0db-4793-84da-a047f84fd203/assinatura` → **Tentar de novo** only.
3. If **Tentar de novo** shows `forbidden` / 403 → **stop** (regression).
4. Prefer retry. Signature PNG is already committed.

### 3. Prove D (the missing gate)

1. Hub `/coletas/4bf31deb-d0db-4793-84da-a047f84fd203` title is `MJT-2026-……` (exactly one number; no duplicate from idempotency).
2. `/coletas/4bf31deb-…/documentos` — “Gerando o PDF da guia…” then **Baixar PDF**. Fail if “Nenhum documento disponível” with no pending/draft explanation **after** a number exists. Poll is OK. Cron is retry-only.
3. **Criar link seguro** → WhatsApp / `navigator.share` is `/d/{token}` only. Fail if `/api/documents/{id}/download`.
4. Incognito / private session: `/d/{token}/download` returns a PDF. Do not paste the token into docs.

---

## P1 — Still broken in the live walk (fix after P0, or in the same PR only if tiny)

These do **not** close Fase 1. Official number + PDF + anonymous `/d/{token}` still do.

### 4. Empresa hydration overlay still eats clicks

**Symptom.** `/configuracoes/empresa` still raises Next.js hydration overlay:

- `src/_pages/company-settings/ui/company-settings-page.tsx` (7:98)
- Message: server/client branch `if (typeof window !== 'undefined')` / `Date.now()` / locale dates
- The page is one long line. Overlay intercepted **Salvar** until dismissed.

Dashboard date hydration was already moved server-side. This page was **not** finished.

**Accept.** No “1 Issue” overlay on empresa / dashboard / coletas / pending banner in `npm run dev`.

### 5. Stale PWA SW can crash `/itens`

**Symptom.** First open of `/coletas/4bf31deb-…/itens` showed **Algo deu errado** / “Não foi possível carregar esta tela” because a stale SW (`http://localhost:3000/sw.js`) served an old Turbopack chunk (`collection-capture-page.tsx` module factory missing). After **one** unregister + cache clear, itens loaded (1 item, customer OK).

**Accept.** Dev walk does not require a crash + manual unregister. If you touch the SW, keep the shell safe; do not invent a second draft to test it.

### 6. Queue copy for this SQL failure

**Symptom.** Banner shows generic **Falha ao sincronizar**, not a specific honest PT sentence for “finalize failed after issuer was ready.” Retry is clickable. Do **not** surface `document_id` / `42702` / raw SQL.

**Accept (optional).** A dedicated machine code from finalize, mapped in `messageForQueueError` (`src/_pages/collection-drafts/model/offline-copy.ts`), still Portuguese, still retryable.

---

## Already done — do not redo

- Issuer RPC `42702` / `organization_id` — `20260905151120_fix_company_issuer_settings_rpc.sql` (remote applied).
- `saveCompanySettings` / `uploadCompanyLogo` DAL, controlled empresa form, `setupStatus` requires active issuer.
- Retry UX: **Tentando novamente…**
- `use-online-status`, dashboard `todayLabel` server-side (`America/Sao_Paulo`).
- Hub CTAs on seeds (walked and passed this afternoon).
- Tests / lint / typecheck / build from the prior session.

Workshop seeds — re-check **only** if you touch CTA code:

| Seed | URL | Expected |
| --- | --- | --- |
| `MJT-2026-900001` rejected | `/coletas/a1000000-0000-4000-8000-000000000001` | Novo orçamento + Cancelar. No Reabrir. |
| Budget `900001` | `/oficina/orcamento` | Item A1, total R$ 15,00. |
| `MJT-2026-900003` canceled | `/coletas/a1000000-0000-4000-8000-000000000003` | Reabrir only. |
| `900004` collected | `/coletas/a1000000-0000-4000-8000-000000000004` | Cancelar visible. Do not confirm. |
| `900002` in_service | `/coletas/a1000000-0000-4000-8000-000000000002` | Cancelar visible. Do not confirm. |

---

## Fase 2 leftovers (observe only)

Do **not** discard `4bf31deb-…`. Do **not** start Optional F (throwaway draft) until D already passed.

| What you see | Expected |
| --- | --- |
| Finalize after issuer+logo | Portuguese + **Tentar de novo**. Fail if **Salvo neste aparelho**. |
| `/itens` customer fail | Panel `Não foi possível carregar o cliente` + **Tentar de novo**. No empty items list. After SW unregister, walk loaded 1 item — do not treat that as a failed hydrate. |
| Discard confirm | Server copy: “neste aparelho **e no servidor**”. Click **Cancel**. |
| Pending row vanishes after official number | Normal. |

---

## Implementation order

1. Additive migration qualifying `document_id` (and any sibling collisions found in the same functions).
2. `supabase db push --linked --yes`.
3. Live retry on **the same** walk draft.
4. Official number + PDF (or honest pending) + anonymous `/d/{token}/download`.
5. Then P1 overlay / SW only if D already passed or the fix is a one-file leftover.
6. Fill the table below. Update `docs/execution/fase1-gate-fix-handoff.md` only if the human wants the old file rewritten.

`scripts/fase1-gate-walk.ts` is an RPC helper. It does **not** replace the browser walk (overlay, Continuar, share button, incognito).

## Do not

- Redo issuer RPC / controlled form / retry label work.
- Discard the walk draft or create a replacement collection.
- Mark Fase 1 closed without official number **and** PDF **and** anonymous `/d/{token}` download.
- Treat **Falha ao sincronizar** after a spinner as done.

## Re-walk table (fill every row after the fix)

| # | Check | Pass / fail / blocked | Evidence (URL + action) |
| --- | --- | --- | --- |
| 1 | Hub rejected / canceled / active CTAs | | |
| 2 | Budget seed on `900001` | | |
| 3 | Issuer + logo saved; no discard | | |
| 4 | Retry finalize (no 403) | | |
| 5 | Official number `MJT-2026-……` | | |
| 6 | Documentos: **Baixar PDF** (or honest pending) | | |
| 7 | Share `/d/{token}` + incognito download | | |
| 8 | Queue errors in PT + retry | | |
| 9 | Empresa form keeps submitted values | | |
| 10 | Continuar / Tentar de novo work; no hydration overlay | | |
