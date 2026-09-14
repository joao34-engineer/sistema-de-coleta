import type { ReactNode } from "react";
import Image from "next/image";

const LOGO_SRC = "/logo/Logo_-_MJT-removebg-preview.png";

export type PublicVerificationIconTone = "success" | "error";

type Field = Readonly<{
  label: string;
  value: string;
  emphasize?: boolean;
}>;

export type PublicVerificationChromeProps = Readonly<{
  headerSubtitle: string;
  icon: string;
  iconTone: PublicVerificationIconTone;
  title: string;
  description: string;
  fields?: readonly Field[];
  footnote?: string;
  extra?: ReactNode;
}>;

export function PublicVerificationChrome({
  headerSubtitle,
  icon,
  iconTone,
  title,
  description,
  fields,
  footnote,
  extra,
}: PublicVerificationChromeProps) {
  const iconClassName =
    iconTone === "success"
      ? "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)]"
      : "bg-[#fdf2f1] text-[var(--color-danger)]";

  return (
    <div className="min-h-screen w-full bg-[var(--color-surface-bg)]">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex min-h-[88px] items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3">
        <Image
          src={LOGO_SRC}
          alt="MJT Tornearia"
          width={44}
          height={32}
          priority
          className="h-8 w-auto shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">Consulta pública</p>
          <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">{headerSubtitle}</p>
        </div>
      </header>

      <section className="mx-4 mt-9 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-10 pt-10 text-center">
        <div className={`mx-auto mb-8 flex size-24 items-center justify-center rounded-full text-[40px] font-semibold ${iconClassName}`}>
          {icon}
        </div>
        <h1 className="text-[22px] font-semibold leading-8 text-[var(--color-text-primary)]">{title}</h1>
        <p className="mt-2 text-[14px] leading-5 text-[var(--color-text-muted)]">{description}</p>
        {extra}
        {fields && fields.length > 0 ? (
          <dl className="mt-10 flex flex-col gap-6">
            {fields.map((field) => (
              <div key={field.label}>
                <dt className="text-[11px] font-semibold leading-4 text-[var(--color-text-muted)]">{field.label}</dt>
                <dd
                  className={`mt-1 text-[16px] font-semibold leading-6 ${
                    field.emphasize ? "text-[var(--color-primary-strong)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {footnote ? (
        <p className="mx-4 mt-8 pb-10 text-center text-[13px] leading-5 text-[var(--color-text-muted)]">{footnote}</p>
      ) : null}
      </main>
    </div>
  );
}
