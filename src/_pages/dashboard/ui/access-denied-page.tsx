import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { AccessDeniedSignOut } from "./access-denied-sign-out";

export function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[var(--color-surface-bg)] px-4">
      <MobileStatePanel
        type="error"
        title="Acesso não autorizado"
        subtitle="Esta conta não possui um vínculo administrativo ativo com a MJT."
        actionSlot={<AccessDeniedSignOut />}
      />
    </main>
  );
}
