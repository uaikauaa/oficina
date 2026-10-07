import { test, expect, type Page } from '@playwright/test';

const user = { id: 1, nome: 'Teste', email: 'teste@oficina.invalid', roles: ['ROLE_ADMIN'] };

async function baseMocks(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
}

test.describe('Modal de Produto: Tipos de Registro e Categorias Técnicas', () => {
  test('abrir modal exibe somente 2 tipos, somente categorias homologadas e permite salvar', async ({ page }) => {
    await baseMocks(page);

    await page.route(/\/api\/categorias\/ativas/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nome: 'Eletrônica', ativo: true },
        { id: 2, nome: 'Máquina de Solda', ativo: true },
        { id: 3, nome: 'Gerador', ativo: true },
        { id: 4, nome: 'Elétrica', ativo: true },
        { id: 5, nome: 'Mecânica', ativo: true },
        { id: 6, nome: 'Consumíveis', ativo: true },
      ]),
    }));

    await page.route(/\/api\/produtos\?/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], totalPages: 0, totalElements: 0 }),
    }));

    let postChamado = false;
    let postBody: { nome?: string; tipo?: string; categoriaId?: number; precoVenda?: string } = {};
    await page.route('**/api/produtos', route => {
      postChamado = true;
      postBody = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 99,
          codigo: 'P-99',
          nome: postBody.nome,
          tipo: postBody.tipo,
          categoriaId: postBody.categoriaId,
          precoVenda: postBody.precoVenda,
          ativo: true,
        }),
      });
    });

    await page.goto('/produtos');
    await page.getByRole('button', { name: /Nova Peça \/ Produto/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 1. Tipos de Registro:
    // Visíveis: Peça / Componente e Consumível de Manutenção
    await expect(dialog.getByRole('button', { name: /Peça \/ Componente/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Consumível de Manutenção/i })).toBeVisible();

    // Não visíveis: Produto Acabado e Serviço Técnico
    await expect(dialog.getByRole('button', { name: /Produto Acabado/i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Serviço Técnico/i })).toHaveCount(0);

    // 2. Categorias Técnicas:
    const categoriaSelect = dialog.locator('select[name="categoriaId"]');
    await expect(categoriaSelect).toBeVisible();
    const optionTexts = await categoriaSelect.locator('option').allInnerTexts();

    expect(optionTexts).toContain('Nenhuma categoria vinculada');
    expect(optionTexts).toContain('Consumíveis');
    expect(optionTexts).toContain('Gerador');
    expect(optionTexts).toContain('Máquina de Solda');
    expect(optionTexts).not.toContain('Eletrônica');
    expect(optionTexts).not.toContain('Elétrica');
    expect(optionTexts).not.toContain('Mecânica');

    // 3. Selecionar valores e salvar
    await dialog.getByRole('button', { name: /Consumível de Manutenção/i }).click();
    await categoriaSelect.selectOption({ label: 'Consumíveis' });
    await dialog.locator('input[name="nome"]').fill('Bocal Cônico 16mm');
    await dialog.locator('input[name="precoVenda"]').fill('45.00');

    await dialog.getByRole('button', { name: /Cadastrar Peça/i }).click();
    await expect(dialog.getByText(/cadastrado com sucesso/i)).toBeVisible();

    expect(postChamado).toBe(true);
    expect(postBody.tipo).toBe('CONSUMIVEL');
    expect(postBody.categoriaId).toBe(6);
  });

  test('abrir modal para edição de produto existente com valores permitidos e salvar com sucesso', async ({ page }) => {
    await baseMocks(page);

    const produtoExistente = {
      id: 42,
      codigo: 'P-042',
      nome: 'Regulador AVR 5kVA',
      tipo: 'PECA',
      tipoDescricao: 'Peça / Componente',
      categoriaId: 3,
      categoriaNome: 'Gerador',
      precoCusto: 80,
      precoVenda: 150,
      estoqueAtual: 5,
      estoqueMinimo: 2,
      ativo: true,
      estoqueBaixo: false,
      semEstoque: false,
    };

    await page.route(/\/api\/categorias\/ativas/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nome: 'Eletrônica', ativo: true },
        { id: 2, nome: 'Máquina de Solda', ativo: true },
        { id: 3, nome: 'Gerador', ativo: true },
        { id: 4, nome: 'Elétrica', ativo: true },
        { id: 5, nome: 'Mecânica', ativo: true },
        { id: 6, nome: 'Consumíveis', ativo: true },
      ]),
    }));

    await page.route(/\/api\/produtos\?/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [produtoExistente], totalPages: 1, totalElements: 1 }),
    }));

    let putChamado = false;
    let putBody: { nome?: string; precoVenda?: number } = {};
    await page.route('**/api/produtos/42', route => {
      putChamado = true;
      putBody = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...produtoExistente, ...putBody }),
      });
    });

    await page.goto('/produtos');
    await page.getByTitle('Editar Peça').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Editar Peça / Componente')).toBeVisible();

    // Validação de tipos na edição
    await expect(dialog.getByRole('button', { name: /Peça \/ Componente/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Consumível de Manutenção/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Produto Acabado/i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Serviço Técnico/i })).toHaveCount(0);

    // Editar preço e salvar
    await dialog.locator('input[name="precoVenda"]').fill('175.00');
    await dialog.getByRole('button', { name: /Salvar Alterações/i }).click();

    await expect(dialog.getByText(/atualizado com sucesso/i)).toBeVisible();
    expect(putChamado).toBe(true);
    expect(putBody.precoVenda).toBe(175);
  });

  for (const tipo of ['PRODUTO', 'SERVICO'] as const) {
    for (const [categoriaId, categoriaNome] of [[1, 'Eletrônica'], [4, 'Elétrica'], [5, 'Mecânica']] as const) {
      test(`A03: ${tipo} + ${categoriaNome} preserva dados históricos na edição`, async ({ page }) => {
        await baseMocks(page);
        const produto = {
          id: 42, codigo: 'P-042', nome: 'Produto histórico', tipo,
          categoriaId, categoriaNome, precoCusto: 80, precoVenda: 150,
          estoqueAtual: 5, estoqueMinimo: 2, ativo: true,
          estoqueBaixo: false, semEstoque: false,
        };
        await page.route('**/api/categorias/ativas', route => route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, nome: 'Eletrônica', ativo: true },
            { id: 4, nome: 'Elétrica', ativo: true },
            { id: 5, nome: 'Mecânica', ativo: true },
            { id: 6, nome: 'Consumíveis', ativo: true },
          ]),
        }));
        await page.route(/\/api\/produtos\?/, route => route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: [produto], totalPages: 1, totalElements: 1 }),
        }));
        const payloads: Array<{ tipo: string; categoriaId: number; precoVenda: number }> = [];
        await page.route('**/api/produtos/42', route => {
          const payload = JSON.parse(route.request().postData() || '{}');
          payloads.push(payload);
          return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ ...produto, ...payload }) });
        });
        await page.goto('/produtos');
        await page.getByTitle('Editar Peça').first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByTestId('tipo-historico')).toContainText(
          tipo === 'PRODUTO' ? 'Produto Acabado (histórico)' : 'Serviço Técnico (histórico)'
        );
        const select = dialog.locator('select[name="categoriaId"]');
        await expect(select).toHaveValue(String(categoriaId));
        await expect(select.locator('option:checked')).toHaveText(`${categoriaNome} (histórica)`);
        await expect(select.locator('option', { hasText: '(histórica)' })).toHaveCount(1);
        await expect(dialog.getByRole('button', { name: /Peça \/ Componente/i })).not.toHaveClass(/border-amber-500/);
        await expect(dialog.getByRole('button', { name: /Consumível de Manutenção/i })).not.toHaveClass(/border-amber-500/);
        await dialog.getByRole('button', { name: /Salvar Alterações/i }).click();
        await expect(dialog.getByText(/atualizado com sucesso/i)).toBeVisible();
        expect(payloads[0]).toMatchObject({ tipo, categoriaId });
        await expect(dialog).toBeHidden();
        await page.reload();
        await page.getByTitle('Editar Peça').first().click();
        await expect(dialog.locator('input[name="precoVenda"]')).toHaveValue('150');
        await dialog.locator('input[name="precoVenda"]').fill('175');
        await dialog.getByRole('button', { name: /Salvar Alterações/i }).click();
        await expect.poll(() => payloads.length).toBe(2);
        expect(payloads[1]).toMatchObject({ tipo, categoriaId, precoVenda: 175 });
      });
    }
  }
});
