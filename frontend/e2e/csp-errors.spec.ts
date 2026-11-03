import { test, expect } from '@playwright/test';

test('application HTML error pages with dotted paths retain nonce CSP', async ({ request }) => {
  for (const path of ['/independent-audit-missing.html', '/independent-audit/missing.json']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['content-security-policy']).toContain("'strict-dynamic'");
    expect(response.headers()['content-security-policy']).toMatch(/'nonce-[^']+'/);
  }
});
