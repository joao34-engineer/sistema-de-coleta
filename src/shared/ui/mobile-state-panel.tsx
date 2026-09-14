import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "./button";
import { buttonClassName } from "@/shared/lib/button-class-name";

export interface MobileStatePanelProps {
  type: "loading" | "empty" | "error" | "success" | "confirmation";
  title: string;
  subtitle: string;
  icon?: string;
  actionText?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionHref?: Route;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  footer?: ReactNode;
  actionSlot?: ReactNode;
  role?: "dialog" | "status";
  labelledBy?: string;
  describedBy?: string;
}

const iconMap = {
  loading: "…",
  empty: "+",
  error: "!",
  success: "✓",
  confirmation: "!",
} as const;

const markClassMap = {
  loading: "bg-[#eef8f2] text-[#3b7a5b]",
  empty: "bg-[#fcf3f1] text-[#a8443b]",
  error: "bg-[#fcf3f1] text-[#a8443b]",
  success: "bg-[#eef8f2] text-[#3b7a5b]",
  confirmation: "bg-[#fff8ec] text-[#a36b2c]",
} as const;

export function MobileStatePanel({
  type,
  title,
  subtitle,
  icon,
  actionText,
  onAction,
  actionDisabled,
  actionHref,
  secondaryActionText,
  onSecondaryAction,
  footer,
  actionSlot,
  role,
  labelledBy,
  describedBy,
}: MobileStatePanelProps) {
  const titleTone =
    type === "error" || type === "empty"
      ? "text-[var(--color-danger)]"
      : type === "confirmation"
        ? "text-[#a36b2c]"
        : "text-[var(--color-text-primary)]";
  const showClickAction = Boolean(actionText && onAction);
  const showHrefAction = Boolean(actionText && actionHref && !onAction);

  return (
    <div
      className={`mx-auto flex min-h-[340px] w-full max-w-md flex-col items-center justify-center p-4 ${role ? "pointer-events-auto" : ""}`}
    >
      <div
        {...(role
          ? { role, "aria-labelledby": labelledBy, "aria-describedby": describedBy }
          : {})}
        className="flex w-full max-w-[342px] flex-col items-center rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center shadow-xs"
      >
        <div
          className={`mb-6 flex h-[92px] w-[92px] items-center justify-center rounded-full text-[36px] font-semibold leading-8 ${markClassMap[type]}`}
        >
          {icon ?? iconMap[type]}
        </div>

        <h2 id={labelledBy} className={`text-[20px] font-semibold leading-8 ${titleTone}`}>
          {title}
        </h2>
        <p id={describedBy} className="mt-1 max-w-[260px] text-[14px] leading-5 text-[var(--color-text-muted)]">
          {subtitle}
        </p>
        {footer}

        {showClickAction || showHrefAction || actionSlot ? (
          <div className="mt-8 flex w-full max-w-[258px] flex-col gap-2">
            {showClickAction ? (
              <Button type="button" variant="primary" onClick={onAction} disabled={actionDisabled}>
                {actionText}
              </Button>
            ) : null}
            {showHrefAction && actionHref ? (
              <Link href={actionHref} className={buttonClassName({ variant: "primary", size: "md" })}>
                {actionText}
              </Link>
            ) : null}
            {actionSlot}
            {secondaryActionText && onSecondaryAction ? (
              <Button type="button" variant="secondary" onClick={onSecondaryAction}>
                {secondaryActionText}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
