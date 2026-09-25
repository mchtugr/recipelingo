export interface TranslationRequest {
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
}

export interface TranslationProgress {
  loaded: number;
  percent: number;
}

export interface TranslateOptions {
  onDownloadProgress?: (progress: TranslationProgress) => void;
}

type TranslatorSession = Pick<Translator, "translate" | "destroy">;

export interface TranslatorApi {
  availability: typeof Translator.availability;
  create: (options: TranslatorCreateOptions) => Promise<TranslatorSession>;
}

export async function translateWithChrome(
  request: TranslationRequest,
  options: TranslateOptions = {},
  api: TranslatorApi | null | undefined = typeof Translator === "undefined"
    ? undefined
    : Translator,
): Promise<string> {
  if (!api) {
    throw new Error("Chrome Translator API is not available");
  }

  const { sourceLanguage, targetLanguage, text } = request;

  const normalizedSourceLanguage = sourceLanguage.trim();

  const normalizedTargetLanguage = targetLanguage.trim();

  if (!normalizedSourceLanguage || !normalizedTargetLanguage || !text.trim()) {
    throw new Error(
      "Source language, target language, and text must be non-empty",
    );
  }

  const languagePair = {
    sourceLanguage: normalizedSourceLanguage,
    targetLanguage: normalizedTargetLanguage,
  };
  const availability = await api.availability(languagePair);
  switch (availability) {
    case "unavailable":
      throw new Error(
        `Translation is unavailable for ${sourceLanguage} → ${targetLanguage}`,
      );
    case "downloadable":
    case "downloading":
    case "available":
      break;

    default:
      throw new Error(
        `Unexpected Translator availability state: ${String(availability)}`,
      );
  }

  const translator = await api.create({
    ...languagePair,
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        const loaded = event.loaded;
        options.onDownloadProgress?.({
          loaded,
          percent: Math.min(100, Math.max(0, Math.round(loaded * 100))),
        });
      });
    },
  });

  try {
    return await translator.translate(text);
  } finally {
    translator.destroy();
  }
}
