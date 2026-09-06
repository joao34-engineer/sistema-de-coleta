# Fix prompt — pending panel looks dead (`collection_incomplete`)

Copy this whole file into a new session. Use it to **implement** the pending-panel deadlock. Stay in `sistema-coleta/`. Feature-first. No architecture rewrite.

This is **not** a re-open of Fase 1 on the walk guia `MJT-2026-000001`. That guia already has a number and PDF. This session exists so the leftover draft on Production can be **discarded or completed**, and so **Continuar / Descartar rascunho / Tentar de novo** stop looking like dead controls.

Related (do not re-litigate): [`vercel-finalize-hub-crash-fix-prompt.md`](./vercel-finalize-hub-crash-fix-prompt.md) (hub null + location gate on **new** coletas). This file owns the **poisoned offline queue** + **panel CTAs**.

## Role

Fix the Production popup on

`https://sistema-de-coleta.vercel.app/coletas/e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0/itens`

Title: **Coletas pendentes de sincronizar**. Red line: **A coleta ainda não atende aos requisitos para finalizar.** The human reports that **Continuar**, **Descartar rascunho**, and **Tentar de novo** do nothing.

This is **not** a `<Dialog>`. It is `OfflinePendingPanel` (`role="status"`, `fixed … z-50`) mounted globally from [`app/(protected)/layout.tsx`](../../app/(protected)/layout.tsx) via `OfflinePendingBanner`. It appears on every protected route while IndexedDB has a non-`synced` draft. The capture-page `MobileStatePanel` after **Finalizar** (`presentFinalizeSync` → `online_failed`) is a **different** surface — do not conflate them.

Then prove a **new** coleta can still finalize after the queue rules change. Commit only if the human asks.

## App / env

- Production: `https://sistema-de-coleta.vercel.app`
- Local: existing `http://localhost:3000` only. Do not start a second Next on 3002.
- Linked remote Supabase. Do **not** `db reset`.
- Do **not** set `DOCUMENT_EMAIL_SEND_ENABLED=true`.

## Hard constraints

- Work only inside `sistema-coleta/`.
- Never `db reset` / wipe / drop.
- Do **not** discard walk collection `4bf31deb-d0db-4793-84da-a047f84fd203` / `MJT-2026-000001`.
- Do **not** write a location into IndexedDB for leftover `e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0` unless the human asks. After the drain/discard fix, **Descartar** must work on that leftover. Completing it is optional and only via the UI (editable local).
- Do not print `.env`, service role, CPF, CNPJ, phone, signature bytes, share tokens, or verification tokens.
- Do not loosen Storage. Do not `service_role` user uploads.
- Do not reopen issuer RPC, `document_id` 42702, empresa form, email send, or Fase 3 auth.
- Tests only under `sistema-coleta/tests/`. Zero `any`. DAL frozen (ADR 0009).
- Preflight before any edit: `docs/feature-first-posture.md`, `sistema-coleta/AGENTS.md`, `sistema-coleta/docs/README.md`, `sistema-coleta/docs/coding-standards.md`.

## Live evidence (2026-09-05 / 2026-09-06 — do not re-litigate)

Walked on Production while logged in. Snapshot + IndexedDB `mjt-offline-v1` (no PII below).

| Fact | Value |
| --- | --- |
| URL | `/coletas/e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0/itens` |
| Popup | `OfflinePendingPanel` — **Coletas pendentes de sincronizar** |
| Red copy | `A coleta ainda não atende aos requisitos para finalizar.` ← `messageForQueueError("collection_incomplete")` |
| Draft `lastError` | `collection_incomplete` |
| Draft `collectionLocation` | `null` |
| Draft `currentStep` | `itens` |
| Draft `syncStatus` | `failed` |
| Draft `serverRowVersion` | `4` (row **exists** on the server) |
| Draft `hasServerSignature` | `true` (PNG blob present) |
| Items on screen | 2 (`Peça teste QR Vercel`, `motor`) |
| `/itens` body | **No** “Local da coleta” field |
| **Fechar** | Works — collapses to **Ver pendentes** |
| **Continuar** | Same URL. Panel stays. Looks dead |
| **Tentar de novo** | Shows **Tentando novamente…** then the **same** red sentence (sometimes twice: `retryResult` + row). Looks dead |
| **Descartar rascunho** | Confirm **does** fire (`window.confirm`). After OK, draft **stays**. Looks dead |
| Failed `finalize` | `sequence` **4**, `status` **failed**, `lastError` `collection_incomplete`, **63 attempts** |
| Pending behind it | extra `finalize` ×2, `patch_draft` ×2 (no location), `save_signature` ×2, `add_item` `motor`, **`discard_draft` ×6** |

