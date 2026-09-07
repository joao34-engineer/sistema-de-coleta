"use client";

import Link from "next/link";
import type { Route } from "next";

const CHIP_BASE =
  "flex h-[36px] shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition-colors";
const CHIP_SELECTED = "bg-[var(--color-text-primary)] text-white shadow-xs";
const CHIP_IDLE =
  "bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]";

export type CollectionsListFilterChipProps = Readonly<{
  href: Route;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}>;

export function CollectionsListFilterChip({
  href,
  label,
  isSelected,
  onSelect,
}: CollectionsListFilterChipProps) {
  const className = `${CHIP_BASE} ${isSelected ? CHIP_SELECTED : CHIP_IDLE}`;

  if (isSelected) {
    return (
      <span aria-current="page" data-selected="true" className={className}>
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      prefetch={true}
      onClick={onSelect}
      data-selected="false"
      className={className}
    >
      {label}
    </Link>
  );
}
