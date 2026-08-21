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
    collected: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
    ready: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
    approved: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
    delivered: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
    draft: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    in_service: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    in_workshop: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    in_budget: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    awaiting_approval: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    canceled: "bg-[#fdf2f1] text-[#ba5b52] border-[#fca5a5]",
    rejected: "bg-[#fdf2f1] text-[#ba5b52] border-[#fca5a5]",
    invoiced: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
    partial_delivery: "bg-[#fff8ec] text-[#a36b2c] border-[#fcd34d]",
    reopened: "bg-[#eef8f2] text-[#31674c] border-[#4c916f]",
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
