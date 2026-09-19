import { describe, expect, it } from "vitest";

import {
  containsAnnotationMarker,
  createAnnotationMarker,
  extractAnnotationMarkers,
  validateAnnotationMarkers,
} from "./markers";

describe("annotation markers", () => {
  it("creates numeric angle-bracket markers", () => {
    expect(
        [0, 1, 25].map(createAnnotationMarker),
    ).toEqual([
      "<0>",
      "<1>",
      "<25>",
    ]);
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])(
      "rejects invalid marker index %s",
      (index) => {
        expect(() =>
            createAnnotationMarker(index),
        ).toThrow(RangeError);
      },
  );

  it("extracts markers in text order", () => {
    expect(
        extractAnnotationMarkers(
            "a <2> b <0> <2>",
        ),
    ).toEqual([
      "<2>",
      "<0>",
      "<2>",
    ]);
  });

  describe("containsAnnotationMarker", () => {
    it("returns true when text contains a numeric marker", () => {
      expect(
          containsAnnotationMarker(
              "Mix for <0>.",
          ),
      ).toBe(true);

      expect(
          containsAnnotationMarker(
              "Use <123> here.",
          ),
      ).toBe(true);
    });

    it("returns false when text has no marker", () => {
      expect(
          containsAnnotationMarker(
              "Mix for 5 minutes.",
          ),
      ).toBe(false);
    });

    it("does not treat arbitrary angle-bracket text as a marker", () => {
      expect(
          containsAnnotationMarker(
              "Use <speed> here.",
          ),
      ).toBe(false);
    });
  });

  it("accepts preserved markers and zero-marker text", () => {
    expect(
        validateAnnotationMarkers(
            "<0> <1>",
            "text <0> <1>",
        ).valid,
    ).toBe(true);

    expect(
        validateAnnotationMarkers(
            "plain",
            "translated",
        ),
    ).toMatchObject({
      sourceMarkers: [],
      translatedMarkers: [],
      valid: true,
    });
  });

  it("detects missing and duplicated occurrences, including repeated source markers", () => {
    expect(
        validateAnnotationMarkers(
            "<0> <1> <2>",
            "<0> <1>",
        ).missingMarkers,
    ).toEqual(["<2>"]);

    expect(
        validateAnnotationMarkers(
            "<0> <1> <2>",
            "<0> <1> <1> <2>",
        ).duplicatedMarkers,
    ).toEqual(["<1>"]);

    expect(
        validateAnnotationMarkers(
            "<0> <0> <1>",
            "<0> <1>",
        ).missingMarkers,
    ).toEqual(["<0>"]);

    expect(
        validateAnnotationMarkers(
            "<0>",
            "<0> <0>",
        ).duplicatedMarkers,
    ).toEqual(["<0>"]);

    expect(
        validateAnnotationMarkers(
            "<0>",
            "<0> <9>",
        ).duplicatedMarkers,
    ).toEqual(["<9>"]);

    expect(
        validateAnnotationMarkers(
            "<0>",
            "none",
        ).valid,
    ).toBe(false);
  });

  it("detects changed order", () => {
    expect(
        validateAnnotationMarkers(
            "<0> <1> <2>",
            "<0> <2> <1>",
        ),
    ).toMatchObject({
      orderChanged: true,
      valid: false,
    });
  });
});