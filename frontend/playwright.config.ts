import { defineConfig, devices } from '@playwright/test';

// Permite validar o build de produção sem interromper o servidor de desenvolvimento.
const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PLAYWRIGHT_PORT inválida');
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;
const target = new URL(baseURL);
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname)
  || target.pathname !== '/' || target.search || target.hash || target.username || target.password) {
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
    command: `npm run start -- --hostname localhost --port ${target.port || port}`,
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
