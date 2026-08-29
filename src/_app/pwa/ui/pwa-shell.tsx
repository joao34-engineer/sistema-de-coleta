"use client";

import { useEffect, useRef, useState } from "react";
import { SKIP_WAITING_MESSAGE } from "@/shared/lib/pwa/service-worker-protocol";
import { shouldReloadOnControllerChange, type PwaShellProps } from "../model/pwa-shell";
import { listenForWaitingWorker, registerColetaServiceWorker } from "../model/service-worker-registration";
import { PwaBannerHost } from "./pwa-banner";
import { InstallPrompt } from "./install-prompt";
import { PwaUpdateBanner } from "./pwa-update-banner";

let hasReloadedOnControllerChange = false;

export function PwaShell({ canReload, hasPendingWork = false }: PwaShellProps) {
  const canReloadRef = useRef(canReload);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    canReloadRef.current = canReload;
  }, [canReload]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let stopListening: (() => void) | undefined;

    const onWaiting = (worker: ServiceWorker) => {
      if (!cancelled) {
        setWaitingWorker(worker);
      }
    };

    const onControllerChange = () => {
      if (cancelled || hasReloadedOnControllerChange) {
        return;
      }

      if (!shouldReloadOnControllerChange(canReloadRef.current)) {
        return;
      }

      hasReloadedOnControllerChange = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void registerColetaServiceWorker().then((registration) => {
      if (registration === null) {
        return;
      }

      const stop = listenForWaitingWorker(registration, onWaiting);
      if (cancelled) {
        stop();
        return;
      }

      stopListening = stop;
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      stopListening?.();
    };
  }, []);

  const showUpdate = waitingWorker !== null && !updateDismissed;

  function confirmUpdate() {
    if (waitingWorker === null) {
      return;
    }

    waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
    setUpdateDismissed(true);
  }

  return (
    <PwaBannerHost>
      <InstallPrompt />
      {showUpdate ? (
        <PwaUpdateBanner
          hasPendingWork={hasPendingWork}
          onConfirm={confirmUpdate}
          onDismiss={() => setUpdateDismissed(true)}
        />
      ) : null}
    </PwaBannerHost>
  );
}
