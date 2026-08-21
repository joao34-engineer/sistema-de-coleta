"use client";

import { useActionState, useState } from "react";
import { signInAction } from "../api/actions";
import { initialLoginActionState } from "@/shared/lib/action-result";
import { Button } from "@/shared/ui/button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialLoginActionState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-primary)]">
          E-mail Corporativo *
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="seu.email@exemplo.com.br"
          className="h-[52px] w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all focus:border-[var(--color-primary)] focus:outline-none"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="mt-1.5 text-[11px] font-medium text-[var(--color-danger)]">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text-primary)]">
          Senha *
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Sua senha"
            className="h-[52px] w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card-bg)] pl-4 pr-14 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all focus:border-[var(--color-primary)] focus:outline-none"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-[12px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-neutral)]"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
          >
            {showPassword ? "Ocultar" : "Exibir"}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="password-error" className="mt-1.5 text-[11px] font-medium text-[var(--color-danger)]">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <div role="alert" className="rounded-[12px] bg-[#fdf2f1] border border-[#fca5a5] p-3.5 text-[12px] text-[#ba5b52] font-medium">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isLoading={pending}
        className="mt-3 h-[52px] rounded-[12px] text-[14px] font-semibold"
      >
        {pending ? "Entrando..." : "Entrar no sistema"}
      </Button>
    </form>
  );
}

