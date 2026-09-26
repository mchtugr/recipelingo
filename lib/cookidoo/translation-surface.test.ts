import { describe, expect, it } from "vitest";

import { detectCookidooPage } from "./page";
import {
  INLINE_TRIGGER_BUTTON_TYPE,
  INLINE_ACTION_ROW_ATTRIBUTE,
  getInlineTriggerMessageKey,
  isCreatedRecipeEditMode,
  resolveTranslationSurface,
} from "./translation-surface";

describe("inline form safety", () => {
  it("uses a non-submit button type and no named form control", () => {
    expect(INLINE_TRIGGER_BUTTON_TYPE).toBe("button");
    expect(INLINE_ACTION_ROW_ATTRIBUTE).toBe("data-recipelingo-action-row");
  });
});

describe("inline trigger labels", () => {
  it("uses the existing localized action keys for each recipe type", () => {
    expect(getInlineTriggerMessageKey("public-recipe")).toBe(
      "translator.actions.importAndTranslate",
    );
    expect(getInlineTriggerMessageKey("created-recipe")).toBe(
      "translator.actions.translate",
    );
  });
});

describe("resolveTranslationSurface", () => {
  const publicRecipe = detectCookidooPage(
    "https://cookidoo.com.tr/recipes/recipe/tr-TR/r1",
  );
  const createdRecipe = detectCookidooPage(
    "https://cookidoo.com.tr/created-recipes/tr-TR/r1",
  );

  it("prefers inline placement when a safe anchor exists", () => {
    expect(
      resolveTranslationSurface(publicRecipe, { hasInlineAnchor: true }),
    ).toBe("inline");
  });

  it("falls back to the FAB when the anchor is unavailable", () => {
    expect(
      resolveTranslationSurface(publicRecipe, { hasInlineAnchor: false }),
    ).toBe("fab");
  });

  it("uses the FAB in Created Recipe edit mode", () => {
    expect(
      resolveTranslationSurface(createdRecipe, {
        hasInlineAnchor: true,
        isEditMode: true,
      }),
    ).toBe("fab");
  });

  it("removes both surfaces from unsupported pages", () => {
    expect(
      resolveTranslationSurface(
        detectCookidooPage("https://cookidoo.com.tr/search/tr-TR"),
        { hasInlineAnchor: true },
      ),
    ).toBe("none");
  });
});

describe("isCreatedRecipeEditMode", () => {
  it("recognizes only the Created Recipe edit route", () => {
    expect(
      isCreatedRecipeEditMode(
        "https://cookidoo.com.tr/created-recipes/tr-TR/r1/edit",
      ),
    ).toBe(true);
    expect(
      isCreatedRecipeEditMode(
        "https://cookidoo.com.tr/created-recipes/tr-TR/r1",
      ),
    ).toBe(false);
  });
});
