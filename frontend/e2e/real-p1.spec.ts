import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// This suite is run only by the disposable PostgreSQL + Mailpit harness.
const mailpit = 'http://127.0.0.1:8025';
const adminEmail = 'ci.integration@oficina.invalid';

async function csrf(context: BrowserContext) {
  const response = await context.request.get('/api/auth/csrf');
  expect(response.status()).toBe(200);
  const { token } = await response.json() as { token: string };
  expect(token).toBeTruthy();
  return { 'X-XSRF-TOKEN': token };
}

async function messageIds(request: APIRequestContext): Promise<Set<string>> {
  const response = await request.get(`${mailpit}/api/v1/messages`);
  expect(response.status()).toBe(200);
  const body = await response.json() as { messages?: Array<{ ID: string }> };
  return new Set(body.messages?.map(message => message.ID) ?? []);
}

async function startLogin(page: Page, request: APIRequestContext, email = adminEmail) {
  const previous = await messageIds(request);
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(process.env.CI_INTEGRATION_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await expect(page.locator('#two-factor-code')).toBeVisible();
  let id = '';
  await expect.poll(async () => {
    const current = await messageIds(request);
    id = [...current].find(candidate => !previous.has(candidate)) ?? '';
    return id;
  }, { timeout: 30000 }).not.toBe('');
  const response = await request.get(`${mailpit}/api/v1/message/${encodeURIComponent(id)}`);
  expect(response.status()).toBe(200);
  const { Text } = await response.json() as { Text?: string };
  const code = Text?.match(/Seu código de verificação é:\s*(\d{6})/)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  return code!;
}

async function finishLogin(page: Page, code: string) {
  await page.locator('#two-factor-code').fill(code);
  await page.locator('#verify-2fa-submit-btn').click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByText('Painel Operacional')).toBeVisible();
}

function syntheticSql(sql: string) {
  const name = process.env.CI_TEST_DB_CONTAINER;
  expect(name).toMatch(/^oficina-hml-postgres-[0-9a-f]{8}$/);
  const inspected = JSON.parse(execFileSync('docker', ['inspect', name!], { encoding: 'utf8' }))[0] as {
    Config: { Labels: Record<string, string> };
  };
  expect(inspected.Config.Labels['oficina.security-hml']).toBe(name!.slice(-8));
  return execFileSync('docker', ['exec', name!, 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-Atc', sql], {
    encoding: 'utf8', windowsHide: true,
  }).trim();
}

function expireSyntheticChallenge() {
  const sql = `WITH target AS (
    SELECT c.id FROM two_factor_challenges c JOIN usuarios u ON u.id=c.usuario_id
    WHERE u.email='${adminEmail}' AND NOT c.utilizado AND NOT c.revogado
    ORDER BY c.id DESC LIMIT 1
  ) UPDATE two_factor_challenges c SET data_expiracao=NOW()-INTERVAL '1 minute'
    FROM target WHERE c.id=target.id RETURNING c.id`;
  const changed = syntheticSql(sql);
  expect(changed).toMatch(/^\d+\r?\nUPDATE 1$/);
}

async function extractedPdfText(context: BrowserContext, url: string, filename: string) {
  const response = await context.request.get(url);
  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  const file = test.info().outputPath(filename);
  const pdf = await response.body();
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  writeFileSync(file, pdf);
  return extractPdfBytes(pdf);
}

function extractPdfBytes(pdf: Buffer) {
  const home = process.env.USERPROFILE || process.env.HOME;
  expect(home).toBeTruthy();
  const jar = path.join(home!, '.m2', 'repository', 'com', 'github', 'librepdf',
    'openpdf', '2.0.3', 'openpdf-2.0.3.jar');
  const source = path.resolve(process.cwd(), '..', 'backend', 'src', 'test', 'java', 'PdfTextProbe.java');
  return execFileSync('java', ['-Dfile.encoding=UTF-8', '-cp', jar, source],
    { encoding: 'utf8', input: pdf, windowsHide: true });
}

