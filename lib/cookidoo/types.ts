/** JSON-compatible values returned by the Created Recipe API. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export interface Ingredient {
  type: "INGREDIENT";
  text: string;

  [key: string]: unknown;
}

export interface AnnotationPosition {
  offset: number;
  length: number;
}

export type Temperature =
  | { value: "varoma"; unit?: never }
  | { value: string; unit: "C" | "F" };

export interface TtsAnnotation {
  type: "TTS";
  position: AnnotationPosition;
  data: {
    time?: number;
    speed?: string;
    direction?: "CW" | "CCW";
    temperature?: Temperature;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ModeAnnotation {
  type: "MODE";
  name: string;
  position: AnnotationPosition;
  data: {
    time?: number;
    pulseCount?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface GenericAnnotation {
  type: string;
  position: AnnotationPosition;
  data?: unknown;
  [key: string]: unknown;
}

export type ProtectedCookingAnnotation = TtsAnnotation | ModeAnnotation;
export type Annotation = ProtectedCookingAnnotation | GenericAnnotation;

export function isProtectedCookingAnnotation(
  annotation: Annotation,
): annotation is ProtectedCookingAnnotation {
  return annotation.type === "TTS" || annotation.type === "MODE";
}

export interface Instruction {
  type: "STEP";
  text: string;
  annotations: Annotation[];

  missedUsages?: unknown[];

  [key: string]: unknown;
}

/**
 * GET response envelope.
 *
 * The `recipe` object itself must never be sent back
 * as the PATCH payload envelope.
 */
export interface CreatedRecipe {
  recipe: CreatedRecipeContent;

  [key: string]: unknown;
}

export interface CreatedRecipeContent {
  name: string;

  ingredients: Ingredient[];

  instructions: Instruction[];

  hints?: string;

  /*
   * Other API fields are intentionally left open
   * until we model them in later commits.
   */
  [key: string]: unknown;
}

/**
 * Fields allowed in the metadata PATCH body.
 *
 * These fields are sent at the JSON root.
 */
export interface RecipeMetadataPatch {
  name?: string;
  ingredients?: Ingredient[];
  hints?: string;
}

/**
 * Exact body shape for instruction PATCHes.
 */
export interface RecipeInstructionsPatch {
  instructions: Instruction[];
}
