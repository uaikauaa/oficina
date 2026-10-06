import { test, expect, type Page } from '@playwright/test';

const user = { id: 1, nome: 'Teste', email: 'teste@oficina.invalid', roles: ['ROLE_ADMIN'] };

async function baseMocks(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
}

async function openIntegratedModal(page: Page, name = 'Cliente de teste') {
  await page.goto('/ordens-servico/nova');
  await page.getByRole('button', { name: 'Cadastrar novo cliente' }).first().click();
  const dialog = page.getByRole('dialog');
  await page.waitForTimeout(100); // Aguarda o reset assíncrono do modal ao abrir.
  await dialog.locator('input[name="nomeRazaoSocial"]').fill(name);
  await dialog.getByRole('button', { name: /Avançar para dados do equipamento/i }).click();
  await dialog.getByPlaceholder('Ex: ESAB, Balmer, Lincoln, Boxer').fill('ESAB');
  await dialog.getByPlaceholder('Ex: LHN 280i Plus, Smashweld 450').fill('LHN');
  return dialog;
}

async function submitIntegrated(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar para Ordem de Serviço' }).click();
}

test.describe('B07: cadastro integrado recupera falha parcial', () => {
  test('retry reutiliza cliente; segunda máquina usa o mesmo ID', async ({ page }) => {
    await baseMocks(page);
    let clients = 0;
    const machineIds: number[] = [];
    await page.route('**/api/clientes', route => {
      clients++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 123, nomeRazaoSocial: 'Cliente de teste', enderecos: [] }) });
    });
    await page.route('**/api/maquinas', route => {
      machineIds.push(JSON.parse(route.request().postData() || '{}').clienteId);
      return route.fulfill({ status: machineIds.length === 1 ? 500 : 201, contentType: 'application/json', body: JSON.stringify(machineIds.length === 1 ? { message: 'Falha simulada' } : { id: 456, clienteId: 123, marca: 'ESAB', modelo: 'LHN' }) });
    });
    await openIntegratedModal(page);
    await submitIntegrated(page);
    await expect(page.getByRole('dialog').getByText('Falha simulada')).toBeVisible();
    await submitIntegrated(page);
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(clients).toBe(1);
    expect(machineIds).toEqual([123, 123]);
  });

  test('falha inicial do cliente permite novo POST no retry', async ({ page }) => {
    await baseMocks(page);
    let clients = 0;
    let machines = 0;
    await page.route('**/api/clientes', route => {
      clients++;
      return route.fulfill({ status: clients === 1 ? 400 : 201, contentType: 'application/json', body: JSON.stringify(clients === 1 ? { message: 'Nome inválido' } : { id: 123, nomeRazaoSocial: 'Cliente de teste', enderecos: [] }) });
    });
    await page.route('**/api/maquinas', route => {
      machines++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 456, clienteId: 123 }) });
    });
    await openIntegratedModal(page);
    await submitIntegrated(page);
    await expect(page.getByRole('dialog').getByText('Nome inválido')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /Avançar para dados do equipamento/i }).click();
    await submitIntegrated(page);
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(clients).toBe(2);
    expect(machines).toBe(1);
  });

  test('fluxo normal faz um POST por entidade', async ({ page }) => {
    await baseMocks(page);
    let clients = 0;
    let machines = 0;
    await page.route('**/api/clientes', route => {
      clients++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 123, nomeRazaoSocial: 'Cliente de teste', enderecos: [] }) });
    });
    await page.route('**/api/maquinas', route => {
      machines++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 456, clienteId: 123 }) });
    });
    await openIntegratedModal(page);
    await submitIntegrated(page);
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(clients).toBe(1);
    expect(machines).toBe(1);
  });

  test('fechar após falha parcial reinicia ID no novo cadastro', async ({ page }) => {
    await baseMocks(page);
    let clients = 0;
    const machineIds: number[] = [];
    await page.route('**/api/clientes', route => {
      clients++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: clients === 1 ? 123 : 124, nomeRazaoSocial: 'Cliente de teste', enderecos: [] }) });
    });
    await page.route('**/api/maquinas', route => {
      machineIds.push(JSON.parse(route.request().postData() || '{}').clienteId);
      return route.fulfill({ status: machineIds.length === 1 ? 500 : 201, contentType: 'application/json', body: JSON.stringify(machineIds.length === 1 ? { message: 'Falha simulada' } : { id: 456, clienteId: 124 }) });
    });
    await openIntegratedModal(page);
    await submitIntegrated(page);
    await expect(page.getByRole('dialog').getByText('Falha simulada')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Cadastrar novo cliente' }).first().click();
    const dialog = page.getByRole('dialog');
    await page.waitForTimeout(100); // Aguarda o reset assíncrono do novo fluxo.
    await dialog.locator('input[name="nomeRazaoSocial"]').fill('Novo cliente');
    await dialog.getByRole('button', { name: /Avançar para dados do equipamento/i }).click();
    await dialog.getByPlaceholder('Ex: ESAB, Balmer, Lincoln, Boxer').fill('ESAB');
    await dialog.getByPlaceholder('Ex: LHN 280i Plus, Smashweld 450').fill('LHN');
    await submitIntegrated(page);
    await expect(dialog).toBeHidden();
    expect(clients).toBe(2);
    expect(machineIds).toEqual([123, 124]);
  });

  test('alterar cliente após falha faz PUT no mesmo ID antes de criar máquina', async ({ page }) => {
    await baseMocks(page);
    let clients = 0;
    const updates: Array<{ url: string; body: { nomeRazaoSocial: string } }> = [];
    const machineIds: number[] = [];
    await page.route('**/api/clientes', route => {
      clients++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 123, nomeRazaoSocial: 'Cliente de teste', enderecos: [] }) });
    });
    await page.route('**/api/clientes/123', route => {
      updates.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || '{}') });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 123, nomeRazaoSocial: 'Cliente corrigido', enderecos: [] }) });
    });
    await page.route('**/api/maquinas', route => {
      machineIds.push(JSON.parse(route.request().postData() || '{}').clienteId);
      return route.fulfill({ status: machineIds.length === 1 ? 500 : 201, contentType: 'application/json', body: JSON.stringify(machineIds.length === 1 ? { message: 'Falha simulada' } : { id: 456, clienteId: 123 }) });
    });
    await openIntegratedModal(page);
    await submitIntegrated(page);
    await expect(page.getByRole('dialog').getByText('Falha simulada')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Editar dados do cliente' }).click();
    await page.getByRole('dialog').locator('input[name="nomeRazaoSocial"]').fill('Cliente corrigido');
    await page.getByRole('dialog').getByRole('button', { name: /Avançar para dados do equipamento/i }).click();
    await submitIntegrated(page);
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(clients).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].url).toContain('/api/clientes/123');
    expect(updates[0].body.nomeRazaoSocial).toBe('Cliente corrigido');
    expect(machineIds).toEqual([123, 123]);
  });
});

