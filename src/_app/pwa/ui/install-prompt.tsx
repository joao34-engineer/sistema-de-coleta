"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/shared/ui/button";
import { pwaCopy } from "../model/pwa-copy";
import {
  isBeforeInstallPromptEvent,
  isIosNonSafariBrowser,
  isIosSafari,
  isStandaloneDisplay,
  persistInstallPromptDismissed,
  wasInstallPromptDismissed,
  type BeforeInstallPromptEvent,
} from "../model/install-prompt";
import { PwaBanner } from "./pwa-banner";

function subscribeNever(): () => void {
  return () => {};
}

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function iosInstallCopy(userAgent: string): string | null {
  if (isIosSafari(userAgent)) {
    return pwaCopy.iosInstallDescription;
  }

  if (isIosNonSafariBrowser(userAgent)) {
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
      <PwaBanner role="status" labelledBy="pwa-install-title" describedBy="pwa-install-description">
        <h2 id="pwa-install-title" className="text-[16px] font-semibold text-[var(--color-text)]">
          {pwaCopy.installTitle}
        </h2>
        <p id="pwa-install-description" className="mt-1 text-[14px] text-[var(--color-muted)]">
          {iosInstallDescription}
        </p>
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={dismiss}>
            {pwaCopy.iosInstallDismiss}
          </Button>
        </div>
      </PwaBanner>
    );
  }

  if (deferredPrompt === null) {
    return null;
  }

  return (
    <PwaBanner role="dialog" labelledBy="pwa-install-title" describedBy="pwa-install-description">
      <h2 id="pwa-install-title" className="text-[16px] font-semibold text-[var(--color-text)]">
        {pwaCopy.installTitle}
      </h2>
      <p id="pwa-install-description" className="mt-1 text-[14px] text-[var(--color-muted)]">
        {pwaCopy.installDescription}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" variant="primary" onClick={() => void install()}>
          {pwaCopy.installConfirm}
        </Button>
        <Button type="button" variant="secondary" onClick={dismiss}>
          {pwaCopy.installDismiss}
        </Button>
      </div>
    </PwaBanner>
  );
}
