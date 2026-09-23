package com.oficinagestao.service;

import com.oficinagestao.dto.EstoqueMovimentacaoResponseDTO;
import com.oficinagestao.dto.OrdemServicoResponseDTO;
import com.oficinagestao.dto.PecaMaisUtilizadaDTO;
import com.oficinagestao.dto.RelatorioClienteItemDTO;
import com.oficinagestao.dto.RelatorioEstoqueItemDTO;
import com.oficinagestao.dto.RelatorioMaquinaItemDTO;
import com.oficinagestao.dto.RelatorioOsResumoDTO;
import com.oficinagestao.dto.RelatorioOsResponseDTO;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.EstoqueMovimentacaoRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Serviço responsável pela geração de relatórios gerenciais e técnicos da oficina.
 * Executa agregações e filtros diretamente no banco de dados para máxima performance.
 */
@Service
@Transactional(readOnly = true)
public class RelatorioService {

    private final OrdemServicoRepository ordemServicoRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;
    private final OrdemServicoItemRepository ordemServicoItemRepository;
    private final ClienteRepository clienteRepository;
    private final MaquinaRepository maquinaRepository;
    private final OrdemServicoService ordemServicoService;
    private final EstoqueService estoqueService;

    public RelatorioService(
            OrdemServicoRepository ordemServicoRepository,
            ProdutoRepository produtoRepository,
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            OrdemServicoItemRepository ordemServicoItemRepository,
            ClienteRepository clienteRepository,
            MaquinaRepository maquinaRepository,
            OrdemServicoService ordemServicoService,
            EstoqueService estoqueService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.ordemServicoItemRepository = ordemServicoItemRepository;
        this.clienteRepository = clienteRepository;
        this.maquinaRepository = maquinaRepository;
        this.ordemServicoService = ordemServicoService;
        this.estoqueService = estoqueService;
    }

    /**
     * 1. Relatório de Ordens de Serviço por Período:
     * Retorna os contadores agregados do período (Total, Concluídas, Abertas, Canceladas, Faturamento)
     * juntamente com a lista paginada de Ordens de Serviço.
     */
    public RelatorioOsResponseDTO obterRelatorioOsPorPeriodo(
            OffsetDateTime dataInicio,
            OffsetDateTime dataFim,
            StatusOrdemServico status,
            Pageable pageable
    ) {
        return obterRelatorioOsPorPeriodo(dataInicio, dataFim, status, true, pageable);
    }

