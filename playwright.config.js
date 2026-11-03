import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'VITE_API_BASE_URL=http://127.0.0.1:4173 npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 30_000 },
});
