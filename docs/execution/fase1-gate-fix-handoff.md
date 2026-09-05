# Fix prompt — Sistema Coleta MJT (Fase 1 gate, post-walk)

Copy this whole file into a new session. Implement the blockers. Re-walk the same draft. Do **not** mark Fase 1 closed until official number **and** PDF (or honest pending PDF) pass.

## Role

Fix only what the 2026-09-05 live walk proved broken. Stay in `sistema-coleta/`. Feature-first: no architecture rewrite, no Fase 2 leftovers as the close, no second-store / S9 work.

App: `http://localhost:3000` (`npm run dev` in `sistema-coleta/`). Linked remote Supabase only.

## Hard constraints

- Never `db reset` / wipe / drop.
- Do not set `DOCUMENT_EMAIL_SEND_ENABLED=true`.
- Do not print `.env`, service role, CPF, phone, CNPJ, or signature bytes.
- Do **not** discard walk draft `4bf31deb-d0db-4793-84da-a047f84fd203` unless the human asks.
- Do not start a second new collection to prove Fase 1.
- Do not loosen the PNG/JPEG/WebP ≤ 2 MB private logo/signature buckets.
- Do not `service_role` user uploads.
- Do not re-diagnose Storage 403 on `collection-signatures` (already fixed with DEFINER helper).
- Seed guias `MJT-2026-900001`–`900004` prove hub CTAs only. They have **no document rows** and cannot prove PDF.

## Current truth (do not re-litigate)

Walk collection: `4bf31deb-d0db-4793-84da-a047f84fd203`  
Customer: `3a963d66-de94-4108-86de-da21c0f2f97e` (Joao Marcelo Walk)

- Signature **committed**. Last seen: `status` **`draft`**, **no official number**, **no PDF**.
- Finalize fails with **`issuer_profile_incomplete`**.
- UI copy is already correct: “Os dados do emissor da guia estão incompletos. Ajuste nas configurações.”
- If **Tentar de novo** now shows `forbidden` / 403, that is a **regression** — stop and report.

Administrator was logged in. Hydration noise on the sync chip is **not** a gate fail by itself.

---

## Problems to fix (priority order)

### P0 — Issuer profile never publishes (this is the Fase 1 blocker)

**Symptom.** On `/configuracoes/empresa`:

1. Synthetic issuer that passes Zod was typed (valid CNPJ checksum, 8-digit CEP, 2-letter UF, phone, legal name, street + number + district + city, signer name/title, legal receipt text).
2. PNG ≤ 2 MB uploaded → **Enviar logo** → “Logo institucional confirmado. Complete os demais campos para habilitar a emissão.”
3. **Salvar configurações** then returned: **“Configurações salvas, mas não foi possível atualizar o perfil de emissão.”**
4. `updateCompanySettingsAction` wrote `organization_settings`, then `publishIssuerProfileIfReady` → `save_company_issuer_settings` returned **`failed`**.
5. Finalize on the walk draft still returns `issuer_profile_incomplete`. Hub title stays **“Coleta”**, not `MJT-2026-……`.

**Where.**

- `src/_pages/company-settings/api/actions.ts` (`updateCompanySettingsAction`, `uploadCompanyLogoAction`, `publishIssuerProfileIfReady`)
- `src/_pages/company-settings/model/issuer-settings.ts` (`toIssuerSettingsRpcInput`)
- `src/_pages/company-settings/model/schema.ts`
- Remote RPC `public.save_company_issuer_settings` (short + full overloads). Local contract: `supabase/migrations/20260820230000_phase_2_document_artifacts_jobs_shares_revisions.sql` (~680–930)
- Finalize: `src/_app/actions/draft-flow.actions.ts` + offline drain

**Likely causes to prove, not guess.**

- RPC error is swallowed. Action only returns the generic Portuguese string. Log/surface the **machine code** (`issuer_settings_invalid`, `issuer_logo_invalid`, `issuer_settings_incomplete`, `issuer_settings_forbidden`, …) in server logs (never print tax id / phone).
- Full RPC requires `p_tax_id ~ '^[0-9]{14}$'`, phone length 10–30, UF `^[A-Z]{2}$`, CEP `^[0-9]{8}$`, non-null `p_logo_asset_id` + matching `organization_brand_assets.storage_path`.
- Short RPC raises `issuer_settings_incomplete` if the logo asset row is missing or `organization_settings` row is missing.
- `getCompanySettings` (`src/shared/db/company-settings.ts`) **does not select `logo_asset_id`**. Publish reads `logo_asset_id` in the action after save — confirm the asset id is actually set after **Enviar logo**.
- After a failed publish, dashboard card **Perfil Emissor MJT** still says “Complete o endereço e logo para habilitar recibos.”

