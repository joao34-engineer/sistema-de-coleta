type Props = Readonly<{
  variant: "rate_limited" | "unavailable";
  retryAfterSeconds?: number;
}>;

export function PublicVerificationWaitPage({ variant, retryAfterSeconds }: Props) {
  const rateLimited = variant === "rate_limited";
  const heading = rateLimited ? "Aguarde antes de consultar novamente." : "Consulta temporariamente indisponível.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-[var(--color-background)] px-4 py-10">
      <section className="w-full rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fdf2f1] text-[24px] font-bold text-[#ba5b52]">
          !
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          MJT · Validação Pública
        </span>
        <h1 className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">{heading}</h1>
        {rateLimited && retryAfterSeconds !== undefined && retryAfterSeconds > 0 ? (
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Tente novamente em {retryAfterSeconds} segundos.
          </p>
        ) : null}
        {!rateLimited ? (
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            A consulta pública está temporariamente indisponível. Tente novamente em instantes.
          </p>
        ) : null}
      </section>
    </main>
  );
}
