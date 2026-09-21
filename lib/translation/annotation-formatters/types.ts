import type {ModeAnnotation, TtsAnnotation} from "../../cookidoo/types";

export interface AnnotationFormatter {
  formatTts(annotation: TtsAnnotation): string;
  formatMode(annotation: ModeAnnotation): string;
}

export interface AnnotationMessages {
  units: {second: string; minute: string};
  labels: {speed: string; reverse: string};
  modes: {dough: string; turbo: string};
  formatCount(count: number): string;
}
