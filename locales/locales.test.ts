import { describe, expect, it } from 'vitest';
import { parseMessagesFile } from '@wxt-dev/i18n/build';
import { fileURLToPath } from 'node:url';

type ParsedMessage = Awaited<ReturnType<typeof parseMessagesFile>>[number];

async function messages(locale: 'en' | 'tr') {
  const parsed = await parseMessagesFile(
    fileURLToPath(new URL(`./${locale}.yml`, import.meta.url)),
  );
  return new Map(
    parsed
      .filter((entry): entry is Extract<ParsedMessage, { type: 'simple' }> => entry.type === 'simple')
      .map((entry) => [entry.key.join('.'), entry.message]),
  );
}

describe('locale resources', () => {
  it('uses natural English copy for the default UI', async () => {
    const english = await messages('en');
    expect(english.get('translator.fields.sourceLanguage')).toBe('Recipe language');
    expect(english.get('translator.fields.targetLanguage')).toBe('Target language');
    expect(english.get('translator.actions.translate')).toBe('Translate recipe');
    expect(english.get('translator.progress.title')).toBe('Translating recipe…');
  });

  it('keeps Turkish keys aligned with the English default locale', async () => {
    const [english, turkish] = await Promise.all([messages('en'), messages('tr')]);
    expect([...turkish.keys()].sort()).toEqual([...english.keys()].sort());
    expect(turkish.get('translator.actions.translate')).toBe('Tarifi çevir');
  });

  it('provides localized labels for every recipe language', async () => {
    const [english, turkish] = await Promise.all([messages('en'), messages('tr')]);
    for (const code of ['tr', 'de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'nl', 'cs', 'el']) {
      expect(english.get(`languages.${code}`)).toBeTruthy();
      expect(turkish.get(`languages.${code}`)).toBeTruthy();
    }
  });
});
