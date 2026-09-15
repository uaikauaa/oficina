package com.oficinagestao.ordem;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.cliente.Cliente;
import com.oficinagestao.cliente.ClienteRepository;
import com.oficinagestao.common.PageResponse;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.maquina.Maquina;
import com.oficinagestao.maquina.MaquinaRepository;
import com.oficinagestao.ordem.dto.OrdemServicoCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoResponseDTO;
import com.oficinagestao.ordem.dto.OrdemServicoStatusDTO;
import com.oficinagestao.ordem.dto.OrdemServicoUpdateDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.Year;

@Service
public class OrdemServicoService {

    private final OrdemServicoRepository ordemServicoRepository;
    private final OrdemServicoMapper ordemServicoMapper;
    private final ClienteRepository clienteRepository;
    private final MaquinaRepository maquinaRepository;
    private final AuditoriaService auditoriaService;

    public OrdemServicoService(
            OrdemServicoRepository ordemServicoRepository,
            OrdemServicoMapper ordemServicoMapper,
            ClienteRepository clienteRepository,
            MaquinaRepository maquinaRepository,
            AuditoriaService auditoriaService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.ordemServicoMapper = ordemServicoMapper;
        this.clienteRepository = clienteRepository;
        this.maquinaRepository = maquinaRepository;
        this.auditoriaService = auditoriaService;
    }

    /**
     * Abre uma nova Ordem de Serviço na oficina.
     * <p>
     * Regra Fundamental:
     * O equipamento deve pertencer obrigatoriamente ao cliente informado.
     * A OS inicia com status ABERTA.
     */
    @Transactional
    public OrdemServicoResponseDTO criar(OrdemServicoCreateDTO dto, Long usuarioId, String ipOrigem) {
        // 1. Validar existência do cliente
        Cliente cliente = clienteRepository.findById(dto.clienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + dto.clienteId()));

