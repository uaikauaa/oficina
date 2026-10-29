import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { visualMocks } from './visual-fixtures';

const evidenceDir = `${process.env.VISUAL_OUTPUT_DIR || '../docs/visual'}/after`;

const cases: Array<{ name: string; path: string; trigger: (page: Page) => Locator; prepare?: (page: Page) => Promise<void> }> = [
  { name: 'cliente-modal', path: '/clientes', trigger: p => p.getByRole('button', { name: 'Novo Cliente' }) },
  { name: 'maquina-modal', path: '/maquinas', trigger: p => p.getByRole('button', { name: 'Novo Equipamento' }) },
  { name: 'produto-modal', path: '/produtos', trigger: p => p.locator('#novo-produto-btn') },
  { name: 'compatibilidade-modal', path: '/produtos', trigger: p => p.getByRole('button', { name: 'Compatibilidade técnica', exact: true }) },
  { name: 'movimentacao-modal', path: '/produtos', trigger: p => p.getByTitle('Registrar entrada, saída ou ajuste de estoque (sem sair da tela)') },
  { name: 'confirmacao-modal', path: '/produtos', trigger: p => p.getByRole('button', { name: 'Inativar peça', exact: true }) },
  { name: 'busca-modal', path: '/dashboard', trigger: p => p.getByRole('button', { name: 'Abrir busca rápida' }) },
  { name: 'instalacao-modal', path: '/dashboard', trigger: p => p.getByRole('button', { name: 'Instalar aplicativo Oficina Gestão' }) },
  { name: 'status-modal', path: '/ordens-servico/77', trigger: p => p.getByRole('button', { name: 'Iniciar Diagnóstico', exact: true }) },
  { name: 'peca-modal', path: '/ordens-servico/77', prepare: async p => { await p.locator('#tab-btn-pecas').click(); }, trigger: p => p.getByRole('button', { name: 'Adicionar Peça', exact: true }) },
];

for (const scenario of cases) {
  test(`visual interativa: ${scenario.name} — dimensões, nomes e teclado`, async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
    });
    await visualMocks(page);
    await page.goto(scenario.path);
    await expect(page.locator('header')).toBeVisible();
    await scenario.prepare?.(page);
    const trigger = scenario.trigger(page);
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/.+/);
    for (const control of await dialog.locator('input:visible, select:visible, textarea:visible, button:visible').all()) {
      await expect(control).toHaveAccessibleName(/.+/);
    }
    await mkdir(evidenceDir, { recursive: true });
    for (const width of [360, 390, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const panels = dialog.locator('.ui-dialog');
      const panel = await panels.count() ? panels : dialog;
      const rect = await panel.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(900);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 1366 || width === 390) await page.screenshot({ path: `${evidenceDir}/${scenario.name}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    const focusable = dialog.locator('button:visible:not(:disabled), input:visible:not(:disabled), select:visible:not(:disabled), textarea:visible:not(:disabled), a[href]:visible, [tabindex="0"]:visible');
    await focusable.last().focus();
    await page.keyboard.press('Tab');
    await expect(focusable.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(focusable.last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test('visual: abas de relatórios e OS preservam dados e navegação mobile', async ({ page }) => {
  await visualMocks(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/relatorios');
  for (const name of ['Situação do Estoque', 'Movimentações', 'Peças Mais Utilizadas', 'Clientes', 'Equipamentos']) {
    const tab = page.getByRole('button', { name, exact: true });
    await tab.click();
    await expect(page.locator('.animate-spin:visible, .animate-pulse:visible')).toHaveCount(0);
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
  await page.goto('/ordens-servico/77');
  for (const id of ['pecas', 'historico', 'observacoes', 'laudo']) {
    await page.locator(`#tab-btn-${id}`).click();
    await expect(page.locator('.animate-spin:visible')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
