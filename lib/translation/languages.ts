import { SUPPORTED_ANNOTATION_LANGUAGES } from "./annotation-formatters";

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

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];
export type SourceLanguage = "auto" | TranslationLanguage;

export const SUPPORTED_TARGET_LANGUAGES = SUPPORTED_ANNOTATION_LANGUAGES;
export type SupportedTargetLanguage =
  (typeof SUPPORTED_TARGET_LANGUAGES)[number];

export const COMING_SOON_TARGET_LANGUAGES = ["pl", "pt"] as const;

export type TargetLanguageResolutionReason =
  | "stored-target"
  | "route-locale"
  | "ui-locale"
  | "english-fallback"
  | "unsupported-stored-target"
  | "unsupported-route-locale";

export interface TargetLanguageResolution {
  language: SupportedTargetLanguage;
  reason: TargetLanguageResolutionReason;
  unsupportedLanguage?: string;
}

export function normalizeLocaleLanguage(locale: string): string | undefined {
  const normalized = locale.trim().replace(/_/g, "-");

  if (/^zh-(hans|cn|sg)(?:-|$)/i.test(normalized)) {
    return "zh-Hans";
  }

  if (/^zh-(hant|tw|hk|mo)(?:-|$)/i.test(normalized)) {
    return "zh-Hant";
  }

  const language = normalized.split("-", 1)[0]?.toLowerCase();
  return language || undefined;
}

export function getLanguageFromLocale(
  locale: string,
): TranslationLanguage | undefined {
  const language = normalizeLocaleLanguage(locale);
  return TRANSLATION_LANGUAGES.some((code) => code === language)
    ? (language as TranslationLanguage)
    : undefined;
}

export function isSupportedTargetLanguage(
  value: string,
): value is SupportedTargetLanguage {
  return (SUPPORTED_TARGET_LANGUAGES as readonly string[]).includes(value);
}

export function resolveTargetLanguage({
  storedTarget,
  routeLocale,
  uiLocale,
  supportedTargets = SUPPORTED_TARGET_LANGUAGES,
}: {
  storedTarget?: string;
  routeLocale: string;
  uiLocale?: string;
  supportedTargets?: readonly SupportedTargetLanguage[];
}): TargetLanguageResolution {
  const isSupported = (value: string): value is SupportedTargetLanguage =>
    supportedTargets.includes(value as SupportedTargetLanguage);

  if (storedTarget && isSupported(storedTarget)) {
    return { language: storedTarget, reason: "stored-target" };
  }

  const unsupportedStoredTarget = storedTarget
    ? normalizeLocaleLanguage(storedTarget)
    : undefined;
  const routeLanguage = normalizeLocaleLanguage(routeLocale);

  if (!unsupportedStoredTarget && routeLanguage && isSupported(routeLanguage)) {
    return { language: routeLanguage, reason: "route-locale" };
  }

  const uiLanguage = uiLocale ? normalizeLocaleLanguage(uiLocale) : undefined;
  const language =
    routeLanguage && isSupported(routeLanguage)
      ? routeLanguage
      : uiLanguage && isSupported(uiLanguage)
        ? uiLanguage
        : "en";

  if (unsupportedStoredTarget) {
    return {
      language,
      reason: "unsupported-stored-target",
      unsupportedLanguage: unsupportedStoredTarget,
    };
  }

  if (routeLanguage && !isSupported(routeLanguage)) {
    return {
      language,
      reason: "unsupported-route-locale",
      unsupportedLanguage: routeLanguage,
    };
  }

  return {
    language,
    reason:
      uiLanguage && isSupported(uiLanguage) ? "ui-locale" : "english-fallback",
  };
}
