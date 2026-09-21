import type {ModeAnnotation, TtsAnnotation} from "../../cookidoo/types";

export interface AnnotationFormatter {
  formatTts(annotation: TtsAnnotation): string;
  formatMode(annotation: ModeAnnotation): string;
}
