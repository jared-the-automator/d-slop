import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    environmentMatchGlobs: [
      ['tests/media-detector/**', 'jsdom'],
    ],
  },
});
