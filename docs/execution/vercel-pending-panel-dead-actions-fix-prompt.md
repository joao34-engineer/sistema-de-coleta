# Fix prompt — pending panel leftover discard (`immutable_record`)

| Campo | Valor |
| --- | --- |
| **Status** | **Almost closed** — Waves 2–3 + most of Wave 1 shipped and re-walked on Production 2026-09-06. **Only check 2 is open.** |
| **Shipped SHA** | `3098350` (`fix panel`) on `https://sistema-de-coleta.vercel.app` |
| **Open** | Leftover `e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0`: **Descartar rascunho** confirm OK does not clear the panel |

Copy the **Remaining work** section into a new session. Do not re-implement Waves 2–3. Feature-first. Stay in `sistema-coleta/`.

Related: [`vercel-finalize-hub-crash-fix-prompt.md`](./vercel-finalize-hub-crash-fix-prompt.md). Do not re-litigate hub-null or location-on-create.

---

## Remaining work (check 2 only)

Production leftover still shows **Coletas pendentes de sincronizar**. After the shipped drain, failed `finalize` rows are `cancelled_by_discard`. Server discard then returns **`immutable_record`**, which the UI does not map → **Falha ao sincronizar**. The card stays.

**Do this:**

1. Treat `immutable_record` like `collection_not_draft` / `not_found` in [`offline-runner.ts`](../../src/_pages/collection-drafts/model/offline-runner.ts) discard replay: **purge local** + `official_kept` if the server row cannot be deleted (signature / issued identity / trigger). Do **not** delete a finalized guia.
2. Map the code in [`offline-copy.ts`](../../src/_pages/collection-drafts/model/offline-copy.ts) / [`action-failure-code.ts`](../../src/shared/lib/action-failure-code.ts) to honest PT (reuse `discardOfficialKept` if the guia was kept). Never show the raw machine code.
3. After confirm OK on leftover `e1f57d1a`, the panel must vanish. Confirm **Cancel** still no-ops.
4. Walk `4bf31deb-…` / `MJT-2026-000001` and `MJT-2026-000002` stay untouched.

**Do not** write a location into leftover IDB. Do not `db reset`. Do not print PII / tokens. Commit only if the human asks.

**Test:** discard replay with `immutable_record` (and `collection_not_draft` / `not_found`) → local tree gone, `officialKept` true. No new banner suite.

**Accept:** Production leftover **Descartar** → confirm OK → no pending card. Checks 1 and 3–8 stay green.

---

## Already done — do not redo

Shipped in `3098350` and re-walked on Production 2026-09-06.

| Wave | What shipped | Re-walk |
| --- | --- | --- |
| **1 (partial)** | Discard **preempts** failed finalize; extra discards cancelled (`cancelled_by_discard`); discard button has busy state; confirm Cancel works | Checks **1**, **5** |
| **2** | Terminal `collection_incomplete` is not retried as a no-op loop; **Completar coleta** + location PT; **Tentar de novo** shows **Tentando novamente…** | Check **3** |
| **3** | **Continuar** → `/revisao` when location missing; same-URL Continuar collapses; revisão edits **Local da coleta \***; emit disabled until filled; nova coleta has required location | Checks **4**, **7** |
| **4** | Deployed. New coleta `MJT-2026-000002` (`716e5ed5-…`) **Coletada**. Walk `MJT-2026-000001` hub + Documentos versão 1 unchanged | Checks **6**, **8** |

**Not done in Wave 1:** leftover confirm OK still fails (this file’s remaining work).

Original diagnosis (poisoned finalize queue, Continuar same-URL, generic requisitos copy, revisão display-only) is **closed**. Do not re-open those as bugs.

---

## Constraints (still bind)

- Work only inside `sistema-coleta/`.
- Never `db reset` / wipe / drop.
- Do **not** discard walk `4bf31deb-d0db-4793-84da-a047f84fd203` / `MJT-2026-000001`.
- Do not print `.env`, service role, CPF, CNPJ, phone, signature bytes, or tokens.
- DAL frozen (ADR 0009). Tests only under `sistema-coleta/tests/`. Zero `any`.
- Preflight before edit: `docs/feature-first-posture.md`, `sistema-coleta/AGENTS.md`, `sistema-coleta/docs/README.md`, `sistema-coleta/docs/coding-standards.md`.

---

## Re-walk (2026-09-06 Production)

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | **Descartar** confirm Cancel → draft stays | **pass** | Panel + leftover remain |
| 2 | **Descartar** confirm OK → panel gone | **fail — still open** | `immutable_record` → **Falha ao sincronizar**. Card stays |
| 3 | **Tentar de novo** not idle; no finalize attempt storm | **pass** | **Tentando novamente…** + `retryResult` |
| 4 | **Continuar** leaves `/itens` trap or closes panel | **pass** | Href `/revisao`; same-URL Continuar → **Ver pendentes**; location field on revisão |
| 5 | **Fechar** / **Ver pendentes** | **pass** | Dashboard and revisão |
| 6 | New coleta with location finalizes | **pass** | `MJT-2026-000002` **Coletada** + `collection.finalized` |
| 7 | No location → cannot emit; copy names the local | **pass** | Nova coleta **Local da coleta \***; revisão warning; emit disabled |
| 8 | Walk `MJT-2026-000001` hub + PDF | **pass** | Official title, **Coletada**, Documentos versão 1 |

---

## File map (only for the open fix)

| File | Why |
| --- | --- |
| `src/_pages/collection-drafts/model/offline-runner.ts` | Discard replay: purge on `immutable_record` |
| `src/_pages/collection-drafts/model/discard-local-draft.ts` | Leftover after drain must not stick on unmapped code |
| `src/_pages/collection-drafts/model/offline-copy.ts` | PT for `immutable_record` |
| `src/shared/lib/action-failure-code.ts` | Known machine code — do not show raw |
| `supabase/migrations/20260905020000_discard_collection_draft.sql` | Read only — RPC already uses `collection_not_draft` / `not_found`. Find where `immutable_record` is raised before changing SQL |
