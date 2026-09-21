const PRIVATE_USE_PATTERN = /[\uE000-\uF8FF]/g;

export function extractCookidooGlyphs(text: string): string[] {
  return text.match(PRIVATE_USE_PATTERN) ?? [];
}
