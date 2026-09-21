import {
  SUPPORTED_ANNOTATION_LANGUAGES,
  type SupportedAnnotationLanguage,
} from "./annotation-formatters";

export const TRANSLATION_LANGUAGES = [
  "tr",
  "de",
  "en",
  "es",
  "fr",
  "it",
  "pl",
  "pt",
  "nl",
  "cs",
  "el",
] as const;

export type TranslationLanguage = typeof TRANSLATION_LANGUAGES[number];
export type SourceLanguage = "auto" | TranslationLanguage;

export const SUPPORTED_TARGET_LANGUAGES = SUPPORTED_ANNOTATION_LANGUAGES;
export type SupportedTargetLanguage = SupportedAnnotationLanguage;

export function getLanguageFromLocale(locale: string): TranslationLanguage | undefined {
  const language = locale.trim().split(/[-_]/, 1)[0]?.toLowerCase();
  return TRANSLATION_LANGUAGES.some((code) => code === language)
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

  const defaultLanguage = SUPPORTED_TARGET_LANGUAGES[0];
  if (!defaultLanguage) throw new Error("No supported target languages configured");
  return defaultLanguage;
}
