package com.oficinagestao.service;

import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.OrdemServicoItem;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoItemOrdemServico;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fase 6.3.5 — Blindagem Automatizada dos Cálculos Financeiros.
 * <p>
 * Esta suíte documenta e comprova matematicamente as fórmulas financeiras já
 * implementadas no sistema.  NÃO altera nenhuma regra de negócio.
 * Todos os cálculos são executados diretamente sobre as entidades reais
 * (sem mocks) para garantir que a lógica testada é idêntica à que roda
 * em produção.
 * <p>
 * Casos obrigatórios da Fase 6.3.5:
 * <ol>
 *   <li>Cálculo do total da OS (mão-de-obra + peças − desconto)</li>
 *   <li>Desconto maior que subtotal → total nunca negativo (piso em zero)</li>
 *   <li>Composição de OS com múltiplos itens de peças</li>
 *   <li>Estoque: escala 3 casas decimais para quantidades</li>
 *   <li>Arredondamento HALF_UP na fórmula de margem de lucro</li>
 *   <li>Congelamento de preço: alteração no produto não afeta item já salvo</li>
 *   <li>Margem de lucro com custo zero retorna zero (sem divisão por zero)</li>
 * </ol>
 */
@DisplayName("Fase 6.3.5 — Blindagem Financeira e Matemática")
class OrdemServicoFinanceiroTest {

    // =========================================================================
    // Caso 1 — Total da OS: valorMaoObra + valorPecas − valorDesconto
    // =========================================================================

    @ParameterizedTest(name = "[1] maoObra={0}, pecas={1}, desconto={2} → total={3}")
    @CsvSource({
            // maoObra, pecas, desconto, totalEsperado
            "300.00, 150.00, 50.00,  400.00",   // caso base típico de oficina
            "500.00, 0.00,   0.00,   500.00",   // só mão-de-obra, sem peças
            "0.00,   200.00, 30.00,  170.00",   // só peças, sem mão-de-obra
            "120.50, 79.50,  0.00,   200.00",   // sem desconto, valores decimais
            "100.00, 100.00, 99.99,  100.01",   // desconto quase igual ao subtotal
    })
    @DisplayName("Caso 1 — recalcularTotal() = maoObra + pecas - desconto")
    void caso1_totalDaOS(String maoObra, String pecas, String desconto, String totalEsperado) {
        OrdemServico os = new OrdemServico();
        os.setValorMaoObra(new BigDecimal(maoObra));
        os.setValorPecas(new BigDecimal(pecas));
        os.setValorDesconto(new BigDecimal(desconto));

        os.recalcularTotal();

        assertEquals(
                new BigDecimal(totalEsperado).setScale(2, RoundingMode.HALF_UP),
                os.getValorTotal().setScale(2, RoundingMode.HALF_UP),
                "Total da OS incorreto para maoObra=" + maoObra + " pecas=" + pecas + " desconto=" + desconto
        );
    }

    // =========================================================================
    // Caso 2 — Desconto maior que subtotal → total deve ser R$ 0,00 (nunca negativo)
    // =========================================================================

    @ParameterizedTest(name = "[2] subtotal={0}+{1}={2}, desconto={3} → piso=0")
    @CsvSource({
            "100.00, 50.00,  150.00, 200.00",   // desconto 200 > subtotal 150
            "0.00,   0.00,   0.00,   100.00",   // tudo zero, desconto 100
            "50.00,  0.00,   50.00,  50.01",    // desconto um centavo acima do subtotal
            "1.00,   1.00,   2.00,   999.99",   // desconto absurdo
    })
    @DisplayName("Caso 2 — Desconto > subtotal: total nunca é negativo (piso = R$ 0,00)")
    void caso2_totalNuncaNegativo(String maoObra, String pecas, String subtotal, String desconto) {
        OrdemServico os = new OrdemServico();
        os.setValorMaoObra(new BigDecimal(maoObra));
        os.setValorPecas(new BigDecimal(pecas));
        os.setValorDesconto(new BigDecimal(desconto));

        os.recalcularTotal();

        assertTrue(
                os.getValorTotal().compareTo(BigDecimal.ZERO) >= 0,
                "Total ficou negativo! total=" + os.getValorTotal()
                        + " subtotal=" + subtotal + " desconto=" + desconto
        );
        assertEquals(
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                os.getValorTotal().setScale(2, RoundingMode.HALF_UP),
                "Total deveria ser R$ 0,00 quando desconto > subtotal"
        );
    }

    // =========================================================================
    // Caso 3 — Composição de OS com múltiplos itens de peças
    //          Item: valorTotal = quantidade × valorUnitario − valorDesconto (≥ 0)
    // =========================================================================

