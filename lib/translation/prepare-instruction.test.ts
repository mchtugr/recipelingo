import {describe, expect, it} from "vitest";
import type {Annotation, Instruction} from "../cookidoo/types";
import {prepareInstruction} from "./prepare-instruction";

const tts = (offset: number, length: number): Annotation => ({
    type: "TTS", position: {offset, length},
    data: {speed: "0.5", temperature: {value: "100", unit: "C"}},
});
const mode = (offset: number, length: number): Annotation => ({
    type: "MODE", name: "dough", position: {offset, length}, data: {time: 180},
});
const ingredient = (offset: number, length: number): Annotation => ({
    type: "INGREDIENT", position: {offset, length}, data: {nested: [1]},
});
const step = (text: string, annotations: Annotation[] = []): Instruction => ({
    type: "STEP", text, annotations,
});

describe("prepareInstruction", () => {
    it("leaves text unchanged without protected annotations", () => {
        expect(prepareInstruction(step("abc", [ingredient(0, 2)])))
            .toEqual({text: "abc", protectedAnnotations: []});
    });

    it("protects one TTS and captures exact source text", () => {
        const annotation = tts(4, 14);
        expect(prepareInstruction(step("Mix 5 Sek./Stufe 5 now", [annotation])))
            .toEqual({
                text: "Mix <0> now", protectedAnnotations: [{
                    marker: "<0>", originalText: "5 Sek./Stufe 5", annotation,
                }]
            });
    });

    it("protects one MODE", () => {
        expect(prepareInstruction(step("Use dough mode", [mode(4, 5)])).text)
            .toBe("Use <0> mode");
    });

    it("numbers unsorted protected annotations left to right and preserves later offsets", () => {
        const result = prepareInstruction(step("aaa LONG bb MEDIUM cc SHORT end", [
            mode(22, 5), tts(4, 4), ingredient(0, 3), tts(12, 6),
        ]));
        expect(result.text).toBe("aaa <0> bb <1> cc <2> end");
        expect(result.protectedAnnotations.map((item) => item.originalText))
            .toEqual(["LONG", "MEDIUM", "SHORT"]);
    });

    it("does not mutate input and deep-clones protected annotations", () => {
        const original = step("abcd", [tts(0, 2), ingredient(2, 2)]);
        const snapshot = structuredClone(original);
        const result = prepareInstruction(original);
        (result.protectedAnnotations[0]!.annotation.data as { speed: string }).speed = "9";
        result.protectedAnnotations[0]!.annotation.position.offset = 3;
        expect(original).toEqual(snapshot);
        expect(original.annotations).toHaveLength(2);
    });

    it.each([
        [-1, 2],
        [0, 0],
        [2, 3],
        [0.5, 1],
        [Number.NaN, 1],
        [0, Number.NaN],
        [Number.POSITIVE_INFINITY, 1],
    ])("rejects invalid range offset %s length %s", (offset, length) => {
        expect(() => prepareInstruction(step("abcd", [tts(offset, length)])))
            .toThrow(`Invalid TTS annotation range: offset ${offset}, length ${length}`);
    });

    it("rejects overlapping protected ranges", () => {
        expect(() => prepareInstruction(step("abcdefghij", [tts(1, 5), mode(4, 4)])))
            .toThrow("Overlapping TTS and MODE annotation ranges");
    });

    it("rejects marker collisions before preparing annotations", () => {
        expect(() =>
            prepareInstruction(
                step(
                    "Mix <0> and 5 sec",
                    [tts(12, 5)],
                ),
            ),
        ).toThrow(
            "Instruction already contains reserved annotation marker syntax",
        );
    });
});
