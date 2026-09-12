import type { Route } from "next";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { leafChrome } from "../model/settings-chrome";
import { CompanySettingsForm } from "./company-settings-form";

type Props = Readonly<{ settings: CompanySettingsDTO; backHref: Route }>;

export function CompanySettingsPage({ settings, backHref }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title={leafChrome.title}
        subtitle={leafChrome.subtitle}
        backHref={backHref}
      />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <CompanySettingsForm settings={settings} />
      </div>

      <MobileBottomNav />
    </main>
  );
}
