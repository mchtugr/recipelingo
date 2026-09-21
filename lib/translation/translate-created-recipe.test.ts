import { describe, expect, it, vi } from "vitest";

import type { CookidooClient } from "../cookidoo/client";
import type {
  CreatedRecipe,
  Instruction,
  RecipeMetadataPatch,
} from "../cookidoo/types";
import { AnnotationMarkerIntegrityError } from "./translate-prepared-instruction";
import {
  SameTranslationLanguageError,
  translateCreatedRecipe,
  type TranslateText,
} from "./translate-created-recipe";

const step = (
    text: string,
    annotations: Instruction["annotations"] = [],
): Instruction => ({
  type: "STEP",
  text,
  annotations,
});

function setup(recipe: CreatedRecipe) {
  const events: string[] = [];

  const getCreatedRecipe = vi.fn(
      async () => {
        events.push("get");
        return recipe;
      },
  );

  const patchRecipeMetadata = vi.fn(
      async (
          _id: string,
          _metadata: RecipeMetadataPatch,
      ) => {
        events.push("metadata");
      },
  );

  const patchRecipeInstructions = vi.fn(
      async (
          _id: string,
          _instructions: Instruction[],
      ) => {
        events.push("instructions");
      },
  );

  const client = {
    getCreatedRecipe,
    patchRecipeMetadata,
    patchRecipeInstructions,
  } as unknown as CookidooClient;

  const translateText: TranslateText =
      vi.fn(async ({ text }) => {
        events.push(`translate:${text}`);
        return `TR ${text}`;
      });

  return {
    client,
    events,
    getCreatedRecipe,
    patchRecipeMetadata,
    patchRecipeInstructions,
    translateText,
  };
}

const base = (
    instructions: Instruction[] = [
      step("Stir gently"),
    ],
): CreatedRecipe => ({
  recipeId: "r1",
  recipeContent: {
    name: "Cake",
    ingredients: [
      {
        type: "INGREDIENT",
        text: "Flour",
        amount: 100,
      },
      {
        type: "INGREDIENT",
        text: "Milk",
        extra: {
          unit: "ml",
        },
      },
    ],
    hints: "Serve warm",
    instructions,
    author: {type: "USER", name: "Original author"},
  },
});

