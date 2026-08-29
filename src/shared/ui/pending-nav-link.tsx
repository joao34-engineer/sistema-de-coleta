"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

const DEFAULT_PENDING_CLASS = "opacity-70 ring-2 ring-[var(--color-primary)]/30";

type PendingNavLinkProps = Readonly<{
  href: Route;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  pendingClassName?: string;
  prefetch?: boolean | "auto";
  "aria-label"?: string;
}>;

function PendingNavLinkContent({
  children,
  contentClassName,
  pendingClassName,
}: Readonly<{
  children: ReactNode;
  contentClassName: string | undefined;
  pendingClassName: string;
}>) {
  const { pending } = useLinkStatus();
  const classes = [contentClassName, pending ? pendingClassName : null].filter(Boolean).join(" ");

  return (
    <span aria-busy={pending} data-pending={pending ? "true" : "false"} className={classes || undefined}>
      {children}
    </span>
  );
}

export function PendingNavLink({
  href,
  children,
  className,
  contentClassName,
  pendingClassName = DEFAULT_PENDING_CLASS,
  prefetch,
  "aria-label": ariaLabel,
}: PendingNavLinkProps) {
  const linkProps = {
    href,
    ...(className !== undefined ? { className } : {}),
    ...(prefetch !== undefined ? { prefetch } : {}),
    ...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {}),
  };

  return (
    <Link {...linkProps}>
      <PendingNavLinkContent contentClassName={contentClassName} pendingClassName={pendingClassName}>
        {children}
      </PendingNavLinkContent>
    </Link>
  );
}
