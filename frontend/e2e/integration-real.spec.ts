import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

/**
 * Real stack smoke: Chromium -> Next.js /api rewrite -> Spring Boot -> PostgreSQL.
 * The SMTP challenge is captured by an isolated Mailpit container, never Gmail.
 * Only runs when the disposable GitHub Actions environment explicitly opts in.
 */
const MAILPIT = 'http://127.0.0.1:8025';
const ADMIN_EMAIL = 'ci.integration@oficina.invalid';

async function readMailpitCode(request: APIRequestContext, recipient = ADMIN_EMAIL): Promise<string> {
  let messageId = '';
  await expect.poll(async () => {
    const response = await request.get(MAILPIT + '/api/v1/messages');
    if (!response.ok()) return '';
    const body = await response.json() as {
      messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
    };
    messageId = body.messages?.find(message =>
      message.To?.some(address => address.Address?.toLowerCase() === recipient)
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

test('admin real isolado: provisionamento, convite, RBAC e telas @integration-real', async ({ page, context, request, browser }) => {
  test.skip(process.env.RUN_REAL_INTEGRATION !== 'true');
  test.setTimeout(180000);
  const ownerEmail = 'ci.superadmin@oficina.invalid';
  const ownerPassword = 'SyntheticSuperAdmin#2026!';
  const login = async (target: typeof page, email: string, password: string) => {
    const container = process.env.CI_INTEGRATION_POSTGRES_CONTAINER;
    expect(container).toMatch(/^oficina-hml-postgres-[a-f0-9]{8}$/);
    execFileSync('docker', ['exec', container!, 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci',
      '-c', 'DELETE FROM security_rate_limits'], { windowsHide: true });
    const remaining = execFileSync('docker', ['exec', container!, 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci',
      '-tA', '-c', 'SELECT count(*) FROM security_rate_limits'], { encoding: 'utf8', windowsHide: true }).trim();
    expect(remaining).toBe('0');
    await target.goto('/login');
    await target.locator('#email').fill(email);
    await target.locator('#senha').fill(password);
    await target.locator('button[type="submit"]').first().click();
    await expect(target.locator('#two-factor-code')).toBeVisible({ timeout: 15000 });
    await target.locator('#two-factor-code').fill(await readMailpitCode(request, email));
    await target.locator('#verify-2fa-submit-btn').click();
    await expect(target).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20000 });
  };
  const inviteToken = async (recipient: string) => {
    let id = '';
    await expect.poll(async () => {
      const response = await request.get(MAILPIT + '/api/v1/messages');
      const data = await response.json() as { messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }> };
      id = data.messages?.find(message => message.To?.some(to => to.Address?.toLowerCase() === recipient))?.ID || '';
      return id;
    }, { timeout: 30000, intervals: [250, 500, 1000] }).not.toBe('');
    const response = await request.get(MAILPIT + '/api/v1/message/' + encodeURIComponent(id));
    const data = await response.json() as { Text?: string };
    const token = data.Text?.match(/\/convite\?token=([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    return token!;
  };

  // The preceding operational test used this same synthetic bootstrap account.
  // AuthService enforces a 30-second gap between 2FA challenges per account.
  await page.waitForTimeout(31000);
  await login(page, ADMIN_EMAIL, process.env.CI_INTEGRATION_ADMIN_PASSWORD!);
  const bootstrap = await context.request.post('/api/admin/provisionamento/super-admin', {
    headers: await csrfHeader(context),
    data: { senhaAtual: process.env.CI_INTEGRATION_ADMIN_PASSWORD, motivo: 'Provisionamento sintético em banco descartável',
      confirmacao: 'PROVISIONAR_SUPER_ADMIN' },
  });
  expect(bootstrap.status(), await bootstrap.text()).toBe(202);
  const token = await inviteToken(ownerEmail);
  await page.goto('/convite?token=' + token);
  await expect(page).toHaveURL(/\/convite$/);
  await page.getByLabel('Seu nome').fill('Super Admin Sintético');
  await page.getByLabel('Crie sua senha').fill(ownerPassword);
  await page.getByRole('button', { name: 'Ativar conta' }).click();
  await expect(page.getByText('Conta criada.')).toBeVisible();
  const replay = await context.request.post('/api/auth/convites/aceitar', {
    headers: await csrfHeader(context), data: { token, nome: 'Replay', senha: ownerPassword },
  });
  expect(replay.status()).toBeGreaterThanOrEqual(400);

  const ownerContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, ownerEmail, ownerPassword);
    const me = await ownerContext.request.get('/api/auth/me');
    expect((await me.json() as { roles: string[] }).roles).toContain('ROLE_SUPER_ADMIN');
    for (const path of ['/administracao', '/administracao/usuarios', '/administracao/papeis',
      '/administracao/auditoria', '/administracao/infraestrutura', '/convite']) {
      await ownerPage.goto(path);
      await expect(ownerPage.locator('main h1')).toBeVisible();
      await expect(ownerPage.getByText('Acesso restrito')).toHaveCount(0);
      for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [1920, 1080]]) {
        await ownerPage.setViewportSize({ width, height });
        await expect.poll(() => ownerPage.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
      }
    }
    for (const endpoint of ['/api/admin/usuarios?search=ci.superadmin&page=0&size=1',
      '/api/admin/papeis', '/api/admin/permissoes', '/api/admin/auditoria', '/api/admin/infraestrutura']) {
      const response = await ownerContext.request.get(endpoint);
      expect(response.status(), endpoint + ': ' + await response.text()).toBe(200);
    }
    const ownerSearch = await ownerContext.request.get('/api/admin/usuarios?search=ci.superadmin&size=1');
    const ownerRows = await ownerSearch.json() as { content: Array<{ id: number }> };
    const ownerId = ownerRows.content[0]?.id;
    expect(ownerId).toBeGreaterThan(0);
    const selfDisable = await ownerContext.request.patch(`/api/admin/usuarios/${ownerId}/status`, {
      headers: await csrfHeader(ownerContext),
      data: { motivo: 'Negativo sintético de autodesativação', senhaAtual: ownerPassword,
        confirmacao: 'ALTERAR_STATUS', ativo: false },
    });
    expect(selfDisable.status()).toBe(403);
    const newRole = await ownerContext.request.post('/api/admin/papeis', {
      headers: await csrfHeader(ownerContext),
      data: { nome: 'ROLE_CUSTOM_STAGE32', descricao: 'Papel sintético de ensaio', permissoes: ['clientes.get'],
        motivo: 'Criação de papel sintético para ensaio', senhaAtual: ownerPassword, confirmacao: 'GERENCIAR_PAPEL' },
    });
    expect(newRole.status(), await newRole.text()).toBe(201);
    const roleId = (await newRole.json() as { id: number }).id;
    const changedRole = await ownerContext.request.put(`/api/admin/papeis/${roleId}`, {
      headers: await csrfHeader(ownerContext),
      data: { nome: 'ROLE_CUSTOM_STAGE32', descricao: 'Papel sintético atualizado',
        permissoes: ['clientes.get', 'maquinas.get'], motivo: 'Atualização de permissão sintética',
        senhaAtual: ownerPassword, confirmacao: 'GERENCIAR_PAPEL' },
    });
    expect(changedRole.status(), await changedRole.text()).toBe(200);
    const operatorEmail = 'ci.operator@oficina.invalid';
    const operatorPassword = 'SyntheticOperator#2026!';
    const created = await ownerContext.request.post('/api/admin/convites', {
      headers: await csrfHeader(ownerContext),
      data: { email: operatorEmail, role: 'ROLE_OPERADOR_GERAL', motivo: 'Operador sintético para validação isolada',
        senhaAtual: ownerPassword, confirmacao: 'CRIAR_CONVITE' },
    });
    expect(created.status(), await created.text()).toBe(202);
    const operatorToken = await inviteToken(operatorEmail);
    const accepted = await ownerContext.request.post('/api/auth/convites/aceitar', {
      headers: await csrfHeader(ownerContext),
      data: { token: operatorToken, nome: 'Operador Sintético', senha: operatorPassword },
    });
    expect(accepted.status(), await accepted.text()).toBe(204);
    const operatorContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const operatorPage = await operatorContext.newPage();
      await login(operatorPage, operatorEmail, operatorPassword);
      expect((await operatorContext.request.get('/api/admin/usuarios')).status()).toBe(403);
      expect((await operatorContext.request.get('/api/clientes')).status()).toBe(200);
      expect((await operatorContext.request.get('/api/relatorios/clientes')).status()).toBe(200);
      await operatorPage.goto('/administracao');
      await expect(operatorPage.getByText('Acesso restrito')).toBeVisible();
    } finally { await operatorContext.close(); }
    const operatorSearch = await ownerContext.request.get('/api/admin/usuarios?search=ci.operator&size=1');
    const operatorRows = await operatorSearch.json() as { content: Array<{ id: number }> };
    const operatorId = operatorRows.content[0]?.id;
    expect(operatorId).toBeGreaterThan(0);
    const revoke = await ownerContext.request.post(`/api/admin/usuarios/${operatorId}/revogar-sessoes`, {
      headers: await csrfHeader(ownerContext),
      data: { motivo: 'Revogação sintética de sessões de operador', senhaAtual: ownerPassword,
        confirmacao: 'REVOGAR_SESSOES' },
    });
    expect(revoke.status(), await revoke.text()).toBe(204);
    const changeRole = await ownerContext.request.put(`/api/admin/usuarios/${operatorId}/papeis`, {
      headers: await csrfHeader(ownerContext),
      data: { motivo: 'Atribuição sintética de papel personalizado', senhaAtual: ownerPassword,
        confirmacao: 'ALTERAR_PAPEIS', roles: ['ROLE_CUSTOM_STAGE32'] },
    });
    expect(changeRole.status(), await changeRole.text()).toBe(200);
    const audit = await ownerContext.request.get('/api/admin/auditoria');
    expect(audit.status()).toBe(200);
    expect((await audit.json() as { totalElements: number }).totalElements).toBeGreaterThan(0);
    const consultEmail = 'ci.consulta@oficina.invalid';
    const consultPassword = 'SyntheticConsulta#2026!';
    const consultInvite = await ownerContext.request.post('/api/admin/convites', {
      headers: await csrfHeader(ownerContext),
      data: { email: consultEmail, role: 'ROLE_CONSULTA', motivo: 'Consulta sintética para validação RBAC',
        senhaAtual: ownerPassword, confirmacao: 'CRIAR_CONVITE' },
    });
    expect(consultInvite.status(), await consultInvite.text()).toBe(202);
    const consultToken = await inviteToken(consultEmail);
    const consultAccept = await ownerContext.request.post('/api/auth/convites/aceitar', {
      headers: await csrfHeader(ownerContext),
      data: { token: consultToken, nome: 'Consulta Sintética', senha: consultPassword },
    });
    expect(consultAccept.status(), await consultAccept.text()).toBe(204);
    const consultContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const consultPage = await consultContext.newPage();
      await login(consultPage, consultEmail, consultPassword);
      expect((await consultContext.request.get('/api/clientes')).status()).toBe(200);
      for (const path of ['/api/admin/usuarios', '/api/ordens-servico', '/api/produtos',
        '/api/relatorios/clientes', '/api/configuracao-oficina']) {
        expect((await consultContext.request.get(path)).status(), path).toBe(403);
      }
    } finally { await consultContext.close(); }
  } finally { await ownerContext.close(); }
});
