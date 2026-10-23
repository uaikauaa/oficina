import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Run after the frontend production build. No backend is started or contacted.
export default defineConfig({
  testDir: '.',
  testMatch: 'logout.spec.ts',
  outputDir: '../test-results/logout',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3117',
    trace: 'off',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'logout-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'logout-mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3117',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://127.0.0.1:3117/login',
    reuseExistingServer: false,
    env: { INTERNAL_BACKEND_URL: 'http://127.0.0.1:9' },
  },
});
