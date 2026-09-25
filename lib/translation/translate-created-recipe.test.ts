import { describe, expect, it, vi } from "vitest";

import type { CookidooClient } from "../cookidoo/client";
import type {
  CreatedRecipe,
  Instruction,
  RecipeMetadataPatch,
} from "../cookidoo/types";
import { CookidooAuthenticationError } from "../cookidoo/errors";
import { RecipeLanguageDetectionError } from "./detect-recipe-language";
import type { SupportedTargetLanguage } from "./languages";
import { AnnotationMarkerIntegrityError } from "./translate-prepared-instruction";
import {
  SameTranslationLanguageError,
  translateCreatedRecipe,
  type TranslateText,
} from "./translate-created-recipe";

const { formatterLanguages } = vi.hoisted(() => ({
  formatterLanguages: [] as string[],
}));

vi.mock("./annotation-formatters", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./annotation-formatters")>();
  const localized = {
    en: {
      formatTts: () => "5 sec/speed 5",
      formatMode: () => "Dough/3 min",
    },
    de: {
      formatTts: () => "5 Sek./Stufe 5",
      formatMode: () => "Teig/3 Min.",
    },
  } as const;

  return {
    ...actual,
    getAnnotationFormatter: (language: keyof typeof localized | "tr") => {
      formatterLanguages.push(language);
      return language === "tr"
        ? actual.trAnnotationFormatter
        : localized[language];
    },
  };
});

const target = (language: "en" | "de"): SupportedTargetLanguage =>
  language as SupportedTargetLanguage;

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

  const getCreatedRecipe = vi.fn(async () => {
    events.push("get");
    return recipe;
  });

  const patchRecipeMetadata = vi.fn(
    async (_id: string, _metadata: RecipeMetadataPatch) => {
      events.push("metadata");
    },
  );

  const patchRecipeInstructions = vi.fn(
    async (_id: string, _instructions: Instruction[]) => {
      events.push("instructions");
    },
  );

  const client = {
    getCreatedRecipe,
    patchRecipeMetadata,
    patchRecipeInstructions,
  } as unknown as CookidooClient;

  const translateText: TranslateText = vi.fn(async ({ text }) => {
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
  instructions: Instruction[] = [step("Stir gently")],
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
    author: { type: "USER", name: "Original author" },
  },
});

