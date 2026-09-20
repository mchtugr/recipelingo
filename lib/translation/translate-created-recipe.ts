import type {CookidooClient} from "../cookidoo/client";
import type {Ingredient, Instruction} from "../cookidoo/types";
import {
  translateWithChrome,
  type TranslateOptions,
  type TranslationProgress,
  type TranslationRequest,
} from "./chrome-translator";
import {prepareInstruction} from "./prepare-instruction";
import {restoreInstruction} from "./restore-instruction";
import {translatePreparedInstruction} from "./translate-prepared-instruction";

export type TranslateText = (
  request: TranslationRequest,
  options?: TranslateOptions,
) => Promise<string>;

export type RecipeTranslationStage =
  | "loading"
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
  sourceLanguage: string;
  targetLanguage: string;
  onDownloadProgress?: (progress: TranslationProgress) => void;
  onProgress?: (progress: RecipeTranslationProgress) => void;
  translateText?: TranslateText;
}

export interface CreatedRecipeTranslationResult {
  name: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  hints?: string;
}

/**
 * Translates all fields before saving. Restoration rebuilds only TTS/MODE annotations;
 * source INGREDIENT/VOLUME offsets are discarded because translation moves the text.
 * The two PATCHes are separate: an instruction PATCH failure can leave metadata saved.
 */
export async function translateCreatedRecipe(
  client: CookidooClient,
  options: TranslateCreatedRecipeOptions,
): Promise<CreatedRecipeTranslationResult> {
  const {
    recipeId, sourceLanguage, targetLanguage,
    onDownloadProgress, onProgress,
    translateText = translateWithChrome,
  } = options;
  const report = (progress: RecipeTranslationProgress) => onProgress?.(progress);
  const translatePlainText = (text: string): Promise<string> =>
    text.trim()
      ? translateText(
          {sourceLanguage, targetLanguage, text},
          {onDownloadProgress},
        )
      : Promise.resolve(text);

  report({stage: "loading"});
  const {recipe} = await client.getCreatedRecipe(recipeId);

  report({stage: "translating-metadata"});
  const name = await translatePlainText(recipe.name);
  const ingredients: Ingredient[] = [];
  for (const ingredient of recipe.ingredients) {
    ingredients.push({...ingredient, text: await translatePlainText(ingredient.text)});
  }
  const hints = recipe.hints === undefined
    ? undefined
    : await translatePlainText(recipe.hints);

  const instructions: Instruction[] = [];
  const total = recipe.instructions.length;
  report({stage: "translating-instructions", current: 0, total});
  for (const instruction of recipe.instructions) {
    const prepared = prepareInstruction(instruction);
    const translated = await translatePreparedInstruction(
      prepared,
      {sourceLanguage, targetLanguage, onDownloadProgress},
      translateText,
    );
    instructions.push(restoreInstruction(translated, {targetLanguage}));
    report({stage: "translating-instructions", current: instructions.length, total});
  }

  report({stage: "saving-metadata"});
  await client.patchRecipeMetadata(recipeId, {
    name,
    ingredients,
    ...(hints === undefined ? {} : {hints}),
  });
  report({stage: "saving-instructions"});
  await client.patchRecipeInstructions(recipeId, instructions);
  report({stage: "complete"});

  return {name, ingredients, instructions, ...(hints === undefined ? {} : {hints})};
}
