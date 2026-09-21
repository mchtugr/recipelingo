import type { Browser } from 'wxt/browser';
import { detectCookidooPage, type CookidooPageInfo } from '../../lib/cookidoo/page';

export type PopupPageState =
  | { status: 'loading' }
  | { status: 'created-recipe' | 'public-recipe'; pageInfo: CookidooPageInfo; tabId: number }
  | { status: 'cookidoo'; pageInfo: CookidooPageInfo }
  | { status: 'other' }
  | {
      status: 'error';
      messageKey: 'popup.activeTabError' | 'popup.activeTabUnavailable';
    };

export function classifyActiveTab(tab: Pick<Browser.tabs.Tab, 'id' | 'url'> | undefined): PopupPageState {
  if (!tab?.url) return { status: 'other' };
  const pageInfo = detectCookidooPage(tab.url);
  if (pageInfo.type === 'created-recipe' || pageInfo.type === 'public-recipe') {
    return tab.id === undefined
      ? { status: 'error', messageKey: 'popup.activeTabUnavailable' }
      : { status: pageInfo.type, pageInfo, tabId: tab.id };
  }
  return pageInfo.type === 'cookidoo'
    ? { status: 'cookidoo', pageInfo }
    : { status: 'other' };
}
