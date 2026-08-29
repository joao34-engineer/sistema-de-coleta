import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pwaCopy } from "@/_app/pwa/model/pwa-copy";
import { INSTALL_DISMISS_STORAGE_KEY } from "@/_app/pwa/model/install-prompt";
import { InstallPrompt } from "@/_app/pwa/ui/install-prompt";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function stubMatchMedia(standalone: boolean): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const matches = query.includes("display-mode: standalone") ? standalone : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}

function stubUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => userAgent,
  });
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    sessionStorage.removeItem(INSTALL_DISMISS_STORAGE_KEY);
    stubUserAgent(IOS_SAFARI_UA);
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("stays hidden when the app already runs standalone", () => {
    stubMatchMedia(true);
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(pwaCopy.installTitle)).not.toBeInTheDocument();
  });

  it("shows the iOS install instruction outside standalone Safari", () => {
    render(<InstallPrompt />);
    expect(screen.getByRole("status", { name: pwaCopy.installTitle })).toBeInTheDocument();
    expect(screen.getByText(pwaCopy.iosInstallDescription)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: pwaCopy.iosInstallDismiss })).toBeInTheDocument();
  });
});