`discard_draft` rows prove the human already confirmed discard several times. The mutation is enqueued at the **end** of the sequence. Drain never reaches it.

## Verdicts (do not re-litigate)

### A. The handlers are not dead — the queue is poisoned

Buttons are wired:

| CTA | Where | What it actually does |
| --- | --- | --- |
| **Continuar** | [`offline-pending-panel.tsx`](../../src/_app/offline/ui/offline-pending-panel.tsx) | `Link` **always** to `/coletas/${draft.id}/itens` (`offlineCopy.resume`) |
| **Descartar rascunho** | [`offline-pending-banner.tsx`](../../src/_app/offline/ui/offline-pending-banner.tsx) | `window.confirm` → `discardLocalDraft` → if online, `runAuthenticatedDrain` |
| **Tentar de novo** | same banner | `busy` + `drainAndReload` + `setRetryResult(messageForQueueError(lastError))` |
| **Fechar** | same banner | `setCollapsed(true)` — the only CTA that visibly works today |

`drainCollectionQueue` ([`offline-runner.ts`](../../src/_pages/collection-drafts/model/offline-runner.ts)) loads `pending` **and** `failed`, sorts by `sequence` ([`offline-store.ts`](../../src/_pages/collection-drafts/model/offline-store.ts) `listMutations`), and **returns on the first error**.

On this leftover the first unfinished mutation is the **failed finalize** (`sequence` 4). Every retry replays it, RPC raises `collection_incomplete` again (`collectionLocation` still empty), `markFailed`, **stop**. Later `discard_draft` / `add_item` / location patches never run.

`discardLocalDraft` ([`discard-local-draft.ts`](../../src/_pages/collection-drafts/model/discard-local-draft.ts)) then sees the leftover draft, returns `{ ok: false, error: "collection_incomplete" }`, and the panel reprints the same sentence.

**Terminal validation is being retried as if it were transient.** 63 finalize attempts is the proof.

### B. `collection_incomplete` is location — and this leftover cannot self-heal in the current UI

Do **not** treat `e1f57d1a` as local-only. `serverRowVersion` is **4** and `create_draft` is `done`. Discard must hit the server (`shouldEnqueueServerDiscard` is true). Hub-crash notes that assumed “no server row” are stale versus this IDB dump.

RPC `public.finalize_collection` in [`20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql`](../../supabase/migrations/20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql) (~623–627) raises `P0001` / `collection_incomplete` when **any** of these is empty: `customer_id`, trimmed `collection_location`, trimmed `responsible_name`, `collected_at`. Other codes (`collection_requires_item`, `collection_requires_signature`, `issuer_profile_incomplete`) are **not** this leftover. Local gate: [`has-required-collection-location.ts`](../../src/_pages/collection-drafts/model/has-required-collection-location.ts) and [`can-finalize-collection.ts`](../../src/_pages/collection-drafts/model/can-finalize-collection.ts).

This draft has customer, responsible, `collectedAt`, items, and signature. **Only location is null.**

`saveLocalSignature` ([`offline-capture.ts`](../../src/_pages/collection-drafts/model/offline-capture.ts) ~210–235) enqueues `patch_draft` with responsible + `collectedAt` only — **never location**. `createLocalDraft` only enqueues a location patch when the create-time field is truthy (~76–83). That is why the failed finalize payload can never grow a location on retry.

Worse: filling location later still cannot unblock the leftover **until drain changes**, because any new `patch_draft` is enqueued at the **tail**. Drain still hits `finalize` sequence 4 first.

Worse still: **Revisão shows the missing location but has no input** ([`collection-capture-page.tsx`](../../src/_pages/collection-drafts/ui/collection-capture-page.tsx) ~489–501). Location is collected on **Nova coleta** ([`new-collection-page.tsx`](../../src/_pages/collection-drafts/ui/new-collection-page.tsx)). `/itens` has no location field. **Continuar** sends the user to `/itens` — the one step that cannot fix the error.

This leftover was created when Production review said “Local da coleta não informado” (see hub-crash prompt). Do not invent a location in IDB.

### C. Continuar is a same-route no-op

`captureStepHref` already knows `itens` / `revisao` / `assinatura`. The panel ignores `currentStep` and the missing-field. User is already on `/itens` → Next.js client navigation is a no-op. Panel does not collapse (unlike **Fechar**).

Copy `collection_incomplete` → generic “não atende aos requisitos” hides **what** to fix. Capture already has `Informe o local da coleta antes de continuar.` — the panel does not use it.

## What to implement (one axis: pending panel + drain honesty)

### Wave 1 — Discard must win (must)

