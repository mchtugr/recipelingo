import { describe, expect, it } from "vitest";
import type { IngredientAnnotation, Instruction } from "../cookidoo/types";
import {
  captureIngredients,
  IngredientAnnotationPlacementError,
  overlaps,
  restoreIngredients,
} from "./ingredient-annotations";

const ingredient = (
  offset: number,
  length: number,
  text = "3 jajka",
  annotations: any[] = [],
): IngredientAnnotation => ({
  type: "INGREDIENT",
  position: { offset, length },
  data: { description: { text, annotations } },
  extra: "keep",
});
const step = (
  text: string,
  annotations: Instruction["annotations"],
): Instruction => ({ type: "STEP", text, annotations, missedUsages: ["salt"] });
const translate = async (text: string) =>
  (
    ({
      "3 jajka": "3 yumurta",
      jajka: "yumurta",
      "100 g wody": "100 g su",
      "20 - 30 g": "20 - 30 g",
      "<0> papryczek chili": "taze acı biber <0>",
    }) as Record<string, string>
  )[text] ?? text;

describe("ingredient weighing restoration", () => {
  it("translates a description without VOLUME and relinks a unique exact span", async () => {
    const source = step("Add 100 g wody", [ingredient(4, 10, "3 jajka")]);
    const result = await restoreIngredients(
      step("Karıştırma kabına 100 g su ekleyin.", []),
      captureIngredients(source),
      translate,
    );
    expect(result.annotations[0]).toMatchObject({
      position: { offset: 18, length: 8 },
      extra: "keep",
      data: { description: { text: "3 yumurta", annotations: [] } },
    });
    expect(result.missedUsages).toEqual(["salt"]);
  });

  it("relinks a unique candidate case-insensitively before using a fallback anchor", async () => {
    const source = step("jajka", [ingredient(0, 5)]);
    const result = await restoreIngredients(
      step("YUMURTA ekleyin", []),
      captureIngredients(source),
      async (text) => (text === "jajka" ? "yumurta" : text),
    );
    expect(result.annotations[0]?.position).toEqual({
      offset: 0,
      length: "YUMURTA".length,
    });
  });

  it.each([
    ["normal space", " abc", 0],
    ["NBSP", "\u00A0abc", 0],
  ])(
    "uses a safe %s fallback when the translated candidate is absent",
    async (_name, text, offset) => {
      const result = await restoreIngredients(
        step(text, []),
        captureIngredients(step("jajka", [ingredient(0, 5)])),
        async () => "missing",
      );
      expect(result.annotations[0]?.position).toEqual({ offset, length: 1 });
    },
  );

  it("does not attach to an ambiguous repeated candidate", async () => {
    const result = await restoreIngredients(
      step("yumurta ve yumurta", []),
      captureIngredients(step("jajka", [ingredient(0, 5)])),
      async (text) => (text === "jajka" ? "yumurta" : text),
    );
    expect(result.annotations[0]?.position).toEqual({
      offset: "yumurta".length,
      length: 1,
    });
  });

  it("protects and rebuilds multiple VOLUME spans", async () => {
    const volume = (offset: number, length: number) => ({
      type: "VOLUME" as const,
      position: { offset, length },
      data: { amount: 20, amountMax: 30, unit: "g", unitText: "g" },
    });
    const source = step("jajka", [
      ingredient(0, 5, "20 - 30 g papryczek chili", [volume(0, 9)]),
    ]);
    const result = await restoreIngredients(
      step("Yumurtaları koyun.", []),
      captureIngredients(source),
      translate,
    );
    const description = (result.annotations[0] as IngredientAnnotation).data
      .description;
    if (typeof description === "string")
      throw new Error("Expected structured description");
    expect(description.text).toBe("taze acı biber 20 - 30 g");
    expect(description.annotations[0]?.position).toEqual({
      offset: 15,
      length: 9,
    });
    expect(description.annotations[0]?.data).toEqual(volume(0, 9).data);
    expect(result.text[result.annotations[0]!.position!.offset]).toMatch(/\s/);
  });

  it("allocates distinct whitespace around occupied TTS and MODE ranges", async () => {
    const source = step("jajka wody", [ingredient(0, 5), ingredient(6, 4)]);
    const final = step("X Y Z", [
      { type: "TTS", position: { offset: 1, length: 1 }, data: { speed: "1" } },
      { type: "MODE", name: "dough", position: { offset: 3, length: 1 } },
    ]);
    const result = await restoreIngredients(
      final,
      captureIngredients(source),
      async () => "missing",
    );
    const positions = result.annotations
      .filter((a) => a.type === "INGREDIENT")
      .map((a) => a.position!);
    expect(positions).toEqual([
      { offset: 0, length: 1 },
      { offset: 2, length: 1 },
    ]);
    for (const position of positions)
      for (const other of result.annotations.filter(
        (a) => a.type !== "INGREDIENT",
      )) {
        expect(overlaps(position, other.position!)).toBe(false);
      }
  });

  it("uses visible character only when whitespace is unavailable", async () => {
    const result = await restoreIngredients(
      step("abc", []),
      captureIngredients(step("jajka", [ingredient(0, 5)])),
      async () => "missing",
    );
    expect(result.annotations[0]?.position).toEqual({ offset: 0, length: 1 });
  });

  it("fails instead of dropping ingredient when all positions are occupied", async () => {
    await expect(
      restoreIngredients(
        step("abc", [
          { type: "MODE", name: "dough", position: { offset: 0, length: 3 } },
        ]),
        captureIngredients(step("jajka", [ingredient(0, 5)])),
        async () => "missing",
      ),
    ).rejects.toBeInstanceOf(IngredientAnnotationPlacementError);
  });

  it("rejects overlapping source INGREDIENT and protected annotations", () => {
    expect(() =>
      captureIngredients(
        step("jajka", [
          ingredient(0, 5),
          {
            type: "TTS",
            position: { offset: 2, length: 2 },
            data: { speed: "1" },
          },
        ]),
      ),
    ).toThrow("Overlapping INGREDIENT and TTS annotation ranges");
  });

  it("rejects overlapping nested VOLUME ranges", async () => {
    const source = step("jajka", [
      ingredient(0, 5, "20 - 30 g", [
        { type: "VOLUME", position: { offset: 0, length: 4 }, data: {} },
        { type: "VOLUME", position: { offset: 3, length: 4 }, data: {} },
      ]),
    ]);
    await expect(
      restoreIngredients(
        step("abc", []),
        captureIngredients(source),
        translate,
      ),
    ).rejects.toThrow("Overlapping VOLUME");
  });

  it("fails explicitly when translation removes a nested VOLUME marker", async () => {
    const source = step("jajka", [
      ingredient(0, 5, "100 g wody", [
        {
          type: "VOLUME",
          position: { offset: 0, length: 5 },
          data: { amount: 100, unit: "g" },
        },
      ]),
    ]);
    await expect(
      restoreIngredients(
        step("abc", []),
        captureIngredients(source),
        async (text) => (text === "<0> wody" ? "su" : text),
      ),
    ).rejects.toThrow("Translation changed protected VOLUME markers");
  });

  it("restores multiple VOLUME spans after translated order changes", async () => {
    const volumes = [
      {
        type: "VOLUME" as const,
        position: { offset: 0, length: 5 },
        data: { amount: 100, unit: "g" },
      },
      {
        type: "VOLUME" as const,
        position: { offset: 8, length: 6 },
        data: { amount: 200, unit: "ml" },
      },
    ];
    const source = step("jajka", [ingredient(0, 5, "100 g i 200 ml", volumes)]);
    const result = await restoreIngredients(
      step("abc", []),
      captureIngredients(source),
      async (text) => (text === "<0> i <1>" ? "<1> ve <0>" : text),
    );
    const description = (result.annotations[0] as IngredientAnnotation).data
      .description;
    if (typeof description === "string")
      throw new Error("Expected structured description");
    expect(description.text).toBe("200 ml ve 100 g");
    expect(description.annotations.map((a) => a.position)).toEqual([
      { offset: 0, length: 6 },
      { offset: 10, length: 5 },
    ]);
    expect(description.annotations.map((a) => a.data)).toEqual([
      volumes[1]!.data,
      volumes[0]!.data,
    ]);
  });
});
