# Fix prompt — Sistema Coleta MJT (Fase 1/2 leftovers + document resto)

Copy this whole file into a new session. The **Fase 1 gate is closed** on the walk guia: official number **and** PDF **and** anonymous `/d/{token}` download already passed on 2026-09-05. This session exists to fix the leftovers that still hurt the walk, plus three document bugs that are **not** Fase 1/2 closers (scan “Fase 4 resto”). Do **not** reopen issuer, finalize SQL, or a second collection.

## Role

Stay in `sistema-coleta/`. Feature-first. No architecture rewrite. No email send. No Fase 3 auth / Fase 5 polish / oficina as the close.

App: `http://localhost:3000` (`npm run dev` in `sistema-coleta/`). If port 3000 is already taken, use that existing server — do not start a second Next on 3002.

Linked remote Supabase only.

## Hard constraints

- Work only inside `sistema-coleta/`.
- Never `db reset` / wipe / drop.
- Do **not** discard collection `4bf31deb-d0db-4793-84da-a047f84fd203`. It is no longer a draft.
- Do not create a second collection to prove Fase 1.
- Do not print `.env`, service role, CPF, CNPJ, phone, signature bytes, or share tokens/URLs.
- Do not set `DOCUMENT_EMAIL_SEND_ENABLED=true`. Do not send email/WhatsApp.
- Do not loosen PNG/JPEG/WebP ≤ 2 MB private buckets.
- Do not `service_role` user uploads.
- Do not re-diagnose Storage 403 on `collection-signatures`.
- Do not redo issuer RPC, controlled empresa form, dashboard `todayLabel`, retry-button UX, or the `document_id` 42702 migration.
- Do not commit unless the human asks.
- Seed guias `MJT-2026-900001`–`900004` prove hub CTAs only. They have **no document rows** and cannot prove PDF.

## Current truth (do not re-litigate)

Walk collection: `4bf31deb-d0db-4793-84da-a047f84fd203`  
Customer: `3a963d66-de94-4108-86de-da21c0f2f97e` (Joao Marcelo Walk)

| Check | Last live value |
| --- | --- |
| Signature | committed |
| Status | `collected` |
| Official code | `MJT-2026-000001` |
| Hub | title is the official number; `collection.finalized` in history |
| PDF | **Baixar PDF** on `/coletas/4bf31deb-…/documentos` (versão 1) |
| Share | **Criar link seguro** → `/d/{token}` only (never `/api/documents/{id}/download`) |
| Anonymous download | `/d/{token}/download` returned 200 + `%PDF` (do not paste the token) |
| Issuer + logo | complete. Dashboard: “Dados jurídicos e logo institucional confirmados.” |
| Finalize SQL | fixed. Additive migration `20260905173235_fix_finalize_document_id_ambiguity.sql` applied with `supabase db push --linked --yes`. Locals are `v_document_id`; `ON CONFLICT ON CONSTRAINT document_jobs_document_id_job_type_key`. |

Prior sessions already implemented and walked: issuer publish, empresa form keeps submitted values, **Tentar de novo** / **Tentando novamente…**, `use-online-status`, hub CTAs on seeds.

---

## Already done — do not redo

- `42702` on `save_company_issuer_settings` (`organization_id`) — `20260905151120_fix_company_issuer_settings_rpc.sql`.
- `42702` on `finalize_collection` (`document_id`) — `20260905173235_fix_finalize_document_id_ambiguity.sql`.
- Finalize + official number + PDF + `/d/{token}` on the walk guia.
- Retry UX, controlled empresa form, dashboard date hydration (`America/Sao_Paulo` on the server).
- App-side hydration for `useLinkStatus` / bottom-nav active class: `useHydrated` in [`src/shared/lib/use-hydrated.ts`](../../src/shared/lib/use-hydrated.ts); pending markers stay idle during SSR.
- Stable `pt-BR` dates: [`src/shared/lib/format-date-time-pt-br.ts`](../../src/shared/lib/format-date-time-pt-br.ts) used by hub, timeline, Documentos.

A Cursor IDE snapshot that injects `data-cursor-ref` can still raise the Next overlay. That is **tooling**, not an app bug. Do not “fix” it with `suppressHydrationWarning`. Accept = no overlay in the human’s own Chrome on the pages below.

---

## P0 — Still Fase 1/2 leftover (fix these)

### 1. Stale PWA `sw.js` crashes `/itens`

**Symptom.** First open of `/coletas/4bf31deb-…/itens` showed **Algo deu errado** / “Não foi possível carregar esta tela” because a stale SW (`http://localhost:3000/sw.js`) served an old Turbopack chunk (`collection-capture-page.tsx` module factory missing). After **one** unregister + cache clear, itens loaded (1 item, customer OK).

