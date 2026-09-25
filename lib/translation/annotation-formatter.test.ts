import {describe, expect, it} from "vitest";
import type {ModeAnnotation, ModePower, TtsAnnotation} from "../cookidoo/types";
import {
  ANNOTATION_FORMATTERS,
  ANNOTATION_MESSAGES,
  createAnnotationFormatter,
  getAnnotationFormatter,
  trAnnotationFormatter,
} from "./annotation-formatters";

const tts = (data: TtsAnnotation["data"]): TtsAnnotation =>
  ({type: "TTS", position: {offset: 0, length: 1}, data});
const mode = (name: string, data?: ModeAnnotation["data"]): ModeAnnotation =>
  ({type: "MODE", name, position: {offset: 0, length: 1}, data});

describe("trAnnotationFormatter", () => {
  it.each([
    [{time: 5, speed: "5"}, "5 sn/hız 5"],
    [{time: 720, temperature: {value: "100", unit: "C"}, direction: "CCW", speed: "0.5"}, "12 dk/100°C/ters yön/hız 0.5"],
    [{time: 600, temperature: {value: "varoma"}, speed: "1"}, "10 dk/Varoma/hız 1"],
    [{time: 90}, "90 sn"],
    [{time: 60}, "1 dk"],
    [{temperature: {value: "212", unit: "F"}}, "212°F"],
    [{direction: "CW", speed: "01.5"}, "hız 01.5"],
    [{speed: "5"}, "hız 5"],
  ] as const)("formats TTS %j", (data, expected) => {
    expect(trAnnotationFormatter.formatTts(tts(data))).toBe(expected);
  });

  it.each([
    ["dough", {time: 180}, "Hamur/3 dk"],
    ["turbo", {time: 1, pulseCount: 1}, "Turbo/1 sn/1 kez"],
    ["turbo", {time: 1}, "Turbo/1 sn"],
  ] as const)("formats %s mode", (name, data, expected) => {
    expect(trAnnotationFormatter.formatMode(mode(name, data))).toBe(expected);
  });

  it("rejects unsupported values", () => {
    expect(trAnnotationFormatter.formatMode(mode("rice-cooker", {time: 60})))
      .toBe("rice-cooker");
    expect(() => trAnnotationFormatter.formatTts(tts({direction: "LEFT" as "CW"})))
      .toThrow("Unsupported TTS direction: LEFT");
  });

  it.each([-1, 1.5, Infinity, NaN])("rejects invalid time %s", (time) => {
    expect(() => trAnnotationFormatter.formatTts(tts({time}))).toThrow("Invalid annotation time");
  });

  it("is resolved for Turkish", () => {
    expect(getAnnotationFormatter("tr")).toBe(trAnnotationFormatter);
  });
});

