import {describe, expect, it, vi} from "vitest";
import type {PreparedInstruction} from "./prepare-instruction";
import {
  AnnotationMarkerIntegrityError,
  translatePreparedInstruction,
} from "./translate-prepared-instruction";

const options = {sourceLanguage: "de", targetLanguage: "tr"};
const protectedAnnotation: PreparedInstruction["protectedAnnotations"][number] = {
  marker: "<0>",
  originalText: "5 Sek.",
  glyphs: [],
  annotation: {
    type: "TTS", position: {offset: 4, length: 6},
    data: {speed: "1"},
  },
};

function translator(result: string) {
  return vi.fn(async () => result);
}

describe("translatePreparedInstruction", () => {
  it("accepts a preserved marker and copies metadata", async () => {
    const prepared: PreparedInstruction = {text: "Mix <0> now", protectedAnnotations: [protectedAnnotation]};
    const snapshot = structuredClone(prepared);
    const translate = translator("Şimdi <0> karıştırın");
    const result = await translatePreparedInstruction(prepared, options, translate);
    expect(translate).toHaveBeenCalledWith({sourceLanguage: "de", targetLanguage: "tr", text: prepared.text},
      {onDownloadProgress: undefined});
    expect(result).toEqual({text: "Şimdi <0> karıştırın", protectedAnnotations: prepared.protectedAnnotations});
    expect(result.protectedAnnotations).not.toBe(prepared.protectedAnnotations);
    expect(result.protectedAnnotations[0]!.annotation).not.toBe(prepared.protectedAnnotations[0]!.annotation);
    expect(prepared).toEqual(snapshot);
  });

  it.each([
    ["Mix <0>", "Karıştırın", {missingMarkers: ["<0>"]}],
    ["<0>", "<0> <0>", {duplicatedMarkers: ["<0>"]}],
    ["<0> then <1>", "<1> sonra <0>", {orderChanged: true}],
    ["<0>", "<0> <9>", {duplicatedMarkers: ["<9>"]}],
  ])("rejects changed markers: %s → %s", async (source, translated, expected) => {
    const annotations = source.includes("<1>")
      ? [protectedAnnotation, {...protectedAnnotation, marker: "<1>"}]
      : [protectedAnnotation];
    const prepared: PreparedInstruction = {text: source, protectedAnnotations: annotations};
    const error = await translatePreparedInstruction(prepared, options, translator(translated))
      .then(() => undefined, (reason: unknown) => reason);
    expect(
        error as AnnotationMarkerIntegrityError,
    ).toMatchObject({
      stage: "translated",
    });
    expect((error as AnnotationMarkerIntegrityError).validation).toMatchObject(expected);
  });

  it("accepts zero-marker instructions", async () => {
    const result = await translatePreparedInstruction(
      {text: "Mix onions", protectedAnnotations: []}, options, translator("Soğanları karıştırın"),
    );
    expect(result).toEqual({text: "Soğanları karıştırın", protectedAnnotations: []});
  });

  it("carries independent instruction metadata", async () => {
    const prepared: PreparedInstruction = {text: "Mix <0>",
      protectedAnnotations: [protectedAnnotation],
      metadata: {type: "STEP", missedUsages: ["salt"]}};
    const result = await translatePreparedInstruction(prepared, options, translator("Karıştır <0>"));
    expect(result.metadata).toEqual(prepared.metadata);
    expect(result.metadata).not.toBe(prepared.metadata);
  });

  it("rejects inconsistent prepared metadata before translation", async () => {
    const translate = translator("Karıştırın");
    const error = await translatePreparedInstruction(
      {text: "Mix onions", protectedAnnotations: [protectedAnnotation]}, options, translate,
    ).then(() => undefined, (reason: unknown) => reason);
    expect(
        error as AnnotationMarkerIntegrityError,
    ).toMatchObject({
      stage: "prepared",
    });
    expect((error as AnnotationMarkerIntegrityError).validation.missingMarkers).toEqual(["<0>"]);
    expect(translate).not.toHaveBeenCalled();
  });
});
