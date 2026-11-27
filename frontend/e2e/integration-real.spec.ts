import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Real stack smoke: Chromium -> Next.js /api rewrite -> Spring Boot -> PostgreSQL.
 * The SMTP challenge is captured by an isolated Mailpit container, never Gmail.
 * Only runs when the disposable GitHub Actions environment explicitly opts in.
 */
const MAILPIT = 'http://127.0.0.1:8025';
const ADMIN_EMAIL = 'ci.integration@oficina.invalid';

async function readMailpitCode(request: APIRequestContext): Promise<string> {
  let messageId = '';
  await expect.poll(async () => {
    const response = await request.get(MAILPIT + '/api/v1/messages');
    if (!response.ok()) return '';
    const body = await response.json() as {
      messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
    };
    messageId = body.messages?.find(message =>
      message.To?.some(recipient => recipient.Address?.toLowerCase() === ADMIN_EMAIL)
    )?.ID || '';
    return messageId;
  }, { timeout: 30000, intervals: [250, 500, 1000] }).not.toBe('');

  const message = await request.get(MAILPIT + '/api/v1/message/' + encodeURIComponent(messageId));
  expect(message.ok(), 'The synthetic 2FA message must be retrievable').toBeTruthy();
  const data = await message.json() as { Text?: string };
  const code = data.Text?.match(/Seu código de verificação é:\s*(\d{6})/)?.[1];
  expect(code, 'A six-digit 2FA code must arrive at the local SMTP container').toMatch(/^\d{6}$/);
  return code!;
}

async function csrfHeader(context: BrowserContext) {
  const response = await context.request.get('/api/auth/csrf');
  expect(response.status(), 'CSRF token endpoint').toBe(200);
  const payload = await response.json() as { token: string };
  expect(payload.token).toBeTruthy();
  return { 'X-XSRF-TOKEN': payload.token };
}

