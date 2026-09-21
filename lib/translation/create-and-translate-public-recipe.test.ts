import {describe, expect, it, vi} from "vitest";
import type {CookidooClient} from "../cookidoo/client";
import {CookidooAuthenticationError} from "../cookidoo/errors";
import {RecipeLanguageDetectionError} from "./detect-recipe-language";
import type {SupportedTargetLanguage} from "./languages";
import {createAndTranslatePublicRecipe, PublicRecipeTranslationError} from "./create-and-translate-public-recipe";
import {SameTranslationLanguageError} from "./translate-created-recipe";

const {formatterLanguages} = vi.hoisted(() => ({formatterLanguages: [] as string[]}));

vi.mock("./annotation-formatters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./annotation-formatters")>();
  return {
    ...actual,
    getAnnotationFormatter: (language: string) => {
      formatterLanguages.push(language);
      return language === "tr" ? actual.trAnnotationFormatter : {
        formatTts: () => "5 sec/speed 5",
        formatMode: () => "Dough/3 min",
      };
    },
  };
});

const english = "en" as SupportedTargetLanguage;

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
  sourceLanguage: "de",
  targetLanguage: english,
  translateText: vi.fn(async ({text}: {text: string}) => `TR ${text}`),
} as const;

describe("createAndTranslatePublicRecipe", () => {
  it("creates once, then translates and saves the new ID", async () => {
    formatterLanguages.length = 0;
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
      expect.objectContaining({sourceLanguage: "de", targetLanguage: "en"}),
      expect.any(Object),
    );
    expect(formatterLanguages).toEqual(["en"]);
  });

  it("does not translate if creation fails", async () => {
    const context = setup();
    context.addPublicRecipeToCookidoo.mockRejectedValueOnce(new Error("POST failed"));
    await expect(createAndTranslatePublicRecipe(context.client, options)).rejects.toThrow("POST failed");
    expect(context.getCreatedRecipe).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
  });

  it("does not create a partial-success error when import requires authentication", async () => {
    const context = setup();
    const failure = new CookidooAuthenticationError();
    context.addPublicRecipeToCookidoo.mockRejectedValueOnce(failure);

    await expect(createAndTranslatePublicRecipe(context.client, options)).rejects.toBe(failure);
    expect(context.getCreatedRecipe).not.toHaveBeenCalled();
  });

  it("preserves the created ID when authentication expires after import", async () => {
    const context = setup();
    const failure = new CookidooAuthenticationError();
    context.getCreatedRecipe.mockRejectedValueOnce(failure);

    await expect(createAndTranslatePublicRecipe(context.client, options)).rejects.toMatchObject({
      createdRecipeId: "created-123",
      cause: failure,
    });
    expect(context.addPublicRecipeToCookidoo).toHaveBeenCalledOnce();
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

  it("preserves the created ID when automatic detection finds the target language", async () => {
    const context = setup();
    await expect(createAndTranslatePublicRecipe(context.client, {
      ...options,
      sourceLanguage: "auto",
      detectLanguage: vi.fn(async () => ({language: "en", isReliable: true})),
    })).rejects.toMatchObject({
      createdRecipeId: "created-123",
      cause: expect.any(SameTranslationLanguageError),
    });
    expect(context.addPublicRecipeToCookidoo).toHaveBeenCalledOnce();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("preserves the created ID and detection cause when detection fails after import", async () => {
    const context = setup();
    await expect(createAndTranslatePublicRecipe(context.client, {
      ...options,
      sourceLanguage: "auto",
      detectLanguage: vi.fn(async () => ({language: "und", isReliable: false})),
    })).rejects.toMatchObject({
      createdRecipeId: "created-123",
      cause: expect.any(RecipeLanguageDetectionError),
    });
    expect(context.addPublicRecipeToCookidoo).toHaveBeenCalledOnce();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("reports creating before the Created Recipe workflow stages", async () => {
    const context = setup();
    const progress: string[] = [];
    await createAndTranslatePublicRecipe(context.client, {
      ...options,
      sourceLanguage: "auto",
      detectLanguage: vi.fn(async () => ({language: "de", isReliable: true})),
      onProgress: ({stage}) => progress.push(stage),
    });
    expect(progress).toEqual([
      "creating", "loading", "detecting-language", "translating-metadata",
      "translating-instructions", "translating-instructions",
      "saving-metadata", "saving-instructions", "complete",
    ]);
  });
});
