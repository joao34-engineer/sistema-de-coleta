import { PublicVerificationChrome } from "./public-verification-chrome";

type Props = Readonly<{
  variant: "rate_limited" | "unavailable";
  retryAfterSeconds?: number;
}>;

export function PublicVerificationWaitPage({ variant, retryAfterSeconds }: Props) {
  const rateLimited = variant === "rate_limited";

  return (
    <PublicVerificationChrome
      headerSubtitle={rateLimited ? "Aguarde consultar" : "Consulta indisponível"}
      icon="!"
      iconTone="error"
      title={rateLimited ? "Aguarde antes de consultar" : "Consulta indisponível"}
      description={
        rateLimited
          ? "Muitas consultas foram feitas neste endereço. Espere um momento antes de tentar de novo."
          : "A consulta pública está temporariamente indisponível. Tente novamente em instantes."
      }
      extra={
        rateLimited && retryAfterSeconds !== undefined && retryAfterSeconds > 0 ? (
          <p className="mt-2 text-[14px] leading-5 text-[var(--color-text-muted)]">
            Tente novamente em {retryAfterSeconds} segundos.
          </p>
        ) : null
      }
    />
  );
}
