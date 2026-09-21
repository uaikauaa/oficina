import { test, expect } from '@playwright/test';

test.describe('Autenticação e Login E2E', () => {
  test('1. Deve renderizar a tela de login sem erros de CSP ou console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('Oficina Gestão');
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#senha')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Validar que não houve bloqueio por CSP de eval no console
    const evalCspErrors = consoleErrors.filter((e) =>
      e.includes('eval() is not supported') || e.includes('Content-Security-Policy')
    );
    expect(evalCspErrors).toHaveLength(0);
  });

  test('2. Tentativa de login com credenciais inválidas deve usar Same-Origin e exibir erro tratado', async ({
    page,
  }) => {
    await page.goto('/login');

    let apiRequestUrl = '';
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) {
        apiRequestUrl = req.url();
      }
    });

    await page.locator('input#email').fill('usuario_inexistente@oficina.com.br');
    await page.locator('input#senha').fill('SenhaInvalida#2026');
    await page.locator('button[type="submit"]').click();

    // Confirmar que o erro tratado aparece
    const alert = page.locator('#login-error-alert');
    await expect(alert).toBeVisible({ timeout: 10000 });
    const alertText = await alert.textContent();

    // Garantir que NÃO é 'Falha ao buscar'
    expect(alertText).not.toContain('Falha ao buscar');
    expect(alertText).toBeTruthy();

    // Confirmar que a requisição utilizou Same-Origin (/api/auth/login no host da aplicação)
    expect(apiRequestUrl).toContain('/api/auth/login');
    expect(apiRequestUrl).not.toContain('localhost:8080');
  });

  test('3. Login com credenciais válidas deve autenticar e navegar para /dashboard', async ({ page }) => {
    const email = process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'Credenciais administrativas não fornecidas no ambiente local');
      return;
    }

    await page.goto('/login');

    await page.locator('input#email').fill(email);
    await page.locator('input#senha').fill(password);
    await page.locator('button[type="submit"]').click();

    // Deve redirecionar para o dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Header e Dashboard devem carregar
    await expect(page.getByText('Painel Operacional')).toBeVisible();
  });
});
