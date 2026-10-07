import { test, expect, type Page } from '@playwright/test';

const user = { id: 1, nome: 'Teste B03', email: 'b03@oficina.invalid', roles: ['ROLE_ADMIN'] };

async function mockSession(page: Page, meStatusBeforeRefresh: number, refreshStatus: number) {
  let refreshed = false;
  let meCalls = 0;
  let refreshCalls = 0;
  await page.route('**/api/**', (route) => {
    throw new Error(`API não mockada no cenário B03: ${route.request().url()}`);
  });
  await page.route('**/api/notificacoes', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 0, naoLidas: 0, notificacoes: [] }),
  }));
  await page.route('**/api/ordens-servico/contadores-dashboard', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prontas: 0, aguardandoAprovacao: 0, emManutencao: 0 }),
  }));
  await page.route('**/api/estoque/resumo', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ totalProdutos: 0, itensSemEstoque: 0, itensEstoqueBaixo: 0, valorTotalEstoque: 0 }),
  }));
  await page.route(/\/api\/ordens-servico\?/, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0, first: true, last: true }),
  }));
  await page.route('**/api/auth/me', async (route) => {
    meCalls++;
    const status = refreshed ? 200 : meStatusBeforeRefresh;
    await route.fulfill({ status, contentType: 'application/json', body: status === 200 ? JSON.stringify(user) : '{}' });
  });
  await page.route('**/api/auth/refresh', async (route) => {
    refreshCalls++;
    const cookie = route.request().headers()['cookie'] ?? '';
    const status = refreshStatus === 200 && !cookie.includes('refresh_token=') ? 401 : refreshStatus;
    if (status === 200) refreshed = true;
    await route.fulfill({ status, contentType: 'application/json', body: '{}' });
  });
  return { counts: () => ({ meCalls, refreshCalls }) };
}

test.describe('B03: navegação real e recuperação de sessão', () => {
  test('dashboard sem access, com refresh válido, recupera antes de exibir a área autenticada', async ({ page, context }) => {
    await context.addCookies([{ name: 'refresh_token', value: 'refresh-valido', domain: 'localhost', path: '/api/auth', httpOnly: true, sameSite: 'Strict' }]);
    expect((await context.cookies('http://localhost:3000/dashboard')).some((cookie) => cookie.name === 'refresh_token')).toBe(false);
    expect((await context.cookies('http://localhost:3000/api/auth/refresh')).some((cookie) => cookie.name === 'refresh_token')).toBe(true);
    const session = await mockSession(page, 401, 200);
    await page.goto('/dashboard');
    await expect(page.getByText('Painel Operacional')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    expect(session.counts().meCalls).toBeGreaterThanOrEqual(2);
    expect(session.counts().meCalls).toBeLessThanOrEqual(4); // StrictMode pode repetir o effect em dev.
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('dashboard com access válido não renova', async ({ page }) => {
    const session = await mockSession(page, 200, 401);
    await page.goto('/dashboard');
    await expect(page.getByText('Painel Operacional')).toBeVisible();
    expect(session.counts().meCalls).toBeGreaterThanOrEqual(1);
    expect(session.counts().refreshCalls).toBe(0);
  });

  test('dashboard sem sessão termina no login sem ciclo de redirects', async ({ page }) => {
    const session = await mockSession(page, 401, 401);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard&sessionChecked=1$/);
    await expect(page.locator('input#email')).toBeVisible();
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('login com sessão recuperável navega ao dashboard', async ({ page, context }) => {
    await context.addCookies([{ name: 'refresh_token', value: 'refresh-valido', domain: 'localhost', path: '/api/auth', httpOnly: true, sameSite: 'Strict' }]);
    const session = await mockSession(page, 401, 200);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Painel Operacional')).toBeVisible();
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('login com access válido navega ao dashboard sem refresh', async ({ page }) => {
    const session = await mockSession(page, 200, 401);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Painel Operacional')).toBeVisible();
    expect(session.counts().refreshCalls).toBe(0);
  });

  test('login sem cookies permanece no formulário', async ({ page }) => {
    const session = await mockSession(page, 401, 401);
    await page.goto('/login');
    await expect(page.locator('input#email')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('dashboard com access inválido e refresh válido recupera a sessão', async ({ page, context }) => {
    await context.addCookies([
      { name: 'access_token', value: 'access-invalido', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
      { name: 'refresh_token', value: 'refresh-valido', domain: 'localhost', path: '/api/auth', httpOnly: true, sameSite: 'Strict' },
    ]);
    const session = await mockSession(page, 401, 200);
    await page.goto('/dashboard');
    await expect(page.getByText('Painel Operacional')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('refresh 500 termina no login sem ciclo de redirects', async ({ page }) => {
    const session = await mockSession(page, 401, 500);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard&sessionChecked=1$/);
    await expect(page.locator('input#email')).toBeVisible();
    expect(session.counts().refreshCalls).toBe(1);
  });

  test('/me 500 não renova nem cria ciclo de redirects', async ({ page }) => {
    const session = await mockSession(page, 500, 401);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard&sessionChecked=1$/);
    await expect(page.locator('input#email')).toBeVisible();
    expect(session.counts().refreshCalls).toBe(0);
  });

  test('rede interrompida termina no login sem reload infinito', async ({ page }) => {
    let meCalls = 0;
    await page.route('**/api/auth/me', (route) => { meCalls++; return route.abort(); });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard&sessionChecked=1$/);
    await expect(page.locator('input#email')).toBeVisible();
    expect(meCalls).toBeLessThanOrEqual(2);
  });

  test('login com access forjado e refresh inválido permanece no login', async ({ page, context }) => {
    await context.addCookies([{ name: 'access_token', value: 'forjado', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    const session = await mockSession(page, 401, 401);
    await page.goto('/login');
    await expect(page.locator('input#email')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    expect(session.counts().meCalls).toBeGreaterThanOrEqual(1);
    expect(session.counts().meCalls).toBeLessThanOrEqual(2);
    expect(session.counts().refreshCalls).toBe(1);
  });
});
