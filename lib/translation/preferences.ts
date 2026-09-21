import {browser} from "wxt/browser";
import type {SupportedTargetLanguage} from "./languages";

const TARGET_LANGUAGE_KEY = "targetLanguage";

export interface TargetLanguageStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

function defaultStorage(): TargetLanguageStorage {
  return browser.storage.local;
}

export async function getTargetLanguagePreference(
  storage: TargetLanguageStorage = defaultStorage(),
): Promise<string | undefined> {
  const values = await storage.get(TARGET_LANGUAGE_KEY);
  const value = values[TARGET_LANGUAGE_KEY];
  return typeof value === "string" ? value : undefined;
}

export async function setTargetLanguagePreference(
  language: SupportedTargetLanguage,
  storage: TargetLanguageStorage = defaultStorage(),
): Promise<void> {
  await storage.set({[TARGET_LANGUAGE_KEY]: language});
}