**Where.** [`public/sw.js`](../../public/sw.js), [`src/_app/pwa/model/service-worker-registration.ts`](../../src/_app/pwa/model/service-worker-registration.ts), [`src/shared/lib/pwa/shell-cache-policy.ts`](../../src/shared/lib/pwa/shell-cache-policy.ts).

**Fix.** Keep the shell safe in `npm run dev`. A stale SW must not serve a missing module factory. Do not invent a second draft to test. Do not cache HTML / API / PDF.

**Accept.** Opening `/itens` (or `/coletas/nova` then an existing draft) does not require a manual unregister. Customer panel still works. If hydrate fails, keep `Não foi possível carregar o cliente` + **Tentar de novo** — no empty items list.

### 2. Re-certify hydration overlay in the human’s Chrome

**Symptom (before the `useHydrated` fix).** Overlay ate clicks on Documentos / empresa / pending banner. Stack cited `pending-nav-link.tsx` and `mobile-page-header.tsx`. Empresa page used to be one long line with a `window` / locale-date mismatch; dashboard `todayLabel` is already server-side.

**Where.** [`src/shared/ui/pending-nav-link.tsx`](../../src/shared/ui/pending-nav-link.tsx), [`src/shared/ui/mobile-bottom-nav.tsx`](../../src/shared/ui/mobile-bottom-nav.tsx), [`src/_pages/company-settings/ui/company-settings-page.tsx`](../../src/_pages/company-settings/ui/company-settings-page.tsx).

**Fix.** Only if the human’s Chrome still shows “1 Issue” on first load (hard refresh, no Cursor snapshot). Do not chase `data-cursor-ref`.

**Accept.** No overlay on first load of `/dashboard`, `/coletas`, `/configuracoes/empresa`, `/coletas/4bf31deb-…`, `/coletas/4bf31deb-…/documentos`, and the pending banner. **Salvar** / **Continuar** / **Tentar de novo** receive the click.

### 3. Optional — honest PT for unknown finalize SQL

**Symptom.** Unknown SQL (the old `42702`) mapped to generic **Falha ao sincronizar** via `messageForQueueError` → `operation_failed`. Retry stayed clickable. The 42702 case is gone.

**Where.** [`src/_pages/collection-drafts/model/offline-copy.ts`](../../src/_pages/collection-drafts/model/offline-copy.ts), [`src/shared/lib/action-failure-code.ts`](../../src/shared/lib/action-failure-code.ts).

**Fix (optional).** A dedicated machine code from finalize for unexpected DB failures, mapped to one Portuguese sentence. Still no raw SQL / `42702` / `document_id` in the UI.

**Accept.** Failures stay Portuguese + **Tentar de novo**. Fail if the chip says **Salvo neste aparelho** after an online finalize error.

---

## P1 — Not Fase 1/2, but still broken (scan “Fase 4 resto”)

These live on the document/share/QR path. ADR [`0004`](../decisions/0004-phase-2-documents-sharing.md) parked **B28** here on purpose. Fix them properly. Do not treat them as a new Fase 1 close. Prove on the **same** walk guia (`MJT-2026-000001`). Do not print tokens.

### 4. B28 — consume share only after a signed URL exists

**Symptom.** `/d/{token}/download` calls `consumeDocumentShare` (increments `download_count`) **before** `createConsumedShareDownload`. If Storage fails to mint the signed URL, the client gets 404 **and** loses one of the max downloads. A 429 is JSON, so an `<a href>` shows a JSON error instead of a PDF.

**Where.**

- [`app/(public)/d/[shareToken]/download/route.ts`](../../app/(public)/d/[shareToken]/download/route.ts)
- [`src/_pages/collection-documents/api/delivery/queries.server.ts`](../../src/_pages/collection-documents/api/delivery/queries.server.ts) (`consumeDocumentShare`, `createConsumedShareDownload`)
- RPC `consume_document_share`

**Fix.** Do not increment quota until a signed URL exists (or roll the increment back if Storage fails). Keep token hashing, expiry, revoke, `no-store`, `Referrer-Policy: no-referrer`. Do not make the bucket public.

**Accept.** A Storage failure does not burn a download. Happy path still redirects to a short-lived signed URL and returns a PDF. Rate-limit / invalid token stay unusable (404/429) without leaking paths.

### 5. PDF retry is a stub (always 422)

**Symptom.** `POST /api/collections/{id}/documents/{documentId}/retry` always returns **422** `document_retry_not_available` (“A geração é retomada pelo worker com lease idempotente.”). A `failed` `render_pdf` job has no working UI retry. Happy path uses `after()` + cron only.

**Where.** [`app/api/collections/[id]/documents/[documentId]/retry/route.ts`](../../app/api/collections/[id]/documents/[documentId]/retry/route.ts). Worker: `processQueuedDocumentRenders` / `POST /api/internal/document-jobs/run`.

