package com.oficinagestao.service;

import com.oficinagestao.dto.MaquinaCreateDTO;
import com.oficinagestao.dto.MaquinaResponseDTO;
import com.oficinagestao.dto.MaquinaUpdateDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class MaquinaService {

    private final MaquinaRepository maquinaRepository;
    private final ClienteRepository clienteRepository;
    private final AuditoriaService auditoriaService;

    public MaquinaService(
            MaquinaRepository maquinaRepository,
            ClienteRepository clienteRepository,
            AuditoriaService auditoriaService
    ) {
        this.maquinaRepository = maquinaRepository;
        this.clienteRepository = clienteRepository;
        this.auditoriaService = auditoriaService;
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
                    ativo ? "ATIVACAO" : "INATIVACAO",
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
        try {
            return new BigDecimal(value.replace(",", ".").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
