import { defineConfig } from 'vitest/config';
import path from 'path';

const WORKSPACE_ROOT = '/Users/macmini/.openclaw/workspace';

export default defineConfig({
  test: {
    setupFiles: ['./__tests__/setup.ts'],
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      thresholds: {
        statements: 25,
        branches: 20,
        functions: 30,
        lines: 26,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workspace': WORKSPACE_ROOT,
    },
  },
});
