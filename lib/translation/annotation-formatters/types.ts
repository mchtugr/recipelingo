import type {ModeAnnotation, TtsAnnotation} from "../../cookidoo/types";

export interface AnnotationFormatter {
  formatTts(annotation: TtsAnnotation, context?: AnnotationFormatContext): string;
  formatMode(annotation: ModeAnnotation, context?: AnnotationFormatContext): string;
}

export interface AnnotationFormatContext {
  sourceText: string;
  glyphs: readonly string[];
}

export interface AnnotationMessages {
  units: {second: string; minute: string};
  labels: {speed: string; reverse: string};
  modes: Record<"dough" | "turbo" | "blend" | "warm_up" | "rice_cooker", string>;
  formatCount(count: number): string;
}
