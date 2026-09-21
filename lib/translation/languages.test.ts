import {describe, expect, it} from "vitest";
import {getLanguageFromLocale, resolveTargetLanguage} from "./languages";

describe("getLanguageFromLocale", () => {
  it.each([
    ["tr-TR", "tr"],
    ["de-DE", "de"],
    ["en-GB", "en"],
    ["pl", "pl"],
    ["cs", "cs"],
  ])("extracts %s", (locale, expected) => {
    expect(getLanguageFromLocale(locale)).toBe(expected);
  });

  it("returns undefined for an unknown language", () => {
    expect(getLanguageFromLocale("ja-JP")).toBeUndefined();
  });
});

describe("resolveTargetLanguage", () => {
  it.each([
    [{locale: "tr-TR"}, "tr"],
    [{locale: "de-DE"}, "tr"],
    [{locale: "de-DE", savedTargetLanguage: "tr"}, "tr"],
    [{locale: "tr-TR", savedTargetLanguage: "de"}, "tr"],
  ])("gates targets to formatter-supported languages", (input, expected) => {
    expect(resolveTargetLanguage(input)).toBe(expected);
  });
});
