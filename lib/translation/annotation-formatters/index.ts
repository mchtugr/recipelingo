import {createAnnotationFormatter} from "./formatter";
import {ANNOTATION_MESSAGES, type SupportedAnnotationLanguage} from "./messages";
import type {AnnotationFormatter} from "./types";

export type {AnnotationFormatter, AnnotationMessages} from "./types";
export {createAnnotationFormatter} from "./formatter";
export {ANNOTATION_MESSAGES} from "./messages";
export type {SupportedAnnotationLanguage} from "./messages";

export const ANNOTATION_FORMATTERS = {
  tr: createAnnotationFormatter(ANNOTATION_MESSAGES.tr),
  en: createAnnotationFormatter(ANNOTATION_MESSAGES.en),
  de: createAnnotationFormatter(ANNOTATION_MESSAGES.de),
  fr: createAnnotationFormatter(ANNOTATION_MESSAGES.fr),
  es: createAnnotationFormatter(ANNOTATION_MESSAGES.es),
  it: createAnnotationFormatter(ANNOTATION_MESSAGES.it),
} satisfies Record<SupportedAnnotationLanguage, AnnotationFormatter>;

export const trAnnotationFormatter = ANNOTATION_FORMATTERS.tr;
export const enAnnotationFormatter = ANNOTATION_FORMATTERS.en;
export const deAnnotationFormatter = ANNOTATION_FORMATTERS.de;
export const frAnnotationFormatter = ANNOTATION_FORMATTERS.fr;
export const esAnnotationFormatter = ANNOTATION_FORMATTERS.es;
export const itAnnotationFormatter = ANNOTATION_FORMATTERS.it;

export function getAnnotationFormatter(
  language: SupportedAnnotationLanguage,
): AnnotationFormatter {
  return ANNOTATION_FORMATTERS[language];
}

export const SUPPORTED_ANNOTATION_LANGUAGES = Object.freeze(
  Object.keys(ANNOTATION_MESSAGES) as SupportedAnnotationLanguage[],
);
