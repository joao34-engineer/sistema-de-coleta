# Implementation plan — Fase 3 auth + Fase 1/4 leftovers + Fase 5 field bugs

| Campo | Valor |
| --- | --- |
| **Status** | **`closed`** 2026-09-06 — already done, **do not redo** |
| **Authority** | `informative` (historical). Leftover list: [`design-patterns/system-scan-for-bugs.md`](../design-patterns/system-scan-for-bugs.md) |
| **Owner** | product / sistema-coleta |
| **Escopo** | Somente `sistema-coleta/`. Os 13 PRs abaixo + close-out + cheap cleanup 5.14–5.18 |
| **Bug IDs shipped** | B23–B27, B13, B30, 5.1–5.5, 5.8–5.18 |
| **Still open (not this plan)** | **5.6 feito** (remoto + Production 06/09/2026). **5.7 / 5.12 / 5.13 adiados**. Cursor `20260906220000` no remoto (fora deste plano). |
| **App** | Production `https://sistema-de-coleta.vercel.app` · local `http://localhost:3000` |
| **Last verified** | 2026-09-06 (`origin/main` `30d8621` + 5.6 Production; cursor `20260906220000` no remoto) |
| **Line budget** | Exceeds the 500-line cap of [`docs/README.md`](../README.md). Do **not** rewrite §4–§10 to implement again. |

**Already done — do not redo.** Sections §4–§10 are the original spec. Code is on `main`. Scan absorbed §11 errata on 2026-09-06.

| Wave | What | Merge / tip SHA |
| --- | --- | --- |
| PR 1 | B26 cookies + B23 Sair | `b14ab76` / `f0a8a26` |
| PR 2 | B24 env + B25 quota | `dfca718` / `5ef0cc8` |
| PR 3 | B27 proxy fail-closed | `7bfa1bf` / `218cbf8` |
| PR 4 | B13 machine codes | `76f9503` / `aa55895` |
| PR 5 | B30 issuer copy | `3be15a1` / `5472f94` |
| PR 6 | 5.2 / 5.3 taxonomy | `b55e4a2` / `96aae13` |
| PR 7 | 5.1 / 5.3 list RPC | `ddad74e` / `26bdb28` |
| PR 8 | 5.4 timeline | `b24e46b` / `d8bf009` |
| PR 9 | 5.8 check-in complete | `c7a5ba0` / `6e5e307` |
| PR 10 | 5.9 SO `delivered` | `e017fdb` / `b170f33` |
| PR 11 | 5.5 delivery ids | `ef6e721` / `8b32f12` |
| PR 12 | 5.10 `awaiting_approval` doc | `bafde30` / `44a1133` |
| PR 13 | 5.11 lifecycle reopen | `156c685` / `889406e` |
| Close-out | `SUPABASE_SECRET_KEY` on Vercel + leftovers | `6260d70` |
| Cheap cleanup | 5.14–5.18 | `30d8621` |

This plan does **not** re-open architecture. It does not authorize S4/F1/F2, Postgres rewrites, `docs/planned/`, email sending, or Fase 4 chats 5–7.

---

## 1. Preflight (mandatory, before any edit)

Read, in this order, every session that touches this plan:

1. [`docs/feature-first-posture.md`](../../../docs/feature-first-posture.md) (repo root)
2. [`sistema-coleta/AGENTS.md`](../../AGENTS.md)
3. [`sistema-coleta/docs/README.md`](../README.md)
4. Thematic doc for the axis at hand: [`coding-standards.md`](../coding-standards.md), [`typescript.md`](../typescript.md), [`supabase.md`](../supabase.md), [`security.md`](../security.md), [`architecture/fsd.md`](../architecture/fsd.md), [`architecture/data-and-rules.md`](../architecture/data-and-rules.md)
5. [ADR 0009 — DAL única](../decisions/0009-data-access-layer.md) (**congelada**) and [ADR 0007 — rate limit compartilhado](../decisions/0007-shared-rate-limit-login-download.md)

Skills: `$mjt-supabase` for any SQL/RLS/Storage axis, `$mjt-nextjs-pwa` for App Router/PWA axes.

## 2. Hard constraints (apply to every PR below)

- Work only inside `sistema-coleta/`. Do not touch the afiliado monorepo.
- **Never** `supabase db reset`, `db reset --linked`, `DROP TABLE`, or any data wipe on the linked remote. Every schema change is **additive**.
- **Never** `DROP FUNCTION` when a same-signature `CREATE OR REPLACE` works — dropping loses the Chat 3 grants. The one exception in this plan (§7, `list_collections`) is called out explicitly with its re-`GRANT` block, because PostgreSQL cannot add parameters to an existing function.
- Finalized guias are immutable documentary records. `MJT-2026-000001` and `MJT-2026-000002` exist in Production and must keep loading, keep their PDFs, and keep their QR verification working after every PR.
- Zero `any`, no `@ts-ignore` / `@ts-expect-error`, no non-null assertion to mask uncertainty.
- Data access only through the frozen DAL: `src/_pages/<slice>/api/queries.ts` / `commands.ts` + `src/shared/auth`. No internal `fetch` of own `/api`, no Supabase query in a Client Component or in `page.tsx`.
- Never print or log `.env` values, `SUPABASE_SECRET_KEY`, the HMAC secret, CPF/CNPJ, phone, signature bytes, share tokens, or verification tokens. Log env **names** only.
- Do not enable `DOCUMENT_EMAIL_SEND_ENABLED`. Do not loosen Storage policies. Do not upload user files with `service_role`.
- Tests only under `sistema-coleta/tests/` (Vitest/Playwright) and `sistema-coleta/supabase/tests/` (pgTAP).
- Commit/push/deploy **only when the human asks**.

### Validation commands (verbatim from `package.json`)

```text
npm run lint          # eslint app src scripts tests proxy.ts next.config.ts
npm run typecheck     # next typegen && tsc --noEmit
npm run test          # vitest run
npm run architecture  # steiger src   (required whenever FSD imports change)
npm run test:e2e      # playwright (baseURL http://localhost:3100)
npm run check         # architecture && lint && typecheck && test && build
npm run db:types:remote   # supabase gen types --linked  (after any migration)
```

pgTAP files live in `supabase/tests/` and are run with `supabase test db` against a **throwaway** database. [`docs/supabase.md`](../supabase.md) defers local Docker, so pgTAP additions in this plan are written to be correct-and-ready, not gated on CI.

### Migration policy for this plan

Convention is `YYYYMMDDHHMMSS_snake_case_description.sql`; last file on disk is `20260905184000_retry_document_job.sql`. Each PR below proposes a filename. **Assign the real timestamp at commit time**, keep it strictly ascending relative to application order, never reuse a timestamp, and open each file with the standard `--` header (phase, "aditiva", what it preserves, which body it starts from). Apply with `supabase db push --dry-run` first, then a manual push, then `npm run db:types:remote`.

### Backfills that need explicit human approval

Three corrective `UPDATE`s appear in this plan. None of them are required for the code fix to work; all are guarded so they cannot touch unrelated rows. **Run the paired `SELECT` first, show the row count to the human, and only then ask.** They are: §10.1 (service order status after full delivery), §10.3 (stale `canceled_at`), and the optional `awaiting_approval` backfill in §10.2 (which this plan recommends **not** doing).

---

## 3. PR order

| # | Axis | Bugs | SQL? | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Session cookies + escape hatch for a trapped user | B26, B23 | no | — |
| 2 | Login env fail-closed + failure-only quota | B24, B25 | additive | PR 1 (same file `login/api/actions.ts`) |
| 3 | Proxy fail-closed without public env | B27 | no | — |
| 4 | Machine codes in the offline queue | B13 | no | — |
| 5 | Issuer settings tell the truth | B30 | no | PR 4 (shares the error-copy rule) |
| 6 | One status→bucket taxonomy | 5.2, 5.3 (part) | no | — |
| 7 | Server-side list/search + honest counts | 5.1, 5.3 (part) | additive (**DROP+CREATE**, see §7) | PR 6 |
| 8 | Timeline labels + `actorName` | 5.4 | additive | — |
| 9 | Check-in requires every item | 5.8 | additive | — |
| 10 | Service order gets a terminal state | 5.9 | additive | — |
| 11 | Delivery item validation | 5.5 | additive | **PR 10** (same RPC body) |
| 12 | `awaiting_approval` decision | 5.10 | none (doc) | — |
| 13 | Lifecycle reopen clears cancel columns | 5.11 | additive | — |

PR 1→3 can run as one auth lane. PR 4, 5, 6, 8, 9, 12, 13 are independent and can run in parallel lanes. **PR 11 must not be written before PR 10 lands**, because both `CREATE OR REPLACE` the same `deliver_to_customer` body — whichever lands second must start from the other's body, or the first fix is silently reverted.

---

## 4. Fase 3 — auth and session

### 4.1 PR 1 — B26 cookie write modes + B23 escape hatch

**Severity:** B26 média, B23 alta. Ship together: a Sair button that calls today's `signOutAction` can redirect to `/login` while the session cookie survives, and the proxy bounces the user straight back into the trap.

#### B26 — ground truth

`src/shared/auth/supabase-server.ts` 8–26 swallows every cookie write failure:

```16:24:sistema-coleta/src/shared/auth/supabase-server.ts
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies; proxy refreshes them.
        }
      },
```

`src/shared/auth/actions.ts` 6–10 discards the sign-out error and always redirects:

