import { COOKIDOO_HOSTS } from "@/lib/cookidoo/domains";
import { detectCookidooPage } from "@/lib/cookidoo/page";

export default defineContentScript({
  matches: COOKIDOO_HOSTS.map(
    (hostname) => `https://${hostname}/created-recipes/*` as const,
  ),
  main() {
    const pageInfo = detectCookidooPage(window.location.href);

    if (pageInfo.type === "created-recipe") {
      console.info("[RecipeLingo] Created recipe detected", pageInfo);
    }
  },
});
