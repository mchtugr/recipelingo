import { isCookidooHostname } from './domains.ts';

export type CookidooPageType =
  | 'public-recipe'
  | 'created-recipe'
  | 'cookidoo'
  | 'other';

export interface CookidooPageInfo {
  type: CookidooPageType;
  hostname?: string;
  locale?: string;
  recipeId?: string;
}

export function detectCookidooPage(url: string | URL): CookidooPageInfo {
  let parsedUrl: URL;

  try {
    parsedUrl = typeof url === 'string' ? new URL(url) : url;
  } catch {
    return { type: 'other' };
  }

  if (!isCookidooHostname(parsedUrl.hostname)) {
    return { type: 'other' };
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const [firstSegment, secondSegment, thirdSegment, fourthSegment] = segments;

  console.log({parsedUrl})
  if (
      parsedUrl.protocol !== "https:" ||
      !isCookidooHostname(
          parsedUrl.hostname,
      )
  ) {
    return {
      type: "other",
    };
  }

  if (
    segments.length === 4 &&
    firstSegment === 'recipes' &&
    secondSegment === 'recipe' &&
    thirdSegment !== undefined &&
    fourthSegment !== undefined
  ) {
    return {
      type: 'public-recipe',
      hostname: parsedUrl.hostname,
      locale: thirdSegment,
      recipeId: fourthSegment,
    };
  }

  const isCreatedRecipePath =
    firstSegment === 'created-recipes' &&
    secondSegment !== undefined &&
    thirdSegment !== undefined &&
    (segments.length === 3 ||
      (segments.length === 4 && fourthSegment === 'edit'));

  if (isCreatedRecipePath) {
    return {
      type: 'created-recipe',
      hostname: parsedUrl.hostname,
      locale: secondSegment,
      recipeId: thirdSegment,
    };
  }

  return { type: 'cookidoo', hostname: parsedUrl.hostname };
}
