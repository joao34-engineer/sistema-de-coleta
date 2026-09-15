import type { ReactNode } from "react";
import Image from "next/image";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { buttonClassName } from "@/shared/lib/button-class-name";

const LOGO_SRC = "/logo/Logo_-_MJT-removebg-preview.png";

type ShareChromeProps = Readonly<{
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
  footnote?: string;
}>;

function ShareChrome({ headerTitle, headerSubtitle, children, footnote }: ShareChromeProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--color-surface-bg)]">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex min-h-[88px] items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3">
          <Image
            src={LOGO_SRC}
            alt="MJT Tornearia"
            width={44}
            height={32}
            priority
            className="h-8 w-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">{headerTitle}</p>
            <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">{headerSubtitle}</p>
          </div>
        </header>
        <div className="flex flex-1 flex-col justify-center px-2 py-8">{children}</div>
        {footnote ? (
          <p className="px-6 pb-10 text-center text-[13px] leading-5 text-[var(--color-text-muted)]">{footnote}</p>
        ) : null}
      </main>
    </div>
  );
}

type AvailableProps = Readonly<{ shareToken: string }>;

export function DocumentShareAvailablePage({ shareToken }: AvailableProps) {
  return (
    <ShareChrome
      headerTitle="Link seguro"
      headerSubtitle="Documento protegido"
      footnote="Este link é privado. Não compartilhe a URL em canais públicos."
    >
      <MobileStatePanel
        type="empty"
        icon="↓"
        title="Documento protegido"
        subtitle="O acesso ao PDF é temporário e cada download consome uma utilização do link."
        actionSlot={
          <a href={`/d/${shareToken}/download`} className={buttonClassName({ variant: "primary", size: "md" })}>
            Baixar PDF
          </a>
        }
      />
    </ShareChrome>
  );
}

export function DocumentShareUnavailablePage() {
  return (
    <ShareChrome headerTitle="Link seguro" headerSubtitle="Link indisponível">
      <MobileStatePanel
        type="error"
        title="Link indisponível"
        subtitle="O link é inválido."
        actionText="Fechar"
        actionHref="/"
      />
    </ShareChrome>
  );
}
