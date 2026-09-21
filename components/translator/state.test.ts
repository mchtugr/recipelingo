import {describe, expect, it} from "vitest";
import {CookidooAuthenticationError} from "../../lib/cookidoo/errors";
import {RecipeLanguageDetectionError} from "../../lib/translation/detect-recipe-language";
import {SameTranslationLanguageError} from "../../lib/translation/translate-created-recipe";
import {getTranslationErrorMessageKey} from "./state";

describe("getTranslationErrorMessageKey", () => {
  it("maps Cookidoo authentication errors to a dedicated localization key", () => {
    expect(getTranslationErrorMessageKey(new CookidooAuthenticationError()))
      .toBe("translator.error.authenticationRequired");
  });

  it("maps language selection errors to localization keys", () => {
    expect(getTranslationErrorMessageKey(new RecipeLanguageDetectionError()))
      .toBe("translator.error.sourceDetectionFailed");
    expect(getTranslationErrorMessageKey(new SameTranslationLanguageError("tr")))
      .toBe("translator.error.sameLanguage");
  });
});