```6:10:sistema-coleta/src/shared/auth/actions.ts
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

**The swallow is not simply a bug.** It is the official `@supabase/ssr` + App Router pattern: Supabase may call `setAll` during an RSC render (token refresh), where `cookies().set` throws. Removing the `catch` globally would 500 the protected layout, the dashboard, home, and every DAL read. The real defect is that **Server Actions**, which *can* write cookies, use the same forgiving mode:

| Context | Can write cookies? | Today |
| --- | --- | --- |
| RSC (`app/page.tsx`, `app/(protected)/layout.tsx`, settings/list reads) | No | swallow is **required** |
| Server Action (`signInAction`, `signOutAction`) | Yes | swallow hides a real failure |
| Route Handler (`/api/collections/*`, `/d/*/download`) | Yes | works; swallow hides rare failures |
| `proxy.ts` 30–34 | Yes (own `response.cookies`) | already writes correctly — not this bug |

Siblings with the same shape, **out of scope for this PR**: `src/_pages/collection-lifecycle/api/lifecycle-supabase.ts` 27–31 and `src/_pages/collection-documents/api/public/verification.ts` 37 (`setAll: () => undefined`, deliberate for a public RPC).

#### B26 — fix

Keep one factory; add an explicit write mode, default unchanged.

```ts
// src/shared/auth/supabase-server.ts
type CookieMutation = "best-effort" | "required";

export async function createServerSupabaseClient(
  options: Readonly<{ cookieMutation?: CookieMutation }> = {},
) {
  const cookieMutation = options.cookieMutation ?? "best-effort";
  // ...
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (error) {
          if (cookieMutation === "required") throw error;
        }
      },
}
```

Pass `{ cookieMutation: "required" }` in **exactly two** places: `signInAction` (`src/_pages/login/api/actions.ts`) and `signOutAction` (`src/shared/auth/actions.ts`). Everyone else keeps the default — including `requireAuthenticatedAdministrator`, which runs from both RSC and Route Handlers.

`signOutAction` must report failure instead of redirecting blind:

```ts
export type SignOutActionState = Readonly<{ status: "idle" | "error"; message?: string }>;
export const initialSignOutState: SignOutActionState = { status: "idle" };

export async function signOutAction(
  _previous: SignOutActionState = initialSignOutState,
): Promise<SignOutActionState> {
  const supabase = await createServerSupabaseClient({ cookieMutation: "required" });
  const { error } = await supabase.auth.signOut();
  if (error) return { status: "error", message: "Não foi possível encerrar a sessão. Tente novamente." };
  redirect("/login");
}
```

For `signInAction`, the existing `catch` already returns `unexpected_error` + "Não foi possível concluir o login agora." — that is the correct fail-closed outcome when the cookie write throws. **Do not** `redirect(dashboard)` after a failed cookie write. Do not hand-delete `sb-*` cookies by guessed names.

#### B23 — ground truth

`requireAuthenticatedAdministrator` (`src/shared/auth/require-admin.ts` 28–46) throws `AdministratorAccessDeniedError` for **four** situations, not just "no administrator role": missing/inactive membership, `role_code <> 'administrator'`, inactive `profiles.status`, and missing organization. The protected layout renders `<AccessDeniedPage />` (`app/(protected)/layout.tsx` 13–20). That page has no form, no link, no sign-out:

```188:198:sistema-coleta/src/_pages/dashboard/ui/dashboard-page.tsx
export function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Acesso não autorizado</h1>
```

`proxy.ts` 38–43 then closes the trap: any request to `/login` with a `sub` claim is redirected to `/dashboard`. `app/page.tsx` 8–10 does the same for `/`. The dashboard **already** has a working Sair form (same file, 59–64) — the denied screen simply never got one.

#### B23 — fix

**Owns:**

- `src/_pages/dashboard/ui/access-denied-page.tsx` — **new**, Server Component. Today `AccessDeniedPage` is exported from a `"use client"` module, so the denied layout drags the whole dashboard client graph. Same slice, no new FSD layer.
- `src/_pages/dashboard/ui/access-denied-sign-out.tsx` — **new**, minimal `"use client"` leaf with `useActionState(signOutAction, initialSignOutState)`, a `Sair` button, and `role="alert"` for `state.message`.
- `src/_pages/dashboard/ui/dashboard-page.tsx` — remove `AccessDeniedPage`; keep the dashboard Sair form and migrate it to the new action state.
- `src/_pages/dashboard/index.ts` — re-export from the new file so `app/(protected)/layout.tsx` keeps its import.
- `src/shared/auth/actions.ts` — the B26 signature change above.

Do **not** teach `proxy.ts` about roles: the role lives in `organization_memberships`, not in the JWT, so the edge would need a DB round-trip per request. Do **not** add a `?force=` bypass on `/login`. After a real sign-out, `hasIdentity` is false and `/login` stays put — that is the whole fix.

**Accept:** a signed-in non-admin sees **Acesso não autorizado** with a working **Sair**; clicking it lands on `/login` and a refresh stays on `/login` with no `sb-*` session cookie. Admin login and the dashboard Sair still work. `toLifecycleApiError` still maps `AdministratorAccessDeniedError` to 403 `administrator_access_denied` (`src/_pages/collection-lifecycle/api/lifecycle-errors.ts` 15–16).

**Tests:**

- `tests/unit/supabase-server-cookies.test.ts` (new) — `best-effort` + throwing `set` does not throw; `required` + throwing `set` throws.
- `tests/unit/sign-out-action.test.ts` (new) — `signOut` returns `{ error }` → `{ status: "error" }` and **no** redirect; success → redirect.
- `tests/unit/login-action.test.ts` — add a case where the factory throws in `required` mode → `unexpected_error`, no redirect. Keep the three existing cases.
- `tests/unit/require-admin.test.ts` — add inactive `profiles.status` and missing organization → `AdministratorAccessDeniedError`.
- `tests/component/access-denied-page.test.tsx` (new) — heading + `Sair` control, action mocked.
- `tests/e2e/administrator-smoke.spec.ts` must stay green (it clicks Sair on the dashboard). Its copy is already stale versus the live dashboard — **do not** fix that here; it is bug 5.14.

**Risks:** throwing from `setAll` in RSC would 500 the whole protected tree, so the default mode must stay `best-effort`. Changing `signOutAction` to a state-returning action without updating the dashboard form breaks admin Sair. Do not log Supabase Auth `error.message` (it can carry the email). The service worker (`public/sw.js`) is network-only for navigations and non-GET — leave it alone.

### 4.2 PR 2 — B24 login env fail-closed + B25 failure-only quota

**Severity:** B24 crítica when a deploy is incomplete; B25 média.

#### B24 — ground truth

`signInAction` (`src/_pages/login/api/actions.ts` 15–53) calls `enforceLoginRateLimit` **before** Supabase Auth, and flattens every non-quota throw into one Portuguese sentence with no log:

```26:31:sistema-coleta/src/_pages/login/api/actions.ts
  try {
    await enforceLoginRateLimit({ headers: await headers() }, parsed.data.email);
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return { status: "error", code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." };
    }
    return { status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." };
```

That path requires, transitively: `DOCUMENT_RATE_LIMIT_SECRET` (≥32 chars, via `getDocumentRateLimitSecret`), plus `getServiceEnvironment`'s three vars:

```16:20:sistema-coleta/src/shared/config/environment.ts
const serviceEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_CONFIRM_PROJECT_REF: z.string().min(1),
});
```

`SUPABASE_CONFIRM_PROJECT_REF` is **required and never consumed** — neither `createRateLimitClient` (`src/shared/lib/rate-limit.server.ts` 84–89) nor `createPhaseTwoServiceClient` (`src/_pages/collection-documents/api/rendering/server-client.ts`) reads `confirmProjectRef`. The same confirm-ref pattern **is** properly wired for `BOOTSTRAP_CONFIRM_PROJECT_REF` (`scripts/bootstrap-admin.ts`) and `RESTORE_CONFIRM_PROJECT_REF` (`scripts/backup/project-guard.ts`).

Two documentation landmines make this worse: `.env.example` and `README.md` still say `SUPABASE_SECRET_KEY` is "somente para scripts" and "nunca configurar na Vercel". Since Chat 3, the Next server needs it for the rate-limit RPC **and** the PDF worker. An operator who follows those docs gets 100% login failure with a message that looks like a Supabase outage.

Also: `logTransactionFailure` never runs on this path, so **nothing distinguishes a misconfigured deploy from a wrong password in the logs** (wrong password does not log either).

The `auth_login` scope migrations **do** exist locally — `20260829010000_phase_4_auth_login_rate_limit_scope.sql` (adds `'auth_login'` to the RPC allowlist) and `20260829020000_phase_4_auth_login_rate_limit_scope_check.sql` (widens `document_rate_limit_windows_scope_check`, without which the RPC passes and the INSERT dies on the CHECK). Docs record them as applied on 2026-08-29. Reconfirm read-only, never by reset:

```powershell
# from sistema-coleta/
npx supabase migration list --linked
```

```sql
select version from supabase_migrations.schema_migrations
where version in ('20260829010000','20260829020000');

