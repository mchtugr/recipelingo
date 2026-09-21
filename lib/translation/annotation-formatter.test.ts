import {describe, expect, it} from "vitest";
import type {ModeAnnotation, TtsAnnotation} from "../cookidoo/types";
import {
  getAnnotationFormatter,
  trAnnotationFormatter,
} from "./annotation-formatters";

const tts = (data: TtsAnnotation["data"]): TtsAnnotation =>
  ({type: "TTS", position: {offset: 0, length: 1}, data});
const mode = (name: string, data: ModeAnnotation["data"]): ModeAnnotation =>
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
    expect(() => trAnnotationFormatter.formatMode(mode("rice-cooker", {})))
      .toThrow("Unsupported MODE annotation: rice-cooker");
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
