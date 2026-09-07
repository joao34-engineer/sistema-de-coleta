"use client";

import { useActionState } from "react";
import { signOutAction, initialSignOutState } from "@/shared/auth/actions";
import { Button } from "@/shared/ui/button";

export function AccessDeniedSignOut() {
  const [state, formAction] = useActionState(signOutAction, initialSignOutState);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <Button type="submit" variant="secondary" size="md">
        Sair
      </Button>
      {state?.status === "error" ? (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