describe("shared annotation formatter", () => {
  it("accepts optional MODE data and both verified browning power values", () => {
    const powers: ModePower[] = ["Intense", "Gentle"];

    expect(mode("egg_boiler")).toMatchObject({name: "egg_boiler", data: undefined});
    for (const power of powers) {
      const annotation = mode("browning", {
        time: 300,
        temperature: {value: "160", unit: "C"},
        power,
      });
      expect(annotation.data?.power).toBe(power);
      expect(getAnnotationFormatter("en").formatMode(annotation))
        .toBe("browning/5 min/160°C");
    }
  });

  it("uses only the verified visible fields for blend and warm_up", () => {
    const formatter = getAnnotationFormatter("en");

    expect(formatter.formatMode(mode("blend", {time: 60, speed: "10"})))
      .toBe("Blend/1 min");
    expect(formatter.formatMode(mode("warm_up", {
      temperature: {value: "37", unit: "C"},
      speed: "2",
    }))).toBe("Warm Up/37°C");
  });

  it("formats sugar_stages with optional time and keeps open cooking unchanged", () => {
    const formatter = getAnnotationFormatter("en");

    expect(formatter.formatMode(mode("sugar_stages"))).toBe("sugar_stages");
    expect(formatter.formatMode(mode("sugar_stages", {time: 1320})))
      .toBe("sugar_stages/22 min");
    expect(formatter.formatMode(mode("open cooking", {
      time: 2700,
      temperature: {value: "100", unit: "C"},
    }))).toBe("open cooking/45 min/100°C");
  });

  it.each([
    ["slicing", "Slicing \uE037/Thin", "slicing \uE037/Thin"],
    ["slicing", "Slicing \uE037/Thick", "slicing \uE037/Thick"],
    ["grating", "Grating \uE036/Thin", "grating \uE036/Thin"],
    ["grating", "Grating \uE036/Thick", "grating \uE036/Thick"],
    ["slicing", "Dilimleme \uE037/İnce", "slicing \uE037/İnce"],
  ] as const)("preserves %s source variant from %s", (name, sourceText, expected) => {
    const glyph = sourceText.match(/[\uE000-\uF8FF]/)?.[0] ?? "";
    expect(getAnnotationFormatter("en").formatMode(mode(name), {
      sourceText,
      glyphs: [glyph],
    })).toBe(expected);
  });

  it("formats every confirmed MODE shape with source glyphs in every language", () => {
    const cases = [
      {name: "dough", data: {time: 10}, glyph: "\uE001", suffix: "/10"},
      {name: "turbo", data: {time: 2}, glyph: "\uE00B", suffix: "/2"},
      {name: "blend", data: {time: 30, speed: "6"}, glyph: "\uE01E", suffix: "/30"},
      {name: "warm_up", data: {temperature: {value: "65", unit: "C"}, speed: "soft"}, glyph: "\uE019", suffix: "/65°C"},
      {name: "rice_cooker", data: undefined, glyph: "\uE00D", suffix: ""},
    ] as const;
    for (const [language, messages] of Object.entries(ANNOTATION_MESSAGES)) {
      const formatter = getAnnotationFormatter(language as keyof typeof ANNOTATION_MESSAGES);
      for (const {name, data, glyph, suffix} of cases) {
        const result = formatter.formatMode(mode(name, data),
          {sourceText: glyph, glyphs: [glyph]});
        const timeUnit = language === "tr" ? " sn"
          : language === "en" || language === "it" ? " sec"
            : language === "de" ? " Sek."
              : " s";
        expect(result).toBe(`${messages.modes[name]} ${glyph}${suffix}${suffix && name !== "warm_up" ? timeUnit : ""}`);
        if (name === "blend") expect(result).not.toContain("6");
        if (name === "warm_up") expect(result).not.toContain("soft");
      }
      expect(formatter.formatMode(mode("future_mode", undefined),
        {sourceText: "\uE027", glyphs: ["\uE027"]})).toBe("future_mode \uE027");
    }
  });
  it("uses exactly the enabled dictionary languages as the registry", () => {
    expect(Object.keys(ANNOTATION_MESSAGES)).toEqual(["tr", "en", "de", "fr", "es", "it"]);
    expect(Object.keys(ANNOTATION_FORMATTERS)).toEqual(Object.keys(ANNOTATION_MESSAGES));
    expect(Object.keys(ANNOTATION_MESSAGES)).not.toEqual(
      expect.arrayContaining(["pl", "pt", "nl", "cs", "el"]),
    );
  });

  it.each([
    ["tr", "12 dk/100°C/ters yön/hız 0.5", "Hamur/3 dk", "Turbo/1 sn/1 kez"],
    ["en", "12 min/100°C/reverse/speed 0.5", "Dough/3 min", "Turbo/1 sec/1 time"],
    ["de", "12 Min./100°C/Linkslauf/Stufe 0.5", "Teig/3 Min.", "Turbo/1 Sek./1 Mal"],
    ["fr", "12 min/100°C/sens inverse/vitesse 0.5", "Pétrin/3 min", "Turbo/1 s/1 fois"],
    ["es", "12 min/100°C/giro inverso/velocidad 0.5", "Amasar/3 min", "Turbo/1 s/1 vez"],
    ["it", "12 min/100°C/antiorario/velocità 0.5", "Impasto/3 min", "Turbo/1 sec/1 volta"],
  ] as const)("formats %s golden annotations", (language, ttsDisplay, dough, turbo) => {
    const formatter = getAnnotationFormatter(language);
    expect(formatter.formatTts(tts({
      time: 720,
      temperature: {value: "100", unit: "C"},
      direction: "CCW",
      speed: "0.5",
    }))).toBe(ttsDisplay);
    expect(formatter.formatMode(mode("dough", {time: 180}))).toBe(dough);
    expect(formatter.formatMode(mode("turbo", {time: 1, pulseCount: 1}))).toBe(turbo);
  });

  it("owns structure, validation, Varoma, and unknown-mode fallback centrally", () => {
    const formatter = createAnnotationFormatter(ANNOTATION_MESSAGES.en);
    expect(formatter.formatTts(tts({time: 90}))).toBe("90 sec");
    expect(formatter.formatTts(tts({temperature: {value: "varoma"}}))).toBe("Varoma");
    expect(formatter.formatMode(mode("future_mode", {
      time: 60,
      temperature: {value: "100", unit: "C"},
      speed: "10",
      power: "Intense",
      opaque: {keep: true},
    }))).toBe("future_mode");
    expect(formatter.formatMode(mode("__proto__", {
      time: 60,
      temperature: {value: "100", unit: "C"},
    }), {
      sourceText: "\uE027",
      glyphs: ["\uE027"],
    })).toBe("__proto__ \uE027");
    expect(formatter.formatMode(mode("turbo", {pulseCount: 2}))).toBe("Turbo/2 times");
    expect(() => formatter.formatMode(mode("turbo", {pulseCount: -1})))
      .toThrow("Invalid MODE pulse count");
  });

  it("does not mutate annotation data in any language", () => {
    const annotation = tts({time: 720, temperature: {value: "100", unit: "C"}, direction: "CCW", speed: "0.5", opaque: {keep: true}});
    const snapshot = structuredClone(annotation);
    for (const formatter of Object.values(ANNOTATION_FORMATTERS)) formatter.formatTts(annotation);
    expect(annotation).toEqual(snapshot);
  });
});
