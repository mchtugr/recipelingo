import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("#i18n", () => ({
  i18n: { t: (key: string) => key },
}));

import TranslatorPanel, { appendInstructionProgress } from "./TranslatorPanel";

describe("appendInstructionProgress", () => {
  it("keeps dynamic instruction counts numeric", () => {
    expect(appendInstructionProgress("Translating steps…", 7, 12)).toBe(
      "Translating steps… 7 / 12",
    );
  });

  it("omits counts before progress starts", () => {
    expect(appendInstructionProgress("Translating steps…", 0, 12)).toBe(
      "Translating steps…",
    );
  });
});

describe("target language selector", () => {
  it("shows Polish and Portuguese as disabled coming-soon options", () => {
    const html = renderToStaticMarkup(
      createElement(TranslatorPanel, {
        page: {
          type: "public-recipe",
          hostname: "cookidoo.com.tr",
          locale: "pl-PL",
          recipeId: "r123",
        },
      }),
    );

    expect(html).toMatch(/<option value="pl" disabled="">/);
    expect(html).toMatch(/<option value="pt" disabled="">/);
  });
});
