import Image from "next/image";

const LOGO_SRC = "/logo/Logo_-_MJT-removebg-preview.png";

export type LetterheadItem = Readonly<{
  description: string;
  quantity: number;
}>;

type Props = Readonly<{
  officialCode: string | null;
  version: number | null;
  customerName?: string | null;
  locationDescription?: string | null;
  items?: ReadonlyArray<LetterheadItem>;
  signerName?: string | null;
}>;

function formatItemLine(item: LetterheadItem): string {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
  const label = quantity === 1 ? "1×" : `${quantity}×`;
  return `${label} ${item.description}`;
}

export function CollectionDocumentLetterhead({
  officialCode,
  version,
  customerName = null,
  locationDescription = null,
  items = [],
  signerName = null,
}: Props) {
  const customerLabel = customerName?.trim() || "—";
  const locationLabel = locationDescription?.trim() || "—";
  const signerLabel = signerName?.trim() || "—";

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

      <section className="mt-6 space-y-1">
        <p className="text-[14px] font-semibold leading-5 text-[var(--color-text-primary)]">{customerLabel}</p>
        <p className="text-[12px] leading-4 text-[var(--color-text-muted)]">Local: {locationLabel}</p>
      </section>

      <section className="mt-6 space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Itens</p>
        {items.length > 0 ? (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li
                key={`${item.description}-${index}`}
                className="text-[13px] leading-5 text-[var(--color-text-primary)]"
              >
                {formatItemLine(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-5 text-[var(--color-text-muted)]">—</p>
        )}
      </section>

      <section className="mt-6">
        <p className="text-[13px] leading-5 text-[var(--color-text-primary)]">
          <span className="font-semibold">Signatário:</span>
          {` ${signerLabel}`}
        </p>
      </section>

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
