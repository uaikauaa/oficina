package com.oficinagestao.service;

import com.oficinagestao.dto.OrdemServicoContadoresDashboardDTO;
import com.oficinagestao.dto.OrdemServicoContadoresStatusDTO;
import com.oficinagestao.dto.OrdemServicoCreateDTO;
import com.oficinagestao.dto.OrdemServicoResponseDTO;
import com.oficinagestao.dto.OrdemServicoStatusDTO;
import com.oficinagestao.dto.OrdemServicoUpdateDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.EstoqueMovimentacaoRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OrdemServicoService {

    private final OrdemServicoRepository ordemServicoRepository;
    private final ClienteRepository clienteRepository;
    private final MaquinaRepository maquinaRepository;
    private final AuditoriaService auditoriaService;
    private final OrdemServicoItemRepository ordemServicoItemRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final PdfService pdfService;

    public OrdemServicoService(
            OrdemServicoRepository ordemServicoRepository,
            ClienteRepository clienteRepository,
            MaquinaRepository maquinaRepository,
            AuditoriaService auditoriaService,
            OrdemServicoItemRepository ordemServicoItemRepository,
            ProdutoRepository produtoRepository,
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            UsuarioRepository usuarioRepository,
            PdfService pdfService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.clienteRepository = clienteRepository;
        this.maquinaRepository = maquinaRepository;
        this.auditoriaService = auditoriaService;
        this.ordemServicoItemRepository = ordemServicoItemRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.pdfService = pdfService;
    }

    @Transactional
    public OrdemServicoResponseDTO criar(OrdemServicoCreateDTO dto, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findById(dto.clienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + dto.clienteId()));

        if (!Boolean.TRUE.equals(cliente.getAtivo())) {
            throw new BusinessException("Não é possível abrir Ordem de Serviço para um cliente inativo.");
        }

        Maquina maquina = maquinaRepository.findByIdWithCliente(dto.maquinaId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + dto.maquinaId()));

        if (!Boolean.TRUE.equals(maquina.getAtivo())) {
            throw new BusinessException("Não é possível abrir Ordem de Serviço para um equipamento inativo.");
        }

        if (!maquina.getCliente().getId().equals(cliente.getId())) {
            throw new BusinessException("O equipamento informado (ID " + dto.maquinaId() +
                    ") não pertence ao cliente indicado (" + cliente.getNomeRazaoSocial() + ").");
        }

        String numeroOs;
        if (dto.numeroOs() != null && !dto.numeroOs().isBlank()) {
            numeroOs = dto.numeroOs().trim();
            if (ordemServicoRepository.existsByNumeroOs(numeroOs)) {
                throw new ConflictException("Já existe uma Ordem de Serviço com o número: " + numeroOs);
            }
        } else {
            numeroOs = gerarProximoNumeroOs();
        }

        OrdemServico os = new OrdemServico();
        os.setNumeroOs(numeroOs);
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setStatus(StatusOrdemServico.ABERTA);
        os.setDataEntrada(dto.dataEntrada() != null ? dto.dataEntrada() : OffsetDateTime.now());
        os.setPrevisaoConclusao(dto.previsaoConclusao());
        os.setProblemaRelatado(dto.problemaRelatado().trim());
        os.setObservacoes(dto.observacoes() != null && !dto.observacoes().isBlank() ? dto.observacoes().trim() : null);

        if (dto.horimetroAtual() != null) {
            os.setHorimetroAtual(parseBigDecimal(dto.horimetroAtual()));
        }

        OrdemServico salva = ordemServicoRepository.save(os);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "OrdemServico", String.valueOf(salva.getId()), "INSERT", ipOrigem);
        }

        return toResponseDTO(salva);
    }

    @Transactional(readOnly = true)
    public OrdemServicoResponseDTO buscarPorId(Long id) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));
        return toResponseDTO(os);
    }

    @Transactional(readOnly = true)
    public byte[] gerarPdf(Long id) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));
        if (os.getCliente() != null && os.getCliente().getEnderecos() != null) {
            os.getCliente().getEnderecos().size(); // força inicialização da coleção
        }
        List<OrdemServicoItem> itens = ordemServicoItemRepository.findByOrdemServicoIdComProduto(id);
        return pdfService.gerarOrdemServicoPdf(os, itens);
    }

    @Transactional(readOnly = true)
    public byte[] gerarDocumentoServico(Long id) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));
        if (os.getCliente() != null && os.getCliente().getEnderecos() != null) {
            os.getCliente().getEnderecos().size(); // força inicialização da coleção
        }
        List<OrdemServicoItem> itens = ordemServicoItemRepository.findByOrdemServicoIdComProduto(id);
        return pdfService.gerarDocumentoServicoPdf(os, itens);
    }

    @Transactional(readOnly = true)
    public byte[] gerarRecibo(Long id) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));
        if (os.getCliente() != null && os.getCliente().getEnderecos() != null) {
            os.getCliente().getEnderecos().size(); // força inicialização da coleção
        }
        List<OrdemServicoItem> itens = ordemServicoItemRepository.findByOrdemServicoIdComProduto(id);
        return pdfService.gerarReciboOsPdf(os, itens);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrdemServicoResponseDTO> listar(
            String termo,
            StatusOrdemServico status,
            OffsetDateTime dataInicio,
            OffsetDateTime dataFim,
            Pageable pageable
    ) {
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<OrdemServico> page = ordemServicoRepository.pesquisarGlobal(
                termoNormalizado, status, dataInicio, dataFim, pageable
        );
        return PageResponse.from(page.map(this::toResponseDTO));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrdemServicoResponseDTO> listarPorCliente(
            Long clienteId,
            StatusOrdemServico status,
            Pageable pageable
    ) {
        if (!clienteRepository.existsById(clienteId)) {
            throw new ResourceNotFoundException("Cliente não encontrado com ID: " + clienteId);
        }
        Page<OrdemServico> page = ordemServicoRepository.pesquisarPorCliente(clienteId, status, pageable);
        return PageResponse.from(page.map(this::toResponseDTO));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrdemServicoResponseDTO> listarPorMaquina(Long maquinaId, Pageable pageable) {
        if (!maquinaRepository.existsById(maquinaId)) {
            throw new ResourceNotFoundException("Equipamento não encontrado com ID: " + maquinaId);
        }
        Page<OrdemServico> page = ordemServicoRepository.pesquisarPorMaquina(maquinaId, pageable);
        return PageResponse.from(page.map(this::toResponseDTO));
    }

    @Transactional
    public OrdemServicoResponseDTO atualizar(Long id, OrdemServicoUpdateDTO dto, Long usuarioId, String ipOrigem) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));

        if (os.getStatus() == StatusOrdemServico.CONCLUIDA) {
            throw new BusinessException("Ordem de Serviço já concluída não pode ser alterada.");
        }
        if (os.getStatus() == StatusOrdemServico.CANCELADA) {
            throw new BusinessException("Ordem de Serviço cancelada não pode ser alterada.");
        }

        validarValoresNaoNegativos(dto.valorMaoObra(), dto.valorPecas(), dto.valorDesconto());

        updateEntity(os, dto);
        OrdemServico salva = ordemServicoRepository.save(os);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "OrdemServico", String.valueOf(salva.getId()), "UPDATE", ipOrigem);
        }

        return toResponseDTO(salva);
    }

    @Transactional
    public OrdemServicoResponseDTO alterarStatus(Long id, OrdemServicoStatusDTO dto, Long usuarioId, String ipOrigem) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));

        StatusOrdemServico statusAtual = os.getStatus();
        StatusOrdemServico novoStatus = dto.status();

        if (statusAtual.isTerminal()) {
            throw new BusinessException("Ordem de Serviço com status " + statusAtual.getDescricao() +
                    " não pode sofrer novas alterações de status.");
        }

        if (!statusAtual.podeTransicionarPara(novoStatus)) {
            throw new BusinessException("Transição de status inválida: não é permitido transicionar de " +
                    statusAtual.getDescricao() + " para " + novoStatus.getDescricao() + ".");
        }

        if (dto.testesRealizados() != null && !dto.testesRealizados().isBlank()) {
            os.setTestesRealizados(dto.testesRealizados().trim());
        }

        if (novoStatus == StatusOrdemServico.PRONTA) {
            if (os.getTestesRealizados() == null || os.getTestesRealizados().trim().length() < 15) {
                throw new BusinessException("Para liberar a Ordem de Serviço como PRONTA, " +
                        "é obrigatório registrar os testes técnicos realizados na bancada (mínimo de 15 caracteres).");
            }
        }

        if (novoStatus == StatusOrdemServico.CONCLUIDA) {
            os.setDataConclusao(OffsetDateTime.now());
        }

        if (novoStatus == StatusOrdemServico.CANCELADA) {
            // P0 — BUG-001: Estorno atômico de peças de volta ao estoque físico
            List<OrdemServicoItem> itens = ordemServicoItemRepository.findByOrdemServicoIdComProduto(os.getId());
            Map<Produto, BigDecimal> pecasAgrupadas = itens.stream()
                    .filter(i -> i.getTipoItem() == TipoItemOrdemServico.PECA)
                    .collect(Collectors.groupingBy(
                            OrdemServicoItem::getProduto,
                            Collectors.reducing(BigDecimal.ZERO, OrdemServicoItem::getQuantidade, BigDecimal::add)
                    ));

            Usuario usuario = usuarioId != null ? usuarioRepository.findById(usuarioId).orElse(null) : null;

            for (Map.Entry<Produto, BigDecimal> entry : pecasAgrupadas.entrySet()) {
                Produto produtoRef = entry.getKey();
                BigDecimal qtdDevolvida = entry.getValue();

                Produto produto = produtoRepository.findByIdWithLock(produtoRef.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Produto vinculado à OS não encontrado. ID: " + produtoRef.getId()));

                BigDecimal saldoAnterior = produto.getEstoqueAtual() != null ? produto.getEstoqueAtual() : BigDecimal.ZERO;
                BigDecimal saldoPosterior = saldoAnterior.add(qtdDevolvida);
                produto.setEstoqueAtual(saldoPosterior);
                produtoRepository.save(produto);

                EstoqueMovimentacao mov = new EstoqueMovimentacao(
                        produto,
                        usuario,
                        os,
                        TipoMovimentacaoEstoque.DEVOLUCAO,
                        qtdDevolvida,
                        produtoRef.getPrecoVenda(),
                        saldoAnterior,
                        saldoPosterior,
                        "Estorno por cancelamento da OS " + os.getNumeroOs()
                );
                estoqueMovimentacaoRepository.save(mov);
            }

            os.setValorPecas(BigDecimal.ZERO);
            os.recalcularTotal();
        }

        if (dto.observacoes() != null && !dto.observacoes().isBlank()) {
            String obsExistente = os.getObservacoes() != null ? os.getObservacoes() + "\n" : "";
            os.setObservacoes(obsExistente + "[Status " + novoStatus.getDescricao() + "]: " + dto.observacoes().trim());
        }

        os.setStatus(novoStatus);
        OrdemServico salva = ordemServicoRepository.save(os);

        if (usuarioId != null) {
            auditoriaService.registrar(
                    usuarioId,
                    "OrdemServico",
                    String.valueOf(salva.getId()),
                    "UPDATE",
                    ipOrigem
            );
        }

        return toResponseDTO(salva);
    }

    // --- Métodos de Mapeamento Diretos ---

    public OrdemServicoResponseDTO toResponseDTO(OrdemServico entity) {
        if (entity == null) {
            return null;
        }

        Cliente cliente = entity.getCliente();
        Maquina maquina = entity.getMaquina();

        String clienteTelefone = null;
        String clienteNome = null;
        String clienteCpfCnpj = null;
        Long clienteId = null;

        if (cliente != null) {
            clienteId = cliente.getId();
            clienteNome = cliente.getNomeRazaoSocial();
            clienteCpfCnpj = cliente.getCpfCnpj();
            if (cliente.getCelular() != null && !cliente.getCelular().isBlank()) {
                clienteTelefone = cliente.getCelular();
            } else {
                clienteTelefone = cliente.getTelefone();
            }
        }

        return new OrdemServicoResponseDTO(
                entity.getId(),
                entity.getNumeroOs(),
                clienteId,
                clienteNome,
                clienteTelefone,
                clienteCpfCnpj,
                maquina != null ? maquina.getId() : null,
                maquina != null ? maquina.getTipoEquipamento() : null,
                maquina != null && maquina.getTipoEquipamento() != null ? maquina.getTipoEquipamento().getDescricao() : null,
                maquina != null ? maquina.getMarca() : null,
                maquina != null ? maquina.getModelo() : null,
                maquina != null ? maquina.getNumeroSerie() : null,
                maquina != null ? maquina.getPotencia() : null,
                maquina != null ? maquina.getTensao() : null,
                entity.getTecnicoResponsavel() != null ? entity.getTecnicoResponsavel().getId() : null,
                entity.getTecnicoResponsavel() != null ? entity.getTecnicoResponsavel().getNome() : null,
                entity.getStatus(),
                entity.getStatus() != null ? entity.getStatus().getDescricao() : null,
                entity.getDataEntrada(),
                entity.getPrevisaoConclusao(),
                entity.getDataConclusao(),
                entity.getProblemaRelatado(),
                entity.getDiagnostico(),
                entity.getSolucaoAplicada(),
                entity.getTestesRealizados(),
                entity.getObservacoes(),
                entity.getHorimetroAtual(),
                entity.getValorMaoObra(),
                entity.getValorPecas(),
                entity.getValorDesconto(),
                entity.getValorTotal(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public void updateEntity(OrdemServico entity, OrdemServicoUpdateDTO dto) {
        if (dto.problemaRelatado() != null && !dto.problemaRelatado().isBlank()) {
            entity.setProblemaRelatado(dto.problemaRelatado().trim());
        }
        if (dto.diagnostico() != null) {
            entity.setDiagnostico(dto.diagnostico().trim().isEmpty() ? null : dto.diagnostico().trim());
        }
        if (dto.solucaoAplicada() != null) {
            entity.setSolucaoAplicada(dto.solucaoAplicada().trim().isEmpty() ? null : dto.solucaoAplicada().trim());
        }
        if (dto.testesRealizados() != null) {
            entity.setTestesRealizados(dto.testesRealizados().trim().isEmpty() ? null : dto.testesRealizados().trim());
        }
        if (dto.observacoes() != null) {
            entity.setObservacoes(dto.observacoes().trim().isEmpty() ? null : dto.observacoes().trim());
        }
        if (dto.horimetroAtual() != null) {
            entity.setHorimetroAtual(parseBigDecimal(dto.horimetroAtual()));
        }
        if (dto.valorMaoObra() != null) {
            entity.setValorMaoObra(dto.valorMaoObra());
        }
        if (dto.valorPecas() != null) {
            // P1 — BUG-002: Se a OS possuir peças cadastradas em ordem_servico_itens,
            // valorPecas é estritamente derivado dos itens e não aceita override manual.
            boolean possuiPecasLancadas = ordemServicoItemRepository.existsByOrdemServicoIdAndTipoItem(entity.getId(), TipoItemOrdemServico.PECA);
            if (possuiPecasLancadas) {
                if (entity.getValorPecas() == null || dto.valorPecas().compareTo(entity.getValorPecas()) != 0) {
                    throw new BusinessException("O valor das peças é recalculado automaticamente a partir dos itens lançados na Ordem de Serviço e não pode ser alterado manualmente.");
                }
            } else {
                entity.setValorPecas(dto.valorPecas());
            }
        }
        if (dto.valorDesconto() != null) {
            entity.setValorDesconto(dto.valorDesconto());
        }
        if (dto.previsaoConclusao() != null) {
            entity.setPrevisaoConclusao(dto.previsaoConclusao());
        }
        entity.recalcularTotal();
    }

    public static BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String sanitized = value.replaceAll("\\s+", "").replace(",", ".");
        if (!sanitized.matches("^-?\\d+(\\.\\d+)?$")) {
            throw new BusinessException("Valor numérico inválido informado para o horímetro: " + value);
        }
        try {
            BigDecimal val = new BigDecimal(sanitized);
            if (val.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException("O horímetro não pode ser negativo.");
            }
            return val;
        } catch (NumberFormatException e) {
            throw new BusinessException("Valor numérico inválido informado para o horímetro: " + value);
        }
    }

    private void validarValoresNaoNegativos(BigDecimal maoObra, BigDecimal pecas, BigDecimal desconto) {
        if (maoObra != null && maoObra.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("O valor da mão de obra não pode ser negativo.");
        }
        if (pecas != null && pecas.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("O valor das peças não pode ser negativo.");
        }
        if (desconto != null && desconto.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("O valor do desconto não pode ser negativo.");
        }
        // RISK-003: Desconto não pode exceder o total de serviços e peças
        BigDecimal subtotal = (maoObra != null ? maoObra : BigDecimal.ZERO).add(pecas != null ? pecas : BigDecimal.ZERO);
        if (desconto != null && desconto.compareTo(subtotal) > 0) {
            throw new BusinessException("O valor do desconto não pode ser superior ao subtotal de serviços e peças.");
        }
    }

    private String gerarProximoNumeroOs() {
        int ano = Year.now().getValue();
        Long seq = null;
        try {
            seq = ordemServicoRepository.getProximoSequencialOs();
        } catch (Exception ignored) {
        }
        if (seq == null || seq <= 0) {
            long totalNoAno = ordemServicoRepository.countByPrefixo("OS-" + ano + "-");
            seq = totalNoAno + 1;
        }
        String numeroGerado = String.format("OS-%d-%04d", ano, seq);

        while (ordemServicoRepository.existsByNumeroOs(numeroGerado)) {
            Long nextSeq = null;
            try {
                nextSeq = ordemServicoRepository.getProximoSequencialOs();
            } catch (Exception ignored) {
            }
            if (nextSeq != null && nextSeq > 0) {
                seq = nextSeq;
            } else {
                seq++;
            }
            numeroGerado = String.format("OS-%d-%04d", ano, seq);
        }

        return numeroGerado;
    }

    @Transactional(readOnly = true)
    public OrdemServicoContadoresDashboardDTO obterContadoresDashboard() {
        long prontas = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.PRONTA);
        long aguardandoAprovacao = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.AGUARDANDO_APROVACAO);
        long emManutencao = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.EM_MANUTENCAO);
        return new OrdemServicoContadoresDashboardDTO(prontas, aguardandoAprovacao, emManutencao);
    }

    @Transactional(readOnly = true)
    public OrdemServicoContadoresStatusDTO obterContadoresStatus() {
        long total = ordemServicoRepository.count();
        long aberta = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.ABERTA);
        long emDiagnostico = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.EM_DIAGNOSTICO);
        long aguardandoAprovacao = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.AGUARDANDO_APROVACAO);
        long emManutencao = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.EM_MANUTENCAO);
        long aguardandoPeca = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.AGUARDANDO_PECA);
        long pronta = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.PRONTA);
        long concluida = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.CONCLUIDA);
        long cancelada = ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.CANCELADA);

        return new OrdemServicoContadoresStatusDTO(
                total,
                aberta,
                emDiagnostico,
                aguardandoAprovacao,
                emManutencao,
                aguardandoPeca,
                pronta,
                concluida,
                cancelada
        );
    }
}
