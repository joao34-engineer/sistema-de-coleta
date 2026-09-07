# Fix prompt — Vercel finalize fails + hub “Algo deu errado”

| Campo | Valor |
| :--- | :--- |
| **Status** | **Closed** — ciclo coleta → número → PDF → QR em Production 2026-09-05 (`MJT-2026-000002`) |
| **Do not** | Re-implement. Scan 1.6 / 4.4 / 4.5 estão **feito**. |

The sections below are the original incident prompt. Keep for history.

---

The **Fase 1 gate stays closed** on the walk guia. This session exists so a **new** coleta on **https://sistema-de-coleta.vercel.app** can finalize, get an official number, and bake a PDF QR on that origin.

## Role

Fix two production bugs that block the QR test:

1. After **Finalizar coleta**, the hub crashes (**Algo deu errado**).
2. The new coleta never lands on the server (no new `MJT-2026-…`). Pending banner stays on **Assinatura**. **Tentar de novo** looks like a no-op.

Then **commit only if the human asks**, push `sistema-coleta` `main`, and deploy **Production** on a **new SHA** (not Redeploy of the old commit).

## App / env

- Production: `https://sistema-de-coleta.vercel.app`
- Local: existing `http://localhost:3000` only. Do not start a second Next on 3002.
- `NEXT_PUBLIC_APP_URL` on Vercel is already `https://sistema-de-coleta.vercel.app`. Do not create another env key. Do not change `.env.local` (keep localhost).
- Linked remote Supabase. Leftover SQL `inspect_document_share` + `retry_document_job` is already applied. Do **not** `db reset`.
- Do **not** set `DOCUMENT_EMAIL_SEND_ENABLED=true`.

## Hard constraints

- Work only inside `sistema-coleta/`.
- Never `db reset` / wipe / drop.
- Do **not** discard walk collection `4bf31deb-d0db-4793-84da-a047f84fd203` / `MJT-2026-000001`.
- Do **not** discard leftover draft `e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0` unless the human says so. Do not mutate its PDF/jobs (it has none).
- Do not print `.env`, service role, CPF, CNPJ, phone, signature bytes, share tokens, or verification tokens.
- Do not loosen Storage. Do not `service_role` user uploads.
- Do not reopen issuer RPC, `document_id` 42702, empresa controlled form, or email send.
- Tests only under `sistema-coleta/tests/`. Zero `any`. DAL frozen (ADR 0009).
- Preflight before any edit: `docs/feature-first-posture.md`, `sistema-coleta/AGENTS.md`, `sistema-coleta/docs/README.md`, `sistema-coleta/docs/coding-standards.md`.

## Live evidence (2026-09-05, do not re-litigate)

| Fact | Value |
| --- | --- |
| After sign, URL | `https://sistema-de-coleta.vercel.app/coletas/e1f57d1a-854a-4a70-8e64-6f6ad5f62bc0` |
| Screen | **Algo deu errado** / **Não foi possível carregar esta tela.** Digests seen: `1748188988`, then `2675204244` |
| Banner | **Coletas pendentes de sincronizar** — Joao Marcelo Walk · **Assinatura** |
| Server list | No new official number. Only walk `000001` + seeds `900001`–`900004` |
| Review before sign | **Local da coleta não informado** |
| Chip before sign | **Falha ao sincronizar** |
| Nova coleta on Vercel (this walk) | DOM had no Local da coleta / cidade / UF fields |
| **Tentar de novo** | Card stays. No error line. Looks like a no-op |
| Walk PDF QR | Still localhost (expected — baked earlier). Do not use it to prove this fix |

`Ref` is a Next digest. It is not an app code. The real throw is stripped by `RouteErrorFallback`.

Git (as of investigation): `sistema-coleta` `main` = `origin/main` = `6d91eea` (“latest changes”). Leftover session + later Fechar-on-banner work are **dirty / untracked**, not pushed. An env-only Vercel Redeploy rebuilds `6d91eea`, not the laptop tree.

**Confirm first:** Vercel Production deployment SHA. If it is older than `6d91eea`, they Redeployed an old build (that would explain a missing location field). If it is `6d91eea`, leftover/Fechar are still absent.

## Verdicts (do not re-litigate)

### A. Hub crash — `collection_detail_contract_invalid` on SQL null

`get_collection_detail` for a **local-only** UUID returns PostgreSQL `NULL` (`data: null`, `error: null`). `getCollectionDetail` runs Zod on null and throws `collection_detail_contract_invalid`. `if (!collection) notFound()` is **dead** because the function never returns null.

`getServiceOrder` / `getBudgetItems` are caught. Detail + events are not.

After finalize, capture always `router.push(/coletas/${draftId})`. That id is still the client UUID. Drain did not create a server row → hub 500.

**Required:** `data == null` → return `null` (or typed not-found). Keep throwing only on real RPC error or non-null Zod fail. Then `notFound()` works. Prefer **redirect to `/coletas/{id}/itens`** so the pending draft can resume. Never “Algo deu errado” for an unknown UUID.

Do **not** send a local-only id to the hub after finalize (`queued_local` / leftover still in IDB → `/coletas` or `/itens`, not hub).

### B. Finalize never succeeded — incomplete / failed drain

`finalize_collection` raises `collection_incomplete` when `collection_location` (or responsible / `collected_at`) is empty. This draft’s review said location was not informed. Local tree gates finalize on `hasRequiredCollectionLocation`; the Vercel UI used in this walk did not collect location.

