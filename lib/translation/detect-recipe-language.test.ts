import {describe, expect, it, vi} from "vitest";
import type {RecipeContent} from "../cookidoo/types";
import {
  buildRecipeLanguageSample,
  detectRecipeLanguage,
  RECIPE_LANGUAGE_SAMPLE_MAX_LENGTH,
  RecipeLanguageDetectionError,
} from "./detect-recipe-language";

const recipe: RecipeContent = {
  name: "Kuchen",
  hints: "Warm servieren",
  ingredients: [{type: "INGREDIENT", text: "Mehl", secret: "metadata"}],
  instructions: [{
    type: "STEP",
    text: "Gut mischen",
    annotations: [{type: "TTS", position: {offset: 0, length: 3}, data: {speed: "5"}}],
  }],
};

describe("buildRecipeLanguageSample", () => {
  it("includes user-visible recipe text and excludes annotation metadata", () => {
    const sample = buildRecipeLanguageSample(recipe);
    expect(sample).toContain("Kuchen\nWarm servieren\nMehl\nGut mischen");
    expect(sample).not.toContain("metadata");
    expect(sample).not.toContain("speed");
  });

  it("handles absent hints and bounds the composed sample", () => {
    const long = {...recipe, name: "x".repeat(RECIPE_LANGUAGE_SAMPLE_MAX_LENGTH + 100), hints: undefined};
    expect(buildRecipeLanguageSample(long)).toHaveLength(RECIPE_LANGUAGE_SAMPLE_MAX_LENGTH);
  });
});

describe("detectRecipeLanguage", () => {
  it.each([["de", "de"], ["en", "en"]])("accepts reliable %s", async (language, expected) => {
    const detect = vi.fn(async () => ({language, isReliable: true}));
    await expect(detectRecipeLanguage(recipe, detect)).resolves.toBe(expected);
  });

  it.each([
    [{language: "und", isReliable: true}],
    [{language: "", isReliable: true}],
    [{language: "de", isReliable: false}],
  ])("rejects a non-meaningful result", async (result) => {
    await expect(detectRecipeLanguage(recipe, vi.fn(async () => result)))
      .rejects.toBeInstanceOf(RecipeLanguageDetectionError);
  });
});
