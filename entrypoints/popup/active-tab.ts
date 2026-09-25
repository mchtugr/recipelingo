import { browser, type Browser } from "wxt/browser";

export async function getActiveTab(): Promise<Browser.tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}
