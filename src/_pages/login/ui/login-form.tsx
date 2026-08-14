"use client";

import { useActionState } from "react";
import { signInAction } from "../api/actions";
import { initialLoginActionState } from "@/shared/lib/action-result";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialLoginActionState);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-md border border-border bg-surface px-3 py-2" aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} />
        {state.fieldErrors?.email ? <p id="email-error" className="mt-1 text-sm text-danger">{state.fieldErrors.email}</p> : null}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-md border border-border bg-surface px-3 py-2" aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password ? "password-error" : undefined} />
        {state.fieldErrors?.password ? <p id="password-error" className="mt-1 text-sm text-danger">{state.fieldErrors.password}</p> : null}
      </div>
      {state.message ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-danger">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
