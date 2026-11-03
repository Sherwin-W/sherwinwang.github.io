import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    globals: false,
    // Node 25's experimental global localStorage shadows jsdom's.
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
});
