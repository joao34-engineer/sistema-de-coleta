import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?:
    | "collected"
    | "draft"
    | "canceled"
    | "in_service"
    | "ready"
    | "neutral"
    | "in_workshop"
    | "in_budget"
    | "awaiting_approval"
    | "approved"
    | "invoiced"
    | "partial_delivery"
    | "delivered"
    | "rejected"
    | "reopened";
}

export const Badge: React.FC<BadgeProps> = ({ className = "", status = "neutral", children, ...props }) => {
  const statusStyles: Record<NonNullable<BadgeProps["status"]>, string> = {
    collected: "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] border-[var(--color-primary)]",
    draft: "bg-amber-50 text-amber-700 border-amber-300",
    canceled: "bg-red-50 text-red-700 border-red-200",
    in_service: "bg-blue-50 text-blue-700 border-blue-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-300",
    neutral: "bg-[var(--color-surface-neutral)] text-[var(--color-muted)] border-[var(--color-border)]",
    in_workshop: "bg-purple-50 text-purple-700 border-purple-200",
    in_budget: "bg-indigo-50 text-indigo-700 border-indigo-200",
    awaiting_approval: "bg-amber-100 text-amber-800 border-amber-300",
    approved: "bg-teal-50 text-teal-700 border-teal-200",
    invoiced: "bg-sky-50 text-sky-700 border-sky-200",
    partial_delivery: "bg-orange-50 text-orange-700 border-orange-200",
    delivered: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
    reopened: "bg-cyan-50 text-cyan-700 border-cyan-200",
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
