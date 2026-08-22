import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

export interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: Route;
  stepText?: string;
  progressText?: string;
  badge?: React.ReactNode;
  logoSrc?: string;
  logoAlt?: string;
}

export function MobilePageHeader({
  title,
  subtitle,
  backHref,
  stepText,
  progressText,
  badge,
  logoSrc,
  logoAlt,
}: MobilePageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[80px] w-full flex-col justify-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Voltar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[22px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-neutral)] active:scale-95"
            >
              ‹
            </Link>
          ) : logoSrc ? (
            <Image
              src={logoSrc}
              alt={logoAlt ?? "Logo MJT Tornearia"}
              width={44}
              height={32}
              priority
              className="h-8 w-auto shrink-0"
            />
          ) : (
            /* Logo Mark MJT do Figma (38x32px, radius 14px, bg #4c916f) */
            <div className="flex h-8 w-[38px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-xs font-bold text-white shadow-xs">
              MJT
            </div>
          )}

          <div className="flex flex-col">
            <h1 className="text-[18px] font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[12px] font-normal leading-tight text-[var(--color-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stepText ? (
            <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
              {stepText}
            </span>
          ) : null}
          {badge ? <div>{badge}</div> : null}
        </div>
      </div>

      {progressText ? (
        <div className="mt-2 text-center text-[12px] font-semibold tracking-widest text-[var(--color-primary)]">
          {progressText}
        </div>
      ) : null}
    </header>
  );
}

