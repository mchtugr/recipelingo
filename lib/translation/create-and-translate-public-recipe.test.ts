import {describe, expect, it, vi} from "vitest";
import type {CookidooClient} from "../cookidoo/client";
import {createAndTranslatePublicRecipe, PublicRecipeTranslationError} from "./create-and-translate-public-recipe";

function setup() {
  const events: string[] = [];
  const addPublicRecipeToCookidoo = vi.fn(async (_publicId: string) => {
    events.push("create");
    return "created-123";
  });
  const getCreatedRecipe = vi.fn(async (_createdId: string) => {
    events.push("load");
    return {recipeId: "created-123", recipeContent: {
      name: "Cake", ingredients: [{type: "INGREDIENT", text: "Flour"}],
      instructions: [{type: "STEP", text: "Mix", annotations: []}],
    }};
  });
  const patchRecipeMetadata = vi.fn(async () => { events.push("metadata"); });
  const patchRecipeInstructions = vi.fn(async () => { events.push("instructions"); });
  const client = {addPublicRecipeToCookidoo, getCreatedRecipe, patchRecipeMetadata, patchRecipeInstructions} as unknown as CookidooClient;
  return {client, events, addPublicRecipeToCookidoo, getCreatedRecipe, patchRecipeMetadata, patchRecipeInstructions};
}

const options = {
  publicRecipeId: "r912684",
  sourceLanguage: "es",
  targetLanguage: "tr",
  translateText: vi.fn(async ({text}: {text: string}) => `TR ${text}`),
};

describe("createAndTranslatePublicRecipe", () => {
  it("creates once, then translates and saves the new ID", async () => {
    const context = setup();
    const progress: string[] = [];
    const result = await createAndTranslatePublicRecipe(context.client, {
      ...options, onProgress: ({stage}) => progress.push(stage),
    });
    expect(result.createdRecipeId).toBe("created-123");
    expect(context.addPublicRecipeToCookidoo).toHaveBeenCalledExactlyOnceWith("r912684");
    expect(context.getCreatedRecipe).toHaveBeenCalledExactlyOnceWith("created-123");
    expect(context.patchRecipeMetadata).toHaveBeenCalledExactlyOnceWith("created-123", expect.any(Object));
    expect(context.patchRecipeInstructions).toHaveBeenCalledExactlyOnceWith("created-123", expect.any(Array));
    expect(context.events).toEqual(["create", "load", "metadata", "instructions"]);
    expect(progress[0]).toBe("creating");
    expect(progress.at(-1)).toBe("complete");
    expect(options.translateText).toHaveBeenCalledWith(
      expect.objectContaining({sourceLanguage: "es", targetLanguage: "tr"}),
      expect.any(Object),
    );
  });

  it("does not translate if creation fails", async () => {
    const context = setup();
    context.addPublicRecipeToCookidoo.mockRejectedValueOnce(new Error("POST failed"));
    await expect(createAndTranslatePublicRecipe(context.client, options)).rejects.toThrow("POST failed");
    expect(context.getCreatedRecipe).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
  });

  it("preserves the created ID when translation fails and does not roll back", async () => {
    const context = setup();
    const failure = new Error("translation failed");
    try {
      await createAndTranslatePublicRecipe(context.client, {...options, translateText: vi.fn(async () => {throw failure;})});
      throw new Error("Expected translation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicRecipeTranslationError);
      expect(error).toMatchObject({createdRecipeId: "created-123", cause: failure});
    }
    expect(context.addPublicRecipeToCookidoo).toHaveBeenCalledOnce();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });
});
