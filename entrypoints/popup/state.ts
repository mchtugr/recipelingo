import type { Browser } from 'wxt/browser';
import { detectCookidooPage, type CookidooPageInfo } from '../../lib/cookidoo/page';
import { AnnotationMarkerIntegrityError } from '../../lib/translation/translate-prepared-instruction';

export type PopupPageState =
  | { status: 'loading' }
  | { status: 'created-recipe' | 'public-recipe'; pageInfo: CookidooPageInfo; tabId: number }
  | { status: 'cookidoo'; pageInfo: CookidooPageInfo }
  | { status: 'other' }
  | { status: 'error'; message: string };

export function classifyActiveTab(tab: Pick<Browser.tabs.Tab, 'id' | 'url'> | undefined): PopupPageState {
  if (!tab?.url) return { status: 'other' };
  const pageInfo = detectCookidooPage(tab.url);
  if (pageInfo.type === 'created-recipe' || pageInfo.type === 'public-recipe') {
    return tab.id === undefined
      ? { status: 'error', message: 'Etkin sekmeye erişilemedi.' }
      : { status: pageInfo.type, pageInfo, tabId: tab.id };
  }
  return pageInfo.type === 'cookidoo'
    ? { status: 'cookidoo', pageInfo }
    : { status: 'other' };
}

export function getTranslationErrorMessage(error: unknown): string {
  if (error instanceof AnnotationMarkerIntegrityError) {
    return 'Çeviri sırasında tarifin cihaz ayarları güvenli şekilde korunamadı. Tarif kaydedilmedi.';
  }
  if (error instanceof Error &&
      (error.message.includes('Chrome Translator API is not available') ||
       error.message.startsWith('Translation is unavailable for '))) {
    return 'Bu dil çifti bu Chrome sürümünde kullanılamıyor.';
  }
  return 'Tarif çevrilemedi. Lütfen tekrar deneyin.';
}

export function getPublicRecipeTranslationInput(page: PopupPageState, sourceLanguage: string):
    {hostname: string; locale: string; publicRecipeId: string; sourceLanguage: string; targetLanguage: 'tr'} | undefined {
  if (page.status !== 'public-recipe' || !page.pageInfo.hostname || !page.pageInfo.locale ||
      !page.pageInfo.recipeId || !sourceLanguage) return undefined;
  return {
    hostname: page.pageInfo.hostname,
    locale: page.pageInfo.locale,
    publicRecipeId: page.pageInfo.recipeId,
    sourceLanguage,
    targetLanguage: 'tr',
  };
}