Chip **Falha ao sincronizar** appeared **before** signature, so an earlier mutation (`create_draft` / `add_item`) may also have failed. Drain stops at the first failure. Retry cannot invent a location.

`lastError` can stay **null** (uncaught Zod `.parse` in replay; leftover pending with no `in_flight` write). Production banner has no `retryResult` / **Fechar** → **Tentar de novo** looks dead.

Do **not** treat leftover SQL (B28 / PDF retry) as the finalize fix. Do **not** re-open Storage 403 as the close.

### C. Deploy gap

Leftover (SW, B28, verificar 429, real retry, `finalize_failed` PT) and the Fechar-on-banner patch are **not on Vercel**. `NEXT_PUBLIC_APP_URL` is set; that only affects **new** PDF/QR after a successful finalize.

`6d91eea` already contains a dedicated **Local da coleta \*** field. If Production SHA is that commit and the field is still missing, re-check the live form. If SHA is older, deploy `6d91eea` **plus** this session’s hub/drain fixes.

## What to implement (one axis: production finalize + hub)

### Wave 1 — hub must not crash (must)

**Owns:**

- `src/_pages/collection-lifecycle/api/queries.ts` (`getCollectionDetail`: null data → `null`)
- `app/(protected)/coletas/[id]/page.tsx`
- `app/(protected)/coletas/[id]/load-hub.ts` / `load-operation.ts` if they have the same dead check
- `app/api/collections/[id]/route.ts` → 404 when detail is null
- optional `lifecycle-errors.ts` `collection_not_found` → 404
- `src/_pages/collection-drafts/ui/collection-capture-page.tsx` — do not `push(/coletas/${draftId})` unless the server row exists
- `src/_pages/collection-drafts/model/present-finalize-sync.ts` — `open_collection` only when leftover is gone **and** the server has the row

**Accept:** `/coletas/e1f57d1a-…` → **Página não encontrada** or resume `/itens`. Never **Algo deu errado**. Walk hub `4bf31deb-…` still loads.

### Wave 2 — drain honesty + location gate on the shipped UI (must for a new QR)

**Owns:**

- Confirm Nova coleta on the **deployed** tree shows **Local da coleta \*** and blocks emit without it (`hasRequiredCollectionLocation` / `canFinalizeCollection`).
- Offline runner: wrap `replayMutation` `.parse` in `safeParse` → `markFailed(..., "validation_error")`. If leftover pending and no `in_flight`, set `syncStatus: "failed"` and keep/set `lastError`.
- Keep queue errors as **machine codes** (`toActionFailureCode` / `toFinalizeActionFailureCode`), not Portuguese from `toSafeActionError`.
- Pending banner: always set `retryResult` via `messageForQueueError` when drafts remain (empty `lastError` → **Falha ao sincronizar**). Keep **Fechar** (already in the dirty tree: hides the card, does **not** discard).

**Accept:** **Tentar de novo** shows PT. **Fechar** hides the card. A **new** coleta with location + item + sign finalizes on Vercel.

Do not salvage `e1f57d1a` by writing a location in IDB unless the human asks. Prove on a **new** coleta after deploy.

### Wave 3 — deploy

1. Commit in `sistema-coleta` **only if the human asks**. Include this hub/drain fix + leftover files the human wants shipped + untracked `20260905*` SQL so git matches remote. Never commit `.env.local`.
2. `git push origin main`.
3. Vercel Production of the **new SHA**. Confirm SHA ≠ previous.
4. Leave `NEXT_PUBLIC_APP_URL` as-is. No email enable. No `db push` unless a **new** additive migration was added (none required for A/B if remote already has finalize `document_id` + leftover RPCs).
5. On Vercel: Nova coleta → fill **Local da coleta** → item → sign → Finalizar.
6. Hub title is a **new** official number. Documentos → PDF. Scan QR: host must be `sistema-de-coleta.vercel.app`. Do not paste the token.
7. Walk `MJT-2026-000001` unchanged. Leftover `e1f57d1a` may stay in that browser’s IDB.

## Tests to add

- `getCollectionDetail`: `{ data: null, error: null }` → `null`, no `collection_detail_contract_invalid`.
- Non-null junk object → still `collection_detail_contract_invalid`.
- Hub / API unknown UUID → 404 or `/itens`, never error boundary.
- Capture offline / leftover finalize → CTA is `/coletas` or `/itens`, not hub.
- Banner: retry with `lastError` null → **Falha ao sincronizar**. Fechar does not discard.
- Location gate: emit disabled / blocked without location (if not already covered).

## Do not

- Mark Fase 1 un-closed.
- Discard the walk guia or (unless asked) the leftover draft.
- Enable email, reset the DB, or print tokens.
- Treat leftover B28/retry SQL as this close.
- Redeploy the old SHA and call it done.

## Orchestration

1. Confirm Vercel Production SHA vs `6d91eea`.
2. Implement Wave 1 + Wave 2. Split Grok 4.6 reviewers: (hub/null DAL), (capture navigation), (drain lastError + banner), (tests).
3. Scoped `npm run test` on owned tests, then `npm run lint` / `typecheck` on touched files.
4. Ask the human before commit/push. Then Production deploy + prove a **new** coleta QR on the Vercel origin.
