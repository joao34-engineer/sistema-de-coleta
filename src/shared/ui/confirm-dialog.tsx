import { Button } from "./button";

type Props = Readonly<{
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function ConfirmDialog({ title, body, cancelLabel, confirmLabel, onCancel, onConfirm }: Props) {
  const titleId = "confirm-dialog-title";
  const bodyId = "confirm-dialog-body";

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(26,32,30,0.45)] p-4">
      <div
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-modal="true"
        className="flex w-full max-w-[320px] flex-col items-center rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-surface)]"
        role="dialog"
      >
        <div className="mb-4 flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#fff8ec] text-3xl font-bold text-[#a36b2c]">
          !
        </div>
        <h2 id={titleId} className="text-[20px] font-semibold text-[var(--color-text)]">
          {title}
        </h2>
        <p id={bodyId} className="mt-1 max-w-xs text-[14px] text-[var(--color-muted)]">
          {body}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
