import { Button } from "./button";

export interface MobileStatePanelProps {
  type: "loading" | "empty" | "error" | "success" | "confirmation";
  title: string;
  subtitle: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export function MobileStatePanel({
  type,
  title,
  subtitle,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}: MobileStatePanelProps) {
  const iconMap = {
    loading: "…",
    empty: "+",
    error: "!",
    success: "✓",
    confirmation: "!",
  };

  const bgMap = {
    loading: "bg-[#eef8f2] text-[#3b7a5b]",
    empty: "bg-[#eef8f2] text-[#3b7a5b]",
    error: "bg-[#fdf2f1] text-[#ba5b52]",
    success: "bg-[#eef8f2] text-[#3b7a5b]",
    confirmation: "bg-[#fff8ec] text-[#a36b2c]",
  };

  return (
    <div className="mx-auto flex min-h-[460px] w-full max-w-md flex-col items-center justify-center rounded-[24px] bg-[var(--color-background)] p-4">
      <div className="flex w-full flex-col items-center justify-center rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xs">
        {/* Mark Circular 92x92px */}
        <div
          className={`mb-4 flex h-[80px] w-[80px] items-center justify-center rounded-full text-3xl font-bold ${bgMap[type]}`}
        >
          {iconMap[type]}
        </div>

        <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
          {title}
        </h2>
        <p className="mt-1 max-w-xs text-[14px] text-[var(--color-muted)]">
          {subtitle}
        </p>

        {actionText && onAction ? (
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button variant="primary" onClick={onAction}>
              {actionText}
            </Button>
            {secondaryActionText && onSecondaryAction ? (
              <Button variant="secondary" onClick={onSecondaryAction}>
                {secondaryActionText}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
