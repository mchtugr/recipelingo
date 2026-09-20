import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CookidooClient } from "./client";
import type {
  CreatedRecipe,
  Ingredient,
  Instruction,
} from "./types";

const HOSTNAME = "cookidoo.com.tr";
const LOCALE = "tr-TR";
const RECIPE_ID = "test-recipe-id";

const RECIPE_URL =
    `https://${HOSTNAME}/created-recipes/${LOCALE}/${RECIPE_ID}`;

const FULL_RECIPE_MEDIA_TYPE =
    "application/vnd.vorwerk.customer-recipe.full+json";

const ingredient: Ingredient = {
  type: "INGREDIENT",
  text: "1 adet soğan",
};

const instruction: Instruction = {
  type: "STEP",
  text: "Soğanı karıştırma kabına koyun.",
  annotations: [],
  missedUsages: [],
};

const createdRecipe: CreatedRecipe = {
  recipeId: "recipe-id",
  recipeContent: {
    name: "Test Recipe",
    ingredients: [ingredient],
    instructions: [instruction],
    hints: "Test hint",
  },
};

function createResponse(
    body?: unknown,
    init: ResponseInit = {},
): Response {
  return new Response(
      body === undefined
          ? null
          : JSON.stringify(body),
      {
        status: 200,
        ...init,
      },
  );
}

