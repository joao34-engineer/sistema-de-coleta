import type { ReactNode } from "react";

type PwaBannerProps = {
  readonly role: "dialog" | "status";
  readonly labelledBy: string;
  readonly describedBy: string;
  readonly children: ReactNode;
};

export function PwaBannerHost({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

export function PwaBanner({ role, labelledBy, describedBy, children }: PwaBannerProps) {
  return (
    <section
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="pointer-events-auto rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-surface)]"
    >
      {children}
    </section>
  );
}
