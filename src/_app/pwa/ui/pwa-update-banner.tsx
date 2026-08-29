import { Button } from "@/shared/ui/button";
import { pwaCopy } from "../model/pwa-copy";
import { PwaBanner } from "./pwa-banner";

type PwaUpdateBannerProps = {
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
  readonly hasPendingWork?: boolean;
};

export function PwaUpdateBanner({ onConfirm, onDismiss, hasPendingWork = false }: PwaUpdateBannerProps) {
  return (
    <PwaBanner role="dialog" labelledBy="pwa-update-title" describedBy="pwa-update-description">
      <h2 id="pwa-update-title" className="text-[16px] font-semibold text-[var(--color-text)]">
        {pwaCopy.updateTitle}
      </h2>
      <p id="pwa-update-description" className="mt-1 text-[14px] text-[var(--color-muted)]">
        {hasPendingWork ? pwaCopy.updatePendingDescription : pwaCopy.updateDescription}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" variant="primary" onClick={onConfirm}>
          {pwaCopy.updateConfirm}
        </Button>
        <Button type="button" variant="secondary" onClick={onDismiss}>
          {pwaCopy.updateDismiss}
        </Button>
      </div>
    </PwaBanner>
  );
}
