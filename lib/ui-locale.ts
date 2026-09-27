import {
  getUiLocaleFromLocale,
  type SupportedUiLocale,
} from "./translation/languages";

export const UI_LOCALE_CHANGED_EVENT = "recipelingo:ui-locale-changed";

let uiLocale: SupportedUiLocale = "en";
let loadedMessages: Record<string, string> = {};
let englishMessages: Record<string, string> = {};
const messagePromises = new Map<
  SupportedUiLocale,
  Promise<Record<string, string>>
>();

export async function setUiLocale(
  pageLocale: string | undefined,
): Promise<SupportedUiLocale> {
  const nextLocale = getUiLocaleFromLocale(pageLocale);
  if (nextLocale === uiLocale && Object.keys(loadedMessages).length > 0) {
    return uiLocale;
  }
  const changed = nextLocale !== uiLocale;
  uiLocale = nextLocale;
  [loadedMessages, englishMessages] = await Promise.all([
    loadMessages(nextLocale),
    loadMessages("en"),
  ]);

  if (changed) {
    globalThis.window?.dispatchEvent(new CustomEvent(UI_LOCALE_CHANGED_EVENT));
  }

  return uiLocale;
}

async function loadMessages(
  locale: SupportedUiLocale,
): Promise<Record<string, string>> {
  const cached = messagePromises.get(locale);
  if (cached) return cached;

  const messagesPromise = fetchMessages(locale).catch(() =>
    locale === "en" ? {} : loadMessages("en"),
  );
  messagePromises.set(locale, messagesPromise);
  return messagesPromise;
}

async function fetchMessages(
  locale: SupportedUiLocale,
): Promise<Record<string, string>> {
  try {
    const response = await fetch(
      browser.runtime.getURL(`_locales/${locale}/messages.json` as never),
    );
    if (!response.ok) throw new Error(`Could not load ${locale} messages`);
    const messages = (await response.json()) as Record<
      string,
      { message?: string }
    >;
    return Object.fromEntries(
      Object.entries(messages).flatMap(([key, value]) =>
        value.message === undefined ? [] : [[key, value.message]],
      ),
    );
  } catch {
    throw new Error(`Could not load ${locale} messages`);
  }
}

export function toGeneratedMessageKey(key: string): string {
  return key.replace(/\./g, "_");
}

export function getUiLocale(): SupportedUiLocale {
  return uiLocale;
}

function substitute(message: string, substitutions?: unknown): string {
  if (!substitutions) return message;
  return message.replace(/\{(\w+)\}/g, (_, key: string) =>
    String((substitutions as Record<string, unknown>)[key] ?? `{${key}}`),
  );
}

function findMessage(
  messages: Record<string, string>,
  key: string,
): string | undefined {
  return messages[key] ?? messages[toGeneratedMessageKey(key)];
}

const MISSING_MESSAGE_FALLBACK = (key: string) =>
  `[Missing translation: ${key}]`;

export const localizedI18n = {
  t(key: string, substitutions?: unknown): string {
    const message =
      findMessage(loadedMessages, key) ?? findMessage(englishMessages, key);
    if (message !== undefined) return substitute(message, substitutions);

    if (import.meta.env.DEV) {
      console.warn(`Missing RecipeLingo message: ${key}`);
    }

    return MISSING_MESSAGE_FALLBACK(key);
  },
};
