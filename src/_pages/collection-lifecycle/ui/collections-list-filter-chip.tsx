"use client";

import Link from "next/link";
import type { Route } from "next";

const CHIP_BASE =
  "flex h-8 shrink-0 items-center justify-center rounded-full px-[14px] py-2 text-[12px] font-semibold";
const CHIP_SELECTED = "bg-[var(--color-text-primary)] text-white";
const CHIP_IDLE =
  "border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-muted)]";

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
