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
    collected: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    ready: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    approved: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    delivered: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    invoiced: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    reopened: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]/40",
    draft: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    in_service: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    in_workshop: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    in_budget: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    awaiting_approval: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    partial_delivery: "bg-[#fff8ec] text-[#a36b2c] border-[#a36b2c]/40",
    canceled: "bg-[#fdf2f1] text-[#ba5b52] border-[#ba5b52]/40",
    rejected: "bg-[#fdf2f1] text-[#ba5b52] border-[#ba5b52]/40",
    neutral: "bg-[var(--color-surface-neutral)] text-[var(--color-muted)] border-[var(--color-border)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight ${statusStyles[status]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
