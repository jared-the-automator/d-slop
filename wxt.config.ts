import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'D-slop',
    description: 'Highlights or hides AI-generated content on web pages.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['https://raw.githubusercontent.com/*'],
  },
});
