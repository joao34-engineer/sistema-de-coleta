import type { PublicVerificationDTO } from "../model/public-verification";

type Props = Readonly<{ verification: PublicVerificationDTO | null }>;

function formatIssuedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PublicVerificationPage({ verification }: Props) {
  if (!verification) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="w-full max-w-lg rounded-medium border border-border bg-surface p-7 shadow-surface" aria-labelledby="verification-title">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Verificação MJT</p>
          <h1 id="verification-title" className="mt-2 text-2xl font-semibold">Registro não encontrado</h1>
          <p className="mt-3 text-sm leading-6 text-muted">O código informado é inválido ou não corresponde a uma guia disponível para consulta.</p>
        </section>
      </main>
    );
  }

  const canceled = verification.status === "canceled";
  const authentic = verification.authentic && !canceled;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-medium border border-border bg-surface p-7 shadow-surface" aria-labelledby="verification-title">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Verificação MJT</p>
        <h1 id="verification-title" className="mt-2 text-2xl font-semibold">{canceled ? "Guia cancelada" : authentic ? "Guia autêntica" : "Guia não autenticada"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {canceled ? "Esta guia permanece verificável, mas foi marcada como cancelada." : authentic ? "Os dados mínimos desta guia foram confirmados pelo servidor." : "Não foi possível confirmar a autenticidade desta guia."}
        </p>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Código oficial</dt><dd className="mt-1 font-semibold">{verification.officialCode}</dd></div>
          <div><dt className="text-muted">Organização</dt><dd className="mt-1 font-semibold">{verification.organization.name}</dd></div>
          <div><dt className="text-muted">Emitida em</dt><dd className="mt-1 font-semibold">{formatIssuedAt(verification.issuedAt)}</dd></div>
          <div><dt className="text-muted">Versão do documento</dt><dd className="mt-1 font-semibold">{verification.documentVersion}</dd></div>
        </dl>
        <p className="mt-6 rounded-small bg-background px-4 py-3 text-xs leading-5 text-muted">Esta consulta não exibe assinatura, contatos, CPF/CNPJ, fotos ou a lista integral de itens.</p>
      </section>
    </main>
  );
}
