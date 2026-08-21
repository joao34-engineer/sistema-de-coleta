import type { PublicVerificationDTO } from "../model/public-verification";
import { Badge } from "@/shared/ui/badge";

type Props = Readonly<{ verification: PublicVerificationDTO | null }>;

function formatIssuedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PublicVerificationPage({ verification }: Props) {
  if (!verification) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-[var(--color-background)] px-4 py-10">
        <section className="w-full rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fdf2f1] text-[24px] font-bold text-[#ba5b52]">
            !
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            MJT · Validação Pública
          </span>
          <h1 className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">
            Registro não encontrado
          </h1>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            O código informado é inválido ou não corresponde a uma guia disponível para consulta pública.
          </p>
        </section>
      </main>
    );
  }

  const canceled = verification.status === "canceled";
  const authentic = verification.authentic && !canceled;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-[var(--color-background)] px-4 py-8">
      <div>
        {/* Topbar MJT do Figma */}
        <header className="mb-6 flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-sm font-bold text-white">
              MJT
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-[var(--color-text)]">
                Verificação
              </h1>
              <p className="text-[12px] text-[var(--color-muted)]">
                Validação pública de recibo
              </p>
            </div>
          </div>
          <Badge status={canceled ? "canceled" : authentic ? "collected" : "neutral"}>
            {canceled ? "Cancelada" : authentic ? "✓ Autêntica" : "Não Autêntica"}
          </Badge>
        </header>

        {/* Hero Banner */}
        <section className="mb-6 px-1">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text)]">
            {canceled ? "Guia cancelada" : authentic ? "Guia autêntica" : "Guia não autenticada"}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {canceled
              ? "Esta guia permanece verificável no histórico imutável, mas foi cancelada."
              : authentic
              ? "Os dados desta guia foram confirmados com sucesso pelo servidor MJT."
              : "Não foi possível confirmar a autenticidade deste documento."}
          </p>
        </section>

        {/* Card de Dados Públicos do Figma Q01/Q02 */}
        <section className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
          <h3 className="text-[14px] font-semibold text-[var(--color-text)] pb-3 border-b border-[var(--color-border)]">
            Dados Públicos Registrados
          </h3>
          <dl className="mt-4 flex flex-col gap-3 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-muted)]">Código Oficial:</dt>
              <dd className="font-semibold text-[var(--color-text)]">{verification.officialCode}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-muted)]">Organização Emissora:</dt>
              <dd className="font-semibold text-[var(--color-text)]">{verification.organization.name}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-muted)]">Data de Emissão:</dt>
              <dd className="font-semibold text-[var(--color-text)]">{formatIssuedAt(verification.issuedAt)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-muted)]">Versão do Recibo:</dt>
              <dd className="font-semibold text-[var(--color-text)]">v{verification.documentVersion}</dd>
            </div>
          </dl>
        </section>

        <p className="mt-4 rounded-[12px] bg-[var(--color-surface-neutral)] p-3 text-center text-[11px] text-[var(--color-muted)]">
          🔒 Esta consulta restringe dados sensíveis de acordo com a LGPD (sem assinaturas ou dados pessoais).
        </p>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-[12px] text-[var(--color-muted)]">
          MJT Soluções Industriais • Validação Pública
        </p>
      </footer>
    </main>
  );
}