    public RelatorioOsResponseDTO obterRelatorioOsPorPeriodo(
            OffsetDateTime dataInicio,
            OffsetDateTime dataFim,
            StatusOrdemServico status,
            boolean incluirResumo,
            Pageable pageable
    ) {
        RelatorioOsResumoDTO resumo = null;
        if (incluirResumo) {
            long totalOs = status == null
                    ? ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, null)
                    : ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, status);
            long concluidas = (status == null || status == StatusOrdemServico.CONCLUIDA)
                    ? ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, StatusOrdemServico.CONCLUIDA)
                    : 0L;
            long abertas = (status == null)
                    ? ordemServicoRepository.contarAbertasPorPeriodo(dataInicio, dataFim)
                    : (status != StatusOrdemServico.CONCLUIDA && status != StatusOrdemServico.CANCELADA
                            ? ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, status)
                            : 0L);
            long canceladas = (status == null || status == StatusOrdemServico.CANCELADA)
                    ? ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, StatusOrdemServico.CANCELADA)
                    : 0L;
            BigDecimal valorTotalConcluidas = (status == null || status == StatusOrdemServico.CONCLUIDA)
                    ? ordemServicoRepository.somarValorConcluidasPorPeriodo(dataInicio, dataFim)
                    : BigDecimal.ZERO;
            BigDecimal valorTotalAReceber = (status == null || (status != StatusOrdemServico.CONCLUIDA && status != StatusOrdemServico.CANCELADA))
                    ? ordemServicoRepository.somarValorAReceberPorPeriodo(dataInicio, dataFim)
                    : BigDecimal.ZERO;

            resumo = new RelatorioOsResumoDTO(
                    totalOs,
                    concluidas,
                    abertas,
                    canceladas,
                    valorTotalConcluidas,
                    valorTotalAReceber
            );
        }

        Page<OrdemServicoResponseDTO> itens = ordemServicoRepository
                .pesquisarGlobal(null, status, dataInicio, dataFim, pageable)
                .map(ordemServicoService::toResponseDTO);

        return new RelatorioOsResponseDTO(resumo, itens);
    }

    /**
     * 2. Relatório de Estoque:
     * Retorna os produtos com seus saldos, estoque mínimo e status visual (NORMAL, BAIXO, ZERADO).
     */
    public Page<RelatorioEstoqueItemDTO> obterRelatorioEstoque(
            Long categoriaId,
            Long fornecedorId,
            Boolean estoqueBaixo,
            Boolean zerado,
            Pageable pageable
    ) {
        return produtoRepository.relatorioEstoque(categoriaId, fornecedorId, estoqueBaixo, zerado, pageable)
                .map(this::converterParaRelatorioEstoque);
    }

    /**
     * 3. Relatório de Movimentações de Estoque:
     * Histórico auditável de entradas, saídas, baixas em OS e estornos com filtros e paginação.
     */
    public Page<EstoqueMovimentacaoResponseDTO> obterRelatorioMovimentacoes(
            OffsetDateTime dataInicio,
            OffsetDateTime dataFim,
            Long produtoId,
            TipoMovimentacaoEstoque tipo,
            String numeroOs,
            Pageable pageable
    ) {
        return estoqueMovimentacaoRepository
                .pesquisarHistorico(produtoId, tipo, dataInicio, dataFim, numeroOs, null, pageable)
                .map(estoqueService::toResponseDTO);
    }

    /**
     * 4. Relatório de Peças Mais Utilizadas:
     * Ranking ordenado por quantidade total consumida a partir dos dados reais das ordens de serviço.
     */
    public Page<PecaMaisUtilizadaDTO> obterPecasMaisUtilizadas(Pageable pageable) {
        return ordemServicoItemRepository.relatorioPecasMaisUtilizadas(pageable);
    }

    /**
     * 5. Relatório Consolidado de Clientes:
     * Indicadores por cliente: contagem de máquinas, total de OS, última visita e valor acumulado
     * considerando exclusivamente ordens CONCLUÍDAS.
     */
    public Page<RelatorioClienteItemDTO> obterRelatorioClientes(Pageable pageable) {
        return clienteRepository.relatorioClientes(pageable);
    }

    /**
     * 6. Relatório Consolidado de Equipamentos:
     * Indicadores por máquina: cliente vinculado, quantidade de OS, data da última manutenção
     * e valor acumulado de ordens CONCLUÍDAS.
     */
    public Page<RelatorioMaquinaItemDTO> obterRelatorioEquipamentos(Pageable pageable) {
        return maquinaRepository.relatorioEquipamentos(pageable);
    }

    private RelatorioEstoqueItemDTO converterParaRelatorioEstoque(Produto p) {
        String statusEstoque;
        BigDecimal atual = p.getEstoqueAtual() != null ? p.getEstoqueAtual() : BigDecimal.ZERO;
        BigDecimal minimo = p.getEstoqueMinimo() != null ? p.getEstoqueMinimo() : BigDecimal.ZERO;

        if (atual.compareTo(BigDecimal.ZERO) <= 0) {
            statusEstoque = "ZERADO";
        } else if (atual.compareTo(minimo) <= 0) {
            statusEstoque = "BAIXO";
        } else {
            statusEstoque = "NORMAL";
        }

        return new RelatorioEstoqueItemDTO(
                p.getId(),
                p.getCodigo(),
                p.getNome(),
                p.getMarca(),
                p.getCategoria() != null ? p.getCategoria().getNome() : "-",
                p.getFornecedor() != null ? p.getFornecedor().getRazaoSocial() : "-",
                atual,
                minimo,
                statusEstoque
        );
    }
}