describe("translateCreatedRecipe", () => {
  it("detects an automatic source after loading and uses the concrete language", async () => {
    const context = setup(base());
    const progress: string[] = [];
    const detectLanguage = vi.fn(async () => ({language: "de", isReliable: true}));

    await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "auto",
      targetLanguage: "tr",
      translateText: context.translateText,
      detectLanguage,
      onProgress: ({stage}) => progress.push(stage),
    });

    expect(detectLanguage).toHaveBeenCalledOnce();
    expect(progress.slice(0, 3)).toEqual(["loading", "detecting-language", "translating-metadata"]);
    expect(context.translateText).toHaveBeenCalledWith(
      expect.objectContaining({sourceLanguage: "de", targetLanguage: "tr"}),
      expect.any(Object),
    );
  });

  it("skips detection for a manual source", async () => {
    const context = setup(base());
    const detectLanguage = vi.fn();
    const progress: string[] = [];
    await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: "tr",
      translateText: context.translateText,
      detectLanguage,
      onProgress: ({stage}) => progress.push(stage),
    });
    expect(detectLanguage).not.toHaveBeenCalled();
    expect(progress).not.toContain("detecting-language");
  });

  it("does not translate or patch when the detected source equals the target", async () => {
    const context = setup(base());
    await expect(translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "auto",
      targetLanguage: "tr",
      translateText: context.translateText,
      detectLanguage: vi.fn(async () => ({language: "tr", isReliable: true})),
    })).rejects.toBeInstanceOf(SameTranslationLanguageError);
    expect(context.translateText).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it(
      "translates and saves metadata then instructions, rebuilding TTS and MODE",
      async () => {
        const source = base([
          step(
              "Mix 5 Sek./Stufe 5 now",
              [
                {
                  type: "TTS",
                  position: {
                    offset: 4,
                    length: 14,
                  },
                  data: {
                    time: 5,
                    speed: "5",
                  },
                },
              ],
          ),
          step(
              "Use dough mode",
              [
                {
                  type: "MODE",
                  name: "dough",
                  position: {
                    offset: 4,
                    length: 5,
                  },
                  data: {
                    time: 180,
                  },
                },
              ],
          ),
          step("Stir gently"),
        ]);

        const original =
            structuredClone(source);

        const setupResult =
            setup(source);

        const progress: unknown[] = [];
        const downloads: unknown[] = [];

        const translator: TranslateText =
            vi.fn(
                async (
                    request,
                    options,
                ) => {
                  setupResult.events.push(
                      `translate:${request.text}`,
                  );

                  options
                      ?.onDownloadProgress
                      ?.({
                        loaded: 1,
                        percent: 100,
                      });

                  return `TR ${request.text}`;
                },
            );

        const result =
            await translateCreatedRecipe(
                setupResult.client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText: translator,

                  onProgress: (value) =>
                      progress.push(value),

                  onDownloadProgress: (
                      value,
                  ) =>
                      downloads.push(value),
                },
            );

        expect(
            setupResult.getCreatedRecipe,
        ).toHaveBeenCalledExactlyOnceWith(
            "r1",
        );

        expect(
            setupResult.patchRecipeMetadata,
        ).toHaveBeenCalledExactlyOnceWith(
            "r1",
            {
              name: "TR Cake",

              ingredients: [
                {
                  type: "INGREDIENT",
                  text: "TR Flour",
                  amount: 100,
                },
                {
                  type: "INGREDIENT",
                  text: "TR Milk",
                  extra: {
                    unit: "ml",
                  },
                },
              ],

              hints: "TR Serve warm",
            },
        );

        expect(
            setupResult
                .patchRecipeInstructions,
        ).toHaveBeenCalledExactlyOnceWith(
            "r1",
            result.instructions,
        );

        expect(
            setupResult.events.at(-2),
        ).toBe("metadata");

        expect(
            setupResult.events.at(-1),
        ).toBe("instructions");

        expect(source).toEqual(original);

        expect(result.name).toBe(
            "TR Cake",
        );

        expect(result.hints).toBe(
            "TR Serve warm",
        );

        expect(
            result.instructions[0]!.text,
        ).toBe(
            "TR Mix 5 sn/hız 5 now",
        );

        expect(
            result.instructions[1]!.text,
        ).toBe(
            "TR Use Hamur/3 dk mode",
        );

        expect(
            result.instructions[2],
        ).toEqual(
            step("TR Stir gently"),
        );

        const tts =
            result.instructions[0]!
                .annotations[0]!;

        expect(tts).toMatchObject({
          type: "TTS",
          data: {
            time: 5,
            speed: "5",
          },
        });

        if (!tts.position) throw new Error("Expected TTS position");

        expect(
            result.instructions[0]!.text.slice(
                tts.position.offset,
                tts.position.offset +
                tts.position.length,
            ),
        ).toBe("5 sn/hız 5");

        const mode =
            result.instructions[1]!
                .annotations[0]!;

        expect(mode).toMatchObject({
          type: "MODE",
          name: "dough",
          data: {
            time: 180,
          },
        });

        if (!mode.position) throw new Error("Expected MODE position");

        expect(
            result.instructions[1]!.text.slice(
                mode.position.offset,
                mode.position.offset +
                mode.position.length,
            ),
        ).toBe("Hamur/3 dk");

        for (
            const instruction
            of result.instructions.slice(
            0,
            2,
        )
            ) {
          expect(
              instruction.text,
          ).not.toContain("<0>");
        }

        expect(progress).toEqual([
          {
            stage: "loading",
          },
          {
            stage:
                "translating-metadata",
          },
          {
            stage:
                "translating-instructions",
            current: 0,
            total: 3,
          },
          {
            stage:
                "translating-instructions",
            current: 1,
            total: 3,
          },
          {
            stage:
                "translating-instructions",
            current: 2,
            total: 3,
          },
          {
            stage:
                "translating-instructions",
            current: 3,
            total: 3,
          },
          {
            stage: "saving-metadata",
          },
          {
            stage:
                "saving-instructions",
          },
          {
            stage: "complete",
          },
        ]);

        expect(
            downloads.length,
        ).toBeGreaterThan(0);
      },
  );

  it(
      "preserves absent hints and whitespace without translating them",
      async () => {
        const source = base([
          step("  "),
        ]);

        delete source.recipeContent.hints;

        source.recipeContent.ingredients[0]!
            .text = " ";

        const {
          client,
          patchRecipeMetadata,
          translateText,
        } = setup(source);

        const result =
            await translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            );

        expect(
            result,
        ).not.toHaveProperty(
            "hints",
        );

        expect(
            patchRecipeMetadata
                .mock.calls[0]![1],
        ).not.toHaveProperty(
            "hints",
        );

        expect(
            result.ingredients[0]!.text,
        ).toBe(" ");

        expect(
            result.instructions[0],
        ).toEqual(
            step("  "),
        );

        expect(
            translateText,
        ).not.toHaveBeenCalledWith(
            expect.objectContaining({
              text: " ",
            }),
            expect.anything(),
        );

        expect(
            translateText,
        ).not.toHaveBeenCalledWith(
            expect.objectContaining({
              text: "  ",
            }),
            expect.anything(),
        );
      },
  );

  it(
      "drops source ingredient offsets after translating an instruction",
      async () => {
        const source = base([
          step(
              "Add flour",
              [
                {
                  type: "INGREDIENT",
                  position: {
                    offset: 4,
                    length: 5,
                  },
                  data: {
                    id: "flour",
                  },
                },
              ],
          ),
        ]);

        const {
          client,
          translateText,
        } = setup(source);

        const result =
            await translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            );

        expect(
            result.instructions[0],
        ).toEqual(
            step("TR Add flour"),
        );

        expect(
            source.recipeContent
                .instructions[0]!
                .annotations,
        ).toHaveLength(1);
      },
  );

  it(
      "does not translate or patch when loading fails",
      async () => {
        const setupResult =
            setup(base());

        const failure =
            new Error("GET failed");

        setupResult
            .getCreatedRecipe
            .mockRejectedValueOnce(
                failure,
            );

        await expect(
            translateCreatedRecipe(
                setupResult.client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText:
                  setupResult.translateText,
                },
            ),
        ).rejects.toBe(failure);

        expect(
            setupResult.translateText,
        ).not.toHaveBeenCalled();

        expect(
            setupResult
                .patchRecipeMetadata,
        ).not.toHaveBeenCalled();

        expect(
            setupResult
                .patchRecipeInstructions,
        ).not.toHaveBeenCalled();
      },
  );

  it(
      "does not patch when translation fails",
      async () => {
        const {
          client,
          patchRecipeMetadata,
          patchRecipeInstructions,
        } = setup(base());

        const failure =
            new Error(
                "translator failed",
            );

        const translateText:
            TranslateText = vi.fn(
            async ({ text }) => {
              if (
                  text ===
                  "Stir gently"
              ) {
                throw failure;
              }

              return text;
            },
        );

        await expect(
            translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            ),
        ).rejects.toBe(failure);

        expect(
            patchRecipeMetadata,
        ).not.toHaveBeenCalled();

        expect(
            patchRecipeInstructions,
        ).not.toHaveBeenCalled();
      },
  );

  it(
      "does not patch when a protected marker is removed",
      async () => {
        const source = base([
          step(
              "Mix 5 Sek./Stufe 5 now",
              [
                {
                  type: "TTS",
                  position: {
                    offset: 4,
                    length: 14,
                  },
                  data: {
                    time: 5,
                    speed: "5",
                  },
                },
              ],
          ),
        ]);

        const {
          client,
          patchRecipeMetadata,
          patchRecipeInstructions,
        } = setup(source);

        const translateText:
            TranslateText = vi.fn(
            async ({ text }) =>
                text.replace(
                    "<0>",
                    "",
                ),
        );

        await expect(
            translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            ),
        ).rejects.toBeInstanceOf(
            AnnotationMarkerIntegrityError,
        );

        expect(
            patchRecipeMetadata,
        ).not.toHaveBeenCalled();

        expect(
            patchRecipeInstructions,
        ).not.toHaveBeenCalled();
      },
  );

  it(
      "does not patch when annotation formatting fails",
      async () => {
        const source = base([
          step(
              "Use rice mode",
              [
                {
                  type: "MODE",
                  name: "rice-cooker",
                  position: {
                    offset: 4,
                    length: 4,
                  },
                  data: {},
                },
              ],
          ),
        ]);

        const {
          client,
          patchRecipeMetadata,
          patchRecipeInstructions,
          translateText,
        } = setup(source);

        await expect(
            translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            ),
        ).rejects.toThrow(
            "Unsupported MODE annotation: rice-cooker",
        );

        expect(
            patchRecipeMetadata,
        ).not.toHaveBeenCalled();

        expect(
            patchRecipeInstructions,
        ).not.toHaveBeenCalled();
      },
  );

  it(
      "does not patch instructions when metadata PATCH fails",
      async () => {
        const {
          client,
          patchRecipeMetadata,
          patchRecipeInstructions,
          translateText,
        } = setup(base());

        const failure =
            new Error(
                "metadata PATCH failed",
            );

        patchRecipeMetadata
            .mockRejectedValueOnce(
                failure,
            );

        await expect(
            translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            ),
        ).rejects.toBe(failure);

        expect(
            patchRecipeMetadata,
        ).toHaveBeenCalledOnce();

        expect(
            patchRecipeInstructions,
        ).not.toHaveBeenCalled();
      },
  );

  it(
      "propagates instruction PATCH failure after saving metadata",
      async () => {
        const {
          client,
          patchRecipeMetadata,
          patchRecipeInstructions,
          translateText,
        } = setup(base());

        const failure =
            new Error("PATCH failed");

        patchRecipeInstructions
            .mockRejectedValueOnce(
                failure,
            );

        await expect(
            translateCreatedRecipe(
                client,
                {
                  recipeId: "r1",
                  sourceLanguage: "de",
                  targetLanguage: "tr",
                  translateText,
                },
            ),
        ).rejects.toBe(failure);

        expect(
            patchRecipeMetadata,
        ).toHaveBeenCalledOnce();

        expect(
            patchRecipeInstructions,
        ).toHaveBeenCalledOnce();
      },
  );
});
