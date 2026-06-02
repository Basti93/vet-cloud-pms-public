import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      JWT_SECRET: 'test-secret-at-least-32-chars-long!!',
      SMTP_HOST: 'localhost',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-pass',
    },
    // Playwright E2E tests live in e2e/ — exclude from Vitest
    exclude: ['node_modules', 'e2e/**'],
    // Cap parallel workers — testcontainers integration tests start Postgres
    // containers; 2 workers = 2 containers max, safe on 4GB server.
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'coverage/',
        '**/*.config.*',
        '**/types/**',
        'src/app/**',
        'scripts/**',
        'src/server/trpc.ts',
        'src/server/adminTrpc.ts',
        'src/lib/db/**',
        'src/lib/theme.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
