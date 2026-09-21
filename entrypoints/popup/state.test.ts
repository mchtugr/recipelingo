import { describe, expect, it } from 'vitest';
import { classifyActiveTab } from './state';

describe('classifyActiveTab', () => {
  it.each([
    ['https://cookidoo.de/created-recipes/de-DE/abc', 'created-recipe'],
    ['https://cookidoo.pl/recipes/recipe/pl/r123', 'public-recipe'],
    ['https://cookidoo.com.tr/foundation/tr-TR/explore', 'cookidoo'],
    ['https://example.com', 'other'],
  ])('classifies %s as %s', (url, status) => {
    expect(classifyActiveTab({ id: 12, url }).status).toBe(status);
  });

  it('includes the data needed to translate a created recipe', () => {
    expect(classifyActiveTab({ id: 12, url: 'https://cookidoo.de/created-recipes/de-DE/abc' }))
      .toEqual({ status: 'created-recipe', tabId: 12, pageInfo: {
        type: 'created-recipe', hostname: 'cookidoo.de', locale: 'de-DE', recipeId: 'abc',
      } });
  });
});
