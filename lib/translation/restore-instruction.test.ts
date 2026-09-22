import {describe, expect, it} from "vitest";
import type {ModeAnnotation, TtsAnnotation} from "../cookidoo/types";
import type {TranslatedPreparedInstruction} from "./translate-prepared-instruction";
import {restoreInstruction} from "./restore-instruction";
import {prepareInstruction} from "./prepare-instruction";
import {
  deAnnotationFormatter,
  enAnnotationFormatter,
  trAnnotationFormatter,
  type AnnotationFormatter,
} from "./annotation-formatters";

const tts = (marker: string, data: TtsAnnotation["data"] = {time: 5, speed: "5"}) => ({
  marker, originalText: "source", glyphs: [], annotation: {
    type: "TTS" as const, position: {offset: 99, length: 6}, data,
    extra: {keep: true},
  },
});
const mode = (
  marker: string,
  name = "dough",
  data: ModeAnnotation["data"] = name === "rice_cooker" ? undefined : {time: 180},
  glyphs: string[] = [],
) => ({
  marker, originalText: "source", glyphs, annotation: {
    type: "MODE" as const, name, position: {offset: 55, length: 6},
    data,
  },
});
const restore = (input: TranslatedPreparedInstruction) =>
  restoreInstruction(input, trAnnotationFormatter);

describe("restoreInstruction", () => {
  it.each([
    ["Hamur \uE001/10 sn", "MODE", "dough", {time: 10}, "Dough \uE001/10 sec", "Teig \uE001/10 Sek."],
    ["Turbo \uE00B/2 sn", "MODE", "turbo", {time: 2}, "Turbo \uE00B/2 sec", "Turbo \uE00B/2 Sek."],
    ["Karıştırma \uE01E/30 sn", "MODE", "blend", {time: 30}, "Blend \uE01E/30 sec", "Mixen \uE01E/30 Sek."],
    ["Isıtma \uE019/65°C", "MODE", "warm_up", {temperature: {value: "65", unit: "C"}, speed: "soft"}, "Warm Up \uE019/65°C", "Erwärmen \uE019/65°C"],
    ["Pilav Pişirici \uE00D", "MODE", "rice_cooker", undefined, "Rice Cooker \uE00D", "Reiskocher \uE00D"],
    ["Yeni Mod \uE027/5 dk", "MODE", "future_mode", {time: 300}, "future_mode \uE027/5 min", "future_mode \uE027/5 Min."],
    ["1 sn/hız \uE002", "TTS", "", {time: 1, speed: "soft"}, "1 sec/speed \uE002", "1 Sek./Stufe \uE002"],
    ["1 dk/\uE003/hız 8.5", "TTS", "", {time: 60, direction: "CCW", speed: "8.5"}, "1 min/\uE003/speed 8.5", "1 Min./\uE003/Stufe 8.5"],
    ["1 sn/\uE003/hız \uE002", "TTS", "", {time: 1, direction: "CCW", speed: "soft"}, "1 sec/\uE003/speed \uE002", "1 Sek./\uE003/Stufe \uE002"],
  ] as const)("preserves source glyphs in %s", (source, type, name, data, english, german) => {
    const annotation = type === "MODE"
      ? {type, name, data, position: {offset: 0, length: source.length}}
      : {type, data, position: {offset: 0, length: source.length}};
    const prepared = prepareInstruction({type: "STEP", text: source, annotations: [annotation]});
    expect(prepared.text).toBe("<0>");
    for (const [formatter, expected] of [[enAnnotationFormatter, english], [deAnnotationFormatter, german]] as const) {
      const result = restoreInstruction(prepared, formatter);
      expect(result.text).toBe(expected);
      expect(result.annotations[0]?.position).toEqual({offset: 0, length: expected.length});
      expect(result.annotations[0]?.data).toEqual(data);
    }
  });

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

  it.each([
    ["tr", "5 sn/hız 5"],
    ["en", "5 sec/speed 5"],
    ["de", "5 Sek./Stufe 5"],
  ])("preserves annotation data when restoring %s display text", (_language, display) => {
    const input: TranslatedPreparedInstruction = {
      text: "Before <0> after",
      protectedAnnotations: [tts("<0>", {
        time: 5,
        speed: "5",
        forwardCompatible: {nested: [1, 2, 3]},
      })],
    };
    const originalData = structuredClone(input.protectedAnnotations[0]!.annotation.data);
    const result = restoreInstruction(input, {
      formatTts: () => display,
      formatMode: () => "unused",
    });

    expect(result.annotations[0]!.data).toEqual(originalData);
    expect(result.annotations[0]!.position).toEqual({
      offset: "Before ".length,
      length: display.length,
    });
    expect(result.text).toBe(`Before ${display} after`);
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

  it("restores multiple MODE annotations independently", () => {
    const result = restore({
      text: "<0> <1>",
      protectedAnnotations: [
        mode("<0>", "rice_cooker", undefined, ["\uE00D"]),
        mode("<1>", "warm_up", {temperature: {value: "65", unit: "C"}, speed: "soft"}, ["\uE019"]),
      ],
    });

    expect(result.text).toBe("Pilav Pişirici \uE00D Isıtma \uE019/65°C");
    expect(result.annotations.map(({position}) => position)).toEqual([
      {offset: 0, length: "Pilav Pişirici \uE00D".length},
      {offset: "Pilav Pişirici \uE00D ".length, length: "Isıtma \uE019/65°C".length},
    ]);
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

  it("uses the source mode name as a safe fallback", () => {
    expect(restore({text: "<0>", protectedAnnotations: [mode("<0>", "rice-cooker")]}).text)
      .toBe("rice-cooker/3 dk");
  });

  it.each([
    [trAnnotationFormatter, "5 sn/hız 5 sonra Hamur/3 dk", [10, 10]],
    [deAnnotationFormatter, "5 Sek./Stufe 5 sonra Teig/3 Min.", [14, 11]],
  ] as const)("rebuilds multiple positions for different localized lengths", (formatter, text, lengths) => {
    const result = restoreInstruction({
      text: "<0> sonra <1>",
      protectedAnnotations: [tts("<0>"), mode("<1>")],
    }, formatter);
    expect(result.text).toBe(text);
    expect(result.annotations.map(({position}) => position)).toEqual([
      {offset: 0, length: lengths[0]},
      {offset: lengths[0] + " sonra ".length, length: lengths[1]},
    ]);
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
          glyphs: [],
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
          glyphs: [],
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
