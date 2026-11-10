import { test, expect } from '@playwright/test';

const owner = {
  id: 701, nome: 'Administrador Sintético', email: 'owner@example.invalid',
  roles: ['ROLE_SUPER_ADMIN'], permissoes: ['infraestrutura.visualizar'],
};
const now = '2026-11-09T12:00:00Z';

const fixtures: Record<string, unknown> = {
  '/api/auth/me': owner,
  '/api/admin/resumo': {
    usuarios: 1, ativos: 1, inativos: 0, convitesPendentes: 0,
    usuariosPorPapel: { ROLE_SUPER_ADMIN: 1 }, eventosRecentes: [],
    conexaoBanco: 'conectado', origemBanco: 'local', atualizadoEm: now,
  },
  '/api/admin/usuarios': { content: [], totalElements: 0, totalPages: 0 },
  '/api/admin/papeis': [],
  '/api/admin/permissoes': [],
  '/api/admin/auditoria': { content: [], totalElements: 0, page: 0, size: 20 },
  '/api/admin/infraestrutura': {
    databaseProvider: 'local', databaseName: 'synthetic', connectionStatus: 'conectado',
    database: {}, neon: {}, googleCloud: {}, collectedAt: now, cacheExpiresAt: now,
  },
};

for (const path of ['/administracao', '/administracao/usuarios', '/administracao/papeis',
  '/administracao/auditoria', '/administracao/infraestrutura']) {
  test(`admin responsive mock: ${path}`, async ({ page }) => {
    await page.route('**/api/**', route => {
      const resource = new URL(route.request().url()).pathname;
      const body = fixtures[resource];
      return route.fulfill({ status: body === undefined ? 404 : 200,
        contentType: 'application/json', body: JSON.stringify(body ?? {}) });
    });
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Acesso restrito')).toHaveCount(0);
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await expect(page.locator('main h1')).toBeVisible();
    }
  });
}

test('convite removes token from address bar and forbids referrer', async ({ page }) => {
  const response = await page.goto('/convite?token=' + 'a'.repeat(43));
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page).toHaveURL(/\/convite$/);
  await expect(page.getByRole('heading', { name: 'Ativar sua conta' })).toBeVisible();
});
