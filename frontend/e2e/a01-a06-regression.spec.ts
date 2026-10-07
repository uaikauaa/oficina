import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const user = { id: 1, nome: 'Teste Responsivo', email: 'qa@oficina.invalid', roles: ['ROLE_ADMIN'] };
const order = {
  id: 77, numeroOs: 'OS-77', status: 'ABERTA', statusDescricao: 'Aberta',
  clienteId: 42, clienteNome: 'Cliente Teste', maquinaId: 9, maquinaMarca: 'ESAB',
  maquinaModelo: 'LHN', maquinaTipoDescricao: 'Máquina de Solda',
  problemaRelatado: 'Não liga', dataEntrada: '2026-10-06T12:00:00-03:00',
  valorMaoObra: 0, valorPecas: 0, valorDesconto: 0, valorTotal: 0,
};
const config = {
  id: 1, nomeSistema: 'Oficina Gestão', nomeFantasia: 'Oficina QA',
  nomeEmpresarial: 'Empresa QA', cnpj: '11.222.333/0001-81', telefone: '1111-1111',
  email: 'qa@oficina.invalid', logradouro: 'Rua A', numero: '10', bairro: 'Centro',
  cep: '19914-080', municipio: 'Ourinhos', uf: 'SP',
};

async function baseMocks(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/categorias/ativas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/configuracao-oficina', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }));
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/ordens-servico/77', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) }));
}

async function documentWidth(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
}

