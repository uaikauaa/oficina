package com.oficinagestao.service;

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
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
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
    private final ClienteRepository clienteRepository;
    private final MaquinaRepository maquinaRepository;
    private final AuditoriaService auditoriaService;

    public OrdemServicoService(
            OrdemServicoRepository ordemServicoRepository,
            ClienteRepository clienteRepository,
            MaquinaRepository maquinaRepository,
            AuditoriaService auditoriaService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.clienteRepository = clienteRepository;
        this.maquinaRepository = maquinaRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public OrdemServicoResponseDTO criar(OrdemServicoCreateDTO dto, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findById(dto.clienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + dto.clienteId()));

        Maquina maquina = maquinaRepository.findByIdWithCliente(dto.maquinaId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + dto.maquinaId()));

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
            if (os.getTestesRealizados() == null || os.getTestesRealizados().isBlank()) {
                throw new BusinessException("Para liberar a Ordem de Serviço como PRONTA, " +
                        "é obrigatório registrar os testes técnicos realizados na bancada.");
            }
        }

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
            entity.setValorPecas(dto.valorPecas());
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
        try {
            return new BigDecimal(value.trim().replace(",", "."));
        } catch (NumberFormatException e) {
            return null;
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
    }

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
