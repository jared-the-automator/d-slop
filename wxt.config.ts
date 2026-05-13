import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'D-slop',
    description: 'Highlights or hides AI-generated content on web pages.',
    version: '0.2.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://raw.githubusercontent.com/*', '<all_urls>'],
    icons: {
      16: 'icon-16.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'D-slop',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon-16.png',
        48: 'icon-48.png',
      },
    },
    browser_specific_settings: {
      gecko: {
        id: 'd-slop@jared-the-automator',
        strict_min_version: '109.0',
        data_collection_permissions: {
          required: [],
          optional: [],
        },
      },
    },
  },
});
