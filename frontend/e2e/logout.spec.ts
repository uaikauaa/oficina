import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const FAILURE = 'Não foi possível confirmar sua saída. Tente novamente.';
const SECURITY_FAILURE = 'Não foi possível confirmar sua saída por uma falha de segurança da sessão. Tente novamente.';
const PRIVATE_MARKER = 'synthetic-private-session-marker';
const user = { id: 51, nome: 'Pessoa Sintética', email: 'logout@example.invalid', roles: ['ROLE_ADMIN'] };

interface LogoutResponse {
  status?: number;
  code?: string;
  networkFailure?: boolean;
  malformed?: boolean;
  wait?: Promise<void>;
}

async function prepare(page: Page, context: BrowserContext, responses: LogoutResponse[]) {
  const state = { logoutCalls: 0, csrfCalls: 0, refreshCalls: 0, meAfterLogout: 0, signedOut: false };
  const unexpected: string[] = [];
  const warnings: string[] = [];
  const csrfHeaders: string[] = [];
  page.on('console', message => warnings.push(message.text()));
  await context.addCookies([
    { name: 'access_token', value: PRIVATE_MARKER, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'refresh_token', value: PRIVATE_MARKER, domain: '127.0.0.1', path: '/api/auth', httpOnly: true, sameSite: 'Strict' },
  ]);

  // Fail closed: every API response is synthetic; external requests are blocked.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:3117') {
      unexpected.push('external request');
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (url.pathname === '/api/auth/logout') {
      const response = responses[state.logoutCalls++];
      expect(request.method()).toBe('POST');
      csrfHeaders.push(request.headers()['x-xsrf-token'] ?? '');
      if (!response) {
        unexpected.push('automatic logout retry');
        await route.fulfill({ status: 500, body: '{}' });
        return;
      }
      if (response.wait) await response.wait;
      if (response.networkFailure) {
        await route.abort('failed');
        return;
      }
      const status = response.status ?? 500;
      state.signedOut = status >= 200 && status < 300;
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: state.signedOut ? {
          'set-cookie': 'access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax\nrefresh_token=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict',
        } : {},
        body: state.signedOut ? '' : response.malformed ? '{' : JSON.stringify({
          error: response.code ?? 'ERROR', message: PRIVATE_MARKER,
        }),
      });
      return;
    }
    if (url.pathname === '/api/auth/csrf') {
      const token = `synthetic-csrf-${++state.csrfCalls}`;
      await route.fulfill({ status: 200, json: { token }, headers: {
        'cache-control': 'no-store',
        'set-cookie': `XSRF-TOKEN=${token}; Path=/; HttpOnly; SameSite=Strict`,
      } });
      return;
    }
    if (url.pathname === '/api/auth/me') {
      if (state.signedOut) state.meAfterLogout++;
      await route.fulfill({ status: state.signedOut ? 401 : 200, json: state.signedOut ? {} : user });
      return;
    }
    if (url.pathname === '/api/auth/refresh') {
      state.refreshCalls++;
      await route.fulfill({ status: 401, json: {} });
      return;
    }
    const data: Record<string, unknown> = {
      '/api/notificacoes': { total: 0, naoLidas: 0, notificacoes: [] },
      '/api/ordens-servico/contadores-dashboard': { prontas: 0, aguardandoAprovacao: 0, emManutencao: 0 },
      '/api/estoque/resumo': { totalProdutos: 0, itensSemEstoque: 0, itensEstoqueBaixo: 0, valorTotalEstoque: 0 },
      '/api/ordens-servico': { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0, first: true, last: true },
    };
    if (url.pathname in data) {
      await route.fulfill({ status: 200, json: data[url.pathname] });
    } else {
      unexpected.push(url.pathname);
      await route.fulfill({ status: 503, json: {} });
    }
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Painel Operacional')).toBeVisible();
  return {
    state, warnings, csrfHeaders,
    check: () => expect(unexpected).toEqual([]),
  };
}

async function logoutButton(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    const menu = page.getByRole('button', { name: 'Abrir menu de navegação', exact: true });
    if (await menu.isVisible()) await menu.click();
    return page.locator('#header-mobile-logout-btn');
  }
  const menu = page.getByRole('button', { name: 'Menu do usuário autenticado', exact: true });
  if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  return page.locator('#header-logout-btn');
}

for (const status of [200, 204]) {
  test(`HTTP ${status} sem corpo confirma saída e mantém a página de login`, async ({ page, context }) => {
    const session = await prepare(page, context, [{ status }]);
    await (await logoutButton(page)).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#email')).toBeAttached();
    await expect(page.locator('#header-logout-btn')).toHaveCount(0);
    await expect(page.locator('#header-mobile-logout-btn')).toHaveCount(0);
    expect(session.state.logoutCalls).toBe(1);
    expect(session.state.meAfterLogout).toBeGreaterThan(0);
    expect(session.csrfHeaders).toEqual(['synthetic-csrf-1']);
    expect((await context.cookies()).filter(cookie => ['access_token', 'refresh_token'].includes(cookie.name))).toEqual([]);
    session.check();
  });
}

