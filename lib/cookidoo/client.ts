import { isCookidooHostname } from "./domains";
import type {
  CreatedRecipe,
  Instruction,
  RecipeMetadataPatch,
} from "./types";

const FULL_RECIPE_MEDIA_TYPE =
    "application/vnd.vorwerk.customer-recipe.full+json";

export interface CookidooClientOptions {
  hostname: string;
  locale: string;
  fetch?: typeof fetch;
}

export class CookidooClient {
  private readonly origin: string;
  private readonly locale: string;
  private readonly request: typeof fetch;

  constructor({
                hostname,
                locale,
                fetch: request,
              }: CookidooClientOptions) {
    if (!isCookidooHostname(hostname)) {
      throw new TypeError(
          `Unsupported Cookidoo hostname: ${hostname}`,
      );
    }

    assertRouteSegment(
        locale,
        "locale",
    );

    this.origin =
        `https://${hostname.toLowerCase()}`;

    this.locale = locale;
    this.request = request ?? globalThis.fetch.bind(globalThis);
  }

  async getCreatedRecipe(
      recipeId: string,
  ): Promise<CreatedRecipe> {
    const response =
        await this.request(
            this.recipeUrl(recipeId),
            {
              method: "GET",
              credentials: "include",

              headers: {
                Accept:
                FULL_RECIPE_MEDIA_TYPE,
              },
            },
        );

    this.assertOk(response);

    return (
        await response.json()
    ) as CreatedRecipe;
  }

  /** Imports a public Cookidoo recipe using the request captured from Cookidoo's UI. */
  async addPublicRecipeToCookidoo(publicRecipeId: string): Promise<string> {
    assertRouteSegment(publicRecipeId, "publicRecipeId");
    const recipeUrl = `${this.origin}/recipes/recipe/${encodeURIComponent(this.locale)}/${encodeURIComponent(publicRecipeId)}`;
    const response = await this.request(
      `${this.origin}/created-recipes/${encodeURIComponent(this.locale)}/add-to-cookidoo`,
      {
        method: "POST",
        credentials: "include",
        headers: {Accept: "application/json", "Content-Type": "application/json"},
        body: JSON.stringify({recipeUrl, partnerId: "cookidoo"}),
      },
    );
    this.assertOk(response);
    const body: unknown = await response.json();
    if (!isCreatedRecipeImportResponse(body)) {
      throw new Error("Cookidoo import response is missing a valid recipeId");
    }
    return body.recipeId;
  }

  patchRecipeMetadata(
      recipeId: string,
      metadata: RecipeMetadataPatch,
  ): Promise<void> {
    return this.patch(
        recipeId,
        metadata,
    );
  }

  patchRecipeInstructions(
      recipeId: string,
      instructions: Instruction[],
  ): Promise<void> {
    return this.patch(
        recipeId,
        {
          instructions,
        },
    );
  }

  private async patch(
      recipeId: string,
      fields:
          | RecipeMetadataPatch
          | { instructions: Instruction[] },
  ): Promise<void> {
    const response =
        await this.request(
            this.recipeUrl(recipeId),
            {
              method: "PATCH",
              credentials: "include",

              headers: {
                Accept:
                FULL_RECIPE_MEDIA_TYPE,

                "Content-Type":
                    "application/json",
              },

              body:
                  JSON.stringify(fields),
            },
        );

    this.assertOk(response);
  }

  private recipeUrl(
      recipeId: string,
  ): string {
    assertRouteSegment(
        recipeId,
        "recipeId",
    );

    return (
        `${this.origin}/created-recipes/` +
        `${encodeURIComponent(this.locale)}/` +
        `${encodeURIComponent(recipeId)}`
    );
  }

  private assertOk(
      response: Response,
  ): void {
    if (!response.ok) {
      const status =
          response.statusText
              ? ` ${response.statusText}`
              : "";

      throw new Error(
          `Cookidoo request failed: ${response.status}${status}`,
      );
    }
  }
}

interface CreatedRecipeImportResponse {
  recipeId: string;
}

function isCreatedRecipeImportResponse(value: unknown): value is CreatedRecipeImportResponse {
  if (typeof value !== "object" || value === null || !("recipeId" in value)) return false;
  const recipeId = value.recipeId;
  return typeof recipeId === "string" && Boolean(recipeId.trim()) &&
    recipeId !== "." && recipeId !== ".." && !recipeId.includes("/");
}

function assertRouteSegment(
    value: string,
    name: string,
): void {
  if (
      !value.trim() ||
      value === "." ||
      value === ".." ||
      value.includes("/")
  ) {
    throw new TypeError(
        `A valid single route segment is required for ${name}`,
    );
  }
}
