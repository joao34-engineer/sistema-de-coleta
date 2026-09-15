"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { Route } from "next";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { useHydrated } from "@/shared/lib/pwa/use-hydrated";

const DEFAULT_PENDING_CLASS = "opacity-70";

type PendingNavLinkProps = Readonly<{
  href: Route;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  pendingClassName?: string;
  prefetch?: boolean | "auto";
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  onPointerDown?: MouseEventHandler<HTMLAnchorElement>;
  "aria-label"?: string;
  "aria-current"?: "page";
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
  const hydrated = useHydrated();
  const { pending } = useLinkStatus();
  const isPending = hydrated && pending;
  const classes = [contentClassName, isPending ? pendingClassName : null].filter(Boolean).join(" ");

  return (
    <span aria-busy={isPending} data-pending={isPending ? "true" : "false"} className={classes || undefined}>
      {children}
    </span>
  );
}

export function PendingNavLink({
  href,
  children,
  className,
  style,
  contentClassName,
  pendingClassName = DEFAULT_PENDING_CLASS,
  prefetch,
  onClick,
  onPointerDown,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: PendingNavLinkProps) {
  const linkProps = {
    href,
    ...(className !== undefined ? { className } : {}),
    ...(style !== undefined ? { style } : {}),
    ...(prefetch !== undefined ? { prefetch } : {}),
    ...(onClick !== undefined ? { onClick } : {}),
    ...(onPointerDown !== undefined ? { onPointerDown } : {}),
    ...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {}),
    ...(ariaCurrent !== undefined ? { "aria-current": ariaCurrent } : {}),
  };

  return (
    <Link {...linkProps}>
      <PendingNavLinkContent contentClassName={contentClassName} pendingClassName={pendingClassName}>
        {children}
      </PendingNavLinkContent>
    </Link>
  );
}
