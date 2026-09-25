import { describe, expect, it } from "vitest";
import {
  getLanguageFromLocale,
  normalizeLocaleLanguage,
  resolveTargetLanguage,
  SUPPORTED_TARGET_LANGUAGES,
} from "./languages";

it("supports exactly the v1 target languages", () => {
  expect([...SUPPORTED_TARGET_LANGUAGES].sort()).toEqual([
    "de",
    "en",
    "es",
    "fr",
    "it",
    "tr",
  ]);
});

describe("getLanguageFromLocale", () => {
  it.each([
    ["tr-TR", "tr"],
    ["de-DE", "de"],
    ["en-GB", "en"],
    ["en-US", "en"],
    ["de-AT", "de"],
    ["de-CH", "de"],
    ["fr-FR", "fr"],
    ["es-MX", "es"],
    ["it-IT", "it"],
    ["pl-PL", "pl"],
    ["pt-PT", "pt"],
    ["cs", "cs"],
  ])("extracts %s", (locale, expected) => {
    expect(getLanguageFromLocale(locale)).toBe(expected);
  });

  it("returns undefined for an unknown language", () => {
    expect(getLanguageFromLocale("ja-JP")).toBeUndefined();
  });
});

describe("normalizeLocaleLanguage", () => {
  it.each([
    ["zh-Hans", "zh-Hans"],
    ["zh-CN", "zh-Hans"],
    ["zh-SG", "zh-Hans"],
    ["zh-Hant", "zh-Hant"],
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-MO", "zh-Hant"],
    ["en-GB", "en"],
    ["tr-TR", "tr"],
  ])("normalizes %s without losing script distinctions", (locale, expected) => {
    expect(normalizeLocaleLanguage(locale)).toBe(expected);
  });
});

describe("resolveTargetLanguage", () => {
  it("uses a supported route locale when no target is stored", () => {
    expect(
      resolveTargetLanguage({
        routeLocale: "fr-FR",
        uiLocale: "tr-TR",
      }),
    ).toEqual({ language: "fr", reason: "route-locale" });
  });

  it("uses a supported stored target before route and UI locales", () => {
    expect(
      resolveTargetLanguage({
        storedTarget: "tr",
        routeLocale: "pl-PL",
        uiLocale: "en-US",
      }),
    ).toEqual({ language: "tr", reason: "stored-target" });
  });

  it("ignores an unsupported stored target and continues the fallback order", () => {
    expect(
      resolveTargetLanguage({
        storedTarget: "pl",
        routeLocale: "de-DE",
        uiLocale: "tr-TR",
      }),
    ).toEqual({
      language: "de",
      reason: "unsupported-stored-target",
      unsupportedLanguage: "pl",
    });
  });

  it("uses a supported UI locale after an unsupported route locale", () => {
    expect(
      resolveTargetLanguage({
        routeLocale: "pl-PL",
        uiLocale: "tr-TR",
      }),
    ).toEqual({
      language: "tr",
      reason: "unsupported-route-locale",
      unsupportedLanguage: "pl",
    });
  });

  it("reports an unsupported stored target while using the UI fallback", () => {
    expect(
      resolveTargetLanguage({
        storedTarget: "pl",
        routeLocale: "pl-PL",
        uiLocale: "tr-TR",
      }),
    ).toEqual({
      language: "tr",
      reason: "unsupported-stored-target",
      unsupportedLanguage: "pl",
    });
  });

  it("falls back to English when route and UI locales are unsupported", () => {
    expect(
      resolveTargetLanguage({
        routeLocale: "pl-PL",
        uiLocale: "nl-NL",
      }),
    ).toEqual({
      language: "en",
      reason: "unsupported-route-locale",
      unsupportedLanguage: "pl",
    });
  });
});
