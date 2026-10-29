import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { visualMocks, visualRoutes } from './visual-fixtures';

const phase = process.env.VISUAL_PHASE === 'before' ? 'before' : 'after';
for (const [name, path] of visualRoutes) {
  test(`visual: ${name} — rotas, dados e responsividade`, async ({ page }) => {
    await visualMocks(page, name === 'login');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await expect(page.locator(name === 'login' ? '#email' : 'header')).toBeVisible();
    if (name !== 'login') await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('This page couldn’t load')).toHaveCount(0);
    const widths = phase === 'before' ? [1366, 390] : [360, 390, 768, 1024, 1366, 1920];
    const dir = `../docs/visual/${phase}`;
    await mkdir(dir, { recursive: true });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      // Aguarda dados e layout reais; não captura skeletons como evidência de tela pronta.
      await expect(page.locator('.animate-spin:visible, .animate-pulse:visible')).toHaveCount(0);
      if (phase === 'after') {
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(errors).toEqual([]);
        if (width === 390) {
          const controls = page.locator('button:visible, input:visible, select:visible, textarea:visible');
          for (const control of await controls.all()) await expect(control).toHaveAccessibleName(/.+/);
        }
      }
      if (width === 1366 || width === 390) await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  });
}
