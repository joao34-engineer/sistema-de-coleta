import Image from "next/image";

const LOGO_SRC = "/logo/Logo_-_MJT-removebg-preview.png";

type Props = Readonly<{
  officialCode: string | null;
  version: number | null;
}>;

export function CollectionDocumentLetterhead({ officialCode, version }: Props) {
  return (
    <article className="flex min-h-[520px] w-full max-w-[342px] flex-col rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 shadow-xs">
      <Image
        src={LOGO_SRC}
        alt="MJT Tornearia"
        width={88}
        height={64}
        className="h-16 w-auto"
      />
      <h2 className="mt-4 text-[20px] font-semibold leading-8 text-[var(--color-text-primary)]">
        GUIA DE COLETA
      </h2>
      <p className="mt-1 text-[14px] font-semibold leading-5 text-[var(--color-text-primary)]">
        {officialCode ?? "—"}
      </p>
      {version !== null ? (
        <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-muted)]">Versão {version}</p>
      ) : null}
      <p className="mt-6 text-[12px] leading-4 text-[var(--color-text-muted)]">
        {"{{RAZAO_SOCIAL_MJT}} · {{CNPJ_MJT}}"}
      </p>
      <p className="mt-8 text-[12px] leading-4 text-[var(--color-text-muted)]">[ QR ]</p>
      <p className="mt-6 text-[12px] leading-4 text-[var(--color-text-muted)]">
        Este documento não substitui nota fiscal.
      </p>
      <p className="mt-4 text-[12px] leading-4 text-[var(--color-text-muted)]">
        {"{{TEXTO_JURIDICO_RECIBO}}"}
      </p>
    </article>
  );
}
