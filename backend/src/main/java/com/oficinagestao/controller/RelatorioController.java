package com.oficinagestao.controller;

import com.oficinagestao.dto.EstoqueMovimentacaoResponseDTO;
import com.oficinagestao.dto.PecaMaisUtilizadaDTO;
import com.oficinagestao.dto.RelatorioClienteItemDTO;
import com.oficinagestao.dto.RelatorioEstoqueItemDTO;
import com.oficinagestao.dto.RelatorioMaquinaItemDTO;
import com.oficinagestao.dto.RelatorioOsResponseDTO;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import com.oficinagestao.service.RelatorioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/relatorios")
@Tag(name = "Relatórios", description = "Endpoints de relatórios gerenciais, técnicos e operacionais da oficina")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class RelatorioController {

    private final RelatorioService relatorioService;

    public RelatorioController(RelatorioService relatorioService) {
        this.relatorioService = relatorioService;
    }

    @GetMapping("/ordens-servico")
    @Operation(summary = "Relatório de Ordens de Serviço por Período",
            description = "Retorna contadores de OS no período (total, concluídas, abertas, canceladas, faturamento) e a lista paginada")
    public ResponseEntity<RelatorioOsResponseDTO> relatorioOs(
            @Parameter(description = "Data inicial (ISO-8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataInicio,
            @Parameter(description = "Data final (ISO-8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataFim,
            @Parameter(description = "Filtrar por status específico")
            @RequestParam(required = false) StatusOrdemServico status,
            @Parameter(description = "Indica se deve calcular os contadores agregados de resumo (padrão: true)")
            @RequestParam(required = false, defaultValue = "true") Boolean incluirResumo,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        RelatorioOsResponseDTO response = relatorioService.obterRelatorioOsPorPeriodo(dataInicio, dataFim, status, Boolean.TRUE.equals(incluirResumo), pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/estoque")
    @Operation(summary = "Relatório de Situação de Estoque",
            description = "Lista produtos com saldo atual, estoque mínimo e status de reposição (NORMAL, BAIXO, ZERADO)")
    public ResponseEntity<Page<RelatorioEstoqueItemDTO>> relatorioEstoque(
            @Parameter(description = "Filtrar por categoria")
            @RequestParam(required = false) Long categoriaId,
            @Parameter(description = "Filtrar por fornecedor")
            @RequestParam(required = false) Long fornecedorId,
            @Parameter(description = "Filtrar apenas itens com estoque baixo (atual <= mínimo)")
            @RequestParam(required = false) Boolean estoqueBaixo,
            @Parameter(description = "Filtrar apenas itens com estoque zerado (atual <= 0)")
            @RequestParam(required = false) Boolean zerado,
            @PageableDefault(size = 20, sort = "nome", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<RelatorioEstoqueItemDTO> response = relatorioService.obterRelatorioEstoque(categoriaId, fornecedorId, estoqueBaixo, zerado, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/movimentacoes")
    @Operation(summary = "Relatório de Movimentações de Estoque",
            description = "Histórico paginado de entradas, saídas manuais, baixas por OS e devoluções")
    public ResponseEntity<Page<EstoqueMovimentacaoResponseDTO>> relatorioMovimentacoes(
            @Parameter(description = "Data inicial (ISO-8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataInicio,
            @Parameter(description = "Data final (ISO-8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataFim,
            @Parameter(description = "ID do produto")
            @RequestParam(required = false) Long produtoId,
            @Parameter(description = "Tipo de movimentação")
            @RequestParam(required = false) TipoMovimentacaoEstoque tipo,
            @Parameter(description = "Número da OS")
            @RequestParam(required = false) String numeroOs,
            @PageableDefault(size = 20, sort = "dataMovimentacao", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<EstoqueMovimentacaoResponseDTO> response = relatorioService.obterRelatorioMovimentacoes(dataInicio, dataFim, produtoId, tipo, numeroOs, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/pecas-mais-utilizadas")
    @Operation(summary = "Relatório de Peças Mais Utilizadas",
            description = "Ranking de componentes e peças mais aplicados em ordens de serviço, ordenado por quantidade decrescente")
    public ResponseEntity<Page<PecaMaisUtilizadaDTO>> relatorioPecasMaisUtilizadas(
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<PecaMaisUtilizadaDTO> response = relatorioService.obterPecasMaisUtilizadas(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/clientes")
    @Operation(summary = "Relatório Consolidado de Clientes",
            description = "Lista clientes com contagem de equipamentos, total de OS, última visita e valor acumulado de ordens concluídas")
    public ResponseEntity<Page<RelatorioClienteItemDTO>> relatorioClientes(
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<RelatorioClienteItemDTO> response = relatorioService.obterRelatorioClientes(pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/equipamentos")
    @Operation(summary = "Relatório Consolidado de Equipamentos",
            description = "Lista máquinas com cliente vinculado, total de manutenções, data da última OS e valor acumulado de ordens concluídas")
    public ResponseEntity<Page<RelatorioMaquinaItemDTO>> relatorioEquipamentos(
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<RelatorioMaquinaItemDTO> response = relatorioService.obterRelatorioEquipamentos(pageable);
        return ResponseEntity.ok(response);
    }
}