User said throw this draft away. Six `discard_draft` rows are already waiting.

**Owns:**

- [`discard-local-draft.ts`](../../src/_pages/collection-drafts/model/discard-local-draft.ts)
- [`offline-runner.ts`](../../src/_pages/collection-drafts/model/offline-runner.ts) `drainCollectionQueue` / `replayMutation`
- [`offline-store.ts`](../../src/_pages/collection-drafts/model/offline-store.ts) `enqueue` (optional dedupe)

**Required behavior:**

1. If any `discard_draft` is `pending` / `failed` / `in_flight` for a collection, **preempt**: cancel other unfinished mutations (do not replay `finalize` / `patch_draft` / `save_signature` / `add_item`), then replay **one** discard (server if `shouldEnqueueServerDiscard`, else purge local).
2. `discardLocalDraft` must not depend on a successful full drain of a failed finalize. After confirm: enqueue discard (dedupe — do not stack a 7th), then drain with preemption, then delete the local tree when leftover is gone.
3. Deduplicate `discard_draft`. One pending discard per collection.
4. Keep `collection_not_draft` / `not_found` as **official kept** (do not delete a finalized guia). Walk `4bf31deb-…` must stay untouched.
5. Show busy on **Descartar** (`isLoading`), then either the panel vanishes or a **new** Portuguese error (not a silent reprint of `collection_incomplete`).

**Accept:** On leftover `e1f57d1a`, **Descartar rascunho** → confirm → panel gone, `/itens` empty or redirected to `/coletas`. Server draft (if still `draft`) discarded. Walk guia unchanged. Confirm **Cancel** still no-ops.

### Wave 2 — Retry must not loop a terminal finalize (must)

**Owns:** `drainCollectionQueue`, `messageForQueueError` / [`offline-copy.ts`](../../src/_pages/collection-drafts/model/offline-copy.ts), banner `onRetry`.

**Required behavior:**

1. Treat `collection_incomplete` (and other terminal validation codes: `validation_error` with no payload change) as **blocked**, not infinitely retryable. Do **not** increment attempts into the dozens.
2. Do not replay `finalize` while local `collectionLocation` fails `hasRequiredCollectionLocation`. Skip / keep blocked until a later successful `patch_draft` writes location — **or** until discard preempts.
3. Prefer applying `patch_draft` / item mutations **before** any `finalize` for that collection (fixes the “location patch is behind a failed finalize” poison).
4. **Tentar de novo** when `lastError === collection_incomplete`: set `retryResult` to an honest sentence (**Informe o local da coleta para finalizar.**), do **not** look idle. Optional: disable green retry and show **Completar coleta** instead of pretending sync will succeed.

**Accept:** Retry no longer burns attempts on the same failed finalize. Banner text changes or the CTA changes. A **new** coleta with location still finalizes.

### Wave 3 — Continuar must unblock the human (must)

**Owns:** [`offline-pending-panel.tsx`](../../src/_app/offline/ui/offline-pending-panel.tsx), [`capture-step-href.ts`](../../src/_pages/collection-drafts/model/capture-step-href.ts), review step in [`collection-capture-page.tsx`](../../src/_pages/collection-drafts/ui/collection-capture-page.tsx).

**Required behavior:**

1. **Continuar** goes to the step that can fix the error, not always `/itens`.
   - `collection_incomplete` / missing location → `/coletas/${id}/revisao` (after wave 3.2) or resume cliente with location editable.
   - `currentStep === assinatura` → `/assinatura`.
   - Already on that URL → **collapse the panel** (same as **Fechar**) so the form is usable.
2. Revisão must **edit** Local da coleta (required), persist `patch_draft` / local draft field, then allow emit. Display-only + “Informe o local…” is not enough.
3. Panel copy for `collection_incomplete` must name the missing location (reuse capture copy). Keep machine code in the queue; PT only in the UI.

**Accept:** From the leftover URL, **Continuar** either opens revisão with an editable local **or** closes the panel if already there. User can type a location (if they choose to salvage) or **Descartar**. `/itens` is no longer a trap.

### Wave 4 — Deploy + prove

1. Commit in `sistema-coleta` **only if the human asks**. Never commit `.env.local`.
2. `git push origin main` + Vercel Production on the **new** SHA.
3. Production leftover `e1f57d1a`: **Descartar** (preferred) or Completar with a typed location — human chooses. Do not IDB-patch.
4. New coleta: Local da coleta * → item → sign → Finalizar → new `MJT-2026-…`. Hub must not crash (hub-null fix if not already shipped).
5. Walk `MJT-2026-000001` unchanged.

## Tests to add

Extend the existing files. Do not invent a second banner suite.