test.beforeEach(() => {
  test.skip(process.env.RUN_REAL_INTEGRATION !== 'true', 'Requires the isolated PostgreSQL and Mailpit harness');
  expect(process.env.CI_INTEGRATION_ADMIN_EMAIL).toBe(adminEmail);
  expect(process.env.CI_INTEGRATION_ADMIN_PASSWORD).toBeTruthy();
  const target = new URL(test.info().project.use.baseURL!);
  expect(target.hostname).toBe('localhost');
  expect(target.protocol).toBe('http:');
  expect(process.env.INTERNAL_BACKEND_URL).toBe('http://127.0.0.1:8080');
  // Isolate account/IP budgets between scenarios in the verified disposable DB.
  syntheticSql('DELETE FROM security_rate_limits');
  syntheticSql(`UPDATE two_factor_challenges SET data_criacao=NOW()-INTERVAL '2 hours'
    WHERE data_criacao > NOW()-INTERVAL '1 hour'`);
});

test('produto: editar categoria e fornecedor pela UI e persistir no PostgreSQL @real-p1', async ({ page, context, request }) => {
  test.setTimeout(120000);
  await finishLogin(page, await startLogin(page, request));
  expect((await context.request.get('/api/auth/me')).status()).toBe(200);
  const categoryName = 'Gerador';
  const supplierName = `Fornecedor CI ${Date.now()}`;
  const categoryResponse = await context.request.get('/api/categorias/ativas');
  expect(categoryResponse.status()).toBe(200);
  const category = ((await categoryResponse.json()) as Array<{ id: number; nome: string }>)
    .find(row => row.nome === categoryName);
  expect(category, 'B24 provides the technical category').toBeTruthy();
  const supplierResponse = await context.request.post('/api/fornecedores', {
    headers: await csrf(context), data: { razaoSocial: supplierName },
  });
  expect(supplierResponse.status(), await supplierResponse.text()).toBe(201);
  const supplier = await supplierResponse.json() as { id: number };
  const productName = `Placa CI ${Date.now()}`;
  const productResponse = await context.request.post('/api/produtos', {
    headers: await csrf(context), data: { nome: productName, tipo: 'PECA', precoCusto: 12.34,
      precoVenda: 25.67, estoqueMinimo: 1, estoqueInicial: 2 },
  });
  expect(productResponse.status(), await productResponse.text()).toBe(201);
  const product = await productResponse.json() as { id: number };

  await page.goto('/produtos');
  const row = page.getByRole('row').filter({ hasText: productName });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Editar peça' }).click();
  const dialog = page.getByRole('dialog');
  const categorySelect = dialog.getByLabel('Categoria Técnica');
  await expect(categorySelect.locator(`option[value="${category!.id}"]`)).toHaveCount(1);
  await categorySelect.selectOption(String(category!.id));
  await dialog.getByLabel('Fornecedor Preferencial').selectOption(String(supplier.id));
  await dialog.getByLabel('Preço de Venda (R$) *').fill('31.45');
  await dialog.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: productName })).toContainText(categoryName);
  const persisted = await context.request.get(`/api/produtos/${product.id}`);
  expect(persisted.status()).toBe(200);
  expect(await persisted.json()).toMatchObject({ categoriaId: category!.id, fornecedorId: supplier.id, precoVenda: 31.45 });
});

test('2FA: código inválido não cria sessão; reenvio invalida o desafio anterior @real-p1', async ({ page, context, request }) => {
  test.setTimeout(120000);
  const firstCode = await startLogin(page, request);
  const invalidCode = firstCode === '000000' ? '999999' : '000000';
  await page.locator('#two-factor-code').fill(invalidCode);
  await page.locator('#verify-2fa-submit-btn').click();
  await expect(page.getByText(/Código de verificação incorreto/i)).toBeVisible();
  expect((await context.request.get('/api/auth/me')).status()).toBe(401);

  const previous = await messageIds(request);
  const resend = page.locator('#resend-2fa-btn');
  await expect(resend).toBeEnabled({ timeout: 40000 });
  await resend.click();
  let newId = '';
  await expect.poll(async () => {
    const current = await messageIds(request);
    newId = [...current].find(candidate => !previous.has(candidate)) ?? '';
    return newId;
  }, { timeout: 30000 }).not.toBe('');
  const message = await request.get(`${mailpit}/api/v1/message/${encodeURIComponent(newId)}`);
  expect(message.status()).toBe(200);
  const { Text } = await message.json() as { Text?: string };
  const newCode = Text?.match(/Seu código de verificação é:\s*(\d{6})/)?.[1];
  expect(newCode).toMatch(/^\d{6}$/);

  await page.locator('#two-factor-code').fill(firstCode);
  await page.locator('#verify-2fa-submit-btn').click();
  await expect(page.getByText(/Código de verificação incorreto|Desafio inválido/i)).toBeVisible();
  expect((await context.request.get('/api/auth/me')).status()).toBe(401);
  await finishLogin(page, newCode!);
  expect((await context.request.get('/api/auth/me')).status()).toBe(200);
});