function createClient(
    mockFetch: typeof fetch,
): CookidooClient {
  return new CookidooClient({
    hostname: HOSTNAME,
    locale: LOCALE,
    fetch: mockFetch,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CookidooClient", () => {
  describe("addPublicRecipeToCookidoo", () => {
    it("sends the captured import request and returns the Created Recipe ID", async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(createResponse({
        recipeId: "created-123",
        recipeContent: {name: "Empolvados chilenos"},
      }));
      const result = await createClient(mockFetch).addPublicRecipeToCookidoo("r912684");
      expect(result).toBe("created-123");
      expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
        "https://cookidoo.com.tr/created-recipes/tr-TR/add-to-cookidoo",
        {
          method: "POST",
          credentials: "include",
          headers: {Accept: "application/json", "Content-Type": "application/json"},
          body: JSON.stringify({
            recipeUrl: "https://cookidoo.com.tr/recipes/recipe/tr-TR/r912684",
            partnerId: "cookidoo",
          }),
        },
      );
    });

    it("rejects failed or malformed responses", async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(createResponse({}, {status: 400}));
      const client = createClient(mockFetch);
      await expect(client.addPublicRecipeToCookidoo("r912684")).rejects.toThrow("Cookidoo request failed: 400");
      mockFetch.mockResolvedValueOnce(createResponse({recipeContent: {}}));
      await expect(client.addPublicRecipeToCookidoo("r912684")).rejects.toThrow("missing a valid recipeId");
    });
  });

  describe("constructor", () => {
    it("accepts a supported Cookidoo hostname", () => {
      expect(
          () =>
              new CookidooClient({
                hostname: HOSTNAME,
                locale: LOCALE,
              }),
      ).not.toThrow();
    });

    it("normalizes hostname casing", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(createdRecipe),
      );

      const client = new CookidooClient({
        hostname: "COOKIDOO.COM.TR",
        locale: LOCALE,
        fetch: mockFetch,
      });

      await client.getCreatedRecipe(
          RECIPE_ID,
      );

      expect(mockFetch).toHaveBeenCalledWith(
          RECIPE_URL,
          expect.any(Object),
      );
    });

    it("rejects unsupported hostnames", () => {
      expect(
          () =>
              new CookidooClient({
                hostname: "example.com",
                locale: LOCALE,
              }),
      ).toThrow(
          "Unsupported Cookidoo hostname: example.com",
      );
    });

    it.each([
      "",
      "   ",
      ".",
      "..",
      "tr/TR",
    ])(
        "rejects invalid locale route segment %j",
        (locale) => {
          expect(
              () =>
                  new CookidooClient({
                    hostname: HOSTNAME,
                    locale,
                  }),
          ).toThrow(
              "A valid single route segment is required for locale",
          );
        },
    );
  });

  describe("getCreatedRecipe", () => {
    it("constructs the Created Recipe URL correctly", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(createdRecipe),
      );

      const client =
          createClient(mockFetch);

      await client.getCreatedRecipe(
          RECIPE_ID,
      );

      expect(mockFetch).toHaveBeenCalledOnce();

      expect(mockFetch).toHaveBeenCalledWith(
          RECIPE_URL,
          expect.any(Object),
      );
    });

    it("sends credentials and the full recipe Accept header", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(createdRecipe),
      );

      const client =
          createClient(mockFetch);

      await client.getCreatedRecipe(
          RECIPE_ID,
      );

      expect(mockFetch).toHaveBeenCalledWith(
          RECIPE_URL,
          {
            method: "GET",
            credentials: "include",

            headers: {
              Accept:
              FULL_RECIPE_MEDIA_TYPE,
            },
          },
      );
    });

    it("returns the Created Recipe response", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(createdRecipe),
      );

      const client =
          createClient(mockFetch);

      const result =
          await client.getCreatedRecipe(
              RECIPE_ID,
          );

      expect(result).toEqual(
          createdRecipe,
      );
    });

    it.each([
      "",
      " ",
      ".",
      "..",
      "foo/bar",
    ])(
        "rejects invalid recipe id %j",
        async (recipeId) => {
          const mockFetch = vi.fn<typeof fetch>();

          const client =
              createClient(mockFetch);

          await expect(
              client.getCreatedRecipe(
                  recipeId,
              ),
          ).rejects.toThrow(
              "A valid single route segment is required for recipeId",
          );

          expect(
              mockFetch,
          ).not.toHaveBeenCalled();
        },
    );
  });

  describe("patchRecipeMetadata", () => {
    it("PATCHes metadata fields at the root of the request body", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(),
      );

      const client =
          createClient(mockFetch);

      await client.patchRecipeMetadata(
          RECIPE_ID,
          {
            name: "Türkçe tarif",
            ingredients: [ingredient],
            hints: "Yeni ipucu",
          },
      );

      expect(mockFetch).toHaveBeenCalledWith(
          RECIPE_URL,
          {
            method: "PATCH",
            credentials: "include",

            headers: {
              Accept:
              FULL_RECIPE_MEDIA_TYPE,

              "Content-Type":
                  "application/json",
            },

            body: JSON.stringify({
              name: "Türkçe tarif",
              ingredients: [ingredient],
              hints: "Yeni ipucu",
            }),
          },
      );
    });

    it("does not wrap metadata in recipe or recipeContent", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(),
      );

      const client =
          createClient(mockFetch);

      await client.patchRecipeMetadata(
          RECIPE_ID,
          {
            name: "Translated",
          },
      );

      const [, init] =
          mockFetch.mock.calls[0]!;

      const body = JSON.parse(
          String(init?.body),
      );

      expect(body).toEqual({
        name: "Translated",
      });

      expect(body).not.toHaveProperty(
          "recipe",
      );

      expect(body).not.toHaveProperty(
          "recipeContent",
      );
    });
  });

  describe("patchRecipeInstructions", () => {
    it("accepts Instruction[] and wraps it in the exact PATCH body", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(),
      );

      const client =
          createClient(mockFetch);

      await client.patchRecipeInstructions(
          RECIPE_ID,
          [instruction],
      );

      expect(mockFetch).toHaveBeenCalledWith(
          RECIPE_URL,
          {
            method: "PATCH",
            credentials: "include",

            headers: {
              Accept:
              FULL_RECIPE_MEDIA_TYPE,

              "Content-Type":
                  "application/json",
            },

            body: JSON.stringify({
              instructions: [
                instruction,
              ],
            }),
          },
      );
    });

    it("does not add metadata fields to the instruction PATCH", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(),
      );

      const client =
          createClient(mockFetch);

      await client.patchRecipeInstructions(
          RECIPE_ID,
          [instruction],
      );

      const [, init] =
          mockFetch.mock.calls[0]!;

      const body = JSON.parse(
          String(init?.body),
      );

      expect(
          Object.keys(body),
      ).toEqual([
        "instructions",
      ]);
    });
  });

  describe("HTTP errors", () => {
    it("throws for a non-2xx GET response", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(undefined, {
            status: 401,
            statusText:
                "Unauthorized",
          }),
      );

      const client =
          createClient(mockFetch);

      await expect(
          client.getCreatedRecipe(
              RECIPE_ID,
          ),
      ).rejects.toThrow(
          "Cookidoo request failed: 401 Unauthorized",
      );
    });

    it("throws for a non-2xx PATCH response", async () => {
      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          createResponse(undefined, {
            status: 415,
            statusText:
                "Unsupported Media Type",
          }),
      );

      const client =
          createClient(mockFetch);

      await expect(
          client.patchRecipeMetadata(
              RECIPE_ID,
              {
                name: "Test",
              },
          ),
      ).rejects.toThrow(
          "Cookidoo request failed: 415 Unsupported Media Type",
      );
    });

    it("does not parse a PATCH response body", async () => {
      const json = vi.fn();

      const response = {
        ok: true,
        status: 204,
        statusText: "",
        json,
      } as unknown as Response;

      const mockFetch = vi.fn<typeof fetch>();

      mockFetch.mockResolvedValue(
          response,
      );

      const client =
          createClient(mockFetch);

      await client.patchRecipeMetadata(
          RECIPE_ID,
          {
            name: "Test",
          },
      );

      expect(json).not.toHaveBeenCalled();
    });
  });
});
