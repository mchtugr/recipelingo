import { COOKIDOO_HOSTS } from '~/lib/cookidoo/domains';
import { detectCookidooPage } from '~/lib/cookidoo/page';

export default defineContentScript({
  matches: COOKIDOO_HOSTS.map(
    (hostname) => `https://${hostname}/recipes/recipe/*` as const,
  ),
  main() {
    const pageInfo = detectCookidooPage(window.location.href);

    if (pageInfo.type === 'public-recipe') {
      console.info(
        '[Cookidoo Translator] Public recipe detected',
        pageInfo,
      );
    }
  },
});
