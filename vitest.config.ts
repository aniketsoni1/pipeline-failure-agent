import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Map "@pfa/<pkg>" -> "packages/<pkg>/src". Mirrors tsconfig "paths".
      { find: /^@pfa\/(.*)$/, replacement: resolve(rootDir, 'packages/$1/src') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/**/src/**/*.ts'],
    },
  },
});
