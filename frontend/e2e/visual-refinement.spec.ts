import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { visualMocks, visualOrder, visualUser } from './visual-fixtures';

const widths = [360, 390, 768, 1024, 1366, 1920];
const evidenceDir = '../docs/visual/refinement/after';

async function fitsViewport(page: Page, element: Locator) {
  const viewport = page.viewportSize()!;
  const box = await element.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
}

async function opaqueNotice(page: Page) {
  const notice = page.locator('.ui-notice:visible');
  await expect(notice).toHaveCSS('background-color', 'rgb(28, 35, 43)');
  await expect(notice).toHaveCSS('opacity', '1');
  await expect(notice).toHaveCSS('backdrop-filter', 'none');
  expect(await notice.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  const text = notice.getByRole('status').or(notice.getByRole('alert'));
  await expect(text).toHaveCSS('color', 'rgb(231, 233, 237)');
  await fitsViewport(page, notice);
  await fitsViewport(page, notice.getByRole('button', { name: 'Fechar notificação' }));
  return notice;
}

async function capture(page: Page, name: string, width: number) {
  if (width !== 390 && width !== 1366) return;
  await mkdir(evidenceDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${evidenceDir}/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
}

for (const width of widths) {
  test(`refinamento ${width}px: login, erro, loading, CSRF e 2FA`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visualMocks(page, true);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login');
    const mobile = width < 1024;
    const email = page.locator(mobile ? '#modal-email' : '#email');
    const password = page.locator(mobile ? '#modal-senha' : '#senha');
    if (mobile) await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    else await expect(email).toBeVisible();
    await expect(page.getByText('Sistema interno • Oficina Gestão', { exact: true })).toHaveCount(0);
    const photo = page.locator('img[src*="login-bg"]:visible');
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await capture(page, 'login', width);
    if (mobile) {
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await fitsViewport(page, page.getByRole('dialog'));
      await capture(page, 'login-form', width);
    }

    let mode: 'error' | 'challenge' = 'error';
    let releaseLogin!: () => void;
    const loginGate = new Promise<void>(resolve => { releaseLogin = resolve; });
    await page.route('**/api/auth/login', async route => {
      expect(route.request().headers()['x-xsrf-token']).toBe('visual-test-csrf');
      expect(route.request().postDataJSON()).toEqual({ email: 'pessoa@oficina.invalid', senha: 'SenhaSintetica!123', rememberMe: true });
      if (mode === 'error') return route.fulfill({ status: 401, json: { message: 'E-mail ou senha incorretos.' } });
      await loginGate;
      await route.fulfill({ json: { twoFactorRequired: true, challengeToken: 'synthetic-challenge' } });
    });
    await email.fill('pessoa@oficina.invalid');
    await password.fill('SenhaSintetica!123');
    await page.getByRole('button', { name: 'Exibir senha' }).filter({ visible: true }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar senha' }).filter({ visible: true }).click();
    const submit = page.locator('button[type="submit"]:visible');
    await submit.click();
    await expect(page.locator('.ui-notice:visible')).toContainText('E-mail ou senha incorretos.');
    await expect(page.locator('.ui-notice:visible')).toHaveCSS('background-color', 'rgb(28, 35, 43)');
    await capture(page, 'login-error', width);
    mode = 'challenge';
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText('Autenticando...');
    releaseLogin();
    const code = page.locator(mobile ? '#modal-two-factor-code' : '#two-factor-code');
    await expect(code).toBeVisible();
    await expect(code).toBeFocused();
    await expect(page.getByRole('button', { name: /^Reenviar \(\d+s\)$/ }).filter({ visible: true })).toBeDisabled();
    if (mobile) await fitsViewport(page, page.getByRole('dialog'));
    await capture(page, 'login-2fa', width);

    let accepted = false;
    await page.route('**/api/auth/2fa/verify', async route => {
      expect(route.request().headers()['x-xsrf-token']).toBe('visual-test-csrf');
      expect(route.request().postDataJSON()).toEqual({ challengeToken: 'synthetic-challenge', code: '123456' });
      accepted = true;
      await route.fulfill({ json: {} });
    });
    await page.route('**/api/auth/me', route => route.fulfill({ status: accepted ? 200 : 401, json: accepted ? visualUser : {} }));
    await code.fill('123456');
    await page.getByRole('button', { name: 'Verificar código', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('header')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`refinamento ${width}px: toast de OS opaco, sucesso, erro persistente e fechamento`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visualMocks(page);
    await page.goto('/ordens-servico/77');
    await page.getByRole('button', { name: 'Arco estável a 180A (15 min)', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await opaqueNotice(page);
    await capture(page, 'toast-os', width);
    await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click();
    await expect(page.locator('.ui-toast')).toHaveCount(0);

    let failure = false;
    const error = `Não foi possível salvar o laudo. Referência: ${'OS077'.repeat(32)}`;
    await page.route('**/api/ordens-servico/77', route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      return route.fulfill({ status: failure ? 500 : 200, json: failure ? { message: error } : visualOrder });
    });
    await page.getByRole('button', { name: 'Salvar Laudo', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Laudo técnico e valores atualizados com sucesso!');
    await opaqueNotice(page);
    await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click();
    failure = true;
    await page.getByRole('button', { name: 'Salvar Laudo', exact: true }).click();
    await expect(page.locator('.ui-notice').getByRole('alert')).toHaveText(error);
    await opaqueNotice(page);
    await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click();
    await expect(page.locator('.ui-notice')).toHaveCount(0);
  });

  test(`refinamento ${width}px: relatórios, avisos e exportação CSV`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visualMocks(page);
    await page.goto('/relatorios');
    await page.getByRole('button', { name: 'Situação do Estoque', exact: true }).click();
    const exportButton = page.getByRole('button', { name: 'Exportar Estoque (CSV)', exact: true });
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
    const download = page.waitForEvent('download');
    await exportButton.click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    await expect(page.getByRole('status')).toContainText('Exportação concluída');
    await opaqueNotice(page);
    await capture(page, 'toast-relatorios', width);
    await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click();
    let failure = false;
    await page.route('**/api/relatorios/estoque?**', route => route.fulfill({ status: failure ? 500 : 200, json: failure ? { message: 'Falha temporária ao exportar o estoque.' } : { content: [], totalPages: 0, totalElements: 0 } }));
    await exportButton.click();
    await expect(page.getByRole('status')).toContainText('Não há dados de estoque');
    await opaqueNotice(page);
    await page.getByRole('button', { name: 'Fechar notificação', exact: true }).click();
    failure = true;
    await exportButton.click();
    await expect(page.locator('.ui-notice').getByRole('alert')).toContainText('Falha temporária ao exportar o estoque.');
    await opaqueNotice(page);
  });

  test(`refinamento ${width}px: header, notificações e busca rápida`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visualMocks(page);
    await page.goto('/dashboard');
    const bell = page.getByRole('button', { name: /Notificações da oficina/ });
    await bell.click();
    const notifications = page.getByRole('dialog', { name: 'Painel de Notificações' });
    await expect(notifications.getByText('Tudo em dia!', { exact: true })).toBeVisible();
    await fitsViewport(page, notifications);
    await expect(notifications).toHaveCSS('background-color', 'rgb(19, 25, 32)');
    await capture(page, 'notificacoes', width);
    await page.keyboard.press('Escape');
    await expect(notifications).toBeHidden();
    await page.route('**/api/notificacoes', route => route.fulfill({ json: { naoLidas: 8, notificacoes: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, tipo: 'ESTOQUE_BAIXO', titulo: 'Peça abaixo do estoque mínimo', mensagem: 'Conector de potência: conferir a reposição antes do próximo atendimento.', lida: false })) } }));
    await page.reload();
    await bell.click();
    await expect(notifications.getByText('Peça abaixo do estoque mínimo')).toHaveCount(8);
    await fitsViewport(page, notifications);
    await capture(page, 'notificacoes-preenchidas', width);
    await notifications.getByRole('button', { name: 'Marcar todas como lidas', exact: true }).click();
    await expect(notifications.getByText('Tudo lido', { exact: true })).toBeVisible();
    await notifications.getByRole('button', { name: 'Fechar painel de notificações' }).click();
    await expect(notifications).toBeHidden();
    await page.getByRole('button', { name: 'Abrir busca rápida' }).click();
    const search = page.getByRole('dialog', { name: 'Busca Rápida' });
    await fitsViewport(page, search.locator('.ui-dialog'));
    await search.getByRole('textbox').fill('ESAB');
    await expect(search.getByText('Buscando...', { exact: false })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    if (width < 1024) {
      await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
      await expect(page.locator('header').getByRole('link', { name: 'Ordens de Serviço', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test('refinamento: modal de login em viewport curta, teclado e recuperação de senha', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 520 });
  await visualMocks(page, true);
  await page.goto('/login');
  const trigger = page.getByRole('button', { name: 'Entrar', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await fitsViewport(page, dialog);
  await expect(dialog.locator('#modal-email')).toBeFocused();
  const controls = dialog.locator('button:visible, input:visible');
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  const alert = page.waitForEvent('dialog').then(async message => {
    expect(message.message()).toBe('Para recuperação de senha, contate o administrador do sistema.');
    await message.accept();
  });
  await Promise.all([alert, dialog.getByRole('button', { name: 'Esqueceu sua senha?' }).click()]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('refinamento: toasts preservam duração e erros de OS permanecem até fechar', async ({ page }) => {
  await visualMocks(page);
  await page.clock.install();
  await page.goto('/ordens-servico/77');
  await page.getByRole('button', { name: 'Arco estável a 180A (15 min)', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Modelo inserido');
  await page.clock.runFor(4100);
  await expect(page.locator('.ui-toast')).toHaveCount(0);
  await page.route('**/api/ordens-servico/77', route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { message: 'Falha ao salvar.' } }) : route.fallback());
  await page.getByRole('button', { name: 'Salvar Laudo', exact: true }).click();
  await expect(page.locator('.ui-notice').getByRole('alert')).toHaveText('Falha ao salvar.');
  await page.clock.runFor(15000);
  await expect(page.locator('.ui-notice').getByRole('alert')).toHaveText('Falha ao salvar.');
});

for (const width of [390, 1366]) {
  test(`refinamento ${width}px: expiração, reenvio e limite de tentativas 2FA`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visualMocks(page, true);
    await page.clock.install();
    await page.route('**/api/auth/login', route => route.fulfill({ json: { twoFactorRequired: true, challengeToken: 'first-challenge' } }));
    await page.goto('/login');
    const mobile = width < 1024;
    if (mobile) await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.locator(mobile ? '#modal-email' : '#email').fill('pessoa@oficina.invalid');
    await page.locator(mobile ? '#modal-senha' : '#senha').fill('SenhaSintetica!123');
    await page.locator('button[type="submit"]:visible').click();
    const code = page.locator(mobile ? '#modal-two-factor-code' : '#two-factor-code');
    await expect(code).toBeVisible();
    await page.clock.runFor(301000);
    const notice = page.locator('.ui-notice:visible');
    await expect(notice).toContainText('O código de verificação expirou após 5 minutos.');
    await expect(notice).toHaveCSS('background-color', 'rgb(28, 35, 43)');
    await fitsViewport(page, notice);
    await expect(page.getByRole('button', { name: 'Verificar código', exact: true }).filter({ visible: true })).toBeDisabled();
    await page.route('**/api/auth/2fa/resend', route => {
      expect(route.request().headers()['x-xsrf-token']).toBe('visual-test-csrf');
      expect(route.request().postDataJSON()).toEqual({ challengeToken: 'first-challenge' });
      return route.fulfill({ json: { challengeToken: 'renewed-challenge' } });
    });
    await page.getByRole('button', { name: 'Reenviar código', exact: true }).filter({ visible: true }).click();
    await expect(notice).toHaveCount(0);
    await expect(code).toHaveValue('');
    await page.route('**/api/auth/2fa/verify', route => {
      expect(route.request().postDataJSON()).toEqual({ challengeToken: 'renewed-challenge', code: '123456' });
      return route.fulfill({ status: 400, json: { message: 'Limite de tentativas excedido. Volte ao login.' } });
    });
    await code.fill('123456');
    await page.getByRole('button', { name: 'Verificar código', exact: true }).filter({ visible: true }).click();
    await expect(notice).toContainText('Limite de tentativas excedido.');
    await expect(page.getByRole('button', { name: 'Verificar código', exact: true }).filter({ visible: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Voltar para o login', exact: true }).filter({ visible: true }).click();
    await expect(page.locator(mobile ? '#modal-email' : '#email')).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
}