const product = {
  id: 7, codigo: 'TEST-7', nome: 'Peça de teste', tipo: 'PECA', tipoDescricao: 'Peça',
  unidadeMedida: 'UN', precoCusto: 10, precoVenda: 20, estoqueAtual: 10,
  estoqueMinimo: 1, ativo: true, estoqueBaixo: false, semEstoque: false,
};

async function openProducts(page: Page) {
  await baseMocks(page);
  await page.route(/\/api\/produtos\?/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ content: [product], totalPages: 1, totalElements: 1 }),
  }));
  await page.goto('/produtos');
  await expect(page.getByText('Peça de teste')).toBeVisible();
}

for (const status of [200, 201, 400, 409, 500]) {
  test(`B02 movimentação HTTP ${status}: ${status < 300 ? 'sucesso' : 'erro sem callback'}`, async ({ page }) => {
    await openProducts(page);
    let calls = 0;
    await page.route('**/api/estoque/movimentar', route => {
      calls++;
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 300 ? { id: 1 } : { message: `Falha ${status}` }) });
    });
    await page.getByTitle('Registrar entrada, saída ou ajuste de estoque (sem sair da tela)').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('textarea').fill('Teste de movimentação');
    await dialog.getByRole('button', { name: 'Confirmar Movimentação' }).click();
    if (status < 300) {
      await expect(dialog.getByText('Movimentação registrada com sucesso!')).toBeVisible();
      await expect(dialog).toBeHidden(); // onSuccess somente após resposta aceita.
    } else {
      await expect(dialog.getByText(`Falha ${status}`)).toBeVisible();
      await expect(dialog.getByText('Movimentação registrada com sucesso!')).toHaveCount(0);
      await page.waitForTimeout(600);
      await expect(dialog).toBeVisible(); // callback não foi disparado.
    }
    expect(calls).toBe(1);
  });
}

