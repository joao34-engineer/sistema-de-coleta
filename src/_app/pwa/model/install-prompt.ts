export const INSTALL_DISMISS_STORAGE_KEY = "mjt-pwa-install-dismissed" as const;

export type BeforeInstallPromptEvent = Event & {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    readonly outcome: "accepted" | "dismissed";
    readonly platform: string;
  }>;
};

type NavigatorWithStandalone = Navigator & {
  readonly standalone?: boolean;
};

export function isBeforeInstallPromptEvent(value: Event): value is BeforeInstallPromptEvent {
  const prompt = Reflect.get(value, "prompt");
  return typeof prompt === "function";
}

export function isStandaloneDisplay(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return navigatorWithStandalone.standalone === true;
}

export function isIosSafari(userAgent: string): boolean {
  const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent);
  if (!isIosDevice) {
    return false;
  }

  const isOtherIosBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/i.test(userAgent);
  return /Safari/i.test(userAgent) && !isOtherIosBrowser;
}

export function wasInstallPromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_DISMISS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function persistInstallPromptDismissed(): void {
  try {
    sessionStorage.setItem(INSTALL_DISMISS_STORAGE_KEY, "1");
  } catch {
    // sessionStorage pode lançar em modo privado; o banner só some nesta sessão de UI.
  }
}
