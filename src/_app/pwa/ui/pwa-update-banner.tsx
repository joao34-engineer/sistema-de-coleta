import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { pwaCopy } from "../model/pwa-copy";

type PwaUpdateBannerProps = {
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
  readonly hasPendingWork?: boolean;
};

export function PwaUpdateBanner({ onConfirm, onDismiss, hasPendingWork = false }: PwaUpdateBannerProps) {
  return (
    <MobileStatePanel
      type="empty"
      icon="↑"
      role="dialog"
      labelledBy="pwa-update-title"
      describedBy="pwa-update-description"
      title={pwaCopy.updateTitle}
      subtitle={hasPendingWork ? pwaCopy.updatePendingDescription : pwaCopy.updateDescription}
      actionText={pwaCopy.updateConfirm}
      onAction={onConfirm}
      secondaryActionText={pwaCopy.updateDismiss}
      onSecondaryAction={onDismiss}
    />
  );
}