**Fix.** A real authenticated retry that re-queues or releases a failed job under the existing lease/idempotency rules. Do not generate PDF in the browser. Do not expose `DOCUMENT_WORKER_SECRET` to the client. Cron stays retry-only.

**Accept.** After a failed job (or a safe synthetic fail in tests — not a second walk collection), Documentos can recover to **Baixar PDF** or honest “Gerando o PDF…”. 403/`forbidden` = stop.

### 6. `/verificar/{token}` 500 on rate limit

**Symptom.** HTML [`app/(public)/verificar/[verificationToken]/page.tsx`](../../app/(public)/verificar/[verificationToken]/page.tsx) calls `enforcePublicVerificationRateLimit` with **no** try/catch. Hammering the QR page throws → Next **500**. The JSON twin [`app/api/public/collections/[verificationToken]/route.ts`](../../app/api/public/collections/[verificationToken]/route.ts) already returns **429** / **503**.

Second issue: if `verify_collection_document` returns a workshop status (`in_service`, …), Zod that only allows `collected | canceled` shows “Registro não encontrado” for an authentic guia.

**Fix.** Same rate-limit handling as the JSON route (friendly 429 page, not 500). Align the public DTO with statuses the RPC can actually return. Mask PII. Do not print the verification token.

**Accept.** Burst of `/verificar/{token}` → Portuguese wait / 429, never an uncaught 500. A collected walk guia still verifies as authentic. Canceled stays distinguishable. Invalid token stays “não encontrado”.

---

## Observe only (do not start unless D leftovers above are done)

| What | Expected |
| --- | --- |
| Email / WhatsApp send | Dry-run only. Body/share stay `/d/{token}`. |
| Remote RLS / concurrency / Storage isolation / cleanup gates | Still **ADIADO** (Fase 1A). |
| Optional F throwaway draft | Do not discard `4bf31deb-…`. |
| `NEXT_PUBLIC_APP_URL` missing (scan 4.5) | Only if QR/PDF render fails with `document_verification_base_url_missing`. Do not print the URL in docs. |
| Document revision UI | RPC `revise_collection_document` exists. No V1 screen required unless the human asks. |
| Seed hub CTAs | Re-check **only** if you touch workshop CTA code. |

Workshop seeds (do not confirm Cancelar / Reabrir):

| Seed | URL | Expected |
| --- | --- | --- |
| `MJT-2026-900001` rejected | `/coletas/a1000000-0000-4000-8000-000000000001` | Novo orçamento + Cancelar. No Reabrir. |
| Budget `900001` | `/oficina/orcamento` | Item A1, total R$ 15,00. |
| `MJT-2026-900003` canceled | `/coletas/a1000000-0000-4000-8000-000000000003` | Reabrir only. |
| `900004` collected | `/coletas/a1000000-0000-4000-8000-000000000004` | Cancelar visible. |
| `900002` in_service | `/coletas/a1000000-0000-4000-8000-000000000002` | Cancelar visible. |

---

## Implementation order

1. Stale SW so `/itens` does not require unregister.
2. Re-walk hydration in the human’s Chrome (fix only if overlay still appears without Cursor refs).
3. B28 — consume share after signed URL.
4. `/verificar` rate-limit + status DTO.
5. PDF retry (real, not 422 stub) — tests first if you need a failed job; never a second walk collection.
6. Optional PT for unknown finalize SQL.
7. Fill the table below.

`scripts/fase1-gate-walk.ts` is an RPC helper. It does **not** replace the browser walk.

## Do not

- Mark Fase 1 un-closed. Number + PDF + `/d/{token}` already passed.
- Redo issuer / `document_id` / retry labels / empresa controlled fields.
- Enable email, reset the DB, or print tokens.
- Treat a Cursor `data-cursor-ref` overlay as a product fail.

## Re-walk table

| # | Check | Pass / fail / blocked | Evidence (URL + action) |
| --- | --- | --- | --- |
| 1 | `/itens` loads without SW unregister | | |
| 2 | No hydration overlay in human Chrome (dashboard / coletas / empresa / hub / documentos / banner) | | |
| 3 | Clicks work: Continuar / Tentar de novo / Salvar | | |
| 4 | Share download: Storage fail does not burn quota (test or forced fail) | | |
| 5 | `/d/{token}/download` still returns PDF on the walk guia | | |
| 6 | `/verificar/{token}` burst → 429/wait, not 500 | | |
| 7 | Walk guia still authentic on `/verificar/{token}` | | |
| 8 | Failed PDF job can retry to **Baixar PDF** or honest pending | | |
| 9 | Queue errors stay PT + retry (if a fail happened) | | |
| 10 | Hub seeds CTAs (only if CTA code changed) | | |
