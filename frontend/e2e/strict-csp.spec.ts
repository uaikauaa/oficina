import { test, expect } from '@playwright/test';

test('nonce is fresh, hydration works, inline injection is blocked and PWA stays available', async ({ page, request }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: {} }));
  const first = await request.get('/login');
  const second = await request.get('/login');
  const csp = first.headers()['content-security-policy'];
  expect(csp).toContain("'strict-dynamic'");
  expect(csp.split(';').find(value => value.trim().startsWith('script-src'))).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(second.headers()['content-security-policy']).not.toContain(`'nonce-${nonce}'`);
  expect(await first.text()).toContain(`nonce="${nonce}"`);
  // Simulate untrusted HTML inserted into the server response, parsed by the browser.
  // strict-dynamic intentionally trusts scripts created by an already trusted script.
  await page.route('**/login', async route => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace('</head>', '<script>window.__injectedInlineRan = true</script></head>') });
  });
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible();
  await page.locator('#email').fill('synthetic@oficina.invalid');
  await expect(page.locator('#email')).toHaveValue('synthetic@oficina.invalid');
  expect(await page.evaluate(() => Reflect.get(window, '__injectedInlineRan'))).toBeUndefined();
  expect((await request.get('/manifest.webmanifest')).status()).toBe(200);
  expect((await request.get('/pwa/icon-192.png')).status()).toBe(200);
  expect((await request.get('/pwa/icon-512.png')).status()).toBe(200);
});