- `tests/component/offline-pending-banner.test.tsx` / `offline-pending-banner-online.test.tsx` — Continuar href, discard busy, same-URL collapse
- `tests/unit/offline-runner.test.ts` — drain preemption / patch-before-finalize
- `tests/unit/offline-copy-queue-error.test.ts` — already asserts `/requisitos/i`; update if the PT names the local
- `tests/unit/present-finalize-sync.test.ts` — leave unless hub navigation changes

New cases:

- Drain: failed `finalize` (`collection_incomplete`) + later `discard_draft` → discard wins; draft tree gone; finalize not retried.
- Drain: failed `finalize` + later `patch_draft` with location → patch applied, then finalize can succeed (or old finalize cancelled and a fresh one used — pick one and test it).
- Drain: `collection_incomplete` does not increment attempts without a payload change.
- `enqueue` discard is idempotent (second discard does not add another row).
- `discardLocalDraft` online with poisoned finalize queue → `ok: true` (or official kept), not `collection_incomplete`.
- Panel: `collection_incomplete` → Continuar href is revisão (or cliente), not `/itens` when already on itens; same-URL Continuar collapses.
- Review: empty location → emit disabled; typed location persists and `canFinalizeCollection` becomes true (with signature).
- `messageForQueueError("collection_incomplete")` names the local.
- Walk UUID is never used in discard tests.

## Do not

- Mark Fase 1 un-closed on the walk guia.
- Discard `4bf31deb-…` / `MJT-2026-000001`.
- Write location into leftover IDB from the agent.
- Treat leftover B28 / PDF retry / issuer SQL as this close.
- Show raw SQL / `collection_incomplete` to the user (map to PT).
- Redeploy an old SHA and call it done.
- “Fix” clicks by removing `window.confirm` without a visible in-app confirm.

## Orchestration

1. Implement Wave 1 first — leftover becomes escapable.
2. Wave 2 so retry stops lying.
3. Wave 3 so Continuar / revisão can complete a **new** or salvageable draft.
4. Scoped tests, then `npm run lint` / `typecheck` on touched files.
5. Ask before commit/push. Then Production prove.

## Re-walk table

| # | Check | Pass / fail / blocked | Evidence |
| --- | --- | --- | --- |
| 1 | Leftover `/itens`: **Descartar** confirm Cancel → draft stays | | |
| 2 | Leftover: **Descartar** confirm OK → panel gone, no reprint of requisitos | | |
| 3 | Leftover: **Tentar de novo** does not look idle; no attempt storm | | |
| 4 | Leftover: **Continuar** leaves `/itens` trap or closes panel | | |
| 5 | **Fechar** / **Ver pendentes** still work | | |
| 6 | New coleta with location finalizes on Vercel | | |
| 7 | New coleta without location cannot emit; copy names the local | | |
| 8 | Walk `MJT-2026-000001` hub + PDF unchanged | | |

## File map (implementer)

| File | Why |
| --- | --- |
| `app/(protected)/layout.tsx` | Global mount — do not move the banner |
| `src/_app/offline/ui/offline-pending-panel.tsx` | Continuar href + copy |
| `src/_app/offline/ui/offline-pending-banner.tsx` | Retry / discard busy + results |
| `src/_pages/collection-drafts/model/offline-runner.ts` | Preempt discard; skip blocked finalize; patch-before-finalize |
| `src/_pages/collection-drafts/model/offline-store.ts` | Dedupe discard enqueue |
| `src/_pages/collection-drafts/model/discard-local-draft.ts` | Discard must not wait on failed finalize |
| `src/_pages/collection-drafts/model/offline-copy.ts` | Honest PT for missing location |
| `src/_pages/collection-drafts/model/has-required-collection-location.ts` | Gate (keep) |
| `src/_pages/collection-drafts/model/can-finalize-collection.ts` | Gate (keep) |
| `src/_pages/collection-drafts/model/capture-step-href.ts` | Resume URL |
| `src/_pages/collection-drafts/ui/collection-capture-page.tsx` | Editable local on revisão |
| `src/_pages/collection-drafts/ui/new-collection-page.tsx` | Create-time local (already exists — do not remove) |
| `src/_pages/collection-drafts/model/offline-capture.ts` | `saveLocalSignature` must include location in `patch_draft` when present; `createLocalDraft` already patches when truthy |
| `supabase/migrations/20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql` | RPC gate (~623–627). Read only — do not rewrite finalize SQL |
| `src/_app/actions/draft-flow.actions.ts` | `finalizeCollectionAction` already returns machine codes — keep it that way |
| `src/shared/lib/action-failure-code.ts` | `collection_incomplete` is a known code — do not show it raw |