select pg_get_functiondef('public.consume_document_rate_limit(text,text,integer,integer)'::regprocedure);
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'document_rate_limit_windows_scope_check';
```

Both definitions must contain `'auth_login'`. **Do not call the RPC on Production to test it — it writes.**

#### B24 — fix

**Keep fail-closed.** Login is a public form on a single-admin system; a fail-open limiter would allow unlimited `signInWithPassword`. This matches ADR 0007 and the `/verificar` + share-download posture.

1. **Wire `SUPABASE_CONFIRM_PROJECT_REF` instead of removing it.** Extract `projectRefFromUrl` (already implemented twice, in `scripts/bootstrap-admin.ts` and `scripts/backup/project-guard.ts`) into a shared server helper. In `getServiceEnvironment`, after the Zod parse, throw a dedicated `ServiceEnvironmentMismatchError` when `confirmProjectRef !== projectRefFromUrl(supabaseUrl)`. Call the assertion from `createRateLimitClient` **and** `createPhaseTwoServiceClient`, so the var is genuinely consumed. Rationale: a service-role key pointed at the wrong project is worse than a failed login, and "demanded but unused" is the actual defect — not "should not exist". If Production login works today, the var is already set and this is pure safety.
2. **Do not add a user-visible env message.** Keep the existing five-code union and its Portuguese copy exactly as-is, so email enumeration stays impossible.
3. **Add operator-grade logging** on the rate-limit `catch` via `logTransactionFailure` with `operation: "sign_in"`, `status: 503`, `actorId: null`, and one of these allow-listed codes: `rate_limit_secret_missing`, `service_env_invalid`, `service_project_ref_mismatch`, `rate_limit_rpc_failed`. Log **env var names**, never values, never the email, never the HMAC subject. Also catch `getServiceEnvironment`'s generic `Error` and map it to `service_env_invalid` before the flatten.
4. **Fix the stale docs** in the same PR: `.env.example` and `README.md` must state that `SUPABASE_SECRET_KEY` is required **on the Vercel server** (rate limit + document worker), is never `NEXT_PUBLIC_*`, never reaches the client, and is never committed.

Error taxonomy stays:

| Situation | `code` | User `message` |
| --- | --- | --- |
| Bad form | `validation_error` | field copy |
| Wrong email or password | `invalid_credentials` | `E-mail ou senha inválidos.` |
| Quota hit | `rate_limit_exceeded` | `Aguarde antes de tentar novamente.` |
| Env / RPC / limiter down | `temporarily_unavailable` | `Não foi possível concluir o login agora.` |
| Post-auth throw | `unexpected_error` | same sentence |

#### B25 — ground truth

The quota is 5 attempts per 900 s (`documentRateLimitRules.login`, `src/shared/lib/rate-limit.server.ts` 50–57), keyed on `HMAC(ip:email)` — `${requestIpRateLimitSubject(request)}:${normalizedEmail}` — so it is per IP **and** email, and the raw values never reach SQL. Windows live in `private.document_rate_limit_windows` with a **UTC-aligned** start (`floor(epoch / p_window_seconds) * p_window_seconds`), i.e. a clock slot, not a sliding 15 minutes from the first attempt. `consume_document_rate_limit` is a single atomic reserve: INSERT with `request_count = 1`, or increment only `if request_count < p_limit`. Each call also prunes up to 100 expired rows with `FOR UPDATE SKIP LOCKED`.

Because the gate runs before Auth, **successful logins burn slots**. Five good logins in one 900 s slot lock the only admin out — with the correct password.

#### B25 — fix

Recommended sequencing (race-safe, and stricter than a plain peek):

1. **Consume first** (unchanged, atomic). A cold window cannot be raced by parallel guesses.
2. `signInWithPassword`.
3. On **failure**: keep the consumed slot — that is the throttle.
4. On **success**: call a new `reset_document_rate_limit` that **deletes the current window row** for that `scope + subject_hash + window_seconds + window_start`. Full clear, not decrement-by-one, so earlier failures in the same slot do not lock the admin after a good login.
5. If already over the limit at step 1: never reach Auth, never reset. A valid password does **not** bypass an active lockout.

A pure "peek, then record only on failure" ordering is explicitly **not** recommended: N parallel first-window failures could all peek `allowed` and all reach Auth before any increment, which is a burst hole at 5/15 min. Ship `peek_document_rate_limit` anyway (useful for tests and future scopes), but keep `consume` as the recording step.

If the reset call throws, still redirect — do not fail a good login on cleanup. Log `rate_limit_reset_failed`.

**Migration (additive):** `supabase/migrations/20260906120000_phase_3_auth_login_failure_quota.sql`

Do **not** replace `consume_document_rate_limit`. Add two functions, copying the four validation blocks (scope allowlist including `'auth_login'`, `^[0-9a-f]{64}$` hash, 60–86400 s window, 1–10000 limit) verbatim from consume so the scopes stay in lockstep:

```sql
create or replace function public.peek_document_rate_limit(
  p_scope text, p_subject_hash text, p_window_seconds integer, p_limit integer
) returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  observed_at timestamptz := clock_timestamp();
  window_start_value timestamptz;
  window_record private.document_rate_limit_windows%rowtype;
begin
  -- <same validation blocks as consume_document_rate_limit>
  window_start_value := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds);
  select * into window_record from private.document_rate_limit_windows
  where scope = p_scope and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds and window_started_at = window_start_value;
  if not found or window_record.request_count < p_limit then
    return query select true, 0::integer; return;
  end if;
  return query select false,
    greatest(1, ceil(extract(epoch from window_record.expires_at - observed_at))::integer);
end; $$;

create or replace function public.reset_document_rate_limit(
  p_scope text, p_subject_hash text, p_window_seconds integer
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  observed_at timestamptz := clock_timestamp();
  window_start_value timestamptz;
begin
  -- <same scope/hash/window validation, no p_limit>
  window_start_value := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds);
  delete from private.document_rate_limit_windows
  where scope = p_scope and subject_hash = p_subject_hash
    and window_seconds = p_window_seconds and window_started_at = window_start_value;
end; $$;

