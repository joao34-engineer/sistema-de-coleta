import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { routes } from "@/shared/config/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[var(--color-surface-bg)] px-4">
      <MobileStatePanel
        type="error"
        title="Página não encontrada"
        subtitle="O endereço informado não existe."
        actionText="Voltar ao início"
        actionHref={routes.home}
      />
    </main>
  );
}