**Accept.** Saving a complete issuer + confirmed logo returns “Configurações e perfil de emissão salvos.” An **active** `document_issuer_profiles` row exists. **Tentar de novo** on the walk draft no longer returns `issuer_profile_incomplete`.

---

### P0 — Empresa form remounts stale junk and can overwrite a good save

**Symptom.** Fields use `defaultValue` (`src/_pages/company-settings/ui/company-settings-form.tsx`). After **Salvar** / **Enviar logo**, the form remounted with the **previous junk defaults** (leftover from an earlier incomplete walk), wiping the values just typed. A second **Salvar** on that remount wrote junk back (`profileStatus === "incomplete"`: “Complete os campos obrigatórios e envie o logo…”).

**Where.**

- `CompanySettingsForm` is uncontrolled `defaultValue` from `settings` prop
- `CompanySettingsRoute` → `getCompanySettings()` (`src/_pages/company-settings/index.server.tsx`)
- `revalidatePath("/configuracoes/empresa")` after save does not keep the just-submitted values in the DOM if the client remounts with a stale RSC `settings` payload
- Next.js hydration error on `src/_pages/company-settings/ui/company-settings-page.tsx` (7:98) — whole page is one line; error cites `if (typeof window !== 'undefined')`

**Accept.** After a successful save, the form still shows the submitted values (or a fresh server read of those values). A remount must not silently restore an older incomplete profile. One **Salvar** is enough; the user must not have to race the UI.

---

### P1 — Pending-panel clicks look dead (Continuar / Descartar / Tentar de novo)

**Symptom.** Human reported: clicking **Continuar**, **Descartar rascunho**, or **Tentar de novo** does nothing. Walk confirmed two layers:

1. **Dev overlay eats clicks.** Next.js “1 Issue” hydration overlay intercepted **Coletas** nav and **Editar Perfil Institucional**. Pending panel is `fixed … z-50` (`src/_app/offline/ui/offline-pending-panel.tsx`). Overlay sits above it and steals pointer events in `npm run dev`.
2. **Tentar de novo can look like a no-op when it works.** Handler runs `drainAndReload()` (`src/_app/offline/ui/offline-pending-banner.tsx`). Finalize returns the same `issuer_profile_incomplete` in <1s. Banner text does not change. Spinner/`isLoading` is easy to miss.

**Where.**

- Panel: `src/_app/offline/ui/offline-pending-panel.tsx`  
  - **Continuar** = `Link` to `/coletas/${draft.id}/itens` (always `/itens`, even when `currentStep` is `assinatura`)
  - **Descartar** = `onDiscard` → `window.confirm(...)` then `discardLocalDraft`
  - **Tentar de novo** = `onRetry` → `drainAndReload`, `Button isLoading={busy}`
- Hydration sources seen in the overlay:
  - `src/shared/ui/mobile-page-header.tsx` (60:13) — `h1` title
  - `src/shared/ui/pending-nav-link.tsx` (56:5) — `useLinkStatus()`
  - `src/_pages/company-settings/ui/company-settings-page.tsx` (7:98)
  - Message: server/client branch `if (typeof window !== 'undefined')` / `Date.now()` / locale date formatting

**Accept.**

- Fix the hydration mismatches so the Next.js issues overlay does not appear on dashboard / coletas / empresa / pending banner.
- After that, without the overlay:
  - **Continuar** changes the URL (walk draft → `/coletas/4bf31deb-d0db-4793-84da-a047f84fd203/itens`).
  - **Tentar de novo** shows a clear busy state, then an updated result (success **or** the same Portuguese error). Must not look like a dead control.
  - **Descartar rascunho** opens the native confirm. **Do not confirm it on the walk draft.** If you need to prove discard, use a throwaway draft only after D (number + PDF) already passed.

---

### P1 — Documentos empty because finalize never issued (gate, not a copy bug)

**Symptom.** `/coletas/4bf31deb-d0db-4793-84da-a047f84fd203/documentos`:

- Heading: “Rascunho sem guia emitida”
- “Nenhum documento disponível”
- “Rascunho sem guia emitida. Finalize a coleta para gerar o documento.”

This empty state is **honest** for a draft. It is still a **Fase 1 fail** until finalize issues a number and the page shows “Gerando o PDF da guia…” or **Baixar PDF**. Fail again if you ever see “Nenhum documento disponível” with **no** pending/draft explanation after an official number exists.

