import type {CookidooClient} from "../cookidoo/client";
import {
  translateCreatedRecipe,
  type CreatedRecipeTranslationResult,
  type RecipeTranslationProgress,
  type TranslateCreatedRecipeOptions,
} from "./translate-created-recipe";

export type PublicRecipeTranslationProgress = RecipeTranslationProgress | {stage: "creating"};

export interface CreateAndTranslatePublicRecipeOptions extends Omit<TranslateCreatedRecipeOptions, "recipeId" | "onProgress"> {
  publicRecipeId: string;
  onProgress?: (progress: PublicRecipeTranslationProgress) => void;
}

export class PublicRecipeTranslationError extends Error {
  constructor(readonly createdRecipeId: string, cause: unknown) {
    super("Created Recipe translation failed after import", {cause});
  }
}

/** Import is permanent; later translation or PATCH failure does not roll it back. */
export async function createAndTranslatePublicRecipe(
  client: CookidooClient,
  options: CreateAndTranslatePublicRecipeOptions,
): Promise<{createdRecipeId: string; translation: CreatedRecipeTranslationResult}> {
  options.onProgress?.({stage: "creating"});
  const createdRecipeId = await client.addPublicRecipeToCookidoo(options.publicRecipeId);
  try {
    const translation = await translateCreatedRecipe(client, {
      recipeId: createdRecipeId,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      onProgress: options.onProgress,
      onDownloadProgress: options.onDownloadProgress,
      translateText: options.translateText,
    });
    return {createdRecipeId, translation};
  } catch (cause) {
    throw new PublicRecipeTranslationError(createdRecipeId, cause);
  }
}
