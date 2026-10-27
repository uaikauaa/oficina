import { test, expect } from '@playwright/test';

test('PWA: manifesto e icones PNG validos para instalacao', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json() as {
    name: string; start_url: string; scope: string; display: string;
    icons: Array<{ src: string; sizes: string; type: string }>;
  };
  expect(manifest.name).toBe('Oficina Gestão');
  expect(manifest.start_url).toBe('/login');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');

  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === size + 'x' + size);
    expect(icon).toBeTruthy();
    expect(icon?.type).toBe('image/png');

    const image = await request.get(icon!.src);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const body = await image.body();
    expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(body.readUInt32BE(16)).toBe(size);
    expect(body.readUInt32BE(20)).toBe(size);
  }
});

test('PWA: usuario autenticado encontra instrucoes de instalacao sem download de executavel', async ({ page }) => {
  // Nao usar backend produtivo. Impede o prompt nativo de interferir na
  // verificacao deterministica da alternativa manual.
  await page.addInitScript(() => {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
  await page.route('**/api/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({}),
  }));
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 99, nome: 'Admin PWA', email: 'pwa@example.invalid', roles: ['ROLE_ADMIN'],
    }),
  }));
  await page.goto('/dashboard');
  const install = page.getByRole('button', { name: 'Instalar aplicativo Oficina Gestão' });
  await expect(install).toBeVisible();
  await install.click();
  await expect(page.getByRole('dialog', { name: 'Instalar Oficina Gestão' })).toBeVisible();
  await expect(page.getByText('Fixar na barra de tarefas')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar instruções de instalação' }).click();
  await expect(page.getByRole('dialog', { name: 'Instalar Oficina Gestão' })).toHaveCount(0);
});
