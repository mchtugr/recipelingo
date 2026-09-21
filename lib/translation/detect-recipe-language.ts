import {browser} from "wxt/browser";
import type {RecipeContent} from "../cookidoo/types";
import {
  getLanguageFromLocale,
  type TranslationLanguage,
} from "./languages";

export const RECIPE_LANGUAGE_SAMPLE_MAX_LENGTH = 8_000;

export interface DetectedRecipeLanguage {
  language: string;
  isReliable: boolean;
  percentage?: number;
}

export type DetectRecipeLanguage = (text: string) => Promise<DetectedRecipeLanguage>;

export class RecipeLanguageDetectionError extends Error {
  constructor() {
    super("Recipe language could not be detected reliably");
    this.name = "RecipeLanguageDetectionError";
  }
}

export function buildRecipeLanguageSample(recipe: RecipeContent): string {
  return [
    recipe.name,
    recipe.hints,
    ...recipe.ingredients.map(({text}) => text),
    ...recipe.instructions.map(({text}) => text),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .slice(0, RECIPE_LANGUAGE_SAMPLE_MAX_LENGTH);
}

export const detectRecipeLanguageWithBrowser: DetectRecipeLanguage = async (text) => {
  const result = await browser.i18n.detectLanguage(text);
  const best = result.languages.reduce<(typeof result.languages)[number] | undefined>(
    (current, candidate) => !current || candidate.percentage > current.percentage
      ? candidate
      : current,
    undefined,
  );
  return {
    language: best?.language ?? "",
    isReliable: result.isReliable,
    ...(best?.percentage === undefined ? {} : {percentage: best.percentage}),
  };
};

export async function detectRecipeLanguage(
  recipe: RecipeContent,
  detect: DetectRecipeLanguage = detectRecipeLanguageWithBrowser,
): Promise<TranslationLanguage> {
  const sample = buildRecipeLanguageSample(recipe);
  if (!sample) throw new RecipeLanguageDetectionError();

  const result = await detect(sample);
  const language = result.language.trim().toLowerCase();
  const supportedLanguage = language === "und" ? undefined : getLanguageFromLocale(language);
  if (!result.isReliable || !supportedLanguage) {
    throw new RecipeLanguageDetectionError();
  }
  return supportedLanguage;
}
