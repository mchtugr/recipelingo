import { defineConfig } from "wxt";

import { COOKIDOO_HOSTS } from "./lib/cookidoo/domains";

const COOKIDOO_MATCHES = COOKIDOO_HOSTS.map(
  (hostname) => `https://${hostname}/*` as const,
);

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  manifest: {
    default_locale: "en",
    permissions: ["activeTab", "storage"],
    web_accessible_resources: [
      {
        resources: ["_locales/*/messages.json"],
        matches: COOKIDOO_MATCHES,
      },
    ],
    name: "__MSG_manifest_name__",
    description: "__MSG_manifest_description__",
  },
});
