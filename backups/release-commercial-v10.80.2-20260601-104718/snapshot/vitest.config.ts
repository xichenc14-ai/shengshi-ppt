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
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workspace': WORKSPACE_ROOT,
    },
  },
});
