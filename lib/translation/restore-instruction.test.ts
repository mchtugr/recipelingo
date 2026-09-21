import {describe, expect, it} from "vitest";
import type {ModeAnnotation, TtsAnnotation} from "../cookidoo/types";
import type {TranslatedPreparedInstruction} from "./translate-prepared-instruction";
import {restoreInstruction} from "./restore-instruction";
import {
  trAnnotationFormatter,
  type AnnotationFormatter,
} from "./annotation-formatters";

const tts = (marker: string, data: TtsAnnotation["data"] = {time: 5, speed: "5"}) => ({
  marker, originalText: "source", annotation: {
    type: "TTS" as const, position: {offset: 99, length: 6}, data,
    extra: {keep: true},
  },
});
const mode = (
  marker: string,
  name = "dough",
  data: ModeAnnotation["data"] = {time: 180},
) => ({
  marker, originalText: "source", annotation: {
    type: "MODE" as const, name, position: {offset: 55, length: 6},
    data,
  },
});
const restore = (input: TranslatedPreparedInstruction) =>
  restoreInstruction(input, trAnnotationFormatter);

describe("restoreInstruction", () => {
  it("restores TTS with new position, preserved data and independent clones", () => {
    const input = {text: "Soğanları ekleyin ve <0> doğrayın.",
      protectedAnnotations: [tts("<0>")], metadata: {type: "STEP" as const, missedUsages: ["x"]}};
    const snapshot = structuredClone(input);
    const result = restore(input);
    expect(result.text).toBe("Soğanları ekleyin ve 5 sn/hız 5 doğrayın.");
    expect(result.annotations[0]?.position).toEqual({offset: 21, length: 10});
    expect(result.text.slice(21, 31)).toBe("5 sn/hız 5");
    expect(result.annotations[0]?.data).toEqual(input.protectedAnnotations[0]?.annotation.data);
    expect(result.annotations[0]).toMatchObject({extra: {keep: true}});
    expect(result.missedUsages).toEqual(["x"]);
    (result.annotations[0]!.data as {time: number}).time = 20;
    expect(input).toEqual(snapshot);
  });

  it("restores MODE", () => {
    expect(restore({text: "Use <0> now", protectedAnnotations: [mode("<0>")]}))
      .toMatchObject({text: "Use Hamur/3 dk now", annotations: [{position: {offset: 4, length: 10}}]});
  });

  it("uses the injected formatter and rebuilds positions from its output", () => {
    const formatter: AnnotationFormatter = {
      formatTts: () => "[TTS]",
      formatMode: () => "[MODE]",
    };
    const input = {
      text: "<0> then <1>",
      protectedAnnotations: [
        tts("<0>", {temperature: {value: "100", unit: "C"}, speed: "2"}),
        mode("<1>", "dough", {time: 180, accessory: "Varoma"}),
      ],
    } satisfies TranslatedPreparedInstruction;
    const result = restoreInstruction(input, formatter);

    expect(result.text).toBe("[TTS] then [MODE]");
    expect(result.annotations.map(({position}) => position)).toEqual([
      {offset: 0, length: 5},
      {offset: 11, length: 6},
    ]);
    expect(result.annotations.map(({data}) => data)).toEqual(
      input.protectedAnnotations.map(({annotation}) => annotation.data),
    );
  });

  it("updates later offsets after earlier replacement", () => {
    const result = restore({text: "Önce <0>, ardından <1> uygulayın.",
      protectedAnnotations: [tts("<0>"), mode("<1>")]});
    expect(result.text).toBe("Önce 5 sn/hız 5, ardından Hamur/3 dk uygulayın.");
    for (const [annotation, expected] of result.annotations.map((a, i) => [a, ["5 sn/hız 5", "Hamur/3 dk"][i]] as const)) {
      if (!annotation.position) throw new Error("Expected annotation position");
      expect(result.text.slice(annotation.position.offset,
        annotation.position.offset + annotation.position.length)).toBe(expected);
    }
    expect(result.annotations[1]?.position?.offset).toBe(result.text.indexOf("Hamur/3 dk"));
  });

  it("matches marker names exactly, including <1> and <10>", () => {
    const result = restore({text: "<1> then <10>",
      protectedAnnotations: [tts("<1>"), mode("<10>")]});
    expect(result.text).toBe("5 sn/hız 5 then Hamur/3 dk");
  });

  it.each(["none", "<0> and <0>"])("rejects missing or duplicated marker in %s", (text) => {
    expect(() => restore({text, protectedAnnotations: [tts("<0>")]}))
      .toThrow("Expected exactly one annotation marker: <0>");
  });

  it("rejects leftover reserved markers", () => {
    expect(() => restore({text: "<9>", protectedAnnotations: []}))
      .toThrow("Reserved annotation markers remain");
  });

  it("allows no protected annotations and excludes unprotected annotations", () => {
    expect(restore({text: "Plain text", protectedAnnotations: []}))
      .toEqual({type: "STEP", text: "Plain text", annotations: []});
  });

  it("propagates formatter errors", () => {
    expect(() => restore({text: "<0>", protectedAnnotations: [mode("<0>", "rice-cooker")]}))
      .toThrow("Unsupported MODE annotation: rice-cooker");
  });

  it("restores annotations using marker position rather than metadata order", () => {
    const translated: TranslatedPreparedInstruction = {
      text: "Önce <0>, ardından <1> uygulayın.",

      // Deliberately reversed:
      // metadata for <1> comes before metadata for <0>.
      protectedAnnotations: [
        {
          marker: "<1>",
          originalText: "Teig/3 Min.",
          annotation: {
            type: "MODE",
            name: "dough",
            position: {
              offset: 20,
              length: 11,
            },
            data: {
              time: 180,
            },
          },
        },
        {
          marker: "<0>",
          originalText: "5 Sek./Stufe 5",
          annotation: {
            type: "TTS",
            position: {
              offset: 5,
              length: 14,
            },
            data: {
              time: 5,
              speed: "5",
            },
          },
        },
      ],
    };

    const result = restoreInstruction(translated, trAnnotationFormatter);

    expect(result.text).toBe(
        "Önce 5 sn/hız 5, ardından Hamur/3 dk uygulayın.",
    );

    expect(result.annotations).toHaveLength(2);

    const tts = result.annotations.find(
        (annotation) =>
            annotation.type === "TTS",
    );

    const mode = result.annotations.find(
        (annotation) =>
            annotation.type === "MODE",
    );

    expect(tts).toBeDefined();
    expect(mode).toBeDefined();

    if (!tts?.position || !mode?.position) {
      throw new Error(
          "Expected restored TTS and MODE annotations",
      );
    }

    expect(tts.position).toEqual({
      offset: result.text.indexOf(
          "5 sn/hız 5",
      ),
      length: "5 sn/hız 5".length,
    });

    expect(mode.position).toEqual({
      offset: result.text.indexOf(
          "Hamur/3 dk",
      ),
      length: "Hamur/3 dk".length,
    });

    expect(
        result.text.slice(
            tts.position.offset,
            tts.position.offset +
            tts.position.length,
        ),
    ).toBe("5 sn/hız 5");

    expect(
        result.text.slice(
            mode.position.offset,
            mode.position.offset +
            mode.position.length,
        ),
    ).toBe("Hamur/3 dk");

    expect(tts.data).toEqual({
      time: 5,
      speed: "5",
    });

    expect(mode.data).toEqual({
      time: 180,
    });
  });
});
