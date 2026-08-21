import React from "react";
import Link from "next/link";
import type { Route } from "next";

export interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: Route;
  stepText?: string;
  badge?: React.ReactNode;
}

export function MobilePageHeader({
  title,
  subtitle,
  backHref,
  stepText,
  badge,
}: MobilePageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 mb-5 flex min-h-[88px] w-full flex-col justify-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-xs">
      {backHref ? (
        <div className="mb-1 flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-strong)] transition-colors hover:underline active:opacity-80"
          >
            <span>←</span> Voltar
          </Link>
          {stepText ? (
            <span className="text-[11px] font-semibold text-[var(--color-muted)]">
              {stepText}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo Mark MJT do Figma (38x32px ou 40x36px, radius 18px / 12px, bg #4c916f) */}
          <div className="flex h-9 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-xs font-bold text-white shadow-xs">
            MJT
          </div>
          <div className="flex flex-col">
            <h1 className="text-[18px] font-semibold leading-snug tracking-tight text-[var(--color-text)]">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-[12px] font-normal text-[var(--color-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {badge ? <div>{badge}</div> : null}
      </div>
    </header>
  );
}
