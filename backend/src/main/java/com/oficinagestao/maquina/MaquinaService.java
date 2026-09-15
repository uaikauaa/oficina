package com.oficinagestao.maquina;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.cliente.Cliente;
import com.oficinagestao.cliente.ClienteRepository;
import com.oficinagestao.common.PageResponse;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.maquina.dto.MaquinaCreateDTO;
import com.oficinagestao.maquina.dto.MaquinaResponseDTO;
import com.oficinagestao.maquina.dto.MaquinaUpdateDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaquinaService {

    private final MaquinaRepository maquinaRepository;
    private final MaquinaMapper maquinaMapper;
    private final ClienteRepository clienteRepository;
    private final AuditoriaService auditoriaService;

    public MaquinaService(
            MaquinaRepository maquinaRepository,
            MaquinaMapper maquinaMapper,
            ClienteRepository clienteRepository,
            AuditoriaService auditoriaService
    ) {
        this.maquinaRepository = maquinaRepository;
        this.maquinaMapper = maquinaMapper;
        this.clienteRepository = clienteRepository;
        this.auditoriaService = auditoriaService;
    }

    /**
     * Cadastra novo equipamento vinculado a um cliente existente.
     */
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
        maquina.setHorimetro(MaquinaMapper.parseBigDecimal(dto.horimetro()));
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

        return maquinaMapper.toResponseDTO(salva);
    }

    /**
     * Busca um equipamento por ID.
     */
    @Transactional(readOnly = true)
    public MaquinaResponseDTO buscarPorId(Long id) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + id));
        return maquinaMapper.toResponseDTO(maquina);
    }

    /**
     * Lista global de equipamentos com filtros opcionais.
     */
    @Transactional(readOnly = true)
    public PageResponse<MaquinaResponseDTO> listar(
            String termo, TipoEquipamento tipoEquipamento, Boolean ativo, Pageable pageable) {
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Maquina> page = maquinaRepository.pesquisarGlobal(termoNormalizado, tipoEquipamento, ativo, pageable);
        return PageResponse.from(page.map(maquinaMapper::toResponseDTO));
    }

    /**
     * Lista equipamentos de um cliente específico com filtros opcionais.
     */
    @Transactional(readOnly = true)
    public PageResponse<MaquinaResponseDTO> listarPorCliente(
            Long clienteId, String termo, TipoEquipamento tipoEquipamento, Boolean ativo, Pageable pageable) {
        // Valida existência do cliente
        if (!clienteRepository.existsById(clienteId)) {
            throw new ResourceNotFoundException("Cliente não encontrado com ID: " + clienteId);
        }
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Maquina> page = maquinaRepository.pesquisarPorCliente(
                clienteId, termoNormalizado, tipoEquipamento, ativo, pageable);
        return PageResponse.from(page.map(maquinaMapper::toResponseDTO));
    }

    /**
     * Atualiza os dados de um equipamento existente.
     * O cliente do equipamento não pode ser alterado após o cadastro.
     */
    @Transactional
    public MaquinaResponseDTO atualizar(Long id, MaquinaUpdateDTO dto, Long usuarioId, String ipOrigem) {
        Maquina maquina = maquinaRepository.findByIdWithCliente(id)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado com ID: " + id));

        maquinaMapper.updateEntity(maquina, dto);
        Maquina atualizada = maquinaRepository.save(maquina);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Maquina", String.valueOf(atualizada.getId()), "UPDATE", ipOrigem);
        }

        return maquinaMapper.toResponseDTO(atualizada);
    }

    /**
     * Ativa ou inativa um equipamento.
     */
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

        return maquinaMapper.toResponseDTO(atualizada);
    }
}