test('integração real: login 2FA, cadastro, estoque e ordem de serviço @integration-real', async ({ page, context, request }) => {
  test.skip(process.env.RUN_REAL_INTEGRATION !== 'true', 'Only the isolated real-stack CI job executes this test.');
  test.setTimeout(120000);

  // Do not allow accidental execution with an external backend or operational account.
  expect(process.env.CI_INTEGRATION_ADMIN_PASSWORD).toBeTruthy();
  expect(process.env.CI_INTEGRATION_ADMIN_EMAIL).toBe(ADMIN_EMAIL);
  expect(new URL(test.info().project.use.baseURL!).hostname).toBe('localhost');

  const beforeLogin = await context.request.get('/api/clientes');
  expect(beforeLogin.status(), 'Unauthenticated business API must reject access').toBe(401);

  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#senha').fill(process.env.CI_INTEGRATION_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();

  await expect(page.locator('#two-factor-code'), 'Login must require second factor').toBeVisible({ timeout: 15000 });
  // The delivery and reading of 2FA happen over real SMTP + Mailpit, not mocked routes.
  const code = await readMailpitCode(request);
  await page.locator('#two-factor-code').fill(code);
  await page.locator('#verify-2fa-submit-btn').click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20000 });
  await expect(page.getByText('Painel Operacional')).toBeVisible();

  const me = await context.request.get('/api/auth/me');
  expect(me.status(), 'The browser must have a real authenticated cookie session').toBe(200);
  const authCookies = (await context.cookies()).filter(cookie => ['access_token', 'refresh_token'].includes(cookie.name));
  expect(authCookies).toHaveLength(2);
  for (const cookie of authCookies) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe(cookie.name === 'refresh_token' ? 'Strict' : 'Lax');
  }
  const missingCsrf = await context.request.post('/api/clientes', { data: {} });
  expect(missingCsrf.status()).toBe(403);
  const badCsrf = await context.request.post('/api/clientes', { headers: { 'X-XSRF-TOKEN': 'invalid' }, data: {} });
  expect(badCsrf.status()).toBe(403);
  const missing = await context.request.get('/api/ordens-servico/999999999');
  expect(missing.status()).toBe(404);

  const clientName = `Cliente CI ${Date.now()} <img src=x onerror=window.auditXss=1>`;
  const clientResponse = await context.request.post('/api/clientes', {
    headers: await csrfHeader(context),
    data: { tipoPessoa: 'FISICA', nomeRazaoSocial: clientName,
      id: 999999999, ativo: false, roles: ['ROLE_ADMIN'], ['__proto__']: { auditPrototypeCanary: true },
      telefone: `149${Date.now().toString().slice(-8)}`, email: `cliente.${Date.now()}@oficina.invalid` },
  });
  expect(clientResponse.status(), await clientResponse.text()).toBe(201);
  const client = await clientResponse.json() as { id: number; ativo: boolean; roles?: unknown };
  expect(client.id).toBeGreaterThan(0);
  expect(client.id).not.toBe(999999999);
  expect(client.ativo).toBe(true);
  expect(client.roles).toBeUndefined();

  const machineResponse = await context.request.post('/api/maquinas', {
    headers: await csrfHeader(context),
    data: { clienteId: client.id, tipoEquipamento: 'MAQUINA_SOLDA',
      marca: 'ESAB CI', modelo: 'LHN Teste', numeroSerie: `CI-SYNTH-${Date.now()}` },
  });
  expect(machineResponse.status(), await machineResponse.text()).toBe(201);
  const machine = await machineResponse.json() as { id: number };
  expect(machine.id).toBeGreaterThan(0);

  const productResponse = await context.request.post('/api/produtos', {
    headers: await csrfHeader(context),
    data: { nome: `Placa inversora CI ${Date.now()}`, tipo: 'PECA',
      precoCusto: 20, precoVenda: 30, estoqueMinimo: 1, estoqueInicial: 3 },
  });
  expect(productResponse.status(), await productResponse.text()).toBe(201);
  const product = await productResponse.json() as { id: number; estoqueAtual: number };
  expect(Number(product.estoqueAtual)).toBe(3);

  const incoming = await context.request.post('/api/estoque/movimentar', {
    headers: await csrfHeader(context),
    data: { produtoId: product.id, tipoMovimentacao: 'ENTRADA', quantidade: 2,
      valorUnitario: 20, motivo: 'Entrada sintética de integração CI' },
  });
  expect(incoming.status(), await incoming.text()).toBe(201);
  expect(Number((await incoming.json()).quantidadePosterior)).toBe(5);

  const orderResponse = await context.request.post('/api/ordens-servico', {
    headers: await csrfHeader(context),
    data: { clienteId: client.id, maquinaId: machine.id,
      problemaRelatado: 'Não liga (fluxo de integração CI)' },
  });
  expect(orderResponse.status(), await orderResponse.text()).toBe(201);
  const order = await orderResponse.json() as { id: number; numeroOs: string };
  expect(order.id).toBeGreaterThan(0);
  expect(order.numeroOs).toMatch(/^OS-/);
  for (const format of ['pdf', 'documento-servico', 'recibo']) {
    const pdf = await context.request.get(`/api/ordens-servico/${order.id}/${format}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.headers()['cache-control']).toContain('no-store');
  }

  const itemResponse = await context.request.post('/api/ordens-servico/' + order.id + '/itens', {
    headers: await csrfHeader(context),
    data: { produtoId: product.id, quantidade: 2, valorDesconto: 0,
      valorUnitario: 0.01, valorTotal: 0.02, ordemServicoId: 999999999 },
  });
  expect(itemResponse.status(), await itemResponse.text()).toBe(201);
  const item = await itemResponse.json() as { id: number; valorUnitario: number; ordemServicoId: number };
  expect(Number(item.valorUnitario), 'Price comes from the server catalog').toBe(30);
  expect(item.ordemServicoId).toBe(order.id);
  const otherOrderResponse = await context.request.post('/api/ordens-servico', {
    headers: await csrfHeader(context), data: { clienteId: client.id, maquinaId: machine.id, problemaRelatado: 'Teste vinculo item/OS' },
  });
  expect(otherOrderResponse.status()).toBe(201);
  const otherOrder = await otherOrderResponse.json() as { id: number };
  const wrongParent = await context.request.delete(`/api/ordens-servico/${otherOrder.id}/itens/${item.id}`, {
    headers: await csrfHeader(context),
  });
  expect(wrongParent.status(), 'A nested item must belong to the specified order').toBe(404);

  let balance = await context.request.get('/api/produtos/' + product.id);
  expect(balance.status()).toBe(200);
  expect(Number((await balance.json()).estoqueAtual), 'OS must deduct two units').toBe(3);

  // Insufficient balance must not change the persisted stock.
  const insufficient = await context.request.post('/api/ordens-servico/' + order.id + '/itens', {
    headers: await csrfHeader(context),
    data: { produtoId: product.id, quantidade: 999, valorDesconto: 0 },
  });
  expect(insufficient.status(), 'Overselling must be rejected').toBe(400);
  balance = await context.request.get('/api/produtos/' + product.id);
  expect(Number((await balance.json()).estoqueAtual)).toBe(3);

  const remove = await context.request.delete('/api/ordens-servico/' + order.id + '/itens/' + item.id, { headers: await csrfHeader(context) });
  expect(remove.status(), await remove.text()).toBe(204);
  balance = await context.request.get('/api/produtos/' + product.id);
  expect(Number((await balance.json()).estoqueAtual), 'Removing item must restore the reserved stock').toBe(5);

  const movementHistory = await context.request.get('/api/estoque/movimentacoes?produtoId=' + product.id);
  expect(movementHistory.status()).toBe(200);
  const history = await movementHistory.json() as { content: Array<{ tipoMovimentacao: string }> };
  expect(history.content.some(x => x.tipoMovimentacao === 'DEVOLUCAO')).toBeTruthy();
  await page.goto(`/clientes/${client.id}`);
  await expect(page.getByText(clientName, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, 'auditXss')), 'Stored text must not execute HTML').toBe(false);
  expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'auditPrototypeCanary'))).toBe(false);

  // Persisted edits and relationships are checked through fresh API reads and browser navigation.
  const editedName = 'Cliente CI Editado';
  const editedClient = await context.request.put(`/api/clientes/${client.id}`, {
    headers: await csrfHeader(context),
    data: { tipoPessoa: 'FISICA', nomeRazaoSocial: editedName,
      telefone: `149${Date.now().toString().slice(-8)}`, email: `editado.${client.id}@oficina.invalid` },
  });
  expect(editedClient.status(), await editedClient.text()).toBe(200);
  expect((await (await context.request.get(`/api/clientes/${client.id}`)).json()).nomeRazaoSocial).toBe(editedName);
  await page.reload();
  await expect(page.getByText(editedName, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
  const clientDialog = page.getByRole('dialog');
  await clientDialog.getByLabel('Nome Completo *').fill('Cliente UI CI');
  await clientDialog.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(clientDialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Cliente UI CI', { exact: true }).first()).toBeVisible();
  expect((await (await context.request.get(`/api/clientes/${client.id}`)).json()).nomeRazaoSocial).toBe('Cliente UI CI');

  const machineHistory = await context.request.get(`/api/maquinas/${machine.id}/historico`);
  expect(machineHistory.status()).toBe(200);
  expect(((await machineHistory.json()) as { content: Array<{ id: number }> }).content.some(row => row.id === order.id)).toBe(true);
  const editedMachine = await context.request.put(`/api/maquinas/${machine.id}`, {
    headers: await csrfHeader(context),
    data: { tipoEquipamento: 'MAQUINA_SOLDA', marca: 'ESAB CI', modelo: 'Modelo Editado CI',
      numeroSerie: `CI-SYNTH-EDIT-${machine.id}` },
  });
  expect(editedMachine.status(), await editedMachine.text()).toBe(200);
  const persistedMachine = await (await context.request.get(`/api/maquinas/${machine.id}`)).json() as {
    clienteId: number; modelo: string;
  };
  expect(persistedMachine).toMatchObject({ clienteId: client.id, modelo: 'Modelo Editado CI' });
  await page.goto(`/maquinas/${machine.id}`);
  await expect(page.getByText('Modelo Editado CI').first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
  const machineDialog = page.getByRole('dialog');
  await machineDialog.getByLabel('Modelo *').fill('Modelo UI CI');
  await machineDialog.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(machineDialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Modelo UI CI').first()).toBeVisible();
  expect((await (await context.request.get(`/api/maquinas/${machine.id}`)).json()).modelo).toBe('Modelo UI CI');

  const rejectedStockExit = await context.request.post('/api/estoque/saida', {
    headers: await csrfHeader(context),
    data: { produtoId: product.id, quantidade: 999, motivo: 'Saída sintética acima do saldo' },
  });
  expect(rejectedStockExit.status()).toBe(400);
  expect(Number((await (await context.request.get(`/api/produtos/${product.id}`)).json()).estoqueAtual)).toBe(5);

  const financial = await context.request.put(`/api/ordens-servico/${order.id}`, {
    headers: await csrfHeader(context),
    data: { diagnostico: 'Placa testada em bancada', solucaoAplicada: 'Reparo sintético concluído',
      valorMaoObra: 125.35, valorDesconto: 5.10 },
  });
  expect(financial.status(), await financial.text()).toBe(200);
  expect(Number((await financial.json()).valorTotal)).toBe(120.25);
  const changeStatus = async (status: string, testesRealizados?: string) => context.request.patch(
    `/api/ordens-servico/${order.id}/status`, {
      headers: await csrfHeader(context), data: { status, testesRealizados },
    },
  );
  expect((await changeStatus('CONCLUIDA')).status(), 'Skipping required states must be rejected').toBe(400);
  for (const status of ['EM_DIAGNOSTICO', 'EM_MANUTENCAO']) {
    const changed = await changeStatus(status);
    expect(changed.status(), await changed.text()).toBe(200);
  }
  expect((await changeStatus('PRONTA')).status(), 'Bench tests are mandatory').toBe(400);
  expect((await changeStatus('PRONTA', 'Teste sintético sob carga por quinze minutos')).status()).toBe(200);
  expect((await changeStatus('CONCLUIDA')).status()).toBe(200);
  expect((await changeStatus('EM_MANUTENCAO')).status(), 'Terminal order cannot reopen').toBe(400);
  const persistedOrder = await (await context.request.get(`/api/ordens-servico/${order.id}`)).json() as {
    status: string; valorTotal: number; dataConclusao: string;
  };
  expect(persistedOrder.status).toBe('CONCLUIDA');
  expect(Number(persistedOrder.valorTotal)).toBe(120.25);
  expect(persistedOrder.dataConclusao).toBeTruthy();
  const report = await context.request.get('/api/relatorios/ordens-servico');
  expect(report.status()).toBe(200);
  const reportData = await report.json() as { resumo: { totalOs: number; concluidas: number; valorTotalConcluidas: number } };
  expect(reportData.resumo.totalOs).toBe(2);
  expect(reportData.resumo.concluidas).toBe(1);
  expect(Number(reportData.resumo.valorTotalConcluidas)).toBe(120.25);
  await page.goto(`/ordens-servico/${order.id}`);
  await expect(page.getByText('Concluída').first()).toBeVisible();

  const configName = 'Oficina Sintética CI';
  const configSaved = await context.request.put('/api/configuracao-oficina', {
    headers: await csrfHeader(context), data: { nomeFantasia: configName },
  });
  expect(configSaved.status(), await configSaved.text()).toBe(200);
  expect((await (await context.request.get('/api/configuracao-oficina')).json()).nomeFantasia).toBe(configName);
  await page.goto('/configuracoes');
  await expect(page.getByText(configName).first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Nome Fantasia / Comercial *').fill('Oficina UI CI');
  await page.getByRole('button', { name: 'Salvar Configuração' }).click();
  await expect(page.getByText('Oficina UI CI').first()).toBeVisible();
  await page.reload();
  expect((await (await context.request.get('/api/configuracao-oficina')).json()).nomeFantasia).toBe('Oficina UI CI');

  const formulaClient = await context.request.post('/api/clientes', {
    headers: await csrfHeader(context), data: { tipoPessoa: 'FISICA', nomeRazaoSocial: '=1+1' },
  });
  expect(formulaClient.status()).toBe(201);
  await page.goto('/relatorios');
  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Clientes (CSV)', exact: true }).click();
  const csvPath = await (await downloadReady).path();
  expect(csvPath).toBeTruthy();
  expect(await readFile(csvPath!, 'utf8'), 'CSV text must not be emitted as a formula').toContain('"\t=1+1"');

  // Logout pelo botão REAL do navegador: confirma que a camada apiFetch não
  // usa token CSRF obsoleto nem exige uma segunda tentativa manual.
  await page.getByRole('button', { name: 'Menu do usuário autenticado', exact: true }).click();
  await page.locator('#header-logout-btn').click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.locator('#header-logout-btn')).toHaveCount(0);
  const afterLogout = await context.request.get('/api/auth/me');
  expect(afterLogout.status(), 'Logout must invalidate the authenticated session').toBe(401);
});
