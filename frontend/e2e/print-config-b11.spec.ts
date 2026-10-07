import { test, expect } from '@playwright/test';

const user = { id: 1, nome: 'Teste B11', email: 'b11@oficina.invalid', roles: ['ROLE_ADMIN'] };
const order = {
  id: 77, numeroOs: 'OS-B11-77', status: 'ABERTA', statusDescricao: 'Aberta',
  clienteId: 42, clienteNome: 'Cliente Teste', maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN',
  maquinaTipoDescricao: 'Máquina de Solda', problemaRelatado: 'Não liga',
  dataEntrada: '2026-10-06T12:00:00-03:00', valorMaoObra: 0, valorPecas: 0, valorDesconto: 0, valorTotal: 0,
};

test('B11: impressão acompanha configuração atual e limpa campos opcionais', async ({ page }) => {
  await page.addInitScript(() => {
    const win = window as unknown as Window & { __printCalls: number };
    win.__printCalls = 0;
    win.print = () => { win.__printCalls++; };
  });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/ordens-servico/77', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) }));

  let config = {
    id: 1, nomeSistema: 'Oficina Gestão', nomeFantasia: 'Oficina QA A',
    nomeEmpresarial: 'Empresa QA A', cnpj: '11.222.333/0001-81', telefone: '1111-1111',
    email: 'a@qa.invalid', logradouro: 'Rua A', numero: '10', bairro: 'Centro',
    cep: '19914-080', municipio: 'Ourinhos', uf: 'SP',
  };
  await page.route('**/api/configuracao-oficina', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) }));

  await page.goto('/ordens-servico/77');

  // Validação dos botões: apenas "Imprimir recibo" existe
  await expect(page.getByRole('button', { name: 'PDF OS' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recibo', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Imprimir', exact: true })).toHaveCount(0);
  const btnImprimirRecibo = page.getByRole('button', { name: 'Imprimir recibo' });
  await expect(btnImprimirRecibo).toHaveCount(1);

  const printLayout = page.locator('[class*="print:block"]').first();
  await expect(printLayout).toContainText('Oficina QA A');
  await expect(printLayout).toContainText('11.222.333/0001-81');
  await expect(printLayout).toContainText('Rua A');
  await btnImprimirRecibo.click();
  expect(await page.evaluate(() => (window as unknown as Window & { __printCalls: number }).__printCalls)).toBe(1);

  config = { ...config, nomeFantasia: 'Oficina QA B', nomeEmpresarial: '', cnpj: '',
    telefone: '2222-2222', email: '', logradouro: 'Rua B', numero: '20' };
  await page.reload();
  await expect(printLayout).toContainText('Oficina QA B');
  await expect(printLayout).toContainText('Rua B');
  await expect(printLayout).toContainText('2222-2222');
  await expect(printLayout).not.toContainText('Oficina QA A');
  await expect(printLayout).not.toContainText('11.222.333/0001-81');
  await expect(printLayout).not.toContainText('Empresa QA A');
  await expect(printLayout).not.toContainText('a@qa.invalid');
  await page.getByRole('button', { name: 'Imprimir recibo' }).click();
  expect(await page.evaluate(() => (window as unknown as Window & { __printCalls: number }).__printCalls)).toBe(1);
});

test('B11: falha ao carregar configuração impede impressão com erro claro', async ({ page }) => {
  await page.addInitScript(() => {
    const win = window as unknown as Window & { __printCalls: number };
    win.__printCalls = 0;
    win.print = () => { win.__printCalls++; };
  });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/ordens-servico/77', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) }));
  await page.route('**/api/configuracao-oficina', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Falha simulada' }) }));
  await page.goto('/ordens-servico/77');
  await page.getByRole('button', { name: 'Imprimir recibo' }).click();
  await expect(page.getByText('Dados da oficina indisponíveis. Recarregue a página antes de imprimir.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Window & { __printCalls: number }).__printCalls)).toBe(0);
  await expect(page.locator('[class*="print:block"]')).toHaveCount(0);
});
