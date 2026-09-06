import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import { CompanySettingsForm } from "./company-settings-form";

type Props = Readonly<{ settings: CompanySettingsDTO }>;

export function CompanySettingsPage({ settings }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Configurações</p>
        <h1 className="mt-1 text-3xl font-semibold">Dados institucionais</h1>
        <p className="mt-2 text-sm text-muted">
          Estes dados identificam a MJT na guia de coleta (PDF). Preencha todos os campos abaixo e envie o logo para
          habilitar a emissão do número oficial.
        </p>
      </div>
      <section className="rounded-medium border border-border bg-surface p-5 shadow-surface md:p-8">
        <CompanySettingsForm settings={settings} />
      </section>
    </main>
  );
}
