import type { Route } from "next";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { CompanySettingsForm } from "./company-settings-form";

type Props = Readonly<{ settings: CompanySettingsDTO }>;

export function CompanySettingsPage({ settings }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Empresa"
        subtitle="Dados institucionais"
        backHref={"/dashboard" as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        <CompanySettingsForm settings={settings} />
      </div>

      <MobileBottomNav />
    </main>
  );
}
