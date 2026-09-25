import { describe, expect, it, vi } from "vitest";
import {
  getTargetLanguagePreference,
  setTargetLanguagePreference,
  type TargetLanguageStorage,
} from "./preferences";

function storage(value?: unknown): TargetLanguageStorage {
  return {
    get: vi.fn(async () =>
      value === undefined ? {} : { targetLanguage: value },
    ),
    set: vi.fn(async () => undefined),
  };
}

describe("target language preferences", () => {
  it("returns no preference when none is saved", async () => {
    expect(await getTargetLanguagePreference(storage())).toBeUndefined();
  });

  it("returns a saved string for the resolver to validate", async () => {
    expect(await getTargetLanguagePreference(storage("tr"))).toBe("tr");
    expect(await getTargetLanguagePreference(storage("invalid"))).toBe(
      "invalid",
    );
  });

  it("persists an explicit selection", async () => {
    const adapter = storage();
    await setTargetLanguagePreference("tr", adapter);
    expect(adapter.set).toHaveBeenCalledWith({ targetLanguage: "tr" });
  });

  it("surfaces storage failure for the UI to ignore without reverting state", async () => {
    const adapter = storage();
    vi.mocked(adapter.set).mockRejectedValueOnce(new Error("unavailable"));
    await expect(setTargetLanguagePreference("tr", adapter)).rejects.toThrow(
      "unavailable",
    );
  });
});