test('2FA: desafio expirado no PostgreSQL sintético rejeita código válido @real-p1', async ({ page, context, request }) => {
  test.setTimeout(60000);
  const code = await startLogin(page, request);
  expireSyntheticChallenge();
  await page.locator('#two-factor-code').fill(code);
  await page.locator('#verify-2fa-submit-btn').click();
  await expect(page.getByText(/Código de verificação expirado/i)).toBeVisible();
  expect((await context.request.get('/api/auth/me')).status()).toBe(401);
});

test('2FA: cinco códigos incorretos revogam desafio e impedem sessão @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  const code = await startLogin(page, request);
  const wrong = code === '000000' ? '999999' : '000000';
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.locator('#two-factor-code').fill(wrong);
    await page.locator('#verify-2fa-submit-btn').click();
    await expect(page.getByText(attempt === 5
      ? /Limite de tentativas excedido/i : /Código de verificação incorreto/i)).toBeVisible();
    expect((await context.request.get('/api/auth/me')).status()).toBe(401);
  }
  const state = syntheticSql(`SELECT tentativas,revogado,utilizado FROM two_factor_challenges c
    JOIN usuarios u ON u.id=c.usuario_id WHERE u.email='${adminEmail}' ORDER BY c.id DESC LIMIT 1`);
  expect(state).toBe('5|t|f');
  await page.locator('#two-factor-code').fill(code);
  await expect(page.locator('#verify-2fa-submit-btn')).toBeDisabled();
  expect((await context.request.get('/api/auth/me')).status()).toBe(401);
});

