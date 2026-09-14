import type { Route } from "next";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { leafChrome } from "../model/settings-chrome";
import { CompanySettingsForm } from "./company-settings-form";

type Props = Readonly<{ settings: CompanySettingsDTO; backHref: Route }>;

export function CompanySettingsPage({ settings, backHref }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <MobilePageHeader
        title={leafChrome.title}
        subtitle={leafChrome.subtitle}
        backHref={backHref}
      />

      <div className="flex flex-col gap-4 px-6 pt-7">
        <h2 className="text-[20px] font-semibold leading-8 text-[var(--color-text-primary)]">
          {settings.setupStatus === "complete" ? "Dados da empresa" : "Configuração pendente"}
        </h2>
        <CompanySettingsForm settings={settings} />
      </div>

      <MobileBottomNav />
    </main>
  );
}