async function waitForResponsiveLayoutToSettle(page: Page) {
  return page.evaluate(() => new Promise<{ scroll: number; client: number; inner: number; frames: number }>((resolve, reject) => {
    let previousGeometry = '';
    let stableFrames = 0;
    let frames = 0;
    const timeout = window.setTimeout(() => reject(new Error('Layout não estabilizou em 2 segundos')), 2000);

    const check = () => {
      const root = document.documentElement;
      const scroll = root.scrollWidth;
      const client = root.clientWidth;
      const inner = window.innerWidth;
      const actionRight = document.querySelector('#novo-produto-btn')?.getBoundingClientRect().right ?? null;
      const geometry = `${scroll}:${client}:${inner}:${actionRight}`;
      frames++;
      stableFrames = geometry === previousGeometry ? stableFrames + 1 : 1;
      previousGeometry = geometry;

      if (stableFrames >= 3) {
        window.clearTimeout(timeout);
        resolve({ scroll, client, inner, frames });
        return;
      }

      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  }));
}

test('A05/A06: produtos carrega diretamente em 320×568 sem overflow', async ({ page }) => {
  await baseMocks(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/produtos');
  await expect(page.locator('#novo-produto-btn')).toBeVisible();
  const { scroll, client, inner } = await waitForResponsiveLayoutToSettle(page);
  expect(inner).toBe(320);
  expect(client).toBe(320);
  expect(scroll).toBe(320);
});

test('A05: header mantém menu e ações dentro da viewport', async ({ page }) => {
  await baseMocks(page);
  for (const width of [320, 360, 390, 412, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Abrir busca rápida' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notificações da oficina' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu do usuário autenticado' })).toBeVisible();
    const { scroll, client } = await documentWidth(page);
    expect(scroll, `header em ${width}px`).toBeLessThanOrEqual(client);
    if (width < 1024) {
      const menu = await page.getByRole('button', { name: 'Abrir menu de navegação' }).boundingBox();
      expect(menu).not.toBeNull();
      expect(menu!.x).toBeGreaterThanOrEqual(0);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
  await expect(page.getByRole('link', { name: 'Configurações' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir busca rápida' }).click();
  await expect(page.getByRole('dialog', { name: /busca/i })).toBeVisible();
});

test('A06: configuração em 320px permite editar, salvar e cancelar', async ({ page }) => {
  await baseMocks(page);
  let saved = false;
  await page.route('**/api/configuracao-oficina', route => {
    if (route.request().method() === 'PUT') saved = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/configuracoes');
  const editar = page.getByRole('button', { name: 'Editar', exact: true });
  await expect(editar).toBeVisible();
  const box = await editar.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect((await documentWidth(page)).scroll).toBeLessThanOrEqual(320);
  await editar.click();
  await expect(page.getByRole('button', { name: 'Salvar Configuração' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  expect((await documentWidth(page)).scroll).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editar).toBeVisible();
  await editar.click();
  await page.getByRole('button', { name: 'Salvar Configuração' }).click();
  expect(saved).toBe(true);
});

test('A05/A06: matriz das telas autenticadas não tem overflow global', async ({ page }) => {
  test.setTimeout(180000);
  await baseMocks(page);
  const routes = [
    '/dashboard', '/clientes', '/produtos', '/estoque', '/ordens-servico',
    '/ordens-servico/77', '/ordens-servico/nova', '/maquinas', '/relatorios', '/configuracoes',
  ];
  const widths = [320, 360, 390, 412, 768, 1024, 1280, 1366, 1440, 1920, 2560];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('header')).toBeVisible();
    if (route === '/produtos') {
      await expect(page.locator('#novo-produto-btn')).toBeVisible();
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      const { scroll, client, inner } = await waitForResponsiveLayoutToSettle(page);
      expect(inner, `${route} em ${width}px`).toBe(width);
      expect(scroll, `${route} em ${width}px`).toBeLessThanOrEqual(client);
    }
  }
});

for (const nome of ['Peça normal', 'P'.repeat(194)]) {
  test(`A01: modal 320×568 mantém ações acessíveis com nome de ${nome.length} caracteres`, async ({ page }) => {
    await baseMocks(page);
    await page.setViewportSize({ width: 320, height: 568 });
    const produto = { id: 10, codigo: 'P-10', nome, tipo: 'PECA', precoVenda: 50,
      estoqueAtual: 5, estoqueMinimo: 1, unidadeMedida: 'UN' };
    await page.route(/\/api\/produtos\?/, route => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ content: [produto] }) }));
    let posted = false;
    await page.route('**/api/ordens-servico/77/itens', route => {
      if (route.request().method() === 'POST') {
        posted = true;
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 11 }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ordens-servico/77');
    await page.locator('#tab-btn-pecas').click();
    await page.getByRole('button', { name: 'Adicionar Peça', exact: true }).click();
    const modal = page.getByTestId('adicionar-peca-modal');
    await expect(modal).toBeVisible();
    await modal.getByPlaceholder(/Digite para buscar/).fill('Peça');
    await modal.getByRole('button', { name: new RegExp(nome.slice(0, 12)) }).click();
    const bounds = await modal.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    expect((await documentWidth(page)).scroll).toBeLessThanOrEqual(320);
    await expect(modal.getByRole('button', { name: 'Fechar modal de adicionar peça' })).toBeInViewport();
    await expect(modal.getByRole('button', { name: 'Cancelar' })).toBeInViewport();
    const adicionar = modal.getByRole('button', { name: 'Adicionar Peça', exact: true });
    await expect(adicionar).toBeInViewport();
    const body = modal.getByTestId('adicionar-peca-modal-body');
    expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await adicionar.click();
    expect(posted).toBe(true);
    await expect(modal).toBeHidden();
    if (nome.length < 194) {
      for (const width of [360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.getByRole('button', { name: 'Adicionar Peça', exact: true }).click();
        const box = await modal.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await modal.getByRole('button', { name: 'Cancelar' }).click();
      }
    }
  });
}

test('A02: texto contínuo não expande o recibo A4 nem corta as cinco colunas', async ({ page }) => {
  await baseMocks(page);
  const long = 'X'.repeat(190);
  await page.route('**/api/configuracao-oficina', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...config, nomeFantasia: long, nomeEmpresarial: long,
      email: `${long}@oficina.invalid`, logradouro: long }),
  }));
  await page.route('**/api/ordens-servico/77', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...order, clienteNome: long, maquinaMarca: long,
      maquinaModelo: long, problemaRelatado: long, diagnostico: long }),
  }));
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 1, produtoId: 10, produtoCodigo: 'P-10',
      produtoNome: long, quantidade: 1, valorUnitario: 350,
      valorDesconto: 0, valorTotal: 350 }]),
  }));
  await page.setViewportSize({ width: 718, height: 1024 });
  await page.goto('/ordens-servico/77');
  await page.emulateMedia({ media: 'print' });
  const receipt = page.locator('#print-receipt');
  await expect(receipt).toBeVisible();
  const widths = await receipt.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  if (widths.scroll > widths.client + 1) {
    const offenders = await receipt.evaluate(el => [...el.querySelectorAll('*')]
      .map(node => ({ tag: node.tagName, text: node.textContent?.slice(0, 30),
        scroll: node.scrollWidth, client: node.clientWidth, className: node.getAttribute('class') }))
      .filter(item => item.scroll > item.client + 1).slice(0, 12));
    console.log(JSON.stringify({ widths, offenders }));
  }
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  const cells = receipt.locator('table tbody tr').first().locator('td');
  await expect(cells).toHaveCount(5);
  const receiptBox = await receipt.boundingBox();
  const totalBox = await cells.last().boundingBox();
  expect(receiptBox).not.toBeNull();
  expect(totalBox).not.toBeNull();
  expect(totalBox!.x + totalBox!.width).toBeLessThanOrEqual(receiptBox!.x + receiptBox!.width + 1);
  await expect(receipt.locator('table tbody')).not.toContainText('P-10');
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect(pdf.length).toBeGreaterThan(1000);
  if (process.env.PDF_QA_OUTPUT) {
    await writeFile(process.env.PDF_QA_OUTPUT, pdf);
    await page.screenshot({ path: process.env.PDF_QA_OUTPUT.replace(/\.pdf$/i, '.png'), fullPage: true });
  }
});
