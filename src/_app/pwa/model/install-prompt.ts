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

const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/i;
const IOS_NON_SAFARI_BROWSER_PATTERN = /CriOS|FxiOS|OPiOS|EdgiOS/i;

export function isIosDevice(userAgent: string): boolean {
  return IOS_DEVICE_PATTERN.test(userAgent);
}

export function isIosNonSafariBrowser(userAgent: string): boolean {
  return isIosDevice(userAgent) && IOS_NON_SAFARI_BROWSER_PATTERN.test(userAgent);
}

export function isIosSafari(userAgent: string): boolean {
  if (!isIosDevice(userAgent) || isIosNonSafariBrowser(userAgent)) {
    return false;
  }

  return /Safari/i.test(userAgent);
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
