import { defineConfig } from 'playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        // Extension tests need a persistent context — see extension.spec.ts
      },
    },
  ],
});
