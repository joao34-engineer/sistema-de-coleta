import { describe, expect, it } from "vitest";
import {
  isIosDevice,
  isIosNonSafariBrowser,
  isIosSafari,
} from "@/_app/pwa/model/install-prompt";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const IOS_FIREFOX_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("iOS install user-agent helpers", () => {
  it("treats iPhone Safari as Safari, not as another iOS browser", () => {
    expect(isIosDevice(IOS_SAFARI_UA)).toBe(true);
    expect(isIosSafari(IOS_SAFARI_UA)).toBe(true);
    expect(isIosNonSafariBrowser(IOS_SAFARI_UA)).toBe(false);
  });

  it("detects Chrome and Firefox on iPhone as non-Safari iOS browsers", () => {
    expect(isIosDevice(IOS_CHROME_UA)).toBe(true);
    expect(isIosSafari(IOS_CHROME_UA)).toBe(false);
    expect(isIosNonSafariBrowser(IOS_CHROME_UA)).toBe(true);

    expect(isIosDevice(IOS_FIREFOX_UA)).toBe(true);
    expect(isIosSafari(IOS_FIREFOX_UA)).toBe(false);
    expect(isIosNonSafariBrowser(IOS_FIREFOX_UA)).toBe(true);
  });

  it("does not treat Android Chrome as an iPhone browser", () => {
    expect(isIosDevice(ANDROID_CHROME_UA)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME_UA)).toBe(false);
    expect(isIosNonSafariBrowser(ANDROID_CHROME_UA)).toBe(false);
  });
});
