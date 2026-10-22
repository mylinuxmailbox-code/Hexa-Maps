import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@hexa/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@hexa/shields': path.resolve(__dirname, 'packages/shields/src/index.ts'),
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
  test: {
    globals: true,
    include: [
      'packages/**/*.test.ts',
      'apps/api/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    testTimeout: 25000,
  },
});
