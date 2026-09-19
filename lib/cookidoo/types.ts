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

export interface Annotation {
  type: string;

  position: {
    offset: number;
    length: number;
  };

  data?: unknown;

  [key: string]: unknown;
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