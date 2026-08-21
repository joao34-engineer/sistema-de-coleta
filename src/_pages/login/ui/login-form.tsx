"use client";

import { useActionState, useState } from "react";
import { signInAction } from "../api/actions";
import { initialLoginActionState } from "@/shared/lib/action-result";
import { Button } from "@/shared/ui/button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialLoginActionState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
          E-mail Corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="coletor@mjt.com.br"
          className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-surface px-3.5 text-sm transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="mt-1 text-xs text-red-600 font-medium">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-surface pl-3.5 pr-12 text-sm transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
          >
            {showPassword ? "Ocultar" : "Exibir"}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="password-error" className="mt-1 text-xs text-red-600 font-medium">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          Manter conectado neste dispositivo
        </label>
      </div>

      {state.message ? (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isLoading={pending}
        className="h-11 w-full rounded-xl font-semibold text-sm shadow-sm"
      >
        {pending ? "Autenticando..." : "Entrar no Sistema"}
      </Button>
    </form>
  );
}
