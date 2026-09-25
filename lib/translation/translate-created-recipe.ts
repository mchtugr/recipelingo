import type { CookidooClient } from "../cookidoo/client";
import type { Ingredient, Instruction } from "../cookidoo/types";
import { getAnnotationFormatter } from "./annotation-formatters";
import {
  translateWithChrome,
  type TranslateOptions,
  type TranslationProgress,
  type TranslationRequest,
} from "./chrome-translator";
import { prepareInstruction } from "./prepare-instruction";
import { restoreInstruction } from "./restore-instruction";
import { translatePreparedInstruction } from "./translate-prepared-instruction";
import {
  captureIngredients,
  restoreIngredients,
} from "./ingredient-annotations";
import {
  detectRecipeLanguage,
  type DetectRecipeLanguage,
} from "./detect-recipe-language";
import type {
  SourceLanguage,
  SupportedTargetLanguage,
  TranslationLanguage,
} from "./languages";

export type TranslateText = (
  request: TranslationRequest,
  options?: TranslateOptions,
) => Promise<string>;

export type RecipeTranslationStage =
  | "loading"
  | "detecting-language"
  | "translating-metadata"
  | "translating-instructions"
  | "saving-metadata"
  | "saving-instructions"
  | "complete";

export interface RecipeTranslationProgress {
  stage: RecipeTranslationStage;
  current?: number;
  total?: number;
}

export interface TranslateCreatedRecipeOptions {
  recipeId: string;
  sourceLanguage: SourceLanguage;
  targetLanguage: SupportedTargetLanguage;
  onDownloadProgress?: (progress: TranslationProgress) => void;
  onProgress?: (progress: RecipeTranslationProgress) => void;
  translateText?: TranslateText;
  detectLanguage?: DetectRecipeLanguage;
}

export class SameTranslationLanguageError extends Error {
  constructor(readonly language: TranslationLanguage) {
    super(`Source and target languages are both ${language}`);
    this.name = "SameTranslationLanguageError";
  }
}

export interface CreatedRecipeTranslationResult {
  name: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  hints?: string;
}

/**
 * Translates all fields before saving. Restoration rebuilds TTS/MODE and INGREDIENT positions.
 * The two PATCHes are separate: an instruction PATCH failure can leave metadata saved.
 */
export async function translateCreatedRecipe(
  client: CookidooClient,
  options: TranslateCreatedRecipeOptions,
): Promise<CreatedRecipeTranslationResult> {
  const {
    recipeId,
    sourceLanguage,
    targetLanguage,
    onDownloadProgress,
    onProgress,
    translateText = translateWithChrome,
    detectLanguage,
  } = options;
  const report = (progress: RecipeTranslationProgress) =>
    onProgress?.(progress);

  report({ stage: "loading" });
  const { recipeContent: recipe } = await client.getCreatedRecipe(recipeId);
  let effectiveSourceLanguage: TranslationLanguage;
  if (sourceLanguage === "auto") {
    report({ stage: "detecting-language" });
    effectiveSourceLanguage = await detectRecipeLanguage(
      recipe,
      detectLanguage,
    );
  } else {
    effectiveSourceLanguage = sourceLanguage;
  }
  if (effectiveSourceLanguage === targetLanguage) {
    throw new SameTranslationLanguageError(effectiveSourceLanguage);
  }
  const annotationFormatter = getAnnotationFormatter(targetLanguage);
  const translatePlainText = (text: string): Promise<string> =>
    text.trim()
      ? translateText(
          { sourceLanguage: effectiveSourceLanguage, targetLanguage, text },
          { onDownloadProgress },
        )
      : Promise.resolve(text);

  report({ stage: "translating-metadata" });
  const name = await translatePlainText(recipe.name);
  const ingredients: Ingredient[] = [];
  for (const ingredient of recipe.ingredients) {
    ingredients.push({
      ...ingredient,
      text: await translatePlainText(ingredient.text),
    });
  }
  const hints =
    recipe.hints === undefined
      ? undefined
      : await translatePlainText(recipe.hints);

  const instructions: Instruction[] = [];
  const total = recipe.instructions.length;
  report({ stage: "translating-instructions", current: 0, total });
  for (const instruction of recipe.instructions) {
    const capturedIngredients = captureIngredients(instruction);
    const prepared = prepareInstruction(instruction);
    const translated = await translatePreparedInstruction(
      prepared,
      {
        sourceLanguage: effectiveSourceLanguage,
        targetLanguage,
        onDownloadProgress,
      },
      translateText,
    );
    instructions.push(
      await restoreIngredients(
        restoreInstruction(translated, annotationFormatter),
        capturedIngredients,
        translatePlainText,
      ),
    );
    report({
      stage: "translating-instructions",
      current: instructions.length,
      total,
    });
  }

  report({ stage: "saving-metadata" });
  await client.patchRecipeMetadata(recipeId, {
    name,
    ingredients,
    ...(hints === undefined ? {} : { hints }),
  });
  report({ stage: "saving-instructions" });
  await client.patchRecipeInstructions(recipeId, instructions);
  report({ stage: "complete" });

  return {
    name,
    ingredients,
    instructions,
    ...(hints === undefined ? {} : { hints }),
  };
}
