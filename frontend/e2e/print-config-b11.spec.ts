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

test('Impressão isolada: header e UI do sistema somem no contexto de print, mantendo recibo visível', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/ordens-servico/77', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) }));
  await page.route('**/api/configuracao-oficina', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    id: 1, nomeFantasia: 'Oficina Central', cnpj: '12.345.678/0001-99',
    telefone: '(11) 98888-7777', email: 'contato@central.com',
    logradouro: 'Av Principal', numero: '100', bairro: 'Distrito Industrial',
    municipio: 'São Paulo', uf: 'SP', cep: '01000-000',
  }) }));

  await page.goto('/ordens-servico/77');

  // Modo tela normal: header e busca estão visíveis
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('#busca-rapida-trigger')).toBeVisible();
  await expect(page.locator('#print-receipt')).toBeHidden();

  // Emula modo de impressão
  await page.emulateMedia({ media: 'print' });

  // Header, navegação, busca, botões da aplicação devem sumir completamente
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('#busca-rapida-trigger')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imprimir recibo' })).toBeHidden();

  // Recibo deve estar visível e no topo
  const receipt = page.locator('#print-receipt');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Oficina Central');
  await expect(receipt).toContainText('Recibo de Serviço');
  await expect(receipt).toContainText('OS-B11-77');

  // Screenshot de conferência visual no modo de impressão
  await page.screenshot({ path: 'C:/Users/Kauag/.gemini/antigravity-ide/brain/2277adcb-42c3-4d3a-8f77-4c38ae308dcb/recibo_print_preview.png', fullPage: true });

  // Retorna para tela normal e confirma restauração
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('header')).toBeVisible();
  await expect(receipt).toBeHidden();

  // Screenshot de conferência visual no modo normal (header intacto)
  await page.screenshot({ path: 'C:/Users/Kauag/.gemini/antigravity-ide/brain/2277adcb-42c3-4d3a-8f77-4c38ae308dcb/sistema_modo_normal.png' });
});

test('Tabela de peças sem coluna Código e dados do equipamento sequenciais', async ({ page }) => {
  const orderComItens = {
    ...order,
    maquinaNumeroSerie: 'SERIE-123',
    maquinaTensao: '220V',
    maquinaPotencia: '250A',
    horimetroAtual: 100,
  };
  const itens = [
    {
      id: 1,
      ordemServicoId: 77,
      produtoId: 10,
      produtoCodigo: 'COD-999',
      produtoNome: 'Placa Inversora MIG 250',
      quantidade: 1,
      valorUnitario: 350.0,
      valorDesconto: 0,
      valorTotal: 350.0,
      tipoItem: 'PECA',
      tipoItemDescricao: 'Peça',
      createdAt: '2026-10-06T12:00:00-03:00',
    },
  ];
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/ordens-servico/77/itens', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(itens) }));
  await page.route('**/api/ordens-servico/77', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orderComItens) }));
  await page.route('**/api/configuracao-oficina', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        nomeFantasia: 'Oficina Central',
        cnpj: '12.345.678/0001-99',
        telefone: '(11) 98888-7777',
        email: 'contato@central.com',
        logradouro: 'Av Principal',
        numero: '100',
        bairro: 'Distrito Industrial',
        municipio: 'São Paulo',
        uf: 'SP',
        cep: '01000-000',
      }),
    })
  );

  await page.goto('/ordens-servico/77');
  await page.emulateMedia({ media: 'print' });

  const receipt = page.locator('#print-receipt');
  await expect(receipt).toBeVisible();

  // Validação da tabela de peças: exatamente 5 colunas, sem "Código"
  const ths = receipt.locator('table thead th');
  await expect(ths).toHaveCount(5);
  await expect(ths.nth(0)).toHaveText('Peça / Componente');
  await expect(ths.nth(1)).toHaveText('Qtd');
  await expect(ths.nth(2)).toHaveText('Unit. (R$)');
  await expect(ths.nth(3)).toHaveText('Desc. (R$)');
  await expect(ths.nth(4)).toHaveText('Total (R$)');
  await expect(receipt.locator('table thead')).not.toContainText('Código');

  // Linha da peça: contém o nome da peça e não contém o código COD-999
  const rowTds = receipt.locator('table tbody tr').first().locator('td');
  await expect(rowTds).toHaveCount(5);
  await expect(rowTds.nth(0)).toContainText('Placa Inversora MIG 250');
  await expect(receipt.locator('table tbody')).not.toContainText('COD-999');

  // Validação dos dados do equipamento sequenciais
  await expect(receipt).toContainText('Máquina de Solda');
  await expect(receipt).toContainText('ESAB');
  await expect(receipt).toContainText('LHN');
  await expect(receipt).toContainText('SERIE-123');
  await expect(receipt).toContainText('220V');
  await expect(receipt).toContainText('250A');
  await expect(receipt).toContainText('100 horas');

  // Atualizar screenshot para conferência com tabela de peças e equipamento completo
  await page.screenshot({ path: 'C:/Users/Kauag/.gemini/antigravity-ide/brain/2277adcb-42c3-4d3a-8f77-4c38ae308dcb/recibo_print_preview.png', fullPage: true });
});
