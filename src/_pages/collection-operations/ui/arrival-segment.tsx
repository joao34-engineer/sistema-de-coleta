"use client";

import {
  ARRIVAL_SEGMENT_LABELS,
  ARRIVAL_UI_SEGMENTS,
  type ArrivalUiSegment,
} from "../model/arrival-status";

type Props = Readonly<{
  value: ArrivalUiSegment;
  disabled?: boolean;
  onChange: (segment: ArrivalUiSegment) => void;
}>;

export function ArrivalSegment({ value, disabled = false, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Situação do item" className="flex items-center gap-1.5">
      {ARRIVAL_UI_SEGMENTS.map((segment) => {
        const isActive = value === segment;
        const isMissing = segment === "nao_chegou";
        const activeClass = isMissing
          ? "border-transparent bg-[color-mix(in_srgb,var(--color-danger)_12%,white)] text-[var(--color-danger)]"
          : "border-transparent bg-[var(--color-primary)] text-white";
        return (
          <button
            key={segment}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(segment)}
            className={`flex h-[36px] min-w-0 flex-1 items-center justify-center rounded-[8px] border px-1 text-[12px] font-semibold transition-all active:scale-[0.98] ${
              isActive
                ? activeClass
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            }`}
          >
            {ARRIVAL_SEGMENT_LABELS[segment]}
          </button>
        );
      })}
    </div>
  );
}