test('login mobile: foco do modal e 2FA funcionam com backend real @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const previous = await messageIds(request);
  await page.goto('/login');
  const trigger = page.getByRole('button', { name: 'Entrar', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const email = dialog.locator('#modal-email');
  const password = dialog.locator('#modal-senha');
  await expect(email).toBeFocused();
  await password.click();
  await expect(password).toBeFocused();
  await dialog.getByRole('button', { name: 'Fechar modal de login' }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(email).toBeFocused();
  await email.fill(adminEmail);
  await password.fill(process.env.CI_INTEGRATION_ADMIN_PASSWORD!);
  await expect(email).toHaveValue(adminEmail);
  await expect(password).toHaveValue(process.env.CI_INTEGRATION_ADMIN_PASSWORD!);
  await dialog.locator('button[type="submit"]').first().click();
  const challengeCode = dialog.locator('#modal-two-factor-code');
  await expect(challengeCode).toBeVisible();
  await expect(challengeCode).toBeFocused();
  let id = '';
  await expect.poll(async () => {
    id = [...await messageIds(request)].find(candidate => !previous.has(candidate)) ?? '';
    return id;
  }, { timeout: 30000 }).not.toBe('');
  const message = await request.get(`${mailpit}/api/v1/message/${encodeURIComponent(id)}`);
  expect(message.status()).toBe(200);
  const code = ((await message.json()) as { Text?: string }).Text?.match(/Seu código de verificação é:\s*(\d{6})/)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  await challengeCode.fill(code!);
  await dialog.locator('button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  expect((await context.request.get('/api/auth/me')).status()).toBe(200);
});

test('configuração: papel atendente autenticado não pode alterar dados @real-p1', async ({ page, context, request }) => {
  test.setTimeout(60000);
  const staffEmail = 'ci.atendente@oficina.invalid';
  const role = syntheticSql(`INSERT INTO roles (nome,descricao)
    VALUES ('ROLE_ATENDENTE','Papel sintético para teste de autorização') RETURNING id`);
  expect(role).toMatch(/^\d+\r?\nINSERT 0 1$/);
  const inserted = syntheticSql(`WITH created AS (
    INSERT INTO usuarios (nome,email,senha,ativo)
    SELECT 'Atendente CI','${staffEmail}',senha,true FROM usuarios WHERE email='${adminEmail}'
    RETURNING id
  ) INSERT INTO usuario_roles (usuario_id,role_id)
    SELECT created.id,roles.id FROM created JOIN roles ON roles.nome='ROLE_ATENDENTE'
    RETURNING usuario_id`);
  expect(inserted).toMatch(/^\d+\r?\nINSERT 0 1$/);
  const before = syntheticSql('SELECT nome_fantasia FROM configuracao_oficina');
  const code = await startLogin(page, request, staffEmail);
  await page.locator('#two-factor-code').fill(code);
  const verified = page.waitForResponse(response => response.url().includes('/api/auth/2fa/verify'));
  await page.locator('#verify-2fa-submit-btn').click();
  expect((await verified).status()).toBe(200);
  const me = await context.request.get('/api/auth/me');
  expect(me.status()).toBe(403);
  const denied = await context.request.put('/api/configuracao-oficina', {
    headers: await csrf(context), data: { nomeFantasia: 'Alteração indevida CI' },
  });
  expect(denied.status(), await denied.text()).toBe(403);
  const after = syntheticSql('SELECT nome_fantasia FROM configuracao_oficina');
  expect(after).toBe(before);
});

test('OS: peça e valores pela UI, total e filtros do relatório persistidos @real-p1', async ({ page, context, request }) => {
  test.setTimeout(120000);
  await finishLogin(page, await startLogin(page, request));
  const clientResponse = await context.request.post('/api/clientes', {
    headers: await csrf(context), data: { tipoPessoa: 'FISICA', nomeRazaoSocial: `Cliente OS CI ${Date.now()}` },
  });
  expect(clientResponse.status(), await clientResponse.text()).toBe(201);
  const client = await clientResponse.json() as { id: number };
  const machineResponse = await context.request.post('/api/maquinas', {
    headers: await csrf(context), data: { clienteId: client.id, tipoEquipamento: 'MAQUINA_SOLDA',
      marca: 'ESAB CI', modelo: 'Teste integrado', numeroSerie: `CI-OS-${Date.now()}` },
  });
  expect(machineResponse.status(), await machineResponse.text()).toBe(201);
  const machine = await machineResponse.json() as { id: number };
  const productName = `Diodo CI ${Date.now()}`;
  const productResponse = await context.request.post('/api/produtos', {
    headers: await csrf(context), data: { nome: productName, tipo: 'PECA', precoCusto: 12,
      precoVenda: 31.45, estoqueInicial: 5, estoqueMinimo: 1 },
  });
  expect(productResponse.status(), await productResponse.text()).toBe(201);
  const product = await productResponse.json() as { id: number };
  const orderResponse = await context.request.post('/api/ordens-servico', {
    headers: await csrf(context), data: { clienteId: client.id, maquinaId: machine.id,
      problemaRelatado: 'Falha sintética de bancada' },
  });
  expect(orderResponse.status(), await orderResponse.text()).toBe(201);
  const order = await orderResponse.json() as { id: number; dataEntrada: string };

  await page.goto(`/ordens-servico/${order.id}`);
  await page.locator('#tab-btn-pecas').click();
  await page.getByRole('button', { name: 'Adicionar Peça', exact: true }).first().click();
  const itemDialog = page.getByTestId('adicionar-peca-modal');
  await itemDialog.getByLabel('Pesquisar Peça no Estoque (código, nome ou descrição) *').fill(productName);
  await itemDialog.getByRole('button', { name: new RegExp(productName) }).click();
  await itemDialog.getByLabel('Quantidade *').fill('2');
  await itemDialog.getByRole('button', { name: 'Adicionar Peça', exact: true }).click();
  await expect(itemDialog).toHaveCount(0);
  expect(Number((await (await context.request.get(`/api/produtos/${product.id}`)).json()).estoqueAtual)).toBe(3);

  await page.locator('#tab-btn-laudo').click();
  await page.getByLabel('Mão de Obra Técnica (R$):').fill('125.35');
  await page.getByLabel('Desconto (R$):').fill('5.10');
  await page.getByRole('button', { name: 'Salvar Laudo' }).click();
  await expect.poll(async () => Number((await (await context.request.get(`/api/ordens-servico/${order.id}`)).json()).valorTotal)).toBe(183.15);
  const update = async (status: string, testesRealizados?: string) => context.request.patch(`/api/ordens-servico/${order.id}/status`, {
    headers: await csrf(context), data: { status, testesRealizados },
  });
  for (const status of ['EM_DIAGNOSTICO', 'EM_MANUTENCAO']) {
    const changed = await update(status);
    expect(changed.status(), await changed.text()).toBe(200);
  }
  expect((await update('PRONTA', 'Teste sintético sob carga')).status()).toBe(200);
  expect((await update('CONCLUIDA')).status()).toBe(200);
  const persisted = await (await context.request.get(`/api/ordens-servico/${order.id}`)).json() as {
    status: string; valorPecas: number; valorMaoObra: number; valorDesconto: number; valorTotal: number;
  };
  expect(persisted.status).toBe('CONCLUIDA');
  expect(Number(persisted.valorPecas)).toBe(62.90);
  expect(Number(persisted.valorMaoObra)).toBe(125.35);
  expect(Number(persisted.valorDesconto)).toBe(5.10);
  expect(Number(persisted.valorTotal)).toBe(183.15);
  await page.reload();
  await expect(page.getByText('Concluída').first()).toBeVisible();

  const report = async (query: string) => {
    const response = await context.request.get(`/api/relatorios/ordens-servico?${query}`);
    expect(response.status(), await response.text()).toBe(200);
    return response.json() as Promise<{ resumo: { totalOs: number; valorTotalConcluidas: number }; itens: { content: Array<{ id: number }> } }>;
  };
  const completed = await report('status=CONCLUIDA');
  expect(completed.itens.content.some(row => row.id === order.id)).toBe(true);
  expect(Number(completed.resumo.valorTotalConcluidas)).toBeGreaterThanOrEqual(183.15);
  const open = await report('status=ABERTA');
  expect(open.itens.content.some(row => row.id === order.id)).toBe(false);
  const exactTime = encodeURIComponent(order.dataEntrada);
  const boundary = await report(`dataInicio=${exactTime}&dataFim=${exactTime}`);
  expect(boundary.itens.content.some(row => row.id === order.id)).toBe(true);
  const future = await report('dataInicio=2099-01-01T00%3A00%3A00Z');
  expect(future.itens.content.some(row => row.id === order.id)).toBe(false);

  const orderNumber = (await (await context.request.get(`/api/ordens-servico/${order.id}`)).json()).numeroOs as string;
  await page.goto('/relatorios');
  await page.getByLabel('Status da Ordem:').selectOption('CONCLUIDA');
  const reportRow = page.getByRole('row').filter({ hasText: orderNumber });
  await expect(reportRow).toContainText('R$ 183,15');
  await expect(page.getByText('Valor de OS Concluídas').locator('..'))
    .toContainText(Number(completed.resumo.valorTotalConcluidas).toFixed(2).replace('.', ','));
  await page.getByLabel('Status da Ordem:').selectOption('ABERTA');
  await expect(reportRow).toHaveCount(0);
  await page.getByLabel('Status da Ordem:').selectOption('CONCLUIDA');
  await page.getByLabel('Data Inicial:').fill('2099-01-01');
  await expect(reportRow).toHaveCount(0);
  await page.getByLabel('Data Inicial:').fill(order.dataEntrada.slice(0, 10));
  await expect(reportRow).toBeVisible();
  await page.getByLabel('Data Final:').fill('2000-01-01');
  await expect(reportRow).toHaveCount(0);
  await page.getByLabel('Data Final:').fill(order.dataEntrada.slice(0, 10));
  await expect(reportRow).toBeVisible();

  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Editar' }).click();
  const shopName = `Oficina PDF CI ${Date.now()}`;
  await page.getByLabel('Nome Fantasia / Comercial *').fill(shopName);
  await page.getByRole('button', { name: 'Salvar Configuração' }).click();
  await expect(page.getByText(shopName, { exact: true })).toBeVisible();
  const savedConfig = await context.request.get('/api/configuracao-oficina');
  expect(savedConfig.status()).toBe(200);
  expect((await savedConfig.json()).nomeFantasia).toBe(shopName);
  for (const [suffix, title] of [
    ['pdf', 'ORDEM DE SERVI'],
    ['documento-servico', 'DOCUMENTO DE SERVI'],
    ['recibo', 'RECIBO DE PRESTA'],
  ]) {
    const text = await extractedPdfText(context, `/api/ordens-servico/${order.id}/${suffix}`, `${suffix}.pdf`);
    expect(text).toContain(title);
    expect(text).toContain(shopName);
    expect(text).toContain(productName);
    expect(text).toContain('183,15');
  }
  expect(() => extractPdfBytes(Buffer.from('%PDF-corrupt'))).toThrow();
});

test('estoque: duas saídas concorrentes não vendem acima do saldo @real-p1', async ({ page, context, request }) => {
  test.setTimeout(60000);
  await finishLogin(page, await startLogin(page, request));
  const response = await context.request.post('/api/produtos', {
    headers: await csrf(context), data: { nome: `Estoque paralelo CI ${Date.now()}`, tipo: 'PECA',
      precoCusto: 10, precoVenda: 20, estoqueInicial: 5, estoqueMinimo: 1 },
  });
  expect(response.status(), await response.text()).toBe(201);
  const product = await response.json() as { id: number };
  const headers = await csrf(context);
  const exits = await Promise.all([1, 2].map(index => context.request.post('/api/estoque/saida', {
    headers, data: { produtoId: product.id, quantidade: 4, motivo: `Concorrência sintética ${index}` },
  })));
  expect(exits.map(result => result.status()).sort()).toEqual([201, 400]);
  const persisted = await context.request.get(`/api/produtos/${product.id}`);
  expect(Number((await persisted.json()).estoqueAtual)).toBe(1);
  const history = await context.request.get(`/api/estoque/movimentacoes?produtoId=${product.id}`);
  expect(history.status()).toBe(200);
  const movements = await history.json() as { content: Array<{ tipoMovimentacao: string }> };
  expect(movements.content.filter(row => row.tipoMovimentacao === 'SAIDA').length).toBe(1);
  await page.goto('/produtos');
  await expect(page.getByRole('row').filter({ hasText: 'Estoque paralelo CI' })).toContainText('1');
});

test('cliente: CPF duplicado rejeitado e inativação preserva vínculos @real-p1', async ({ page, context, request }) => {
  test.setTimeout(60000);
  await finishLogin(page, await startLogin(page, request));
  const name = `Cliente vínculo CI ${Date.now()}`;
  const data = { tipoPessoa: 'FISICA', nomeRazaoSocial: name, cpfCnpj: '12345678901' };
  const created = await context.request.post('/api/clientes', { headers: await csrf(context), data });
  expect(created.status(), await created.text()).toBe(201);
  const client = await created.json() as { id: number };
  const duplicate = await context.request.post('/api/clientes', {
    headers: await csrf(context), data: { ...data, nomeRazaoSocial: 'Duplicado CI' },
  });
  expect(duplicate.status()).toBe(409);
  const machineResponse = await context.request.post('/api/maquinas', {
    headers: await csrf(context), data: { clienteId: client.id, tipoEquipamento: 'MAQUINA_SOLDA',
      marca: 'ESAB CI', modelo: 'Vínculo CI', numeroSerie: `CI-VINC-${Date.now()}` },
  });
  expect(machineResponse.status(), await machineResponse.text()).toBe(201);
  const machine = await machineResponse.json() as { id: number };
  const orderResponse = await context.request.post('/api/ordens-servico', {
    headers: await csrf(context), data: { clienteId: client.id, maquinaId: machine.id,
      problemaRelatado: 'Vínculo sintético' },
  });
  expect(orderResponse.status(), await orderResponse.text()).toBe(201);
  const order = await orderResponse.json() as { id: number };
  const inactive = await context.request.patch(`/api/clientes/${client.id}/status`, {
    headers: await csrf(context), data: { ativo: false },
  });
  expect(inactive.status(), await inactive.text()).toBe(200);
  expect((await inactive.json()).ativo).toBe(false);
  expect((await (await context.request.get(`/api/maquinas/${machine.id}`)).json()).clienteId).toBe(client.id);
  expect((await (await context.request.get(`/api/ordens-servico/${order.id}`)).json()).clienteId).toBe(client.id);
  const found = await context.request.get(`/api/clientes?ativo=false&termo=${encodeURIComponent(name)}&size=5`);
  expect(found.status()).toBe(200);
  const list = await found.json() as { content: Array<{ id: number }> };
  expect(list.content.some(row => row.id === client.id)).toBe(true);
  await page.goto(`/clientes/${client.id}`);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test('produto: cadastro e validação pela UI persistem código e saldo @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await finishLogin(page, await startLogin(page, request));
  const name = `Cadastro UI CI ${Date.now()}`;
  await page.goto('/produtos');
  await page.getByRole('button', { name: 'Nova Peça / Produto' }).click();
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', { name: 'Cadastrar Peça' });
  await expect(dialog.getByLabel('Código da Peça')).toBeDisabled();
  await dialog.getByLabel('Preço de Venda (R$) *').fill('-1');
  expect(await dialog.getByLabel('Preço de Venda (R$) *').evaluate((field: HTMLInputElement) => field.checkValidity())).toBe(false);
  expect(await dialog.getByLabel('Nome / Descrição Resumida *').evaluate((field: HTMLInputElement) => field.checkValidity())).toBe(false);
  await dialog.getByLabel('Nome / Descrição Resumida *').fill(name);
  await dialog.getByLabel('Preço de Venda (R$) *').fill('27.35');
  await dialog.getByLabel('Estoque Inicial').fill('4');
  await submit.click();
  await expect(dialog).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  const response = await context.request.get(`/api/produtos?termo=${encodeURIComponent(name)}`);
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json() as { content: Array<{ id: number; codigo: string; nome: string; estoqueAtual: number; precoVenda: number }> };
  const product = body.content.find(item => item.nome === name);
  expect(product).toMatchObject({ estoqueAtual: 4, precoVenda: 27.35 });
  expect(product!.codigo).toMatch(/^P-/);
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
});

test('estoque: entrada e saída insuficiente pela UI preservam saldo e histórico @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await finishLogin(page, await startLogin(page, request));
  const name = `Saldo UI CI ${Date.now()}`;
  const created = await context.request.post('/api/produtos', {
    headers: await csrf(context), data: { nome: name, tipo: 'PECA', precoCusto: 10,
      precoVenda: 20, estoqueInicial: 2, estoqueMinimo: 1 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const product = await created.json() as { id: number };
  await page.goto('/estoque');
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByTitle('Ajustar saldo, registrar compra ou descarte').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Entrada de Estoque' }).click();
  await dialog.getByLabel('Quantidade (UN) *').fill('3');
  await dialog.getByLabel('Motivo / Justificativa da Movimentação *').fill('Compra sintética CI');
  await dialog.getByRole('button', { name: 'Confirmar Movimentação' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => Number((await (await context.request.get(`/api/produtos/${product.id}`)).json()).estoqueAtual)).toBe(5);
  await row.getByTitle('Ajustar saldo, registrar compra ou descarte').click();
  await dialog.getByRole('button', { name: 'Saída Avulsa' }).click();
  await dialog.getByLabel('Quantidade (UN) *').fill('6');
  await dialog.getByLabel('Motivo / Justificativa da Movimentação *').fill('Tentativa insuficiente CI');
  await expect(dialog.getByRole('button', { name: 'Confirmar Movimentação' })).toBeDisabled();
  expect(Number((await (await context.request.get(`/api/produtos/${product.id}`)).json()).estoqueAtual)).toBe(5);
  const history = await context.request.get(`/api/estoque/movimentacoes?produtoId=${product.id}`);
  expect(history.status()).toBe(200);
  const movements = await history.json() as { content: Array<{ tipoMovimentacao: string; motivo?: string }> };
  expect(movements.content.filter(item => item.tipoMovimentacao === 'ENTRADA').length).toBe(2);
  expect(movements.content.some(item => item.motivo?.includes('Tentativa insuficiente'))).toBe(false);
  await dialog.getByRole('button', { name: 'Fechar modal' }).click();
  await page.getByRole('link', { name: 'Histórico de Movimentações' }).click();
  await page.getByLabel('Peça (cód/nome) ou usuário...').fill(name);
  await expect(page.getByRole('row').filter({ hasText: 'Compra sintética CI' })).toContainText(name);
  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Movimentações', exact: true }).click();
  await page.getByLabel('Tipo de Movimentação:').selectOption('ENTRADA');
  await expect(page.getByRole('row').filter({ hasText: 'Compra sintética CI' })).toContainText(name);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Movimentações (CSV)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^relatorio-movimentacoes-.*\.csv$/);
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('Motivo / Justificativa');
  expect(csv).toContain('Compra sintética CI');
  expect(csv).toContain(name);
  await page.getByLabel('Tipo de Movimentação:').selectOption('SAIDA');
  await expect(page.getByRole('row').filter({ hasText: 'Compra sintética CI' })).toHaveCount(0);
});

test('cliente: validação, CPF duplicado e inativação pela UI preservam vínculos @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await finishLogin(page, await startLogin(page, request));
  const existingName = `Cliente CPF CI ${Date.now()}`;
  const cpf = '98765432109';
  const created = await context.request.post('/api/clientes', {
    headers: await csrf(context), data: { tipoPessoa: 'FISICA', nomeRazaoSocial: existingName, cpfCnpj: cpf },
  });
  expect(created.status(), await created.text()).toBe(201);
  const client = await created.json() as { id: number };
  const machine = await context.request.post('/api/maquinas', {
    headers: await csrf(context), data: { clienteId: client.id, tipoEquipamento: 'MAQUINA_SOLDA',
      marca: 'ESAB CI', modelo: 'Vínculo UI', numeroSerie: `CI-UI-${Date.now()}` },
  });
  expect(machine.status(), await machine.text()).toBe(201);
  const machineId = (await machine.json() as { id: number }).id;
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo Cliente' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Cadastrar Cliente' }).click();
  await expect(dialog.getByText(/nome.*obrigatório|mínimo.*2/i).first()).toBeVisible();
  await dialog.getByLabel('Nome Completo *').fill('Duplicado UI CI');
  await dialog.getByLabel('CPF').fill(cpf);
  await dialog.getByRole('button', { name: 'Cadastrar Cliente' }).click();
  await expect(dialog.getByText(/CPF\/CNPJ|duplicad|já existe/i).first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Voltar para pesquisar cliente existente' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Voltar para pesquisar cliente existente' }).click();
  await page.goto(`/clientes/${client.id}`);
  await page.getByRole('button', { name: 'Inativar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Sim, Inativar' }).click();
  await expect(page.getByText('Cliente Inativo')).toBeVisible();
  const persisted = await context.request.get(`/api/clientes/${client.id}`);
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).ativo).toBe(false);
  expect((await (await context.request.get(`/api/maquinas/${machineId}`)).json()).clienteId).toBe(client.id);
});

