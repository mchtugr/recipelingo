import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getUiLocale,
  localizedI18n,
  setUiLocale,
  toGeneratedMessageKey,
} from "./ui-locale";
import { resolveTargetLanguage } from "./translation/languages";

const catalogs: Record<string, Record<string, { message: string }>> = {
  en: {
    translator_modal_title: { message: "Translate recipe" },
    translator_actions_importAndTranslate: {
      message: "Import & translate",
    },
    translator_progress_labelPercent: {
      message: "Translation progress: {percent}%",
    },
    manifest_name: { message: "RecipeLingo" },
  },
  tr: {
    translator_modal_title: { message: "Tarifi çevir" },
    translator_actions_importAndTranslate: {
      message: "İçe aktar ve çevir",
    },
    translator_progress_labelPercent: {
      message: "Çeviri ilerlemesi: yüzde {percent}",
    },
  },
  de: { translator_modal_title: { message: "Rezept übersetzen" } },
  fr: { translator_modal_title: { message: "Traduire la recette" } },
  es: { translator_modal_title: { message: "Traducir receta" } },
  it: { translator_modal_title: { message: "Traduci la ricetta" } },
};

describe("injected UI locale", () => {
  beforeEach(() => {
    vi.stubGlobal("browser", {
      runtime: { getURL: (path: string) => path },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        const locale = path.match(/_locales\/(\w+)\//)?.[1] ?? "en";
        return {
          ok: true,
          json: async () => catalogs[locale] ?? {},
        };
      }),
    );
  });

  it("converts dotted WXT keys to generated Chrome keys", () => {
    expect(toGeneratedMessageKey("translator.actions.importAndTranslate")).toBe(
      "translator_actions_importAndTranslate",
    );
  });

  it("resolves Turkish nested keys from the page-locale catalog", async () => {
    await setUiLocale("tr-TR");
    expect(getUiLocale()).toBe("tr");
    expect(localizedI18n.t("translator.actions.importAndTranslate")).toBe(
      "İçe aktar ve çevir",
    );
    expect(localizedI18n.t("translator.modal.title")).toBe("Tarifi çevir");
  });

  it("supports top-level generated keys and named substitutions", async () => {
    await setUiLocale("tr");
    expect(localizedI18n.t("manifest.name")).toBe("RecipeLingo");
    expect(
      localizedI18n.t("translator.progress.labelPercent", { percent: 42 }),
    ).toBe("Çeviri ilerlemesi: yüzde 42");
  });

  it.each([
    ["de-DE", "Rezept übersetzen"],
    ["fr-FR", "Traduire la recette"],
    ["es-ES", "Traducir receta"],
    ["it-CH", "Traduci la ricetta"],
  ])(
    "continues resolving %s from its own catalog",
    async (locale, expected) => {
      await setUiLocale(locale);
      expect(localizedI18n.t("translator.modal.title")).toBe(expected);
    },
  );

  it("falls back to English when the selected catalog lacks a key", async () => {
    await setUiLocale("tr");
    expect(localizedI18n.t("translator.modal.title")).toBe("Tarifi çevir");
    expect(localizedI18n.t("manifest.name")).toBe("RecipeLingo");
  });

  it("returns an explicit fallback and warns for a missing key", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await setUiLocale("tr");
    expect(localizedI18n.t("translator.notInCatalog")).toBe(
      "[Missing translation: translator.notInCatalog]",
    );
    expect(warning).toHaveBeenCalledWith(
      "Missing RecipeLingo message: translator.notInCatalog",
    );
    warning.mockRestore();
  });

  it("does not use the extension/browser locale for injected UI", async () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    await setUiLocale("tr");
    expect(localizedI18n.t("translator.actions.importAndTranslate")).toBe(
      "İçe aktar ve çevir",
    );
  });

  it("keeps the page UI locale independent from the stored target", async () => {
    await setUiLocale("it-CH");
    expect(getUiLocale()).toBe("it");
    expect(
      resolveTargetLanguage({ routeLocale: "it-CH", storedTarget: "tr" }),
    ).toEqual({ language: "tr", reason: "stored-target" });
  });
});
