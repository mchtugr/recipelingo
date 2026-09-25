import { describe, expect, it } from "vitest";

import { createCookidooLoginUrl } from "./login.ts";

describe("createCookidooLoginUrl", () => {
  it("uses the Cookidoo login route with an encoded recipe return path", () => {
    expect(
      createCookidooLoginUrl({
        hostname: "cookidoo.com.tr",
        locale: "tr-TR",
        redirectAfterLogin: "/recipes/recipe/tr-TR/r912684",
      }),
    ).toBe(
      "https://cookidoo.com.tr/profile/tr-TR/login" +
        "?redirectAfterLogin=%2Frecipes%2Frecipe%2Ftr-TR%2Fr912684",
    );
  });

  it("encodes locale and redirect path values", () => {
    expect(
      createCookidooLoginUrl({
        hostname: "cookidoo.de",
        locale: "de DE",
        redirectAfterLogin: "/recipes/recipe/de-DE/r42?tab=details",
      }),
    ).toBe(
      "https://cookidoo.de/profile/de%20DE/login" +
        "?redirectAfterLogin=%2Frecipes%2Frecipe%2Fde-DE%2Fr42%3Ftab%3Ddetails",
    );
  });

  it.each([
    "https://example.com/recipe",
    "//example.com/recipe",
    "/\\example.com/recipe",
    "recipes/recipe/tr-TR/r42",
  ])(
    "rejects an external or non-absolute redirect: %s",
    (redirectAfterLogin) => {
      expect(() =>
        createCookidooLoginUrl({
          hostname: "cookidoo.com.tr",
          locale: "tr-TR",
          redirectAfterLogin,
        }),
      ).toThrow("Cookidoo login redirect must be a same-site path");
    },
  );

  it("rejects unsupported hostnames", () => {
    expect(() =>
      createCookidooLoginUrl({
        hostname: "example.com",
        locale: "tr-TR",
        redirectAfterLogin: "/recipes/recipe/tr-TR/r42",
      }),
    ).toThrow("Unsupported Cookidoo hostname: example.com");
  });
});
