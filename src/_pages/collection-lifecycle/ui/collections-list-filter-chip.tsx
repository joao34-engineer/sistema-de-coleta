"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { Route } from "next";
import { useHydrated } from "@/shared/lib/pwa/use-hydrated";

const CHIP_BASE =
  "flex h-[36px] shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition-colors";
const CHIP_SELECTED = "bg-[var(--color-text-primary)] text-white shadow-xs";
const CHIP_IDLE =
  "bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]";

export type CollectionsListFilterChipProps = Readonly<{
  href: Route;
  label: string;
  isCurrent: boolean;
  onPendingChange: (pending: boolean) => void;
}>;

function CollectionsListFilterChipStatus({
  label,
  onPendingChange,
}: Readonly<{
  label: string;
  onPendingChange: (pending: boolean) => void;
}>) {
  const hydrated = useHydrated();
  const { pending } = useLinkStatus();
  const isPending = hydrated && pending;
  const selected = isPending;

  useEffect(() => {
    onPendingChange(isPending);
    return () => onPendingChange(false);
  }, [isPending, onPendingChange]);

  return (
    <span
      aria-busy={isPending}
      data-pending={isPending ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      className={`${CHIP_BASE} ${selected ? CHIP_SELECTED : CHIP_IDLE}`}
    >
      {label}
    </span>
  );
}

export function CollectionsListFilterChip({
  href,
  label,
  isCurrent,
  onPendingChange,
}: CollectionsListFilterChipProps) {
  if (isCurrent) {
    return (
      <span
        aria-current="page"
        data-pending="false"
        data-selected="true"
        className={`${CHIP_BASE} ${CHIP_SELECTED}`}
      >
        {label}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} prefetch={false} className="shrink-0">
      <CollectionsListFilterChipStatus label={label} onPendingChange={onPendingChange} />
    </Link>
  );
}
