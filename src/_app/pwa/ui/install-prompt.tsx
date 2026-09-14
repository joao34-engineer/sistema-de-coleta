"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { pwaCopy } from "../model/pwa-copy";
import {
  iosInstallHintKind,
  isBeforeInstallPromptEvent,
  isStandaloneDisplay,
  persistInstallPromptDismissed,
  wasInstallPromptDismissed,
  type BeforeInstallPromptEvent,
} from "../model/install-prompt";
import { PwaBannerHost } from "./pwa-banner";

function subscribeNever(): () => void {
  return () => {};
}

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function iosInstallCopy(userAgent: string): string | null {
  const hint = iosInstallHintKind(userAgent);
  if (hint === "safari") {
    return pwaCopy.iosInstallDescription;
  }

  if (hint === "open-safari") {
    return pwaCopy.iosOpenInSafariDescription;
  }

  return null;
}

export function InstallPrompt() {
  const isClient = useIsClient();
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) {
        return;
      }

      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  function dismiss() {
    persistInstallPromptDismissed();
    setDeferredPrompt(null);
    setDismissed(true);
  }

  async function install() {
    if (deferredPrompt === null) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  }

  if (!isClient || dismissed || isStandaloneDisplay() || wasInstallPromptDismissed()) {
    return null;
  }

  const iosInstallDescription = iosInstallCopy(window.navigator.userAgent);
  if (iosInstallDescription !== null && deferredPrompt === null) {
    return (
      <PwaBannerHost placement="top">
        <MobileStatePanel
          type="empty"
          icon="+"
          role="status"
          labelledBy="pwa-install-title"
          describedBy="pwa-install-description"
          title={pwaCopy.installTitle}
          subtitle={iosInstallDescription}
          actionText={pwaCopy.iosInstallDismiss}
          onAction={dismiss}
        />
      </PwaBannerHost>
    );
  }

  if (deferredPrompt === null) {
    return null;
  }

  return (
    <MobileStatePanel
      type="empty"
      icon="+"
      role="dialog"
      labelledBy="pwa-install-title"
      describedBy="pwa-install-description"
      title={pwaCopy.installTitle}
      subtitle={pwaCopy.installDescription}
      actionText={pwaCopy.installConfirm}
      onAction={() => {
        void install();
      }}
      secondaryActionText={pwaCopy.installDismiss}
      onSecondaryAction={dismiss}
    />
  );
}
