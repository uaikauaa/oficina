import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
  throw new Error('Playwright requer destino local isolado.');
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_EXTERNAL_SERVER === 'true' ? undefined : {
    command: `npm run start -- --hostname localhost --port ${new URL(baseURL).port || '3000'}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      INTERNAL_BACKEND_URL: 'http://127.0.0.1:8080',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