for (const status of [201, 400, 500]) {
  test(`B02 compatibilidade adicionar HTTP ${status}`, async ({ page }) => {
    await openProducts(page);
    let listCalls = 0;
    let links: Array<{ id: number; maquinaId: number; maquinaMarca: string; maquinaModelo: string; maquinaTipoEquipamento: string }> = [];
    await page.route('**/api/maquinas?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ id: 9, marca: 'ESAB', modelo: 'LHN', tipoEquipamentoDescricao: 'Solda' }] }) }));
    await page.route('**/api/produtos/7/compatibilidades', route => {
      if (route.request().method() === 'GET') {
        listCalls++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(links) });
      }
      if (status < 300) links = [{ id: 1, maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN', maquinaTipoEquipamento: 'MAQUINA_SOLDA' }];
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 300 ? links[0] : { message: `Falha ${status}` }) });
    });
    await page.getByRole('button', { name: 'Compatibilidade técnica' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('option', { name: /ESAB LHN/ })).toBeAttached();
    await dialog.locator('select').selectOption('9');
    await dialog.getByRole('button', { name: 'Adicionar Vínculo' }).click();
    if (status < 300) {
      await expect(dialog.getByText('Equipamento vinculado com sucesso!')).toBeVisible();
      await expect(dialog.getByText('Equipamentos Compatíveis Cadastrados (1)')).toBeVisible();
      expect(listCalls).toBeGreaterThanOrEqual(2);
    } else {
      await expect(dialog.getByText(`Falha ${status}`)).toBeVisible();
      await expect(dialog.getByText('Equipamento vinculado com sucesso!')).toHaveCount(0);
      expect(listCalls).toBe(1);
    }
  });
}

