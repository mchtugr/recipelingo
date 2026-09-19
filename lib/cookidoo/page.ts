import { isCookidooHostname } from './domains.ts';

export type CookidooPageType =
  | 'public-recipe'
  | 'created-recipe'
  | 'cookidoo'
  | 'other';

export interface CookidooPageInfo {
  type: CookidooPageType;
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

  if (
    segments.length === 4 &&
    firstSegment === 'recipes' &&
    secondSegment === 'recipe' &&
    thirdSegment !== undefined &&
    fourthSegment !== undefined
  ) {
    return {
      type: 'public-recipe',
      locale: thirdSegment,
      recipeId: fourthSegment,
    };
  }

  if (
    segments.length === 3 &&
    firstSegment === 'created-recipes' &&
    secondSegment !== undefined &&
    thirdSegment !== undefined
  ) {
    return {
      type: 'created-recipe',
      locale: secondSegment,
      recipeId: thirdSegment,
    };
  }

  return { type: 'cookidoo' };
}
