import { describe, expect, it } from 'vitest';
import { AnnotationMarkerIntegrityError } from '../../lib/translation/translate-prepared-instruction';
import { classifyActiveTab, getTranslationErrorMessage } from './state';

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

describe('getTranslationErrorMessage', () => {
  it('maps marker integrity failures', () => {
    const error = new AnnotationMarkerIntegrityError('translated', {
      valid: false, sourceMarkers: [], translatedMarkers: [],
      missingMarkers: [], duplicatedMarkers: [], orderChanged: false,
    });
    expect(getTranslationErrorMessage(error)).toContain('cihaz ayarları');
  });

  it('maps unavailable translation and general failures', () => {
    expect(getTranslationErrorMessage(new Error('Translation is unavailable for de → tr')))
      .toContain('kullanılamıyor');
    expect(getTranslationErrorMessage(new Error('request failed')))
      .toBe('Tarif çevrilemedi. Lütfen tekrar deneyin.');
  });
});