Share `/d/{token}` + incognito download were **blocked** (no document). After P0, prove:

1. Hub title is `MJT-2026-……`, not only “Coleta” / “salva neste aparelho”.
2. Documentos: PDF or honest “Gerando o PDF…”. Poll is OK. Cron is retry-only.
3. **Criar link seguro** → WhatsApp / `navigator.share` is `/d/{token}` only. Fail if `/api/documents/{id}/download`.
4. Incognito `/d/{token}` downloads the PDF. Do not paste the token into docs.

---

### P2 — Hub CTAs on seeds already passed (do not “fix” unless you regress them)

Walked and **passed**. Re-check only if you touch workshop CTA code.

| Seed | URL | Expected |
| --- | --- | --- |
| `MJT-2026-900001` rejected | `/coletas/a1000000-0000-4000-8000-000000000001` | **Novo orçamento** + **Cancelar**. No Reabrir. |
| Budget on `900001` | `/oficina/orcamento` | Collection item lines (**Item A1**, total R$ 15,00), not empty. |
| `MJT-2026-900003` canceled | `/coletas/a1000000-0000-4000-8000-000000000003` | **Reabrir** only. |
| `900004` collected | `/coletas/a1000000-0000-4000-8000-000000000004` | **Cancelar** visible. Do not confirm. |
| `900002` in_service | `/coletas/a1000000-0000-4000-8000-000000000002` | **Cancelar** visible. Do not confirm. |

---

## Observed leftovers (record, do not invent a second walk draft)

Code for hydrate abort / discard confirm / `officialKept` is already in the tree. **Do not discard** `4bf31deb-…` to test leftovers.

| What you see | Expected now |
| --- | --- |
| Finalize still fails after issuer+logo | Portuguese + **Tentar de novo**. Fail if it says **Salvo neste aparelho**. `issuer_profile_incomplete` → “Os dados do emissor da guia estão incompletos…” |
| Discard confirm on this draft | Server copy: “neste aparelho **e no servidor**”. Click **Cancel**. |
| After official number, pending row vanishes | Normal. Local queue is purged. |
| Notice “O rascunho local foi removido. A guia oficial não foi apagada.” | Only if a discard hit a guia that is no longer `draft`. |
| Resume `/itens` and customer fails to load | Error panel `Não foi possível carregar o cliente` + **Tentar de novo**. No empty items list. |

Queue errors must stay in Portuguese via `messageForQueueError` (`src/_pages/collection-drafts/model/offline-copy.ts`). **Tentar de novo** must stay clickable.

---

## Implementation order (one axis)

1. Diagnose the exact `save_company_issuer_settings` error (server log / RPC return). Fix publish so logo + complete fields create an **active** issuer profile.
2. Stop the empresa form from remounting stale `defaultValue` junk (controlled fields, key, or read-after-write settings).
3. Kill the hydration mismatches that raise the Next.js overlay (so pending-panel clicks work in `npm run dev`).
4. Retry finalize on the **same** walk draft (prefer retry; signature PNG already committed). Re-sign only if the pad is empty.
5. Prove D: official number + PDF (or honest pending) + `/d/{token}` incognito.
6. Do **not** start Optional F leftovers unless D already passed, and never on the walk UUID.

## Do not

- Reset the DB, enable email, commit unless the human asks, or mark Fase 1 closed without official number **and** PDF (or honest pending PDF).
- “Fix” clicks by loosening Storage RLS or uploading with `service_role`.
- Treat a silent retry that reprints the same issuer banner as done.

## Re-walk table (fill every row after the fix)

| # | Check | Pass / fail / blocked | Evidence (URL + action) |
| --- | --- | --- | --- |
| 1 | Hub rejected / canceled / active CTAs | | |
| 2 | Budget seed on `900001` | | |
| 3 | Issuer + logo saved; no discard | | |
| 4 | Retry finalize (no 403) | | |
| 5 | Official number `MJT-2026-……` | | |
| 6 | Documentos: PDF or honest pending | | |
| 7 | Share `/d/{token}` + incognito download | | |
| 8 | Queue errors in PT + retry (if a fail happened) | | |
| 9 | Empresa form keeps submitted values after save | | |
| 10 | Continuar / Tentar de novo / Descartar respond (no overlay, no dead click) | | |

Leftovers do **not** close the Fase 1 gate. Official number + PDF (or honest pending PDF) still do.