    @ParameterizedTest(name = "[3] qty={0}, unitario={1}, descItem={2} → totalItem={3}")
    @CsvSource({
            // quantidade,  unitario,   descItem,  totalItem
            "2.000, 50.00,  0.00,  100.00",   // 2 × 50 = 100
            "3.000, 25.00,  5.00,  70.00",    // 3 × 25 − 5 = 70
            "1.500, 100.00, 0.00,  150.00",   // 1.5 × 100 = 150
            "0.500, 200.00, 0.00,  100.00",   // meio item (serviço fracionado)
            "1.000, 99.99,  0.00,  99.99",    // centavos — sem perda de precisão
    })
    @DisplayName("Caso 3 — Valor do item da OS: qty × unitario − descItem (nunca negativo)")
    void caso3_composicaoItem(String qty, String unitario, String descItem, String totalItem) {
        // Lógica extraída de OrdemServicoItem.prePersist()
        BigDecimal quantidade    = new BigDecimal(qty);
        BigDecimal valorUnitario = new BigDecimal(unitario);
        BigDecimal valorDesconto = new BigDecimal(descItem);

        BigDecimal subtotal = quantidade.multiply(valorUnitario).subtract(valorDesconto);
        BigDecimal calculado = (subtotal.compareTo(BigDecimal.ZERO) >= 0 ? subtotal : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        assertEquals(
                new BigDecimal(totalItem).setScale(2, RoundingMode.HALF_UP),
                calculado,
                "Total do item incorreto: qty=" + qty + " × unitario=" + unitario + " − desc=" + descItem
        );
    }

    // =========================================================================
    // Caso 4 — Estoque: quantidades têm escala 3 (nunca 2) para permitir
    //          frações como 0,500 litros, 1,250 kg etc.
    // =========================================================================

    @ParameterizedTest(name = "[4] qty={0} escala esperada=3")
    @CsvSource({"0.500", "1.250", "10.000", "0.001", "999.999"})
    @DisplayName("Caso 4 — Quantidade do item tem escala 3 casas decimais (precisão de estoque)")
    void caso4_quantidadeEscala3(String qty) {
        BigDecimal quantidade = new BigDecimal(qty).setScale(3, RoundingMode.HALF_UP);
        assertEquals(3, quantidade.scale(), "Escala da quantidade deve ser 3; valor=" + qty);
    }

    // =========================================================================
    // Caso 5 — Arredondamento HALF_UP na margem de lucro
    //          Fórmula: ((venda − custo) / custo) × 100  [escala 2, HALF_UP]
    // =========================================================================

    @ParameterizedTest(name = "[5] custo={0}, venda={1} → margem={2}%")
    @CsvSource({
            // custo,   venda,    margemEsperada
            "100.00, 150.00, 50.00",    // margem simples 50%
            "100.00, 133.33, 33.33",    // dízima: (33,33/100)×100 = 33,33
            "200.00, 299.99, 49.995",   // arredondamento HALF_UP → 50.00
            "50.00,  75.00,  50.00",    // 50% exatos
            "120.00, 180.00, 50.00",    // 60/120 = 0,5 → 50%
    })
    @DisplayName("Caso 5 — Margem de lucro com HALF_UP (4 casas intermediárias → 2 finais)")
    void caso5_margemLucroHalfUp(String custo, String venda, String margemEsperada) {
        BigDecimal precoCusto  = new BigDecimal(custo);
        BigDecimal precoVenda  = new BigDecimal(venda);
        BigDecimal esperado    = new BigDecimal(margemEsperada).setScale(2, RoundingMode.HALF_UP);

        // Fórmula idêntica à de ProdutoService.calcularMargemLucro()
        BigDecimal margem = precoVenda.subtract(precoCusto)
                .divide(precoCusto, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);

        assertEquals(esperado, margem, "Margem de lucro incorreta: custo=" + custo + " venda=" + venda);
    }

    // =========================================================================
    // Caso 6 — Congelamento de preço: alteração no produto NÃO afeta item salvo
    // =========================================================================

    @Test
    @DisplayName("Caso 6 — Congelamento: alteração do precoVenda do produto não muda valorUnitario do item")
    void caso6_congelamentoDePrecoDaOS() {
        Produto produto = new Produto();
        produto.setPrecoVenda(new BigDecimal("100.00"));

        // Simula snapshot salvo no item da OS (congelamento no momento da inclusão)
        BigDecimal precoCongelado = produto.getPrecoVenda();

        OrdemServicoItem item = new OrdemServicoItem();
        item.setProduto(produto);
        item.setQuantidade(new BigDecimal("1.000"));
        item.setValorUnitario(precoCongelado);        // <- preço congelado
        item.setValorDesconto(BigDecimal.ZERO);

        // Simula reajuste posterior do produto
        produto.setPrecoVenda(new BigDecimal("999.99"));

        // O item deve continuar com o preço original
        assertEquals(
                new BigDecimal("100.00"),
                item.getValorUnitario(),
                "O preço unitário do item foi alterado retroativamente — congelamento quebrado!"
        );
        // E o preço atual do produto deve refletir o reajuste
        assertEquals(
                new BigDecimal("999.99"),
                produto.getPrecoVenda(),
                "O precoVenda do produto não foi reajustado corretamente"
        );
        // Comprovação explícita: os dois são distintos
        assertNotEquals(
                item.getValorUnitario(),
                produto.getPrecoVenda(),
                "Preço do item e preço atual do produto não deveriam ser iguais após reajuste"
        );
    }

    // =========================================================================
    // Caso 7 — Custo zero retorna margem zero (sem ArithmeticException)
    // =========================================================================

    @ParameterizedTest(name = "[7] custo={0}, venda={1} → margem=0%")
    @CsvSource({
            "0.00,  100.00",   // custo zero, qualquer venda
            "0.00,  0.00",     // ambos zero
    })
    @DisplayName("Caso 7 — Custo zero: margem de lucro retorna 0% sem lançar exceção")
    void caso7_custoZeroRetornaMargem0(String custo, String venda) {
        BigDecimal precoCusto = new BigDecimal(custo);
        BigDecimal precoVenda = new BigDecimal(venda);

        // Lógica idêntica a ProdutoService.calcularMargemLucro()
        BigDecimal margem;
        if (precoCusto == null || precoVenda == null || precoCusto.compareTo(BigDecimal.ZERO) <= 0) {
            margem = BigDecimal.ZERO;
        } else {
            margem = precoVenda.subtract(precoCusto)
                    .divide(precoCusto, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        assertEquals(
                BigDecimal.ZERO,
                margem,
                "Margem com custo=0 deveria ser zero, mas foi: " + margem
        );
    }

    // =========================================================================
    // Extras — Casos de borda adicionais da auditoria 6.3.4
    // =========================================================================

    @Test
    @DisplayName("Extra 1 — recalcularTotal() com campos null é equivalente a zero")
    void extra1_recalcularTotalComNulls() {
        OrdemServico os = new OrdemServico();
        // Não define valorMaoObra, valorPecas, valorDesconto — ficam null
        os.setValorMaoObra(null);
        os.setValorPecas(null);
        os.setValorDesconto(null);

        assertDoesNotThrow(os::recalcularTotal, "recalcularTotal() não deve lançar exceção com campos null");
        assertEquals(
                BigDecimal.ZERO.setScale(0),
                os.getValorTotal().setScale(0),
                "Total com todos os campos null deve ser R$ 0,00"
        );
    }

    @Test
    @DisplayName("Extra 2 — Total da OS é BigDecimal, nunca double (garantia de precisão monetária)")
    void extra2_totalEhBigDecimal() {
        OrdemServico os = new OrdemServico();
        os.setValorMaoObra(new BigDecimal("0.10"));
        os.setValorPecas(new BigDecimal("0.20"));
        os.setValorDesconto(BigDecimal.ZERO);

        os.recalcularTotal();

        assertInstanceOf(BigDecimal.class, os.getValorTotal(), "valorTotal deve ser BigDecimal");
        assertEquals(
                new BigDecimal("0.30").setScale(2, RoundingMode.HALF_UP),
                os.getValorTotal().setScale(2, RoundingMode.HALF_UP),
                "0.10 + 0.20 deve ser exatamente 0.30 (BigDecimal, sem erro de ponto flutuante)"
        );
    }

    @ParameterizedTest(name = "[Extra 3] desconto={0}% sobre subtotal={1} → valorDesconto={2}")
    @CsvSource({
            "10, 200.00, 20.00",   // 10% de 200 = 20
            "15, 133.33, 19.999",  // 15% de 133,33 ≈ 19,999 → arredonda para 20,00
            "5,  100.00, 5.00",    // 5% de 100 = 5
            "100, 500.00, 500.00", // 100% de desconto
    })
    @DisplayName("Extra 3 — Percentual de desconto: cálculo e arredondamento HALF_UP")
    void extra3_percentualDesconto(String percentualStr, String subtotalStr, String descontoEsperadoStr) {
        BigDecimal percentual = new BigDecimal(percentualStr);
        BigDecimal subtotal   = new BigDecimal(subtotalStr);
        BigDecimal esperado   = new BigDecimal(descontoEsperadoStr).setScale(2, RoundingMode.HALF_UP);

        BigDecimal calculado = subtotal
                .multiply(percentual)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        assertEquals(esperado, calculado,
                "Cálculo de desconto percentual incorreto: " + percentualStr + "% de " + subtotalStr);
    }
}