const failures: Array<{ name: string; response: LogoutResponse; message: string }> = [
  { name: '401 inconclusivo', response: { status: 401 }, message: FAILURE },
  { name: '403 genérico', response: { status: 403 }, message: FAILURE },
  { name: '403 CSRF_INVALID', response: { status: 403, code: 'CSRF_INVALID' }, message: SECURITY_FAILURE },
  { name: '500', response: { status: 500 }, message: FAILURE },
  { name: 'falha de rede', response: { networkFailure: true }, message: FAILURE },
  { name: '403 com corpo inconclusivo', response: { status: 403, malformed: true }, message: FAILURE },
];

for (const scenario of failures) {
  test(`${scenario.name}: preserva sessão e mostra erro fora do menu sem repetir POST`, async ({ page, context }) => {
    const session = await prepare(page, context, [scenario.response]);
    await (await logoutButton(page)).click();

    await expect(page.locator('p[role="alert"]')).toHaveCount(1);
    await expect(page.locator('p[role="alert"]')).toHaveText(scenario.message);
    await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(await logoutButton(page)).toBeEnabled();
    await page.keyboard.press('Escape');
    const mobileClose = page.getByRole('button', { name: 'Fechar menu', exact: true });
    if (await mobileClose.isVisible()) await mobileClose.click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Allows queued fetch continuations to settle; no automatic retry is permitted.
    await page.waitForTimeout(150);
    expect(session.state.logoutCalls).toBe(1);
    expect(session.state.refreshCalls).toBe(0);
    expect(session.csrfHeaders).toEqual(['synthetic-csrf-1']);
    expect(session.warnings.some(message => message.includes('LOGOUT_NOT_CONFIRMED'))).toBe(true);
    expect(session.warnings.join('\n')).not.toContain(PRIVATE_MARKER);
    await expect(page.locator('body')).not.toContainText(PRIVATE_MARKER);
    expect(await page.evaluate(() => document.cookie)).not.toContain(PRIVATE_MARKER);
    expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(PRIVATE_MARKER);
    expect((await context.cookies()).filter(cookie => ['access_token', 'refresh_token'].includes(cookie.name)))
      .toHaveLength(2);
    session.check();
  });
}

test('nova tentativa manual após CSRF inválido obtém token novo e pode concluir', async ({ page, context }) => {
  const session = await prepare(page, context, [{ status: 403, code: 'CSRF_INVALID' }, { status: 204 }]);
  await (await logoutButton(page)).click();
  await expect(page.locator('p[role="alert"]')).toHaveCount(1);
  await expect(page.locator('p[role="alert"]')).toHaveText(SECURITY_FAILURE);
  expect(session.state.logoutCalls).toBe(1);

  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#email')).toBeAttached();
  await expect(page.locator('#header-logout-btn')).toHaveCount(0);
  await expect(page.locator('#header-mobile-logout-btn')).toHaveCount(0);
  expect(session.state.logoutCalls).toBe(2);
  expect(session.csrfHeaders).toEqual(['synthetic-csrf-1', 'synthetic-csrf-2']);
  session.check();
});

test('cliques concorrentes desktop/mobile compartilham bloqueio imediato e liberam após falha', async ({ page, context }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const session = await prepare(page, context, [{ status: 500, wait }, { status: 200 }]);
  await page.getByRole('button', { name: 'Abrir menu de navegação', exact: true }).click();
  await page.getByRole('button', { name: 'Menu do usuário autenticado', exact: true }).click();
  try {
    await page.evaluate(() => {
      const desktop = document.querySelector<HTMLButtonElement>('#header-logout-btn')!;
      const mobile = document.querySelector<HTMLButtonElement>('#header-mobile-logout-btn')!;
      desktop.click();
      mobile.click();
      mobile.click();
    });
    await expect.poll(() => session.state.logoutCalls).toBe(1);
    await expect(page.getByRole('status')).toHaveText('Confirmando saída...');
    await expect(page.locator('#header-mobile-logout-btn')).toBeDisabled();
    await expect(page.locator('#header-mobile-logout-btn')).toHaveAttribute('aria-busy', 'true');
    await page.getByRole('button', { name: 'Menu do usuário autenticado', exact: true }).click();
    await expect(page.locator('#header-logout-btn')).toBeDisabled();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(session.state.logoutCalls).toBe(1);
  } finally {
    release();
  }

  await expect(page.locator('p[role="alert"]')).toHaveCount(1);
  await expect(page.locator('p[role="alert"]')).toHaveText(FAILURE);
  await expect(page.locator('#header-logout-btn')).toBeEnabled();
  await expect(page.locator('#header-mobile-logout-btn')).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#email')).toBeAttached();
  await expect(page.locator('#header-logout-btn')).toHaveCount(0);
  await expect(page.locator('#header-mobile-logout-btn')).toHaveCount(0);
  expect(session.state.logoutCalls).toBe(2);
  session.check();
});
