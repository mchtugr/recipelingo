export interface AnnotationPosition {
    offset: number;
    length: number;
}

/* -------------------------------------------------------------------------- */
/* Recipe                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreatedRecipe {
    recipeId: string;

    authorId?: string;
    parentRecipeId?: string;

    modifiedAt?: string;
    createdAt?: string;

    status?: string;  // "ACTIVE"
    workStatus?: string; // "PRIVATE"

    recipeContent: RecipeContent;

    [key: string]: unknown;
}

export interface RecipeContent {
    name: string;

    image?: string;

    ingredients: Ingredient[];
    instructions: Instruction[];

    descriptiveAssets?: DescriptiveAsset[];

    isImageCopyrightOwned?: boolean;
    isBasedOn?: string;

    author?: RecipeAuthor;

    prepTime?: number;
    totalTime?: number;

    tools?: string[];

    yield?: RecipeYield;

    hints?: string;

    [key: string]: unknown;
}

export interface RecipeAuthor {
    type: string;
    name: string;

    [key: string]: unknown;
}

export interface RecipeYield {
    value: number;
    unitText: string;

    [key: string]: unknown;
}

export interface DescriptiveAsset {
    square?: string;
    portrait?: string;
    landscape?: string;

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Ingredients                                                                 */
/* -------------------------------------------------------------------------- */

export interface Ingredient {
    type: "INGREDIENT";
    text: string;

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Instructions                                                                */
/* -------------------------------------------------------------------------- */

export interface Instruction {
    type: "STEP";
    text: string;
    annotations: Annotation[];

    missedUsages?: unknown[];

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* TTS                                                                         */
/* -------------------------------------------------------------------------- */

export type Direction =
    | "CW"
    | "CCW";

export type Temperature =
    | {
    value: "varoma";
    unit?: never;
}
    | {
    value: string;
    unit: "C" | "F";
};

export interface TtsData {
    /** Duration in seconds. */
    time?: number;

    /** Thermomix blade speed, e.g. "1", "3.5", "5". */
    speed?: string;

    temperature?: Temperature;
    direction?: Direction;

    [key: string]: unknown;
}

export interface TtsAnnotation {
    type: "TTS";
    position: AnnotationPosition;
    data: TtsData;

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* MODE                                                                        */
/* -------------------------------------------------------------------------- */

export type KnownModeName =
    | "egg_boiler"
    | "blend"
    | "rice_cooker"
    | "sous_vide"
    | "slow_cook"
    | "browning"
    | "sugar_stages"
    | "fermentation"
    | "dough"
    | "thicken"
    | "open cooking"
    | "pre_clean"
    | "warm_up"
    | "kettle"
    | "peeler"
    | "turbo"
    | "slicing"
    | "grating"
    | "spiralizing";

export type ModeName = KnownModeName | (string & {});

export type ModePower =
    | "Intense"
    | "Gentle"
    | (string & {});

export interface ModeTemperature {
    value: string;
    unit?: "C" | "F";

    [key: string]: unknown;
}

export interface ModeData {
    time?: number;
    speed?: string;
    temperature?: ModeTemperature;
    power?: ModePower;
    pulseCount?: number;
    pulseCountMax?: number;

    [key: string]: unknown;
}

export interface ModeAnnotation {
    type: "MODE";

    /**
     * Known values include dough, turbo, blend, warm_up, rice_cooker, etc.
     *
     * Keep this open because Cookidoo may introduce additional modes and
     * the formatter decides which modes it can safely restore.
     */
    name: ModeName;

    position: AnnotationPosition;
    data?: ModeData;

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Ingredient annotations                                                      */
/* -------------------------------------------------------------------------- */

export interface VolumeAnnotation {
    type: "VOLUME";

    position: AnnotationPosition;

    data: {
        amount?: number;
        amountMax?: number;

        unit?: string;
        unitText?: string;

        [key: string]: unknown;
    };

    [key: string]: unknown;
}

export type IngredientDescription =
    | string
    | {
    text: string;
    annotations: VolumeAnnotation[];

    [key: string]: unknown;
};

export interface IngredientAnnotation {
    type:
        | "INGREDIENT"
        | "MISSED_INGREDIENT";

    position: AnnotationPosition;

    data: {
        description: IngredientDescription;

        notes?: string[];

        [key: string]: unknown;
    };

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Unknown annotations                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Forward-compatible fallback for Cookidoo annotation types we do not yet
 * understand.
 *
 * Translation logic must not assume these positions remain valid after
 * translating text.
 */
export interface GenericAnnotation {
    type: string;

    position?: AnnotationPosition;
    data?: unknown;

    [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Annotation unions                                                           */
/* -------------------------------------------------------------------------- */

export type ProtectedCookingAnnotation =
    | TtsAnnotation
    | ModeAnnotation;

export type Annotation =
    | TtsAnnotation
    | ModeAnnotation
    | IngredientAnnotation
    | GenericAnnotation;

export function isProtectedCookingAnnotation(
    annotation: Annotation,
): annotation is ProtectedCookingAnnotation {
    return (
        annotation.type === "TTS" ||
        annotation.type === "MODE"
    );
}

/* -------------------------------------------------------------------------- */
/* PATCH payloads                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Supported root-level metadata fields for Created Recipe PATCH requests.
 *
 * Do not wrap these inside `recipeContent`.
 */
export interface RecipeMetadataPatch {
    name?: string;
    ingredients?: Ingredient[];
    hints?: string;
}

/**
 * Exact instruction PATCH body.
 */
export interface RecipeInstructionsPatch {
    instructions: Instruction[];
}