revoke execute on function public.peek_document_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.reset_document_rate_limit(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.peek_document_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.reset_document_rate_limit(text, text, integer) to service_role;
```

**Owns:** `src/_pages/login/api/actions.ts`, `src/shared/lib/rate-limit.server.ts` (new `peekDocumentRateLimit` / `resetDocumentRateLimit` + `resetLoginRateLimit`; the `RateLimitDatabase` type must list the new signatures — no `any`), `src/shared/config/environment.ts`, the new migration, `.env.example`, `README.md`, plus an "Atualização" note in [`docs/security.md`](../security.md) and ADR 0007.

**Do not** touch consume semantics for `public_verification`, `document_share_*`, or `document_email_*`. Only the login wrappers may reset.

**Accept:** five consecutive successful admin logins in the same 15-minute slot all succeed. Five wrong passwords in one slot lock the account, and a sixth attempt with the **correct** password is still refused until the slot ends. With `DOCUMENT_RATE_LIMIT_SECRET` or `SUPABASE_SECRET_KEY` absent, login still fails closed, and the log now names the missing variable. A `SUPABASE_CONFIRM_PROJECT_REF` that does not match the URL host refuses to build a service-role client.

**Tests:** unit — `getServiceEnvironment` missing-key/invalid-URL throws with no secret in the serialized error; confirm-ref match/mismatch; `getDocumentRateLimitSecret` under 32 chars; `signInAction` calls reset only on success, never when locked; the rate-limit catch logs the right code and contains no email or password; `documentRateLimitRules.login` still `{ scope: "auth_login", limit: 5, windowSeconds: 900 }`. pgTAP — `supabase/tests/phase_3_auth_login_failure_quota_test.sql`: `has_function` for both new functions, `anon`/`authenticated` cannot execute, `service_role` can, consume `prosrc` still contains `'auth_login'` and `request_count < p_limit`, CHECK still allows `'auth_login'`. The consume-5-then-reset behavioral test runs **only** on a disposable database.

**Risks:** locking out the only admin (that is the bug being fixed — but never make CONFIRM optional-and-ignored, which would hide a missing guard); secrets in logs; email enumeration through divergent messages; the `ip:unavailable` fallback sharing one bucket per email when `x-forwarded-for` is missing (Vercel normally sends it).

### 4.3 PR 3 — B27 proxy fail-closed without public env

**Severity:** média (misconfig).

**Ground truth — and the scan is stale here.** `proxy.ts` 22 short-circuits the gate:

```18:23:sistema-coleta/proxy.ts
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Public probe — skip Auth so uptime checks never spend getClaims or cookies.
  if (pathname === "/api/health") return NextResponse.next();

  if (!hasPublicEnvironment()) return NextResponse.next();
```

The scan says "O layout ainda autentica." In the normal misconfiguration — public env absent in **both** Edge and Node — the layout does **not** authenticate: `requireAuthenticatedAdministrator` → `createServerSupabaseClient` → `getPublicEnvironment()` **throws**, the layout `catch` only handles the two auth errors, and the user gets the generic "Algo deu errado" boundary. The scan's description is only true in the odd case where env is scoped to Node but not Edge. Either way no data leaks, but there is no edge gate and the failure mode is a crash instead of a redirect.

There is also an adjacent hole the scan misses: `hasPublicEnvironment()` (`src/shared/config/environment.ts` 60–64) only checks for non-empty strings, while `getPublicEnvironment()` validates the URL. A garbage `NEXT_PUBLIC_SUPABASE_URL` therefore passes the guard and makes `proxy` **throw**, 500ing every matched path except `/api/health`.

**Fix — fail closed for the auth gate, fail open for public/static/health, and never throw inside `proxy`.**

**Owns:**

- `src/shared/config/routes.ts` — export `isProtectedPath` next to `protectedRoutePrefixes` (today `["/dashboard", "/configuracoes", "/coletas"]`, which already covers `/coletas/[id]/oficina/*`).
- `src/shared/config/proxy-gate.ts` — **new**, and deliberately **not** `server-only`, so both `proxy.ts` and Vitest can import it:

```ts
export type ProxyGateDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: "/" | "/login" | "/dashboard" };

export function decideProxyGate(input: Readonly<{
  pathname: string;
  hasPublicEnv: boolean;
  publicEnvValid: boolean;
  hasIdentity: boolean | null; // null = env unusable, claims never fetched
}>): ProxyGateDecision {
  if (input.pathname === "/api/health") return { action: "next" };
  if (!input.hasPublicEnv || !input.publicEnvValid) {
    return isProtectedPath(input.pathname)
      ? { action: "redirect", pathname: "/" }
      : { action: "next" };
  }
  if (input.hasIdentity === false && isProtectedPath(input.pathname)) {
    return { action: "redirect", pathname: "/login" };
  }
  if (input.hasIdentity === true && input.pathname === "/login") {
    return { action: "redirect", pathname: "/dashboard" };
  }
  return { action: "next" };
}
```

- `proxy.ts` — wrap `getPublicEnvironment()` in a try/catch (invalid URL ⇒ treat as unusable), then delegate to `decideProxyGate`. Keep `redirectWithRefreshedCookies` for the session-refresh case.

Protected HTML without usable env goes to `/`, **not** `/login`: `app/page.tsx` 6–7 already renders the "ambiente não configurado" message, whereas `/login` is a form that cannot establish a session (and after PR 2 it fails closed anyway). Sending an operator to a dead login is strictly worse.

**Do not** 503 the whole matcher; **do not** change `config.matcher` (it must keep excluding `_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `icons/`, `sw.js`); **do not** add `/api` to the protected prefixes — API routes were never edge-gated and authorize in the DAL. Internal worker routes (`/api/internal/document-jobs/run`) must keep passing through: they use `isWorkerRequestAuthorized` + service role, not a user session. Build/prerender is unaffected — `proxy` does not run at `next build`, the protected layout is already `force-dynamic`, and home short-circuits without env.

**Accept:** with public env unset, `/dashboard`, `/coletas/x`, `/configuracoes` redirect to `/`; `/login`, `/`, `/d/…`, `/verificar/…` still render; `/api/health` still answers 503 JSON. With a garbage `NEXT_PUBLIC_SUPABASE_URL`, same behavior — no 500. With valid env, today's gate is byte-for-byte unchanged.

**Tests:** `tests/unit/proxy-gate.test.ts` (new) covering the nine cases above, including `hasPublicEnv: true, publicEnvValid: false`, and an assertion that the only possible destinations are `/`, `/login`, `/dashboard` (no open redirect). Keep `tests/unit/environment.test.ts` and `tests/unit/health.test.ts` green.

**Risks:** throwing in `proxy` would take down `/login`, `/d`, and `/verificar`; loosening the matcher would break the PWA assets; failing open "so the build works" is unnecessary.

---

## 5. PR 4 — B13 machine codes in the offline queue

**Severity:** alta. **Fase 1 leftover.**

**The rule:** the offline mutation queue stores stable machine codes; Portuguese is applied only at the UI layer. `classify` in `src/_pages/collection-drafts/model/offline-runner.ts` 528–536 recognizes exactly two codes and stores everything else verbatim:

```528:536:sistema-coleta/src/_pages/collection-drafts/model/offline-runner.ts
function classify(error: string): { kind: "stale" } | { kind: "auth" } | { kind: "error"; error: string } {
  if (error === STALE_RETRY_ONCE) return { kind: "stale" };
  if (error === AUTH_ERROR) return { kind: "auth" };
  return { kind: "error", error };
}
```

`finalizeCollectionAction`, `saveCollectionSignatureAction`, `discardDraftAction`, and `getCustomerAction` were already fixed to `toActionFailureCode` / `toFinalizeActionFailureCode`. **The scan overstates the remaining scope** — it reads as if all actions are broken. Nine sibling catch blocks remain:

| Action | File:lines | Queue kind |
| --- | --- | --- |
| `searchCustomersAction` | `src/_app/actions/draft-flow.actions.ts:66-67` | drain helper |
| `createCustomerAction` | `draft-flow.actions.ts:106-107` | `create_customer` |
| `createDraftAction` | `draft-flow.actions.ts:136-137` | `create_draft` |
| `createDraftWithCustomerAction` | `draft-flow.actions.ts:193-194` | online only (fix for consistency) |
| `fetchDraftWithItemsAction` | `src/_pages/collection-drafts/api/actions.ts:59-60` | drain helper |
| `addItemToDraftAction` | `actions.ts:104-105` | `add_item` |
| `updateItemInDraftAction` | `actions.ts:151-152` | `patch_item` |
| `removeItemFromDraftAction` | `actions.ts:187-188` | `remove_item` |
| `patchDraftFieldsAction` | `actions.ts:228-229` | `patch_draft` |

Each ends in `toSafeActionError`, which is the **UI** mapper (`src/shared/lib/action-error.ts` 19–37). When `error.message === "stale_version"` it writes "A coleta foi atualizada por outra operação…" into `lastError`, and `classify` can no longer retry the version or pause the session.

**Fix — replace those nine catches with the already-blessed pattern:**

```ts
} catch (error: unknown) {
  return { ok: false, error: toActionFailureCode(error) };
}
```

Optionally add `toActionFailureResult(error)` to `src/shared/lib/action-failure-code.ts` to keep it DRY. Remove the now-unused `toSafeActionError` imports from those two files. **Leave `toSafeActionError` itself alone** — it is still correct for the online-only workshop actions in `src/_app/actions/phase3-flow.actions.ts`, whose errors are displayed directly and never persisted.

Then extend `queueErrorMessages` in `src/_pages/collection-drafts/model/offline-copy.ts` for codes that can now surface: `collection_requires_item`, `collection_requires_signature`, `customer_not_found`, `duplicate_tax_id`, `customer_required`, `collection_item_mismatch`, `signature_upload_conflict`, `sequence_exhausted`. Unknown codes already fall through to the generic "Falha ao sincronizar", which is acceptable.

One contract test currently **asserts the bug**: `tests/phase-1/phase-1-hardening-contract.test.ts` 150–151 requires `toSafeActionError` to be present in both files. Invert it to assert `toActionFailureCode` in the catch paths.

**Accept:** an offline `add_item` that fails on a version conflict stores `stale_version`, gets exactly one automatic retry after refetch, and the chip reads Portuguese. An expired session during drain stores `authentication_required` and pauses the drain instead of failing the draft. No IndexedDB row is written with a Portuguese `lastError`.

**Tests:** `tests/unit/action-failure-code.test.ts` (new) — `Error("stale_version")` → `"stale_version"`, Supabase `{ code: "40001" }` → `"stale_version"`, `Error("authentication_required")` → itself, unknown → `"operation_failed"`. `tests/unit/offline-runner.test.ts` — keep the stale-retry and auth-pause cases and add a regression proving a Portuguese `lastError` does **not** trigger retry. One action-level test: a thrown `AuthenticationRequiredError` inside `addItemToDraftAction` yields `{ ok: false, error: "authentication_required" }`.

**Risks:** any screen that renders `res.error` raw will now show snake_case. Today only `src/_pages/collection-drafts/ui/draft-signature-page.tsx` 89–90 does that — PR 5 fixes it. Legacy IndexedDB rows with Portuguese text keep mapping to the generic label (already covered by `tests/unit/offline-copy-queue-error.test.ts`).

---

## 6. PR 5 — B30 issuer settings tell the truth

**Severity:** alta. **Fase 4 leftover.**

**Ground truth.** The settings page still promises the future:

```7:7:sistema-coleta/src/_pages/company-settings/ui/company-settings-page.tsx
Esses dados serão usados futuramente nos recibos e documentos da MJT.
```

That string is the only occurrence in the codebase. Meanwhile `finalize_collection` hard-requires the profile:

```212:221:sistema-coleta/supabase/migrations/20260905173235_fix_finalize_document_id_ambiguity.sql
  select * into issuer_profile_record
  from public.document_issuer_profiles
  where organization_id = collection_record.organization_id and status = 'active';
  if not found or issuer_profile_record.logo_asset_id is null or not exists (
    select 1 from public.organization_brand_assets as asset_record
    where asset_record.id = issuer_profile_record.logo_asset_id
      and asset_record.organization_id = collection_record.organization_id
      and asset_record.asset_type = 'logo'
  ) then
    raise exception using errcode = 'P0001', message = 'issuer_profile_incomplete';
  end if;
```

So finalize checks three things: an `active` profile row, a non-null `logo_asset_id`, and a matching `logo` brand asset. The individual field requirements are enforced app-side in `toIssuerSettingsRpcInput` (`src/_pages/company-settings/model/issuer-settings.ts` 24–41) — a profile is only published when `legalName`, `taxId` (14 digits), `phone` (10–30 chars), `street`, `streetNumber`, `district`, `city`, `stateCode` (2 uppercase), `postalCode` (8 digits), `receiptLegalText`, `signerName`, `signerTitle`, and `logoAssetId` are all present and valid. `companySettingsSchema` marks every field optional, so partial saves are allowed by design, and the save action already returns the honest "Complete os campos obrigatórios e envie o logo para habilitar a emissão." — **contradicting its own page subtitle**.

The scan's "mensagem genérica" claim is half stale: the offline banner already shows a specific message for `issuer_profile_incomplete` (`offline-copy.ts` 40, covered by `tests/component/offline-pending-banner-online.test.tsx` 208–224). The genuinely bad surface is the legacy online path, which prints the raw code:

```89:90:sistema-coleta/src/_pages/collection-drafts/ui/draft-signature-page.tsx
  setErrorMsg(`Erro ao finalizar coleta: ${res.error}`);
```

**Fix.**

**Owns:**

- `src/_pages/company-settings/ui/company-settings-page.tsx` — replace the subtitle with the truth, e.g. *"Estes dados identificam a MJT na guia de coleta (PDF). Preencha todos os campos abaixo e envie o logo para habilitar a emissão do número oficial."*
- `src/_pages/company-settings/model/issuer-settings.ts` — the comment at 19–22 still says the institutional profile "pode permanecer incompleta durante a Fase 1A". Update it, and export the requirement list (`issuerRequiredFields`) so the UI and the publish gate cannot drift.
- `src/_pages/company-settings/ui/company-settings-form.tsx` — mark the required fields with `*` and render a completeness banner driven by `settings.setupStatus` (`src/shared/db/company-settings.ts` 33): `complete` ⇒ "Emissão habilitada"; otherwise list what is missing, derived from `issuerRequiredFields` rather than a second hardcoded list.
- `src/_pages/collection-drafts/ui/draft-signature-page.tsx` — display `messageForQueueError(res.error)` instead of interpolating the raw code.

No SQL, no DAL change. **Out of scope unless product asks:** making `companySettingsSchema` require every field on save, which would block incremental data entry.

**Accept:** the settings screen never says "futuramente"; an operator can see at a glance whether emission is enabled and what is missing; finalizing without a complete issuer shows Portuguese on both the offline banner and the legacy signature page.

**Tests:** unit — table-driven `toIssuerSettingsRpcInput` returning `null` for each individually missing field (including `logoAssetId`); component — the settings page contains no "futuramente" and shows the pending banner for an incomplete profile; component — `DraftSignaturePage` maps `issuer_profile_incomplete` to Portuguese. Keep `tests/unit/company-settings-commands.test.ts` (published vs incomplete) and the existing SQL assertion in `supabase/tests/phase_2_documents_test.sql` 91.

**Risks:** duplicating the requirement rules in the banner would drift from the publish gate — reuse the exported list. Sequence this after PR 4 so the signature-page error mapping lands on top of machine codes.

---

## 7. PR 6 + PR 7 — list, filters and dashboard counts (5.1, 5.2, 5.3)

### 7.1 The one authoritative status→bucket table

5.2 and 5.3 are the same defect seen twice: two independent status groupings. Today `repairStatuses` in `src/shared/model/collection-status.ts` 26–41 **includes `ready`**, so a ready collection matches both "Em reparo" and "Prontas" — and `tests/unit/collections-list-filter.test.ts` 4–24 *asserts* that, so the test must be inverted, not merely extended. In parallel, `countReadyForDelivery` (`src/_pages/dashboard/model/contracts.ts` 26–36) counts only `ready`, so registering an NF-e makes the subtitle drop to "Nenhuma pronta para entrega" while the hub still offers **Entregar ao cliente**.

Grounded in the CHECK (14 values, last amended by `20260822125100`), the product lifecycle in [`data-and-rules.md`](../architecture/data-and-rules.md) 34–38 (`pronto → faturada → entregue`, `faturada → entrega_parcial → entregue`), and the hub CTAs:

| Status | Coletadas | Em reparo | Prontas | Dash. em andamento | Dash. prontas p/ entrega |
| --- | :-: | :-: | :-: | :-: | :-: |
| `draft` | | | | | |
| `collected` | ● | | | ● | |
| `canceled` | | | | | |
| `in_workshop` | | ● | | ● | |
| `in_budget` | | ● | | ● | |
| `awaiting_approval` | | ● | | ● | |
| `approved` | | ● | | ● | |
| `in_service` | | ● | | ● | |
| `rejected` | | ● | | ● | |
| `ready` | | | ● | ● | ● |
| `invoiced` | | | ● | ● | ● |
| `partial_delivery` | | | ● | ● | ● |
| `delivered` | | | | | |
| `reopened` | | | | ● (defensive) | |

**Where it lives:** extend the existing `src/shared/model/collection-status.ts` — do not create an `entities/collection` layer (that would be an architecture reopening, and the taxonomy is already in `shared/model` precisely so list, dashboard, and operations can share it). Export `inRepairStatuses`, `readyForDeliveryStatuses`, `inProgressStatuses`, `statusesForListFilter()`, and `isReadyForDelivery()`. SQL receives arrays from TypeScript; it never re-declares buckets.

### 7.2 PR 6 — taxonomy only (TypeScript, no SQL)

**Owns:** `src/shared/model/collection-status.ts` (the two sets above; keep the chip union `"all" | "collected" | "in_repair" | "ready"`, where `"ready"` now means the *bucket*), `src/_pages/collection-lifecycle/model/status-filters.ts` (re-export + Zod parity), `src/_pages/dashboard/model/contracts.ts` (delete the local `readyStatuses`; type `DashboardActivityStatus` as `CollectionStatus` instead of duplicating the union), `tests/unit/collections-list-filter.test.ts` (**invert**).

**Accept:** a `ready` collection appears under "Prontas" only. A `rejected` collection appears under "Em reparo". After registering an NF-e, the dashboard subtitle still counts the collection as ready for delivery. `countInProgress` still excludes `draft`, `canceled`, `delivered` and still includes `invoiced`.

**Tests (new — there are currently none for the dashboard counters):** `matchesStatusFilter("ready","in_repair") === false`; `matchesStatusFilter` true for `ready`/`invoiced`/`partial_delivery` under `"ready"`; `matchesStatusFilter("rejected","in_repair") === true`; `countReadyForDelivery([{status:"invoiced"}]) === 1`; `countReadyForDelivery([{status:"ready"},{status:"delivered"}]) === 1`.

**Residual after PR 6:** counts and filters are still computed from the first page of 50 rows. PR 7 closes that.

### 7.3 PR 7 — server-side search, pagination and honest counts

**The scan is stale on one point:** `list_collections` **is** already called by the DAL (`src/_pages/collection-lifecycle/api/queries.ts` 42–50, passing all nine parameters). The pages simply never fill them in — `app/(protected)/coletas/page.tsx` 6–16 asks for `{ limit: 50 }` and hands the array to a Client Component, which filters in the browser and matches only `officialCode` and `customerName`:

```47:57:sistema-coleta/src/_pages/collection-lifecycle/ui/collections-list-page.tsx
  const filteredItems = initialItems.filter((item) => {
    const matchesStatus = matchesStatusFilter(item.status, selectedFilter);
    const term = searchTerm.trim().toLowerCase();
    if (!term) return matchesStatus;
    const matchesCode = item.officialCode?.toLowerCase().includes(term) ?? false;
    const matchesCustomer = item.customerName?.toLowerCase().includes(term) ?? false;
    return matchesStatus && (matchesCode || matchesCustomer);
  });
```

`nextCursor` is returned by the RPC and thrown away, so pagination does not exist in the UI. The current RPC body (last replaced in `20260829220000`, lines 371–488) supports partial `ILIKE` on code and customer, **exact** match on `tax_id` and `phone`, a single status, a `created_at` range, and cursor pagination — but has **no** `totalCount`, no multi-status filter, and no unified OR search. So a correct "Em reparo" chip and a single search box need additive SQL.

**Migration:** `supabase/migrations/20260906130000_phase_5_list_collections_search_totals.sql`

PostgreSQL cannot add parameters via `CREATE OR REPLACE`, so this is the one place in the plan that drops a function signature. That is a function-level change, not a data change — but the re-`GRANT` is mandatory or the list dies with a permission error:

```sql
drop function if exists public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer);

create or replace function public.list_collections(
  p_code text default null, p_customer text default null, p_tax_id text default null,
  p_phone text default null, p_status text default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_cursor text default null, p_limit integer default null,
  p_q text default null, p_statuses text[] default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
-- Start from the 20260829220000 body verbatim (customer snapshot for every non-draft status).
-- Keep: private.decode_collection_cursor / encode_collection_cursor,
--        page_size = greatest(1, least(coalesce(p_limit, 25), 50)),
--        private.current_user_is_admin(collection_record.organization_id),
--        order by created_at desc, id desc, and the fetch-one-extra cursor trick.
-- Add to the filtered CTE:
--   and (p_statuses is null or collection_record.status = any (p_statuses))
--   and (p_q is null or (
--          collection_record.official_code ilike '%' || p_q || '%'
--       or display_legal_name ilike '%' || p_q || '%'
--       or display_tax_id = regexp_replace(p_q, '\D', '', 'g')
--       or display_phone  = regexp_replace(p_q, '\D', '', 'g')
--       or (length(regexp_replace(p_q, '\D', '', 'g')) >= 7 and (
--              display_tax_id like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'
--           or display_phone  like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'))))
-- Add: filtered_count as (select count(*) from filtered)
-- Return jsonb with items, nextCursor, totalCount.
$$;

revoke execute on function public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])
  from public, anon, service_role;
grant execute on function public.list_collections(
  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])
  to authenticated;
```

Digits are stripped in SQL **and** normalized in TypeScript, because `customers.tax_id` (`^[0-9]{11}$` or 14) and `customers.phone` (`^[1-9][0-9]{9,10}$`) are stored digits-only while the form shows them formatted. Snapshots copy the same digits.

**Dashboard counts** must stop riding on the list page. Either call `listCollections` twice with `{ statuses, limit: 1 }` and read `totalCount`, or — preferred — add a small `collection_dashboard_summary()` (same admin predicate, `security definer`) returning `{ inProgress, readyForDelivery }`, exposed through a new `src/_pages/dashboard/api/queries.ts` per ADR 0009. "Próximas atividades" may keep using `list_collections` with `p_statuses` and `p_limit: 3` — that is a feed, not a count.

**Owns:** the migration; `src/_pages/collection-lifecycle/model/contracts.ts` (add `q`, `filter`, `statuses` to `collectionQuerySchema`; add required `totalCount` to `collectionListResultSchema`); `src/_pages/collection-lifecycle/api/queries.ts` and `api/lifecycle-supabase.ts`; `app/(protected)/coletas/page.tsx` (read `searchParams`, `safeParse`, map chip → `p_statuses` via `statusesForListFilter`); `src/_pages/collection-lifecycle/ui/collections-list-page.tsx` (chips and search write the URL with `router.replace` + `useTransition`, ~300 ms debounce on `q`; stop filtering `initialItems`; add "Carregar mais" using the opaque `nextCursor`); `app/(protected)/dashboard/page.tsx` + new dashboard DAL; `app/api/collections/route.ts` (already parses the query string — extend it); `src/shared/api/database.generated.ts` (regenerate); [`docs/http-api.md`](../http-api.md) "Consulta e paginação".

Note that `tests/phase-1/phase-1-review-regressions.test.ts` asserts against the **1A** SQL text, not the current Phase 0 body — do not "fix" it here. `supabase/tests/phase_0_workshop_schema_contracts_test.sql` asserts the 9-argument privilege string and **must** be updated to the new signature.

**Accept:** searching an official code, a customer name, a CPF, or a phone finds the row regardless of how old it is. "Em reparo" is a server-side status set and excludes `ready`. The list paginates with the RPC cursor. Changing `q` or `filter` resets the cursor. The dashboard numbers reflect the whole organization, not the newest 50 rows. Anon still cannot execute the RPC.

**Risks:** forgetting the re-`GRANT` after the DROP breaks the list for `authenticated`; RLS/org scoping must stay inside the `SECURITY DEFINER` body via `current_user_is_admin`; `ILIKE` is case-insensitive but **not** accent-insensitive, so "Jose" will miss "José" (there is no `unaccent` extension installed — document the gap or add `unaccent` in the same additive migration and accept the new object on the remote); existing indexes (`collections_list_idx`, `customers_search_idx`, `customers_phone_idx`, the unique on `official_code`) do not serve leading-wildcard `ILIKE`, so a `pg_trgm` GIN index is the escape hatch if latency shows up — skip it for V1 volume.

---

## 8. PR 8 — 5.4 timeline labels and `actorName`

**Severity:** média.

**Ground truth.** The label map is keyed on operation names, while every RPC writes dotted audit names:

```7:18:sistema-coleta/src/_pages/collection-operations/ui/collection-timeline.tsx
const eventTypeLabels: Readonly<Record<string, string>> = {
  collection_finalized: "Coleta finalizada",
  workshop_check_in: "Entrada na oficina",
```

Since the render falls back to `event.type`, **every** row on a real guia shows a raw dotted string. And `actorName` is not lost in the mapper — it is hardcoded in SQL, in a function never replaced since 1A:

```2573:2580:sistema-coleta/supabase/migrations/20260815090000_phase_1a_collection_core.sql
            'reason', page.reason,
            'actorName', null,
```

The complete set of event strings actually written, with the intended Portuguese:

| Emitted | Label |
| --- | --- |
| `collection.draft.created` | Rascunho criado |
| `collection.draft.updated` | Rascunho atualizado |
| `collection.item.created` / `.updated` / `.removed` | Item adicionado / atualizado / removido |
| `collection.evidence.committed` | Evidência anexada |
| `collection.signature.committed` | Assinatura registrada |
| `collection.finalized` | Coleta finalizada |
| `collection.workshop.checked_in` | Entrada na oficina |
| `collection.budget.created` / `.approved` / `.rejected` | Orçamento registrado / aprovado / rejeitado |
| `collection.service.progress_updated` | Progresso atualizado |
| `collection.invoice.registered` | NF-e registrada |
| `collection.delivered` | Entrega ao cliente |
| `collection.canceled` / `collection.reopened` | Coleta cancelada / reaberta |

`collection_events` has `actor_user_id` but no `actor_name`. `profiles.full_name` is nullable and the auth trigger inserts `null`, while the operational names are already snapshotted into `metadata` (`administratorName`, `signerName`, `receiverName`).

**Fix.** UI: replace the map keys with the emitted strings, keeping the raw fallback. SQL: `supabase/migrations/20260906140000_phase_5_list_collection_events_actor_name.sql`, a **same-signature** `CREATE OR REPLACE` of `list_collection_events` that `LEFT JOIN public.profiles on profile_record.user_id = page.actor_user_id` and resolves:

```sql
'actorName', nullif(trim(coalesce(
  profile_record.full_name,
  page.metadata->>'administratorName',
  page.metadata->>'signerName',
  page.metadata->>'receiverName'
)), '')
```

Join-at-read plus metadata fallback, chosen deliberately: the function is already `SECURITY DEFINER`, so it bypasses `profiles_select_self` and needs no new RLS policy; metadata already snapshots the operational actor for check-in/approval/delivery; the join covers events that have an `actor_user_id` but no metadata name (finalize, item CRUD). A write-time `actor_display_name` snapshot is the better long-term audit answer and can be added later as a nullable column populated on **new** writes only — but it cannot retro-fill history, so it is not the fix here.

**Do not** rewrite historical `event_type` strings; `collection_events` has an immutability trigger.

**Owns:** `src/_pages/collection-operations/ui/collection-timeline.tsx`, the migration. `collectionEventSchema` keeps `type: z.string()` (open string — no enum to sync) and the mapper alias `actorname → actorName` already exists.

**Accept:** the hub timeline for `MJT-2026-000001` reads "Coleta finalizada", not `collection.finalized`; an unknown future type still renders raw instead of blank; a check-in event shows "Por <nome>" from metadata even when `profiles.full_name` is null.

**Tests:** unit — every emitted string above maps to a non-raw label, unknown falls back. pgTAP — `list_collection_events` returns a non-null `actorName` when `metadata.administratorName` is set and `full_name` is null. Manual — open both production guias.

**Risks:** minimal; read path only, no status/write/idempotency impact. Worst case `actorName` stays null when both sources are empty.

---

## 9. PR 9 — 5.8 check-in requires every item

**Severity:** média.

**Ground truth.** `workshopCheckInSchema` requires only `min(1)` item, and `workshop_check_in` (`20260823000001` 110–139) loops the payload without ever comparing it to the collection's item set. `workshop_checkin_items` has no unique on `collection_item_id`, so a duplicated id inserts twice. The UI is currently well-behaved — `workshop-checkin-page.tsx` 37–44 seeds one row per item with no way to uncheck — but a crafted Server Action or API call can persist a partial conference and still flip the collection to `in_workshop`.

Completeness is the right rule, and it is grounded rather than guessed: [`data-and-rules.md`](../architecture/data-and-rules.md) 65 and [`vision-and-scope.md`](../product/vision-and-scope.md) decision 15 describe check-in as an item-by-item conference; and there is no post-emission add path, because `create_collection_item` / `remove_collection_item` both require `status = 'draft'` and raise `collection_not_draft`, while document revision patches the snapshot without inserting items. So the item set is frozen at finalize.

> **Open product question — flag once, do not decide unilaterally.** An item that was collected but "never arrived" at the workshop cannot be recorded, because `workshop_checkin_items` has a CHECK `quantity_observed > 0`. **Do not relax that CHECK in this axis.** Ask the human whether a divergence-with-zero-quantity case must exist; if yes, it is a separate product axis.

**Migration:** `supabase/migrations/20260906150000_phase_5_workshop_check_in_complete_items.sql` — same 8-argument signature, `CREATE OR REPLACE`, two new guards added before/around the existing loop:

```sql
if exists (
  select 1 from jsonb_to_recordset(p_items) as x(item_id uuid)
  group by item_id having count(*) > 1
) then
  raise exception using errcode = 'P0001', message = 'duplicate_workshop_item';
end if;

if exists (
  select 1 from public.collection_items as ci
  where ci.collection_id = p_collection_id
    and ci.organization_id = collection_record.organization_id
    and ci.removed_at is null
    and ci.id not in (select x.item_id from jsonb_to_recordset(p_items) as x(item_id uuid))
) then
  raise exception using errcode = 'P0001', message = 'workshop_checkin_items_incomplete';
end if;
```

Extra unknown ids keep raising the existing `collection_item_not_found`; an empty array keeps raising `invalid_workshop_checkin_request`.

**Contract sync:** map `workshop_checkin_items_incomplete` and `duplicate_workshop_item` to 422 + Portuguese in `src/_pages/collection-operations/api/operations-errors.ts` and `src/shared/lib/action-error.ts`. The mapper `workshop-rpc-items.ts` already emits snake_case (`item_id`, `quantity_observed`, …) and needs no change. Optionally add a UI guard that blocks submit when the submitted id set differs from the collection's.

**Accept:** a payload missing one of two items is refused with `workshop_checkin_items_incomplete` and the collection stays `collected`; a duplicated id is refused; the current screen (which sends every item) still checks in successfully; replaying the same idempotency key returns the stored result with a single `workshop_checkin_items` set.

**Risks:** blocking a legitimate check-in only if product later wants a skip path (see the open question). Retrying after success hits `collection_not_collected`, which is the desired outcome, not a double check-in. Note that `supabase/tests/phase_3_operations_workshop_test.sql` 38–44 still asserts the **3a** signatures (bug 5.18) and even calls a function named `budget_approval` that never existed — do not rely on that file as a gate; fixing it is a separate axis.

---

## 10. PR 10–13 — service order state machine (5.9, 5.5, 5.10, 5.11)

Reference transition table used by all four (verified against migrations):

| RPC | Collection before → after | Service order | Event |
| --- | --- | --- | --- |
| `finalize_collection` | `draft` → `collected` | — | `collection.finalized` |
| `workshop_check_in` | `collected` → `in_workshop` | — | `collection.workshop.checked_in` |
| `create_technical_budget` | `in_workshop` \| `rejected` → **`in_budget`** | insert/update `budgeted` | `collection.budget.created` |
| `approve_technical_budget` | `in_budget` → `approved` \| `rejected` | → `approved` \| `rejected` | `collection.budget.approved` / `.rejected` |
| `update_service_progress` | `approved` \| `in_service` → `in_service` \| `ready` | → `in_service` \| `ready` | `collection.service.progress_updated` |
| `register_invoice_reference` | `ready` → `invoiced` | **unchanged** | `collection.invoice.registered` |
| `deliver_to_customer` | `invoiced` \| `partial_delivery` → `partial_delivery` \| `delivered` | **always `ready`** | `collection.delivered` |
| `cancel_or_reopen_collection` | any but `delivered`/`canceled` → `canceled`; `canceled` → previous | unchanged | `collection.canceled` / `.reopened` |
| `cancel_collection` / `reopen_collection` (1A) | `collected` → `canceled`; `canceled` → previous | unchanged | same, **plus a new document version** |

### 10.1 PR 10 — 5.9 the service order needs a terminal state

The live CHECK (Fase 0.4) allows `draft | budgeted | approved | in_service | ready | canceled | rejected` — there is no `delivered`. `deliver_to_customer` therefore writes the only post-service value that exists, in **both** branches:

```877:878:sistema-coleta/supabase/migrations/20260823000001_phase_3_rpcs_idempotency.sql
  if order_record.id is not null then
    update public.service_orders set status = 'ready' where id = order_record.id;
```

**The scan's "moves backward" wording is stale:** since `register_invoice_reference` never touches the service order, it is already `ready` when delivery runs, so mechanically this is a no-op. The real defect is that a fully delivered collection leaves its service order looking "ready for workshop" — there is no terminal state.

**Migration:** `supabase/migrations/20260906160000_phase_5_service_order_delivered_status.sql`, using the exact DROP/ADD pattern Fase 0.4 already established:

```sql
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders
  add constraint service_orders_status_check
  check (status in ('draft','budgeted','approved','in_service','ready','canceled','rejected','delivered'));
```

Then `CREATE OR REPLACE deliver_to_customer` (same 9 arguments — **no** `DROP FUNCTION`) changing only the service-order update:

```sql
    update public.service_orders
      set status = case when remaining = 0 then 'delivered' else 'ready' end,
          updated_at = now()
    where id = order_record.id;
```

Partial delivery keeps the order `ready` (items are still in the shop); full delivery makes it `delivered`. Do not add `invoiced` to the service order — invoicing is a collection-level fact.

**Contract sync:** add `"delivered"` to `ServiceOrderStatus` (`src/_pages/collection-operations/model/view-models.ts` 9) and to `serviceOrderSchema.status` (`api/queries.ts` 27); regenerate `database.generated.ts`; update the CHECK assertions in `supabase/tests/phase_0_workshop_schema_contracts_test.sql` 46–53 and `phase_3_operations_workshop_test.sql` 21–27. No collection-status contract changes — `partial_delivery` / `delivered` are already correct in `customerDeliveryResultSchema`.

**Backward compatibility:** every existing row is a subset of the old CHECK, so widening cannot fail. Both production guias are untouched until someone opens Entrega.

**Backfill (needs human approval).** Run the `SELECT` first; if no collection is `delivered` yet, this touches zero rows:

```sql
UPDATE public.service_orders AS so
SET status = 'delivered', updated_at = now()
FROM public.collections AS c
WHERE so.collection_id = c.id
  AND so.organization_id = c.organization_id
  AND c.status = 'delivered'
  AND so.status = 'ready';
```

Never touch `partial_delivery` rows.

**Accept:** after a full delivery the service order is `delivered` and the collection is `delivered`; after a partial the order is `ready` and the collection is `partial_delivery`; the CHECK definition contains `delivered`; Zod rejects an unknown service-order status.

### 10.2 PR 11 — 5.5 delivery item validation (**after PR 10**)

The screen pre-selects everything:

```30:30:sistema-coleta/src/_pages/collection-operations/ui/customer-delivery-page.tsx
  const [deliveredItemIds, setDeliveredItemIds] = useState<string[]>(() => items.map((item) => item.id));
```

`entrega/page.tsx` loads only `get_collection_detail`, ignoring `getDeliveryTerms` / `getDeliveryTermItems` / `getBudgetItems` — which already exist in `queries.ts` 96–115 and are unused. **The scan is incomplete on the RPC:** empty payloads (`invalid_delivery_request`) and foreign ids (`collection_item_not_found`) are already rejected; duplicates and already-delivered items die only on the `delivery_term_items` unique `(organization_id, collection_id, collection_item_id)`, surfacing as Postgres `23505` mapped to a generic conflict. An item counts as delivered iff it has a `delivery_term_items` row; there is no `delivered_at` on `collection_items`. Multiple `delivery_terms` per collection are allowed since Fase 0.6.

**UI fix:** load the prior terms (and, per [`mobile-workflows.md`](../product/mobile-workflows.md) 26–35, the budget item progress), default `deliveredItemIds` to **`[]`** or to *ready ∩ not-yet-delivered* — **never** to all ids — and render already-delivered rows as visible-but-disabled "já entregue". Keep the empty-selection guard. Optionally add a `.refine` for unique ids in `customerDeliverySchema`.

> **Open product question:** the scan asks only for "not already delivered", while the product doc asks for "only items marked Pronto". Pick one with the human; defaulting to an empty selection is the safest interim.

**Migration:** `supabase/migrations/20260906170000_phase_5_deliver_to_customer_item_validation.sql` — same 9-argument `CREATE OR REPLACE`, **starting from the PR 10 body** so the `delivered`/`ready` branch survives. Insert after the status/version/intent checks and before the item loop:

```sql
if (select count(*) from unnest(p_delivered_item_ids))
   <> (select count(distinct d) from unnest(p_delivered_item_ids) as d) then
  raise exception using errcode = 'P0001', message = 'duplicate_delivery_item';
end if;

if exists (
  select 1 from public.delivery_term_items as dti
  where dti.collection_id = p_collection_id
    and dti.organization_id = collection_record.organization_id
    and dti.collection_item_id = any (p_delivered_item_ids)
) then
  raise exception using errcode = 'P0001', message = 'item_already_delivered';
end if;
```

Do **not** add a unique constraint on `delivery_items` in this PR — it could fail if duplicate rows already exist. The `delivery_term_items` unique stays as a backstop.

**Contract sync:** map `duplicate_delivery_item` and `item_already_delivered` to 409 + Portuguese in `operations-errors.ts` and `action-error.ts`. No RPC argument renames.

**Accept:** a duplicated id is refused with a machine code (not `23505`); an id already on a previous term is refused; two disjoint partial deliveries still both succeed; the second visit shows already-delivered items disabled and nothing pre-checked; replaying the same idempotency key + hash returns the first result without creating a second term.

**Risks:** delivery is **not** on the offline draft queue (`mutationKindSchema` is draft-only), and the UI generates a fresh `crypto.randomUUID()` per submit, so the idempotency ledger does not protect a double-click — version checks plus these new codes do. `digestLifecycleRequest` hashes only `{ operation, collectionId, expectedVersion, reason }`, not the item ids; do not assume otherwise.

### 10.3 PR 12 — 5.10 `awaiting_approval`

Declared in the CHECK (`20260822125100` 13–18), in the identity and previous-status CHECKs, in `collectionStatusSchema`, in the badge, in the dashboard type, in the hub CTAs, and in the "Em reparo" filter — and **written by nothing**. `create_technical_budget` sets `in_budget`; `approve_technical_budget` requires `in_budget` and raises `collection_not_in_budget` for anything else, including `awaiting_approval`.

**Recommendation: document it as deliberately unused. Do not wire it in.** `in_budget` already means "budget exists, waiting for approve/reject" across the RPC guard, the error copy, the result Zod, and the UI. There is no edit-budget dwell state, because a budget is a single `create_technical_budget` shot (plus a rebudget from `rejected`). Wiring `awaiting_approval` would silently redefine `in_budget`.

Cost of wiring it in, if product later insists (must land as **one** migration + one TypeScript PR, or approve breaks): `create_technical_budget` writes `awaiting_approval` and reports it; `approve_technical_budget` accepts `awaiting_approval` **and keeps accepting `in_budget` forever** for rows already waiting; update `technicalBudgetResultSchema`, the action type in `phase3-flow.actions.ts`, and the three error maps (`operations-errors.ts`, `action-error.ts`, `action-failure-code.ts`); plus an optional `UPDATE collections SET status='awaiting_approval' WHERE status='in_budget'` that **needs human approval** and is unsafe unless it deploys atomically with the RPC change.

**Do not** remove the value from the CHECK or from any Zod union — that is not additive, and dropping it from the public verification schema would 500 any row or event that ever carried it. Keep the label as a defensive fallback. Deliverable for this PR: a comment in `src/shared/model/collection-status.ts` and one line in [`data-and-rules.md`](../architecture/data-and-rules.md), plus a test asserting `create_technical_budget` still reports `in_budget`.

### 10.4 PR 13 — 5.11 two cancel/reopen stacks

Two stacks exist, on purpose, and [`docs/http-api.md`](../http-api.md) 108–110 documents the split:

| | Stack A — lifecycle (1A) | Stack B — workshop |
| --- | --- | --- |
| SQL | `cancel_collection` / `reopen_collection` (`20260815090000`, never replaced) | `cancel_or_reopen_collection` (`20260823000001`) |
| Entry | `HTTP /api/collections/{id}/cancel|reopen` + `collection-lifecycle/api/commands.ts` | hub CTAs → `/oficina/cancelar|reabrir` → `phase3-flow.actions.ts` |
| Cancel guard | `collected` only | anything except `delivered` and `canceled` |
| Document | appends a **new version** (PDF/QR) | none |
| Reopen clears cancel columns | **no** | **yes** |

Lifecycle reopen restores the status but leaves the cancel columns populated:

```2270:2279:sistema-coleta/supabase/migrations/20260815090000_phase_1a_collection_core.sql
  restored_status := coalesce(collection_record.previous_status_before_cancellation, 'collected');
  next_version := collection_record.row_version + 1;
  update public.collections
    set status = restored_status,
        reopened_at = now(),
```

while the workshop stack does clear them (`20260823000001` 1011–1016: `canceled_at = null, canceled_by = null, cancel_reason = null, previous_status_before_cancellation = null`).

**The scan overstates the user-visible impact:** the hub, list, and QR verification all read `status`, and neither `get_collection_detail` nor `list_collections` returns `canceled_at`, so a lifecycle-reopened collection does **not** display as canceled. The real defects are (a) header columns that contradict `status`, (b) mixed-stack sequences — workshop cancel followed by lifecycle reopen leaves a stale `canceled_at` *and* mints a document — and (c) the workshop reopen assigning `status = previous_status_before_cancellation` with **no `coalesce`**, which can write NULL.

**Canonical stack:** `cancel_or_reopen_collection` for the oficina UI (already true). **Keep** the lifecycle functions and their HTTP routes — they are the only path that satisfies the product rule in [`data-and-rules.md`](../architecture/data-and-rules.md) 77 (reopen produces a new document version). Deprecation is non-destructive: nothing is dropped, and the hub is not repointed.

**Migration:** `supabase/migrations/20260906180000_phase_5_lifecycle_reopen_clear_cancel.sql` — same-signature `CREATE OR REPLACE reopen_collection` adding `canceled_at = null, canceled_by = null, cancel_reason = null, previous_status_before_cancellation = null` to the existing UPDATE (keeping `coalesce(previous, 'collected')` and the document append), plus a `coalesce` on the workshop reopen's status assignment so a null previous can never write NULL. Clearing these header columns loses no history: the cancellation is already recorded in `collection_events` and, on the lifecycle path, in a cancel document version. `reopened_at/by/reason` are **not** cleared.

Note while you are in this code: `private.enqueue_lifecycle_document_render_job` (`20260820230000` 537) enqueues when `canceled_at is not null OR reopened_at is not null`, and `reopened_at` is never cleared by either stack — so a stale `canceled_at` is not the only thing keeping that condition true. Do not "fix" the enqueue in this axis.

**Backfill (needs human approval).** Run the `SELECT` first:

```sql
SELECT id, official_code, status, canceled_at FROM public.collections
WHERE status <> 'canceled' AND canceled_at IS NOT NULL;

UPDATE public.collections
SET canceled_at = null, canceled_by = null, cancel_reason = null,
    previous_status_before_cancellation = null
WHERE status <> 'canceled' AND canceled_at IS NOT NULL;
```

Currently canceled rows are untouched by that WHERE clause.

**Accept:** lifecycle cancel → reopen leaves `canceled_at IS NULL` and `status` restored, and still appends a document version; workshop cancel → reopen behaves as today; a null previous status can never be written; Reabrir remains available only on `canceled` (`operational-actions.ts`); both HTTP routes and both SQL functions still exist.

**Also worth knowing (do not fix here):** `cancel_or_reopen_collection` permits cancelling a `draft`, which then violates `collections_issued_identity_check` — a dead path with a confusing error. And `service_orders.status = 'canceled'` is allowed by the CHECK but written by no RPC.

---

## 11. Errata — absorbed into the scan on 2026-09-06

Historical notes from before the PRs. Do **not** re-litigate or re-apply; the scan already reflects the shipped code.

| Scan claim | Reality |
| --- | --- |
| 3.1 — trap is "usuário sem papel administrator" | Also inactive `profiles.status`, inactive membership, and missing organization — all four raise `AdministratorAccessDeniedError` |
| 3.4 — `setAll` swallow is a bug | It is the required RSC pattern; only Server Actions must fail loud. The lifecycle client has the same swallow and the public verification client no-ops `setAll` — neither is named in the scan |
| 3.5 — "O layout ainda autentica" | **Wrong** in the normal misconfig: the layout **throws** on `getPublicEnvironment()`. Also, a syntactically invalid URL passes `hasPublicEnvironment()` and makes the proxy throw |
| 3.2 — `getServiceEnvironment` requires `DOCUMENT_RATE_LIMIT_SECRET` | **Wrong.** It requires URL + `SUPABASE_SECRET_KEY` + `SUPABASE_CONFIRM_PROJECT_REF`; the secret is a separate `getDocumentRateLimitSecret()` check |
| 3.2 — `auth_login` migrations "confirmar no remoto" | Both files exist locally and docs record them applied 2026-08-29 — reconfirm read-only, do not assume missing |
| 3.3 — "5 tentativas/15 min" | Correct count; the window is a **UTC-aligned** 900 s slot, not a sliding 15 minutes |
| 1.4 — offline actions return Portuguese | Partly stale: finalize, signature, discard, and `getCustomerAction` are already fixed; nine siblings remain |
| 4.3 — "mensagem genérica" | Half stale: the offline banner already shows specific copy; the gaps are the legacy signature page and the settings screen |
| 5.1 — RPC `list_collections` "não é usado" | Stale: the DAL calls it with all nine parameters; the pages just pass `{ limit: 50 }` and filter in the browser. The RPC has no `totalCount`, no multi-status, no unified search |
| 5.2 | True, and `tests/unit/collections-list-filter.test.ts` **asserts the bug** — the test must be inverted |
| 5.3 | True for the subtitle; there is one card, not a separate "prontas" card. Both numbers are also computed from the first 50 rows |
| 5.4 | True, and worse: the label map is wrong for **every** event type, and `actorName` is hardcoded `null` in SQL |
| 5.5 | True as a machine code; empty and foreign ids are already rejected, and duplicates already die on a unique constraint as `23505` |
| 5.8 | True at RPC/Zod/API; the current UI already submits every item. Post-emission item add is not a live path |
| 5.9 | "Volta para `ready`" is stale — invoicing never moves the service order, so it is already `ready`. The defect is the absence of a terminal state |
| 5.18 | Confirmed: Fase 3 pgTAP still asserts 3a signatures and calls a never-existing `budget_approval` |

---

## 12. Do not

- Do not re-implement any PR in this file. Status is **closed**.
- Do not mark Fase 1 un-closed, and do not reopen 1.6 (worker/PDF), 4.4 (`/verificar`), or 4.5 (`NEXT_PUBLIC_APP_URL`) — all closed on Production 2026-09-05.
- Do not re-implement **5.6**. Delivery from `ready` shipped in `20260906210000_phase_5_deliver_from_ready.sql`; NF-e stays optional. Do not implement **5.7** SignaturePad, **5.12**, or **5.13** — deferred 2026-09-06.
- Do not put role checks in `proxy.ts`; do not throw from `proxy`; do not change `config.matcher`.
- Do not throw from `setAll` in the RSC default path.
- Do not make `SUPABASE_CONFIRM_PROJECT_REF` optional-and-ignored, and do not make the login rate limiter fail-open.
- Do not relax `workshop_checkin_items.quantity_observed > 0`, and do not add a unique constraint on `delivery_items`.
- Do not remove `awaiting_approval` or `reopened` from any CHECK or Zod union.
- Do not drop, rename, or stop granting `cancel_collection` / `reopen_collection`, or delete their HTTP routes.
- Do not combine 5.9, 5.10, and 5.11 into one migration, and never write PR 11 before PR 10 has landed.
- Do not run any backfill `UPDATE` without showing the paired `SELECT` count to the human first.
- Do not enable email sending, print tokens or PII, reset the database, or commit `.env.local`.

## 13. Orchestration (historical)

Do **not** pick a PR from §3 to implement. This plan is closed.

1. (Was:) Pick **one** PR from §3. Read its section end to end, then the preflight docs in §1.
2. Confirm the starting point before writing SQL: for any `CREATE OR REPLACE`, open the migration that last replaced that function and copy its body forward. For PR 2, first reconfirm the `auth_login` migrations on the remote read-only (§4.2).
3. Implement. Split reviewer lanes per PR — a sensible default is one reviewer on the SQL body and grants, one on the DAL/Zod/mapper contract sync, one on UI/copy, one on tests.
4. Validate: scoped `npm run test` on the owned tests, then `npm run lint` and `npm run typecheck`, plus `npm run architecture` whenever FSD imports moved. Run `npm run check` before asking to merge.
5. For any migration: `supabase db push --dry-run`, show the plan to the human, then a manual push, then `npm run db:types:remote` and commit the regenerated types.
6. Ask the human before commit, push, and any Production deploy. Deploy a **new** SHA, never a redeploy of the old one.
7. **Done 2026-09-06.** Metadata closed, SHAs recorded above, scan §5 struck, §11 errata absorbed into [`system-scan-for-bugs.md`](../design-patterns/system-scan-for-bugs.md). 5.6 applied remotely and live in Production. Cursor encoder `20260906220000` applied remotely. Next **code** only if the human asks: 5.7 / 5.12 / 5.13, NF-e after delivery, or delivery Pronto filter. Recertification remains in the scan.
