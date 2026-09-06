import { Card } from "@/shared/ui/card";
import { AccessDeniedSignOut } from "./access-denied-sign-out";

export function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Acesso não autorizado</h1>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Esta conta não possui um vínculo administrativo ativo com a MJT.
        </p>
        <div className="mt-6">
          <AccessDeniedSignOut />
        </div>
      </Card>
    </main>
  );
}