describe("translateCreatedRecipe", () => {
  it("detects an automatic source after loading and uses the concrete language", async () => {
    const context = setup(base());
    const progress: string[] = [];
    const detectLanguage = vi.fn(async () => ({
      language: "de",
      isReliable: true,
    }));

    await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "auto",
      targetLanguage: "tr",
      translateText: context.translateText,
      detectLanguage,
      onProgress: ({ stage }) => progress.push(stage),
    });

    expect(detectLanguage).toHaveBeenCalledOnce();
    expect(progress.slice(0, 3)).toEqual([
      "loading",
      "detecting-language",
      "translating-metadata",
    ]);
    expect(context.translateText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "de", targetLanguage: "tr" }),
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
      onProgress: ({ stage }) => progress.push(stage),
    });
    expect(detectLanguage).not.toHaveBeenCalled();
    expect(progress).not.toContain("detecting-language");
  });

  it("does not translate or patch when the detected source equals the target", async () => {
    const context = setup(base());
    await expect(
      translateCreatedRecipe(context.client, {
        recipeId: "r1",
        sourceLanguage: "auto",
        targetLanguage: "tr",
        translateText: context.translateText,
        detectLanguage: vi.fn(async () => ({
          language: "tr",
          isReliable: true,
        })),
      }),
    ).rejects.toBeInstanceOf(SameTranslationLanguageError);
    expect(context.translateText).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("translates and saves metadata then instructions, rebuilding TTS and MODE", async () => {
    const source = base([
      step("Mix 5 Sek./Stufe 5 now", [
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
      ]),
      step("Use dough mode", [
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
      ]),
      step("Stir gently"),
    ]);

    const original = structuredClone(source);

    const setupResult = setup(source);

    const progress: unknown[] = [];
    const downloads: unknown[] = [];

    const translator: TranslateText = vi.fn(async (request, options) => {
      setupResult.events.push(`translate:${request.text}`);

      options?.onDownloadProgress?.({
        loaded: 1,
        percent: 100,
      });

      return `TR ${request.text}`;
    });

    const result = await translateCreatedRecipe(setupResult.client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: "tr",
      translateText: translator,

      onProgress: (value) => progress.push(value),

      onDownloadProgress: (value) => downloads.push(value),
    });

    expect(setupResult.getCreatedRecipe).toHaveBeenCalledExactlyOnceWith("r1");

    expect(setupResult.patchRecipeMetadata).toHaveBeenCalledExactlyOnceWith(
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

    expect(setupResult.patchRecipeInstructions).toHaveBeenCalledExactlyOnceWith(
      "r1",
      result.instructions,
    );

    expect(setupResult.events.at(-2)).toBe("metadata");

    expect(setupResult.events.at(-1)).toBe("instructions");

    expect(source).toEqual(original);

    expect(result.name).toBe("TR Cake");

    expect(result.hints).toBe("TR Serve warm");

    expect(result.instructions[0]!.text).toBe("TR Mix 5 sn/hız 5 now");

    expect(result.instructions[1]!.text).toBe("TR Use Hamur/3 dk mode");

    expect(result.instructions[2]).toEqual(step("TR Stir gently"));

    const tts = result.instructions[0]!.annotations[0]!;

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
        tts.position.offset + tts.position.length,
      ),
    ).toBe("5 sn/hız 5");

    const mode = result.instructions[1]!.annotations[0]!;

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
        mode.position.offset + mode.position.length,
      ),
    ).toBe("Hamur/3 dk");

    for (const instruction of result.instructions.slice(0, 2)) {
      expect(instruction.text).not.toContain("<0>");
    }

    expect(progress).toEqual([
      {
        stage: "loading",
      },
      {
        stage: "translating-metadata",
      },
      {
        stage: "translating-instructions",
        current: 0,
        total: 3,
      },
      {
        stage: "translating-instructions",
        current: 1,
        total: 3,
      },
      {
        stage: "translating-instructions",
        current: 2,
        total: 3,
      },
      {
        stage: "translating-instructions",
        current: 3,
        total: 3,
      },
      {
        stage: "saving-metadata",
      },
      {
        stage: "saving-instructions",
      },
      {
        stage: "complete",
      },
    ]);

    expect(downloads.length).toBeGreaterThan(0);
  });

  it("preserves absent hints and whitespace without translating them", async () => {
    const source = base([step("  ")]);

    delete source.recipeContent.hints;

    source.recipeContent.ingredients[0]!.text = " ";

    const { client, patchRecipeMetadata, translateText } = setup(source);

    const result = await translateCreatedRecipe(client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: "tr",
      translateText,
    });

    expect(result).not.toHaveProperty("hints");

    expect(patchRecipeMetadata.mock.calls[0]![1]).not.toHaveProperty("hints");

    expect(result.ingredients[0]!.text).toBe(" ");

    expect(result.instructions[0]).toEqual(step("  "));

    expect(translateText).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: " ",
      }),
      expect.anything(),
    );

    expect(translateText).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: "  ",
      }),
      expect.anything(),
    );
  });

  it("preserves ingredient weighing annotation after translating an instruction", async () => {
    const source = base([
      step("Add flour", [
        {
          type: "INGREDIENT",
          position: {
            offset: 4,
            length: 5,
          },
          data: {
            id: "flour",
            description: { text: "flour", annotations: [] },
          },
        },
      ]),
    ]);

    const { client, translateText } = setup(source);

    const result = await translateCreatedRecipe(client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: "tr",
      translateText,
    });

    expect(result.instructions[0]?.text).toBe("TR Add flour");
    expect(result.instructions[0]?.annotations).toMatchObject([
      {
        type: "INGREDIENT",
        position: { offset: 2, length: 1 },
        data: {
          id: "flour",
          description: { text: "TR flour", annotations: [] },
        },
      },
    ]);

    expect(source.recipeContent.instructions[0]!.annotations).toHaveLength(1);
  });

  it("preserves TTS, MODE, INGREDIENT, and nested VOLUME together", async () => {
    const ttsText = "5 Sek./Stufe 5";
    const modeText = "Slicing \uE037/Thin";
    const instructionText = `Add flour, then ${ttsText} and ${modeText}`;
    const volumeData = { amount: 100, unit: "g", unitText: "g", keep: true };
    const source = base([
      step(instructionText, [
        {
          type: "INGREDIENT",
          position: {
            offset: instructionText.indexOf("flour"),
            length: "flour".length,
          },
          data: {
            id: "flour",
            description: {
              text: "100 g flour",
              annotations: [
                {
                  type: "VOLUME",
                  position: { offset: 0, length: "100 g".length },
                  data: volumeData,
                  nestedExtra: "keep",
                },
              ],
            },
          },
          ingredientExtra: "keep",
        },
        {
          type: "TTS",
          position: {
            offset: instructionText.indexOf(ttsText),
            length: ttsText.length,
          },
          data: { time: 5, speed: "5", opaque: { keep: true } },
          ttsExtra: "keep",
        },
        {
          type: "MODE",
          name: "slicing",
          position: {
            offset: instructionText.indexOf(modeText),
            length: modeText.length,
          },
          data: { opaque: { keep: true } },
          modeExtra: "keep",
        },
      ]),
    ]);
    const original = structuredClone(source);
    const context = setup(source);
    const translations: Record<string, string> = {
      "Add flour, then <0> and <1>": "100 g un ekleyin, sonra <0> ve <1>",
      "<0> flour": "<0> un",
      flour: "un",
    };
    const translateText: TranslateText = vi.fn(
      async ({ text }) => translations[text] ?? text,
    );

    const result = await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: "tr",
      translateText,
    });

    expect(source).toEqual(original);
    const instruction = result.instructions[0]!;
    expect(instruction.text).toBe(
      "100 g un ekleyin, sonra 5 sn/hız 5 ve slicing \uE037/Thin",
    );
    expect(instruction.annotations.map(({ type }) => type)).toEqual([
      "INGREDIENT",
      "TTS",
      "MODE",
    ]);

    const ingredient = instruction.annotations.find(
      ({ type }) => type === "INGREDIENT",
    );
    const tts = instruction.annotations.find(({ type }) => type === "TTS");
    const mode = instruction.annotations.find(({ type }) => type === "MODE");
    expect(ingredient).toMatchObject({
      position: { offset: "100 g ".length, length: "un".length },
      ingredientExtra: "keep",
      data: {
        id: "flour",
        description: {
          text: "100 g un",
          annotations: [
            {
              type: "VOLUME",
              position: { offset: 0, length: "100 g".length },
              data: volumeData,
              nestedExtra: "keep",
            },
          ],
        },
      },
    });
    expect(tts).toMatchObject({
      data: { time: 5, speed: "5", opaque: { keep: true } },
      ttsExtra: "keep",
    });
    expect(mode).toMatchObject({
      name: "slicing",
      data: { opaque: { keep: true } },
      modeExtra: "keep",
    });

    for (const annotation of instruction.annotations) {
      if (!annotation.position)
        throw new Error(`Expected ${annotation.type} position`);
      const display = instruction.text.slice(
        annotation.position.offset,
        annotation.position.offset + annotation.position.length,
      );
      if (annotation.type === "INGREDIENT") expect(display).toBe("un");
      if (annotation.type === "TTS") expect(display).toBe("5 sn/hız 5");
      if (annotation.type === "MODE")
        expect(display).toBe("slicing \uE037/Thin");
    }
  });

  it("does not translate or patch when loading fails", async () => {
    const setupResult = setup(base());

    const failure = new Error("GET failed");

    setupResult.getCreatedRecipe.mockRejectedValueOnce(failure);

    await expect(
      translateCreatedRecipe(setupResult.client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText: setupResult.translateText,
      }),
    ).rejects.toBe(failure);

    expect(setupResult.translateText).not.toHaveBeenCalled();

    expect(setupResult.patchRecipeMetadata).not.toHaveBeenCalled();

    expect(setupResult.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("does not patch when translation fails", async () => {
    const { client, patchRecipeMetadata, patchRecipeInstructions } =
      setup(base());

    const failure = new Error("translator failed");

    const translateText: TranslateText = vi.fn(async ({ text }) => {
      if (text === "Stir gently") {
        throw failure;
      }

      return text;
    });

    await expect(
      translateCreatedRecipe(client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText,
      }),
    ).rejects.toBe(failure);

    expect(patchRecipeMetadata).not.toHaveBeenCalled();

    expect(patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("does not patch when a protected marker is removed", async () => {
    const source = base([
      step("Mix 5 Sek./Stufe 5 now", [
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
      ]),
    ]);

    const { client, patchRecipeMetadata, patchRecipeInstructions } =
      setup(source);

    const translateText: TranslateText = vi.fn(async ({ text }) =>
      text.replace("<0>", ""),
    );

    await expect(
      translateCreatedRecipe(client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText,
      }),
    ).rejects.toBeInstanceOf(AnnotationMarkerIntegrityError);

    expect(patchRecipeMetadata).not.toHaveBeenCalled();

    expect(patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("does not patch when annotation data is invalid", async () => {
    const source = base([
      step("Use rice mode", [
        {
          type: "MODE",
          name: "turbo",
          position: {
            offset: 4,
            length: 4,
          },
          data: { pulseCount: -1 },
        },
      ]),
    ]);

    const {
      client,
      patchRecipeMetadata,
      patchRecipeInstructions,
      translateText,
    } = setup(source);

    await expect(
      translateCreatedRecipe(client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText,
      }),
    ).rejects.toThrow("Invalid MODE pulse count: -1");

    expect(patchRecipeMetadata).not.toHaveBeenCalled();

    expect(patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("does not patch instructions when metadata PATCH fails", async () => {
    const {
      client,
      patchRecipeMetadata,
      patchRecipeInstructions,
      translateText,
    } = setup(base());

    const failure = new Error("metadata PATCH failed");

    patchRecipeMetadata.mockRejectedValueOnce(failure);

    await expect(
      translateCreatedRecipe(client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText,
      }),
    ).rejects.toBe(failure);

    expect(patchRecipeMetadata).toHaveBeenCalledOnce();

    expect(patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it("propagates instruction PATCH failure after saving metadata", async () => {
    const {
      client,
      patchRecipeMetadata,
      patchRecipeInstructions,
      translateText,
    } = setup(base());

    const failure = new Error("PATCH failed");

    patchRecipeInstructions.mockRejectedValueOnce(failure);

    await expect(
      translateCreatedRecipe(client, {
        recipeId: "r1",
        sourceLanguage: "de",
        targetLanguage: "tr",
        translateText,
      }),
    ).rejects.toBe(failure);

    expect(patchRecipeMetadata).toHaveBeenCalledOnce();

    expect(patchRecipeInstructions).toHaveBeenCalledOnce();
  });

  it("covers the complete German to English workflow with localized protected annotations", async () => {
    formatterLanguages.length = 0;
    const source = base([
      step("Zwiebeln zugeben"),
      step("5 Sek./Stufe 5", [
        {
          type: "TTS",
          position: { offset: 0, length: 14 },
          data: { time: 5, speed: "5", opaque: { keep: true } },
        },
      ]),
      step("Teig/3 Min.", [
        {
          type: "MODE",
          name: "dough",
          position: { offset: 0, length: 11 },
          data: { time: 180, opaque: ["keep"] },
        },
      ]),
      step("Zuerst 5 Sek./Stufe 5, dann Teig/3 Min. fertigstellen", [
        {
          type: "MODE",
          name: "dough",
          position: { offset: 28, length: 11 },
          data: { time: 180, id: "mode-data" },
        },
        {
          type: "TTS",
          position: { offset: 7, length: 14 },
          data: { time: 5, speed: "5", id: "tts-data" },
        },
      ]),
    ]);
    source.recipeContent.name = "Zwiebelbrot";
    source.recipeContent.ingredients[0]!.text = "Mehl";
    source.recipeContent.ingredients[1]!.text = "Milch";
    source.recipeContent.hints = "Warm servieren";
    const snapshot = structuredClone(source);
    const context = setup(source);
    const translations = new Map([
      ["Zwiebelbrot", "Onion bread"],
      ["Mehl", "Flour"],
      ["Milch", "Milk"],
      ["Warm servieren", "Serve warm"],
      ["Zwiebeln zugeben", "Add onions"],
      ["<0>", "<0>"],
      ["Zuerst <0>, dann <1> fertigstellen", "Finish with <0>, then <1>"],
    ]);
    const translator: TranslateText = vi.fn(async ({ text }) => {
      const translated = translations.get(text);
      if (translated === undefined) throw new Error(`Unexpected text: ${text}`);
      return translated;
    });

    const result = await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "de",
      targetLanguage: target("en"),
      translateText: translator,
    });

    expect(formatterLanguages).toEqual(["en"]);
    expect(translator).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "de", targetLanguage: "en" }),
      expect.any(Object),
    );
    expect(context.patchRecipeMetadata).toHaveBeenCalledExactlyOnceWith("r1", {
      name: "Onion bread",
      ingredients: [
        { type: "INGREDIENT", text: "Flour", amount: 100 },
        { type: "INGREDIENT", text: "Milk", extra: { unit: "ml" } },
      ],
      hints: "Serve warm",
    });
    expect(context.patchRecipeInstructions).toHaveBeenCalledExactlyOnceWith(
      "r1",
      result.instructions,
    );
    expect(result.instructions.map(({ text }) => text)).toEqual([
      "Add onions",
      "5 sec/speed 5",
      "Dough/3 min",
      "Finish with 5 sec/speed 5, then Dough/3 min",
    ]);
    expect(result.instructions.every(({ text }) => !/<\d+>/.test(text))).toBe(
      true,
    );
    for (const instruction of result.instructions.slice(1)) {
      for (const annotation of instruction.annotations) {
        if (!annotation.position)
          throw new Error("Expected rebuilt annotation position");
        expect(
          instruction.text.slice(
            annotation.position.offset,
            annotation.position.offset + annotation.position.length,
          ),
        ).toMatch(/^(5 sec\/speed 5|Dough\/3 min)$/);
      }
    }
    expect(
      result.instructions[3]!.annotations.map(({ type, data }) => ({
        type,
        data,
      })),
    ).toEqual([
      { type: "TTS", data: { time: 5, speed: "5", id: "tts-data" } },
      { type: "MODE", data: { time: 180, id: "mode-data" } },
    ]);
    expect(source).toEqual(snapshot);
  });

  it("selects the German formatter from the target, not the French source", async () => {
    formatterLanguages.length = 0;
    const context = setup(
      base([
        step("Mélanger 5 sec/vitesse 5", [
          {
            type: "TTS",
            position: { offset: 9, length: 15 },
            data: { time: 5, speed: "5" },
          },
        ]),
      ]),
    );
    const translator: TranslateText = vi.fn(async ({ text }) =>
      text === "Mélanger <0>" ? "Mischen <0>" : `DE ${text}`,
    );

    const result = await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "fr",
      targetLanguage: target("de"),
      translateText: translator,
    });

    expect(formatterLanguages).toEqual(["de"]);
    expect(translator).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "fr", targetLanguage: "de" }),
      expect.any(Object),
    );
    expect(result.instructions[0]!.text).toBe("Mischen 5 Sek./Stufe 5");
  });

  it("reports the complete automatic-detection progress contract and never translates from auto", async () => {
    formatterLanguages.length = 0;
    const context = setup(base());
    const progress: string[] = [];
    const detectLanguage = vi.fn(async () => ({
      language: "de",
      isReliable: true,
    }));

    await translateCreatedRecipe(context.client, {
      recipeId: "r1",
      sourceLanguage: "auto",
      targetLanguage: target("en"),
      translateText: context.translateText,
      detectLanguage,
      onProgress: ({ stage }) => progress.push(stage),
    });

    expect(progress).toEqual([
      "loading",
      "detecting-language",
      "translating-metadata",
      "translating-instructions",
      "translating-instructions",
      "saving-metadata",
      "saving-instructions",
      "complete",
    ]);
    expect(context.translateText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "de", targetLanguage: "en" }),
      expect.any(Object),
    );
    expect(context.translateText).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: "auto" }),
      expect.anything(),
    );
  });

  it("rejects a manual same-language request before translation or PATCH", async () => {
    const context = setup(base());
    await expect(
      translateCreatedRecipe(context.client, {
        recipeId: "r1",
        sourceLanguage: "en",
        targetLanguage: target("en"),
        translateText: context.translateText,
      }),
    ).rejects.toBeInstanceOf(SameTranslationLanguageError);
    expect(context.translateText).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });

  it.each([
    { language: "und", isReliable: true },
    { language: "", isReliable: true },
    { language: "de", isReliable: false },
  ])(
    "stops after loading when automatic detection is not reliable: %j",
    async (detection) => {
      const context = setup(base());
      await expect(
        translateCreatedRecipe(context.client, {
          recipeId: "r1",
          sourceLanguage: "auto",
          targetLanguage: target("en"),
          translateText: context.translateText,
          detectLanguage: vi.fn(async () => detection),
        }),
      ).rejects.toBeInstanceOf(RecipeLanguageDetectionError);
      expect(context.getCreatedRecipe).toHaveBeenCalledOnce();
      expect(context.translateText).not.toHaveBeenCalled();
      expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
      expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
    },
  );

  it("stops at an authentication failure while loading a Created Recipe", async () => {
    const context = setup(base());
    const detection = vi.fn();
    context.getCreatedRecipe.mockRejectedValueOnce(
      new CookidooAuthenticationError(),
    );

    await expect(
      translateCreatedRecipe(context.client, {
        recipeId: "r1",
        sourceLanguage: "auto",
        targetLanguage: target("en"),
        translateText: context.translateText,
        detectLanguage: detection,
      }),
    ).rejects.toBeInstanceOf(CookidooAuthenticationError);
    expect(detection).not.toHaveBeenCalled();
    expect(context.translateText).not.toHaveBeenCalled();
    expect(context.patchRecipeMetadata).not.toHaveBeenCalled();
    expect(context.patchRecipeInstructions).not.toHaveBeenCalled();
  });
});
