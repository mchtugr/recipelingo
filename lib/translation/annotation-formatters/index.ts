import {trAnnotationFormatter} from "./tr";
import type {AnnotationFormatter} from "./types";

export type {AnnotationFormatter} from "./types";
export {trAnnotationFormatter} from "./tr";

export const ANNOTATION_FORMATTERS = {
  tr: trAnnotationFormatter,
} as const;

export type SupportedAnnotationLanguage = keyof typeof ANNOTATION_FORMATTERS;

export function getAnnotationFormatter(
  language: SupportedAnnotationLanguage,
): AnnotationFormatter {
  return ANNOTATION_FORMATTERS[language];
}

export const SUPPORTED_ANNOTATION_LANGUAGES = Object.freeze(
  Object.keys(ANNOTATION_FORMATTERS) as SupportedAnnotationLanguage[],
);
