export const TRANSLATION_LANGUAGES = [
  {code: "tr", label: "Türkçe"},
  {code: "de", label: "Almanca"},
  {code: "en", label: "İngilizce"},
  {code: "es", label: "İspanyolca"},
  {code: "fr", label: "Fransızca"},
  {code: "it", label: "İtalyanca"},
  {code: "pl", label: "Lehçe"},
  {code: "pt", label: "Portekizce"},
  {code: "nl", label: "Felemenkçe"},
  {code: "cs", label: "Çekçe"},
  {code: "el", label: "Yunanca"},
] as const;

export type TranslationLanguage = typeof TRANSLATION_LANGUAGES[number]["code"];
export type SourceLanguage = "auto" | TranslationLanguage;

// Expand only after the protected annotation formatter supports the language.
export const SUPPORTED_TARGET_LANGUAGES = ["tr"] as const;
export type SupportedTargetLanguage = typeof SUPPORTED_TARGET_LANGUAGES[number];

export function getLanguageFromLocale(locale: string): TranslationLanguage | undefined {
  const language = locale.trim().split(/[-_]/, 1)[0]?.toLowerCase();
  return TRANSLATION_LANGUAGES.some(({code}) => code === language)
    ? language as TranslationLanguage
    : undefined;
}

export function isSupportedTargetLanguage(value: string): value is SupportedTargetLanguage {
  return (SUPPORTED_TARGET_LANGUAGES as readonly string[]).includes(value);
}

export function resolveTargetLanguage({
  locale,
  savedTargetLanguage,
}: {
  locale: string;
  savedTargetLanguage?: string;
}): SupportedTargetLanguage {
  if (savedTargetLanguage && isSupportedTargetLanguage(savedTargetLanguage)) {
    return savedTargetLanguage;
  }

  const routeLanguage = getLanguageFromLocale(locale);
  if (routeLanguage && isSupportedTargetLanguage(routeLanguage)) {
    return routeLanguage;
  }

  return SUPPORTED_TARGET_LANGUAGES[0];
}
