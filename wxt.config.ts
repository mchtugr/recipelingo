import { defineConfig } from 'wxt';

export default defineConfig({
  modules: [
    '@wxt-dev/module-react',
    '@wxt-dev/i18n/module',
  ],
  manifest: {
    default_locale: 'en',
    permissions: ['activeTab', 'storage'],
    name: '__MSG_manifest_name__',
    description: '__MSG_manifest_description__',
  },
});