test('OS: preço do servidor e estorno pela UI mantêm saldos íntegros @real-p1', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await finishLogin(page, await startLogin(page, request));
  const client = await context.request.post('/api/clientes', { headers: await csrf(context),
    data: { tipoPessoa: 'FISICA', nomeRazaoSocial: `Cliente estorno CI ${Date.now()}` } });
  expect(client.status(), await client.text()).toBe(201);
  const clientId = (await client.json() as { id: number }).id;
  const machine = await context.request.post('/api/maquinas', { headers: await csrf(context),
    data: { clienteId: clientId, tipoEquipamento: 'MAQUINA_SOLDA', marca: 'ESAB CI', modelo: 'Estorno',
      numeroSerie: `CI-EST-${Date.now()}` } });
  expect(machine.status(), await machine.text()).toBe(201);
  const productName = `Peça estorno CI ${Date.now()}`;
  const product = await context.request.post('/api/produtos', { headers: await csrf(context),
    data: { nome: productName, tipo: 'PECA', precoCusto: 10, precoVenda: 31.45,
      estoqueInicial: 4, estoqueMinimo: 1 } });
  expect(product.status(), await product.text()).toBe(201);
  const productId = (await product.json() as { id: number }).id;
  const order = await context.request.post('/api/ordens-servico', { headers: await csrf(context),
    data: { clienteId: clientId, maquinaId: (await machine.json()).id, problemaRelatado: 'Estorno sintético' } });
  expect(order.status(), await order.text()).toBe(201);
  const orderId = (await order.json() as { id: number }).id;
  await page.goto(`/ordens-servico/${orderId}`);
  await page.locator('#tab-btn-pecas').click();
  await page.getByRole('button', { name: 'Adicionar Peça', exact: true }).first().click();
  const dialog = page.getByTestId('adicionar-peca-modal');
  await dialog.getByLabel('Pesquisar Peça no Estoque (código, nome ou descrição) *').fill(productName);
  await dialog.getByRole('button', { name: new RegExp(productName) }).click();
  await dialog.getByLabel('Quantidade *').fill('2');
  await dialog.getByRole('button', { name: 'Adicionar Peça', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: productName })).toContainText('R$ 31,45');
  expect(Number((await (await context.request.get(`/api/produtos/${productId}`)).json()).estoqueAtual)).toBe(2);
  const items = await context.request.get(`/api/ordens-servico/${orderId}/itens`);
  expect(items.status()).toBe(200);
  expect((await items.json() as Array<{ valorUnitario: number; valorTotal: number }>)[0])
    .toMatchObject({ valorUnitario: 31.45, valorTotal: 62.90 });
  await page.getByRole('button', { name: `Remover ${productName} da OS` }).click();
  await page.getByRole('button', { name: 'Remover Peça', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: productName })).toHaveCount(0);
  expect(Number((await (await context.request.get(`/api/produtos/${productId}`)).json()).estoqueAtual)).toBe(4);
  expect((await (await context.request.get(`/api/ordens-servico/${orderId}/itens`)).json()) as unknown[]).toHaveLength(0);
  expect(Number((await (await context.request.get(`/api/ordens-servico/${orderId}`)).json()).valorPecas)).toBe(0);
});
