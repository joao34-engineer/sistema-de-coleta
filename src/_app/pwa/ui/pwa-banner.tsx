import type { ReactNode } from "react";

type PwaBannerProps = {
  readonly role: "dialog" | "status";
  readonly labelledBy: string;
  readonly describedBy: string;
  readonly children: ReactNode;
  readonly emphasized?: boolean;
};

export function PwaBannerHost({
  children,
  placement = "bottom",
}: {
  readonly children: ReactNode;
  readonly placement?: "top" | "bottom";
}) {
  const placementClass =
    placement === "top"
      ? "top-0 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4"
      : "bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4";

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-md flex-col gap-3 px-4 ${placementClass}`}
    >
      {children}
    </div>
  );
}

export function PwaBanner({
  role,
  labelledBy,
  describedBy,
  children,
  emphasized = false,
}: PwaBannerProps) {
  const emphasisClass = emphasized
    ? "border-[var(--color-primary)] shadow-[var(--shadow-surface)] ring-2 ring-[var(--color-primary)]/30"
    : "border-[var(--color-border)] shadow-[var(--shadow-surface)]";

  return (
    <section
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`pointer-events-auto rounded-[16px] border bg-[var(--color-surface)] p-4 ${emphasisClass}`}
    >
      {children}
    </section>
  );
}
