import {describe, expect, it, vi} from "vitest";
import {translateWithChrome, type TranslatorApi} from "./chrome-translator";

const request = {sourceLanguage: "de", targetLanguage: "tr", text: "Hallo"};

function fakeApi(availability: Awaited<ReturnType<TranslatorApi["availability"]>> = "available") {
  const destroy = vi.fn();
  const translate = vi.fn(async () => "Merhaba");
  const create = vi.fn(async (_options: Parameters<TranslatorApi["create"]>[0]) => ({translate, destroy}));
  const api: TranslatorApi = {
    availability: vi.fn(async () => availability),
    create,
  };
  return {api, create, translate, destroy};
}

describe("translateWithChrome", () => {
  it("rejects when the browser API is absent", async () => {
    await expect(
        translateWithChrome(
            request,
            {},
            null,
        ),
    ).rejects.toThrow(
        "Chrome Translator API is not available",
    );
  });

  it("checks availability with the requested language pair", async () => {
    const {api} = fakeApi();
    await translateWithChrome(request, {}, api);
    expect(api.availability).toHaveBeenCalledWith({sourceLanguage: "de", targetLanguage: "tr"});
  });

  it("rejects unavailable pairs without creating a translator", async () => {
    const {api, create} = fakeApi("unavailable");
    await expect(translateWithChrome(request, {}, api)).rejects.toThrow(
      "Translation is unavailable for de → tr",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["available", "downloadable", "downloading"] as const)(
    "creates, translates, and destroys when %s",
    async (availability) => {
      const {api, create, translate, destroy} = fakeApi(availability);
      await expect(translateWithChrome(request, {}, api)).resolves.toBe("Merhaba");
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        sourceLanguage: "de", targetLanguage: "tr", monitor: expect.any(Function),
      }));
      expect(translate).toHaveBeenCalledWith("Hallo");
      expect(destroy).toHaveBeenCalledOnce();
    },
  );

  it("forwards fractional download progress", async () => {
    const {api, create} = fakeApi("downloadable");
    const onDownloadProgress = vi.fn();
    await translateWithChrome(request, {onDownloadProgress}, api);
    const createOptions = create.mock.calls[0]![0];
    const monitor = new EventTarget();
    createOptions.monitor?.(monitor as CreateMonitor);
    monitor.dispatchEvent(Object.assign(new Event("downloadprogress"), {loaded: 0.42}));
    expect(onDownloadProgress).toHaveBeenCalledWith({loaded: 0.42, percent: 42});
  });

  it("destroys the translator when translation fails", async () => {
    const {api, translate, destroy} = fakeApi();
    translate.mockRejectedValueOnce(new Error("translation failed"));
    await expect(translateWithChrome(request, {}, api)).rejects.toThrow("translation failed");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([
    [
      {
        sourceLanguage: " ",
        targetLanguage: "tr",
        text: "Hallo",
      },
    ],
    [
      {
        sourceLanguage: "de",
        targetLanguage: " ",
        text: "Hallo",
      },
    ],
    [
      {
        sourceLanguage: "de",
        targetLanguage: "tr",
        text: " ",
      },
    ],
  ])(
      "rejects empty translation inputs",
      async (invalidRequest) => {
        const { api, create } =
            fakeApi();

        await expect(
            translateWithChrome(
                invalidRequest,
                {},
                api,
            ),
        ).rejects.toThrow(
            "non-empty",
        );

        expect(
            create,
        ).not.toHaveBeenCalled();
      },
  );

  it("normalizes surrounding whitespace in language tags", async () => {
    const { api } = fakeApi();

    await translateWithChrome(
        {
          sourceLanguage: " de ",
          targetLanguage: " tr ",
          text: "Hallo",
        },
        {},
        api,
    );

    expect(
        api.availability,
    ).toHaveBeenCalledWith({
      sourceLanguage: "de",
      targetLanguage: "tr",
    });
  });
});
