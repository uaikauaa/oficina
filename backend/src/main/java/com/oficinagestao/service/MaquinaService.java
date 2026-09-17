package com.oficinagestao.service;

import com.oficinagestao.dto.MaquinaCreateDTO;
import com.oficinagestao.dto.MaquinaResponseDTO;
import com.oficinagestao.dto.MaquinaUpdateDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import org.springframework.data.domain.Page;
import com.oficinagestao.dto.MaquinaResumoDTO;
import com.oficinagestao.dto.OrdemServicoResponseDTO;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.repository.OrdemServicoRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class MaquinaService {

    private final MaquinaRepository maquinaRepository;
    private final ClienteRepository clienteRepository;
    private final AuditoriaService auditoriaService;
    private final OrdemServicoRepository ordemServicoRepository;
    private final OrdemServicoService ordemServicoService;

    public MaquinaService(
            MaquinaRepository maquinaRepository,
            ClienteRepository clienteRepository,
            AuditoriaService auditoriaService,
            OrdemServicoRepository ordemServicoRepository,
            OrdemServicoService ordemServicoService
    ) {
        this.maquinaRepository = maquinaRepository;
        this.clienteRepository = clienteRepository;
        this.auditoriaService = auditoriaService;
        this.ordemServicoRepository = ordemServicoRepository;
        this.ordemServicoService = ordemServicoService;
    }

    @Transactional(readOnly = true)
    public MaquinaResumoDTO obterResumo(Long maquinaId) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(maquinaId)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + maquinaId));

        long totalAtendimentos = ordemServicoRepository.countByMaquinaId(maquinaId);
        BigDecimal valorAcumulado = ordemServicoRepository.somarValorTotalConcluidasPorMaquina(maquinaId);

        Optional<OrdemServico> ultimaOsOpt = ordemServicoRepository.findFirstByMaquinaIdOrderByDataEntradaDesc(maquinaId);

        OffsetDateTime ultimaManutencaoData = null;
        Long ultimaOsId = null;
        String ultimaOsNumero = null;
        String ultimaOsProblema = null;
        StatusOrdemServico ultimaOsStatus = null;

        if (ultimaOsOpt.isPresent()) {
            OrdemServico ultimaOs = ultimaOsOpt.get();
            ultimaOsId = ultimaOs.getId();
            ultimaOsNumero = ultimaOs.getNumeroOs();
            ultimaOsProblema = ultimaOs.getProblemaRelatado();
            ultimaOsStatus = ultimaOs.getStatus();
            ultimaManutencaoData = ultimaOs.getDataConclusao() != null ? ultimaOs.getDataConclusao() : ultimaOs.getDataEntrada();
        }

        return new MaquinaResumoDTO(
                maquina.getId(),
                totalAtendimentos,
                ultimaManutencaoData,
                ultimaOsId,
                ultimaOsNumero,
                ultimaOsProblema,
                ultimaOsStatus,
                valorAcumulado != null ? valorAcumulado : BigDecimal.ZERO
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<OrdemServicoResponseDTO> obterHistorico(Long maquinaId, Pageable pageable) {
        return ordemServicoService.listarPorMaquina(maquinaId, pageable);
    }

    @Transactional
    public MaquinaResponseDTO criar(MaquinaCreateDTO dto, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findById(dto.clienteId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + dto.clienteId()));

        Maquina maquina = new Maquina();
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(dto.tipoEquipamento());
        maquina.setMarca(dto.marca().trim());
        maquina.setModelo(dto.modelo().trim());
        maquina.setAnoFabricacao(dto.anoFabricacao());
        maquina.setNumeroSerie(
                dto.numeroSerie() != null && !dto.numeroSerie().isBlank()
                        ? dto.numeroSerie().trim()
                        : null
        );
        maquina.setHorimetro(parseBigDecimal(dto.horimetro()));
        maquina.setPotencia(
                dto.potencia() != null && !dto.potencia().isBlank()
                        ? dto.potencia().trim()
                        : null
        );
        maquina.setTensao(
                dto.tensao() != null && !dto.tensao().isBlank()
                        ? dto.tensao().trim()
                        : null
        );
        maquina.setObservacoes(dto.observacoes());

        Maquina salva = maquinaRepository.save(maquina);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Maquina", String.valueOf(salva.getId()), "INSERT", ipOrigem);
        }

        return toResponseDTO(salva);
    }

    @Transactional(readOnly = true)
    public MaquinaResponseDTO buscarPorId(Long id) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + id));
        return toResponseDTO(maquina);
    }

    @Transactional(readOnly = true)
    public PageResponse<MaquinaResponseDTO> listar(
            String termo, TipoEquipamento tipoEquipamento, Boolean ativo, Pageable pageable) {
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Maquina> page = maquinaRepository.pesquisarGlobal(termoNormalizado, tipoEquipamento, ativo, pageable);
        return PageResponse.from(page.map(this::toResponseDTO));
    }

    @Transactional(readOnly = true)
    public PageResponse<MaquinaResponseDTO> listarPorCliente(
            Long clienteId, String termo, TipoEquipamento tipoEquipamento, Boolean ativo, Pageable pageable) {
        if (!clienteRepository.existsById(clienteId)) {
            throw new ResourceNotFoundException("Cliente não encontrado com ID: " + clienteId);
        }
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Maquina> page = maquinaRepository.pesquisarPorCliente(
                clienteId, termoNormalizado, tipoEquipamento, ativo, pageable);
        return PageResponse.from(page.map(this::toResponseDTO));
    }

    @Transactional
    public MaquinaResponseDTO atualizar(Long id, MaquinaUpdateDTO dto, Long usuarioId, String ipOrigem) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + id));

        updateEntity(maquina, dto);
        Maquina atualizada = maquinaRepository.save(maquina);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Maquina", String.valueOf(atualizada.getId()), "UPDATE", ipOrigem);
        }

        return toResponseDTO(atualizada);
    }

    @Transactional
    public MaquinaResponseDTO alterarStatus(Long id, boolean ativo, Long usuarioId, String ipOrigem) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + id));

        maquina.setAtivo(ativo);
        Maquina atualizada = maquinaRepository.save(maquina);

        if (usuarioId != null) {
            auditoriaService.registrar(
                    usuarioId,
                    "Maquina",
                    String.valueOf(atualizada.getId()),
                    "UPDATE",
                    ipOrigem
            );
        }

        return toResponseDTO(atualizada);
    }

    // --- Métodos de Mapeamento Diretos ---

    public MaquinaResponseDTO toResponseDTO(Maquina maquina) {
        if (maquina == null) {
            return null;
        }
        return new MaquinaResponseDTO(
                maquina.getId(),
                maquina.getCliente().getId(),
                maquina.getCliente().getNomeRazaoSocial(),
                maquina.getTipoEquipamento(),
                maquina.getTipoEquipamento() != null ? maquina.getTipoEquipamento().getDescricao() : null,
                maquina.getMarca(),
                maquina.getModelo(),
                maquina.getAnoFabricacao(),
                maquina.getNumeroSerie(),
                maquina.getHorimetro(),
                maquina.getPotencia(),
                maquina.getTensao(),
                maquina.getEspecificacoesTecnicas(),
                maquina.getObservacoes(),
                maquina.getAtivo(),
                maquina.getCreatedAt(),
                maquina.getUpdatedAt()
        );
    }

    public void updateEntity(Maquina maquina, MaquinaUpdateDTO dto) {
        maquina.setTipoEquipamento(dto.tipoEquipamento());
        maquina.setMarca(dto.marca().trim());
        maquina.setModelo(dto.modelo().trim());
        maquina.setAnoFabricacao(dto.anoFabricacao());
        maquina.setNumeroSerie(
                dto.numeroSerie() != null && !dto.numeroSerie().isBlank()
                        ? dto.numeroSerie().trim()
                        : null
        );
        maquina.setHorimetro(parseBigDecimal(dto.horimetro()));
        maquina.setPotencia(
                dto.potencia() != null && !dto.potencia().isBlank()
                        ? dto.potencia().trim()
                        : null
        );
        maquina.setTensao(
                dto.tensao() != null && !dto.tensao().isBlank()
                        ? dto.tensao().trim()
                        : null
        );
        maquina.setObservacoes(dto.observacoes());
    }

    public static BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String sanitized = value.replaceAll("\\s+", "").replace(",", ".");
        if (!sanitized.matches("^-?\\d+(\\.\\d+)?$")) {
            throw new BusinessException("Valor de horímetro inválido: " + value);
        }
        try {
            BigDecimal val = new BigDecimal(sanitized);
            if (val.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException("O horímetro não pode ser negativo.");
            }
            return val;
        } catch (NumberFormatException e) {
            throw new BusinessException("Valor de horímetro inválido: " + value);
        }
    }
}
