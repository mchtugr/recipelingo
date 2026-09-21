import {describe, expect, it} from "vitest";
import {RecipeLanguageDetectionError} from "../../lib/translation/detect-recipe-language";
import {SameTranslationLanguageError} from "../../lib/translation/translate-created-recipe";
import {getTranslationErrorMessage} from "./state";

describe("getTranslationErrorMessage", () => {
  it("maps language selection errors to actionable messages", () => {
    expect(getTranslationErrorMessage(new RecipeLanguageDetectionError()))
      .toBe("Tarif dili güvenilir şekilde algılanamadı. Tarif dilini manuel seçin.");
    expect(getTranslationErrorMessage(new SameTranslationLanguageError("tr")))
      .toBe("Tarif zaten hedef dilde görünüyor. Farklı bir hedef dil seçin.");
  });
});