for (const status of [204, 500]) {
  test(`B02 compatibilidade remover HTTP ${status}`, async ({ page }) => {
    await openProducts(page);
    let listCalls = 0;
    let links = [{ id: 1, maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN', maquinaTipoEquipamento: 'MAQUINA_SOLDA' }];
    await page.route('**/api/maquinas?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [] }) }));
    await page.route('**/api/produtos/7/compatibilidades', route => {
      listCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(links) });
    });
    await page.route('**/api/produtos/7/compatibilidades/9', route => {
      if (status < 300) links = [];
      return route.fulfill({ status, contentType: 'application/json', body: status < 300 ? '' : JSON.stringify({ message: 'Falha ao remover' }) });
    });
    await page.getByRole('button', { name: 'Compatibilidade técnica' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Equipamentos Compatíveis Cadastrados (1)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Remover vínculo' }).click();
    if (status < 300) {
      await expect(dialog.getByText('Vínculo removido!')).toBeVisible();
      await expect(dialog.getByText('Equipamentos Compatíveis Cadastrados (0)')).toBeVisible();
      expect(listCalls).toBeGreaterThanOrEqual(2);
    } else {
      await expect(dialog.getByText('Falha ao remover')).toBeVisible();
      await expect(dialog.getByText('Vínculo removido!')).toHaveCount(0);
      await expect(dialog.getByText('Equipamentos Compatíveis Cadastrados (1)')).toBeVisible();
      expect(listCalls).toBe(1);
    }
  });
}

test('B02: erro ao remover limpa sucesso anterior de inclusão', async ({ page }) => {
  await openProducts(page);
  let links: Array<{ id: number; maquinaId: number; maquinaMarca: string; maquinaModelo: string; maquinaTipoEquipamento: string }> = [];
  await page.route('**/api/maquinas?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ id: 9, marca: 'ESAB', modelo: 'LHN', tipoEquipamentoDescricao: 'Solda' }] }) }));
  await page.route('**/api/produtos/7/compatibilidades', route => {
    if (route.request().method() === 'POST') {
      links = [{ id: 1, maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN', maquinaTipoEquipamento: 'MAQUINA_SOLDA' }];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(links[0]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(links) });
  });
  await page.route('**/api/produtos/7/compatibilidades/9', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Falha ao remover' }) }));
  await page.getByRole('button', { name: 'Compatibilidade técnica' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('option', { name: /ESAB LHN/ })).toBeAttached();
  await dialog.locator('select').selectOption('9');
  await dialog.getByRole('button', { name: 'Adicionar Vínculo' }).click();
  await expect(dialog.getByText('Equipamento vinculado com sucesso!')).toBeVisible();
  await dialog.getByRole('button', { name: 'Remover vínculo' }).click();
  await expect(dialog.getByText('Falha ao remover')).toBeVisible();
  await expect(dialog.getByText('Equipamento vinculado com sucesso!')).toHaveCount(0);
  await expect(dialog.getByText('Vínculo removido!')).toHaveCount(0);
  await expect(dialog.getByText('Equipamentos Compatíveis Cadastrados (1)')).toBeVisible();
});

test('B05: formulário envia intenção explícita ao apagar endereço existente', async ({ page }) => {
  await baseMocks(page);
  const customer = {
    id: 42, tipoPessoa: 'FISICA', nomeRazaoSocial: 'Cliente com endereço',
    ativo: true, enderecos: [{ id: 51, logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Ourinhos', estado: 'SP' }],
    totalEquipamentos: 0,
  };
  await page.route(/\/api\/clientes\?/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [customer], totalPages: 1, totalElements: 1 }) }));
  let payload: Record<string, unknown> | null = null;
  await page.route('**/api/clientes/42', route => {
    payload = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...customer, enderecos: [] }) });
  });
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Editar dados cadastrais de Cliente com endereço' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[name="endereco.logradouro"]')).toHaveValue('Rua A');
  await dialog.locator('input[name="endereco.logradouro"]').fill('');
  await dialog.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(dialog).toBeHidden();
  expect(payload?.removerEndereco).toBe(true);
  expect(payload?.endereco).toBeUndefined();
});

test('B06: configurações envia strings vazias para limpar nome empresarial e CNPJ', async ({ page }) => {
  await baseMocks(page);
  const config = { id: 1, nomeSistema: 'Oficina Gestão', nomeFantasia: 'Oficina Teste', nomeEmpresarial: 'Empresa Teste', cnpj: '45076507000167', responsavel: null, telefone: null, email: null, logradouro: null, numero: null, bairro: null, cep: null, municipio: null, uf: null };
  let payload: Record<string, unknown> | null = null;
  await page.route('**/api/configuracao-oficina', route => {
    if (route.request().method() === 'PUT') {
      payload = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...config, nomeEmpresarial: null, cnpj: null }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
  });
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByPlaceholder('Ex: 45.076.507 BRUNO SOARES RODRIGUES').fill('');
  await page.getByPlaceholder('Ex: 45.076.507/0001-67').fill('');
  await page.getByRole('button', { name: 'Salvar Configuração' }).click();
  await expect(page.getByText('Configuração salva com sucesso!')).toBeVisible();
  expect(payload?.nomeEmpresarial).toBe('');
  expect(payload?.cnpj).toBe('');
});

test('B04: laudo envia limpeza explícita dos três campos técnicos', async ({ page }) => {
  await baseMocks(page);
  const order = {
    id: 77, numeroOs: 'OS-77', status: 'EM_DIAGNOSTICO', statusDescricao: 'Em diagnóstico',
    clienteId: 42, clienteNome: 'Cliente Teste', maquinaId: 9, maquinaMarca: 'ESAB', maquinaModelo: 'LHN',
    maquinaTipoDescricao: 'Máquina de Solda', problemaRelatado: 'Não liga',
    diagnostico: 'Diagnóstico antigo', solucaoAplicada: 'Solução antiga', testesRealizados: 'Testes antigos',
    dataEntrada: '2026-10-06T12:00:00-03:00', valorMaoObra: 0, valorPecas: 0, valorDesconto: 0, valorTotal: 0,
  };
  let payload: Record<string, unknown> | null = null;
  await page.route('**/api/ordens-servico/77/itens', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/ordens-servico/77', route => {
    if (route.request().method() === 'PUT') {
      payload = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...order, diagnostico: null, solucaoAplicada: null, testesRealizados: null }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) });
  });
  await page.goto('/ordens-servico/77');
  await page.getByPlaceholder('Descreva o defeito constatado na bancada (ex: IGBTs em curto, diodo de roda livre estourado, falha na excitação do rotor)...').fill('');
  await page.getByPlaceholder('Descreva a solução executada (ex: Substituição do módulo de potência, limpeza química do bloco, regulagem do trimpot de corrente)...').fill('');
  await page.getByPlaceholder('Registre os testes executados na bancada (corrente, arco, voltagem, estabilização sob carga, etc)...').fill('');
  await page.getByRole('button', { name: 'Salvar Laudo' }).click();
  await expect(page.getByText('Laudo técnico e valores atualizados com sucesso!')).toBeVisible();
  expect(payload?.diagnostico).toBe('');
  expect(payload?.solucaoAplicada).toBe('');
  expect(payload?.testesRealizados).toBe('');
});
