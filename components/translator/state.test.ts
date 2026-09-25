import { describe, expect, it } from "vitest";
import { CookidooAuthenticationError } from "../../lib/cookidoo/errors";
import { RecipeLanguageDetectionError } from "../../lib/translation/detect-recipe-language";
import { SameTranslationLanguageError } from "../../lib/translation/translate-created-recipe";
import {
  getPublicRecipeTranslationInput,
  getTranslationErrorMessageKey,
  getUnsupportedTargetWarning,
} from "./state";

describe("getTranslationErrorMessageKey", () => {
  it("maps Cookidoo authentication errors to a dedicated localization key", () => {
    expect(
      getTranslationErrorMessageKey(new CookidooAuthenticationError()),
    ).toBe("translator.error.authenticationRequired");
  });

  it("maps language selection errors to localization keys", () => {
    expect(
      getTranslationErrorMessageKey(new RecipeLanguageDetectionError()),
    ).toBe("translator.error.sourceDetectionFailed");
    expect(
      getTranslationErrorMessageKey(new SameTranslationLanguageError("tr")),
    ).toBe("translator.error.sameLanguage");
  });

  it.each([
    "Chrome Translator API is not available",
    "Translation is unavailable for de → tr",
  ])(
    "maps Translator API availability errors to the language-pair message",
    (message) => {
      expect(getTranslationErrorMessageKey(new Error(message))).toBe(
        "translator.error.languagePairUnavailable",
      );
    },
  );

  it("does not present a 403 or network failure as expired authentication", () => {
    expect(
      getTranslationErrorMessageKey(new Error("Cookidoo request failed: 403")),
    ).toBe("translator.error.generic");
    expect(
      getTranslationErrorMessageKey(new TypeError("Failed to fetch")),
    ).toBe("translator.error.generic");
  });
});

describe("getUnsupportedTargetWarning", () => {
  it("shows informational data for fallback caused by an unsupported target", () => {
    expect(
      getUnsupportedTargetWarning({
        language: "tr",
        reason: "unsupported-route-locale",
        unsupportedLanguage: "pl",
      }),
    ).toEqual({ unsupportedLanguage: "pl", selectedLanguage: "tr" });
  });

  it("does not treat a Polish source as an unsupported target", () => {
    const resolution = {
      language: "tr",
      reason: "stored-target",
    } as const;

    expect(
      getPublicRecipeTranslationInput(
        {
          type: "public-recipe",
          hostname: "cookidoo.pl",
          locale: "pl-PL",
          recipeId: "r123",
        },
        "pl",
        resolution.language,
      ),
    ).toMatchObject({
      sourceLanguage: "pl",
      targetLanguage: "tr",
    });
    expect(getUnsupportedTargetWarning(resolution)).toBeUndefined();
  });
});
