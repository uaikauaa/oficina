import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

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

  const headers = await csrfHeader(context);
  const clientResponse = await context.request.post('/api/clientes', {
    headers,
    data: { tipoPessoa: 'FISICA', nomeRazaoSocial: 'Cliente integração CI',
      telefone: '14999990000', email: 'cliente.integration@oficina.invalid' },
  });
  expect(clientResponse.status(), await clientResponse.text()).toBe(201);
  const client = await clientResponse.json() as { id: number };
  expect(client.id).toBeGreaterThan(0);

  const machineResponse = await context.request.post('/api/maquinas', {
    headers,
    data: { clienteId: client.id, tipoEquipamento: 'MAQUINA_SOLDA',
      marca: 'ESAB CI', modelo: 'LHN Teste', numeroSerie: 'CI-SYNTH-001' },
  });
  expect(machineResponse.status(), await machineResponse.text()).toBe(201);
  const machine = await machineResponse.json() as { id: number };
  expect(machine.id).toBeGreaterThan(0);

  const productResponse = await context.request.post('/api/produtos', {
    headers,
    data: { nome: 'Placa inversora CI', tipo: 'PECA',
      precoCusto: 20, precoVenda: 30, estoqueMinimo: 1, estoqueInicial: 3 },
  });
  expect(productResponse.status(), await productResponse.text()).toBe(201);
  const product = await productResponse.json() as { id: number; estoqueAtual: number };
  expect(Number(product.estoqueAtual)).toBe(3);

  const incoming = await context.request.post('/api/estoque/movimentar', {
    headers,
    data: { produtoId: product.id, tipoMovimentacao: 'ENTRADA', quantidade: 2,
      valorUnitario: 20, motivo: 'Entrada sintética de integração CI' },
  });
  expect(incoming.status(), await incoming.text()).toBe(201);
  expect(Number((await incoming.json()).quantidadePosterior)).toBe(5);

  const orderResponse = await context.request.post('/api/ordens-servico', {
    headers,
    data: { clienteId: client.id, maquinaId: machine.id,
      problemaRelatado: 'Não liga (fluxo de integração CI)' },
  });
  expect(orderResponse.status(), await orderResponse.text()).toBe(201);
  const order = await orderResponse.json() as { id: number; numeroOs: string };
  expect(order.id).toBeGreaterThan(0);
  expect(order.numeroOs).toMatch(/^OS-/);

  const itemResponse = await context.request.post('/api/ordens-servico/' + order.id + '/itens', {
    headers,
    data: { produtoId: product.id, quantidade: 2, valorDesconto: 0 },
  });
  expect(itemResponse.status(), await itemResponse.text()).toBe(201);
  const item = await itemResponse.json() as { id: number };

  let balance = await context.request.get('/api/produtos/' + product.id);
  expect(balance.status()).toBe(200);
  expect(Number((await balance.json()).estoqueAtual), 'OS must deduct two units').toBe(3);

  // Insufficient balance must not change the persisted stock.
  const insufficient = await context.request.post('/api/ordens-servico/' + order.id + '/itens', {
    headers,
    data: { produtoId: product.id, quantidade: 999, valorDesconto: 0 },
  });
  expect(insufficient.status(), 'Overselling must be rejected').toBe(400);
  balance = await context.request.get('/api/produtos/' + product.id);
  expect(Number((await balance.json()).estoqueAtual)).toBe(3);

  const remove = await context.request.delete('/api/ordens-servico/' + order.id + '/itens/' + item.id, { headers });
  expect(remove.status(), await remove.text()).toBe(204);
  balance = await context.request.get('/api/produtos/' + product.id);
  expect(Number((await balance.json()).estoqueAtual), 'Removing item must restore the reserved stock').toBe(5);

  const movementHistory = await context.request.get('/api/estoque/movimentacoes?produtoId=' + product.id);
  expect(movementHistory.status()).toBe(200);
  const history = await movementHistory.json() as { content: Array<{ tipoMovimentacao: string }> };
  expect(history.content.some(x => x.tipoMovimentacao === 'DEVOLUCAO')).toBeTruthy();

  const logout = await context.request.post('/api/auth/logout', { headers });
  expect(logout.status(), await logout.text()).toBe(200);
  const afterLogout = await context.request.get('/api/auth/me');
  expect(afterLogout.status(), 'Logout must invalidate the authenticated session').toBe(401);
});
