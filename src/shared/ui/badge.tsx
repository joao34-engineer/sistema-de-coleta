import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: "collected" | "draft" | "canceled" | "in_service" | "ready" | "neutral";
}

export const Badge: React.FC<BadgeProps> = ({ className = "", status = "neutral", children, ...props }) => {
  const statusStyles = {
    collected: "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] border-[var(--color-primary)]",
    draft: "bg-amber-50 text-amber-700 border-amber-300",
    canceled: "bg-red-50 text-red-700 border-red-200",
    in_service: "bg-blue-50 text-blue-700 border-blue-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-300",
    neutral: "bg-[var(--color-surface-neutral)] text-[var(--color-muted)] border-[var(--color-border)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
