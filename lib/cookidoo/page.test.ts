import { assert, describe, it } from 'vitest';

import {
  COOKIDOO_HOSTS,
  isCookidooHostname,
} from './domains.ts';
import { detectCookidooPage } from './page.ts';

describe('Cookidoo domains', () => {
  it('recognizes every supported hostname', () => {
    for (const hostname of COOKIDOO_HOSTS) {
      assert.equal(isCookidooHostname(hostname), true);
    }
  });

  it('compares hostnames case-insensitively', () => {
    assert.equal(isCookidooHostname('COOKIDOO.COM.TR'), true);
    assert.equal(isCookidooHostname('Cookidoo.Thermomix.Com'), true);
  });

  it('rejects hostname lookalikes', () => {
    const lookalikes = [
      'cookidoo.example.com',
      'cookidoo.com.tr.example.com',
      'fakecookidoo.de',
      'example.com',
    ];

    for (const hostname of lookalikes) {
      assert.equal(isCookidooHostname(hostname), false);
    }
  });
});

describe('detectCookidooPage', () => {
  it('detects a public recipe', () => {
    assert.deepEqual(
      detectCookidooPage(
        'https://cookidoo.com.tr/recipes/recipe/tr-TR/r93674',
      ),
      { type: 'public-recipe', hostname: 'cookidoo.com.tr', locale: 'tr-TR', recipeId: 'r93674' },
    );
  });

  it('detects a created recipe', () => {
    assert.deepEqual(
      detectCookidooPage(
        'https://cookidoo.com.tr/created-recipes/tr-TR/abc123',
      ),
      { type: 'created-recipe', hostname: 'cookidoo.com.tr', locale: 'tr-TR', recipeId: 'abc123' },
    );
  });

  it('detects another Cookidoo page', () => {
    assert.deepEqual(
      detectCookidooPage('https://cookidoo.com.tr/search/tr-TR'),
      { type: 'cookidoo', hostname: 'cookidoo.com.tr' },
    );
  });

  it('rejects a non-Cookidoo page', () => {
    assert.deepEqual(detectCookidooPage('https://example.com/'), {
      type: 'other',
    });
  });

  it('treats locale identifiers as opaque non-empty segments', () => {
    const locales = [
      'tr-TR',
      'de-DE',
      'en-GB',
      'en-US',
      'pl',
      'en',
      'cs',
      'zh-Hans-CN',
      'zh-Hant',
      'anything_goes',
    ];

    for (const locale of locales) {
      assert.deepEqual(
        detectCookidooPage(
          `https://cookidoo.com.tr/recipes/recipe/${locale}/r12345`,
        ),
        { type: 'public-recipe', hostname: 'cookidoo.com.tr', locale, recipeId: 'r12345' },
      );

      assert.deepEqual(
        detectCookidooPage(
          `https://cookidoo.com.tr/created-recipes/${locale}/recipe-123`,
        ),
        { type: 'created-recipe', hostname: 'cookidoo.com.tr', locale, recipeId: 'recipe-123' },
      );
    }
  });

  it('detects recipes across official regional domains', () => {
    for (const hostname of COOKIDOO_HOSTS) {
      assert.deepEqual(
        detectCookidooPage(`https://${hostname}/recipes/recipe/en-GB/r42`),
        { type: 'public-recipe', hostname, locale: 'en-GB', recipeId: 'r42' },
      );
    }
  });

  it('ignores query parameters and hash fragments', () => {
    assert.deepEqual(
      detectCookidooPage(
        'https://cookidoo.com.tr/recipes/recipe/en-GB/r42?foo=bar#steps',
      ),
      { type: 'public-recipe', hostname: 'cookidoo.com.tr', locale: 'en-GB', recipeId: 'r42' },
    );
  });

  it('does not classify similar paths as recipes', () => {
    const invalidPaths = [
      'https://cookidoo.com.tr/recipes/recipe/tr-TR',
      'https://cookidoo.com.tr/recipes/recipe/tr-TR/r1/extra',
      'https://cookidoo.com.tr/recipes/not-recipe/tr-TR/r1',
      'https://cookidoo.com.tr/recipes/recipe//r1',
      'https://cookidoo.com.tr/created-recipes//abc123',
    ];

    for (const url of invalidPaths) {
      assert.deepEqual(detectCookidooPage(url), { type: 'cookidoo', hostname: 'cookidoo.com.tr' });
    }
  });

  it('rejects hostname lookalikes', () => {
    const lookalikes = [
      'https://cookidoo.example.com/recipes/recipe/tr-TR/r93674',
      'https://cookidoo.com.tr.example.com/recipes/recipe/tr-TR/r93674',
      'https://fakecookidoo.de/recipes/recipe/tr-TR/r93674',
      'https://example.com/cookidoo/recipes/recipe/tr-TR/r93674',
      'http://cookidoo.com.tr/recipes/recipe/tr-TR/t1'
    ];

    for (const url of lookalikes) {
      assert.deepEqual(detectCookidooPage(url), { type: 'other' });
    }
  });

  it('returns other for an invalid URL string', () => {
    assert.deepEqual(detectCookidooPage('not a URL'), { type: 'other' });
  });

  it('accepts a URL object', () => {
    assert.deepEqual(
      detectCookidooPage(
        new URL('https://cookidoo.com.tr/created-recipes/it-IT/abc'),
      ),
      { type: 'created-recipe', hostname: 'cookidoo.com.tr', locale: 'it-IT', recipeId: 'abc' },
    );
  });
});
