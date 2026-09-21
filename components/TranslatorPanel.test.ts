import { describe, expect, it, vi } from 'vitest';

vi.mock('#i18n', () => ({
  i18n: { t: (key: string) => key },
}));

import { appendInstructionProgress } from './TranslatorPanel';

describe('appendInstructionProgress', () => {
  it('keeps dynamic instruction counts numeric', () => {
    expect(appendInstructionProgress('Translating steps…', 7, 12))
      .toBe('Translating steps… 7 / 12');
  });

  it('omits counts before progress starts', () => {
    expect(appendInstructionProgress('Translating steps…', 0, 12))
      .toBe('Translating steps…');
  });
});