        // 2. Validar existência do equipamento
        Maquina maquina = maquinaRepository.findByIdWithCliente(dto.maquinaId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + dto.maquinaId()));

        // 3. Regra Crítica: O equipamento DEVE pertencer ao cliente informado
        if (!maquina.getCliente().getId().equals(cliente.getId())) {
            throw new BusinessException("O equipamento informado (ID " + dto.maquinaId() +
                    ") não pertence ao cliente indicado (" + cliente.getNomeRazaoSocial() + ").");
        }

        // 4. Determinar número da OS
        String numeroOs;
        if (dto.numeroOs() != null && !dto.numeroOs().isBlank()) {
            numeroOs = dto.numeroOs().trim();
            if (ordemServicoRepository.existsByNumeroOs(numeroOs)) {
                throw new ConflictException("Já existe uma Ordem de Serviço com o número: " + numeroOs);
            }
        } else {
            numeroOs = gerarProximoNumeroOs();
        }

        // 5. Montar entidade
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
            os.setHorimetroAtual(OrdemServicoMapper.parseBigDecimal(dto.horimetroAtual()));
        }

        OrdemServico salva = ordemServicoRepository.save(os);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "OrdemServico", String.valueOf(salva.getId()), "INSERT", ipOrigem);
        }

        return ordemServicoMapper.toResponseDTO(salva);
    }

    /**
     * Busca uma Ordem de Serviço detalhada por ID.
     */
    @Transactional(readOnly = true)
    public OrdemServicoResponseDTO buscarPorId(Long id) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));
        return ordemServicoMapper.toResponseDTO(os);
    }

    /**
     * Lista global de Ordens de Serviço com filtros opcionais.
     */
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
        return PageResponse.from(page.map(ordemServicoMapper::toResponseDTO));
    }

    /**
     * Consulta o histórico de Ordens de Serviço vinculadas a um cliente específico.
     */
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
        return PageResponse.from(page.map(ordemServicoMapper::toResponseDTO));
    }

    /**
     * Consulta o histórico de manutenções de um equipamento específico.
     * Permite responder: "Quantas vezes essa máquina já veio para a oficina e o que foi feito nela?".
     */
    @Transactional(readOnly = true)
    public PageResponse<OrdemServicoResponseDTO> listarPorMaquina(Long maquinaId, Pageable pageable) {
        if (!maquinaRepository.existsById(maquinaId)) {
            throw new ResourceNotFoundException("Equipamento não encontrado com ID: " + maquinaId);
        }
        Page<OrdemServico> page = ordemServicoRepository.pesquisarPorMaquina(maquinaId, pageable);
        return PageResponse.from(page.map(ordemServicoMapper::toResponseDTO));
    }

    /**
     * Atualiza dados técnicos e financeiros de uma Ordem de Serviço existente.
     * Ordens concluídas ou canceladas não podem ser alteradas livremente.
     */
    @Transactional
    public OrdemServicoResponseDTO atualizar(Long id, OrdemServicoUpdateDTO dto, Long usuarioId, String ipOrigem) {
        OrdemServico os = ordemServicoRepository.findByIdWithClienteAndMaquina(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + id));

        // Validar imutabilidade de ordens terminais
        if (os.getStatus() == StatusOrdemServico.CONCLUIDA) {
            throw new BusinessException("Ordem de Serviço já concluída não pode ser alterada.");
        }
        if (os.getStatus() == StatusOrdemServico.CANCELADA) {
            throw new BusinessException("Ordem de Serviço cancelada não pode ser alterada.");
        }

        // Validação de valores negativos
        validarValoresNaoNegativos(dto.valorMaoObra(), dto.valorPecas(), dto.valorDesconto());

        ordemServicoMapper.updateEntity(os, dto);
        OrdemServico salva = ordemServicoRepository.save(os);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "OrdemServico", String.valueOf(salva.getId()), "UPDATE", ipOrigem);
        }

        return ordemServicoMapper.toResponseDTO(salva);
    }

    /**
     * Altera o status da Ordem de Serviço garantindo regras de transição técnica:
     * - Status terminal não pode sofrer nova transição;
     * - Para PRONTA, é obrigatório ter testes técnicos registrados;
     * - Para CONCLUIDA, preenche data de conclusão automaticamente.
     */
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

        // Se informou testes técnicos no payload de status, atualiza na OS
        if (dto.testesRealizados() != null && !dto.testesRealizados().isBlank()) {
            os.setTestesRealizados(dto.testesRealizados().trim());
        }

        // Validação obrigatória para status PRONTA: deve conter testes técnicos realizados
        if (novoStatus == StatusOrdemServico.PRONTA) {
            if (os.getTestesRealizados() == null || os.getTestesRealizados().isBlank()) {
                throw new BusinessException("Para liberar a Ordem de Serviço como PRONTA, " +
                        "é obrigatório registrar os testes técnicos realizados na bancada.");
            }
        }

        // Se transicionar para CONCLUIDA, registrar data de conclusão
        if (novoStatus == StatusOrdemServico.CONCLUIDA) {
            os.setDataConclusao(OffsetDateTime.now());
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
                    "STATUS_" + novoStatus.name(),
                    ipOrigem
            );
        }

        return ordemServicoMapper.toResponseDTO(salva);
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
    }

    /**
     * Gera o próximo número sequencial de OS no padrão OS-AAAA-XXXX (ex: OS-2026-0001).
     */
    private String gerarProximoNumeroOs() {
        int ano = Year.now().getValue();
        String prefixo = "OS-" + ano + "-";
        long totalNoAno = ordemServicoRepository.countByPrefixo(prefixo);

        int sequencial = (int) totalNoAno + 1;
        String numeroGerado = String.format("OS-%d-%04d", ano, sequencial);

        while (ordemServicoRepository.existsByNumeroOs(numeroGerado)) {
            sequencial++;
            numeroGerado = String.format("OS-%d-%04d", ano, sequencial);
        }

        return numeroGerado;
    }
}
