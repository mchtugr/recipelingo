import {
  translateWithChrome,
  type TranslateOptions,
} from "./chrome-translator";
import {
  validateAnnotationMarkers,
  type MarkerValidationResult,
} from "./markers";
import type {
  PreparedInstruction,
  ProtectedAnnotation,
} from "./prepare-instruction";

export interface TranslatedPreparedInstruction {
  text: string;
  protectedAnnotations: ProtectedAnnotation[];
  metadata?: PreparedInstruction["metadata"];
}

export interface TranslatePreparedInstructionOptions extends TranslateOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export type MarkerIntegrityStage = "prepared" | "translated";

export class AnnotationMarkerIntegrityError extends Error {
  readonly validation: MarkerValidationResult;
  readonly stage: MarkerIntegrityStage;

  constructor(stage: MarkerIntegrityStage, validation: MarkerValidationResult) {
    super(
      stage === "prepared"
        ? "Prepared instruction has inconsistent annotation markers"
        : "Translation changed protected annotation markers",
    );

    this.name = "AnnotationMarkerIntegrityError";
    this.stage = stage;
    this.validation = validation;
  }
}

export async function translatePreparedInstruction(
  prepared: PreparedInstruction,
  options: TranslatePreparedInstructionOptions,
  translate: typeof translateWithChrome = translateWithChrome,
): Promise<TranslatedPreparedInstruction> {
  const expectedMarkers = prepared.protectedAnnotations.map(
    ({ marker }) => marker,
  );
  const sourceValidation = validateAnnotationMarkers(
    expectedMarkers.join(" "),
    prepared.text,
  );
  if (!sourceValidation.valid) {
    throw new AnnotationMarkerIntegrityError("prepared", sourceValidation);
  }

  if (!prepared.text.trim()) {
    return {
      text: prepared.text,
      protectedAnnotations: structuredClone(prepared.protectedAnnotations),
      ...(prepared.metadata
        ? {
            metadata: structuredClone(prepared.metadata),
          }
        : {}),
    };
  }

  const text = await translate(
    {
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      text: prepared.text,
    },
    { onDownloadProgress: options.onDownloadProgress },
  );
  const validation = validateAnnotationMarkers(prepared.text, text);
  if (!validation.valid) {
    throw new AnnotationMarkerIntegrityError("translated", validation);
  }

  return {
    text,
    protectedAnnotations: structuredClone(prepared.protectedAnnotations),
    ...(prepared.metadata
      ? { metadata: structuredClone(prepared.metadata) }
      : {}),
  };
}
