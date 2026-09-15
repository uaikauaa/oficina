package com.oficinagestao.cliente;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.cliente.dto.ClienteCreateDTO;
import com.oficinagestao.cliente.dto.ClienteResponseDTO;
import com.oficinagestao.cliente.dto.ClienteUpdateDTO;
import com.oficinagestao.common.PageResponse;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final ClienteMapper clienteMapper;
    private final AuditoriaService auditoriaService;

    public ClienteService(
            ClienteRepository clienteRepository,
            ClienteMapper clienteMapper,
            AuditoriaService auditoriaService
    ) {
        this.clienteRepository = clienteRepository;
        this.clienteMapper = clienteMapper;
        this.auditoriaService = auditoriaService;
    }

    @Transactional(readOnly = true)
    public PageResponse<ClienteResponseDTO> listar(String termo, TipoPessoa tipoPessoa, Boolean ativo, Pageable pageable) {
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Cliente> page = clienteRepository.pesquisar(termoNormalizado, tipoPessoa, ativo, pageable);
        return PageResponse.from(page.map(cliente -> clienteMapper.toResponseDTO(cliente, 0L)));
    }

    @Transactional(readOnly = true)
    public ClienteResponseDTO buscarPorId(Long id) {
        Cliente cliente = clienteRepository.findByIdWithEnderecos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + id));
        return clienteMapper.toResponseDTO(cliente, 0L);
    }

    @Transactional
    public ClienteResponseDTO criar(ClienteCreateDTO dto, Long usuarioId, String ipOrigem) {
        validarDuplicidadeCriacao(dto);

        Cliente cliente = clienteMapper.toEntity(dto);
        Cliente salvo = clienteRepository.save(cliente);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Cliente", String.valueOf(salvo.getId()), "INSERT", ipOrigem);
        }

        return clienteMapper.toResponseDTO(salvo, 0L);
    }

    @Transactional
    public ClienteResponseDTO atualizar(Long id, ClienteUpdateDTO dto, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findByIdWithEnderecos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + id));

        validarDuplicidadeAtualizacao(id, dto);

        clienteMapper.updateEntity(cliente, dto);
        Cliente atualizado = clienteRepository.save(cliente);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Cliente", String.valueOf(atualizado.getId()), "UPDATE", ipOrigem);
        }

        return clienteMapper.toResponseDTO(atualizado, 0L);
    }

    @Transactional
    public ClienteResponseDTO alterarStatus(Long id, boolean ativo, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findByIdWithEnderecos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + id));

        cliente.setAtivo(ativo);
        Cliente atualizado = clienteRepository.save(cliente);

        if (usuarioId != null) {
            auditoriaService.registrar(
                    usuarioId,
                    "Cliente",
                    String.valueOf(atualizado.getId()),
                    ativo ? "ATIVACAO" : "INATIVACAO",
                    ipOrigem
            );
        }

        return clienteMapper.toResponseDTO(atualizado, 0L);
    }

    private void validarDuplicidadeCriacao(ClienteCreateDTO dto) {
        // Validação de Razão Social / Nome
        if (dto.nomeRazaoSocial() != null && !dto.nomeRazaoSocial().isBlank()) {
            if (clienteRepository.existsByNomeRazaoSocialIgnoreCase(dto.nomeRazaoSocial().trim())) {
                throw new ConflictException("Já existe um cliente cadastrado com este Nome ou Razão Social.");
            }
        }

        // Validação de CPF/CNPJ
        if (dto.cpfCnpj() != null && !dto.cpfCnpj().isBlank()) {
            if (clienteRepository.existsByCpfCnpj(dto.cpfCnpj().trim())) {
                throw new ConflictException("Já existe um cliente cadastrado com este CPF/CNPJ.");
            }
        }

        // Validação de Telefone/Celular
        if (dto.telefone() != null && !dto.telefone().isBlank()) {
            if (clienteRepository.existsByTelefoneOuCelular(dto.telefone().trim())) {
                throw new ConflictException("Já existe um cliente cadastrado com este Telefone/Celular.");
            }
        }

        if (dto.celular() != null && !dto.celular().isBlank()) {
            if (clienteRepository.existsByTelefoneOuCelular(dto.celular().trim())) {
                throw new ConflictException("Já existe um cliente cadastrado com este Telefone/Celular.");
            }
        }
    }

    private void validarDuplicidadeAtualizacao(Long id, ClienteUpdateDTO dto) {
        // Validação de Razão Social / Nome
        if (dto.nomeRazaoSocial() != null && !dto.nomeRazaoSocial().isBlank()) {
            if (clienteRepository.existsByNomeRazaoSocialIgnoreCaseAndIdNot(dto.nomeRazaoSocial().trim(), id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Nome ou Razão Social.");
            }
        }

        // Validação de CPF/CNPJ
        if (dto.cpfCnpj() != null && !dto.cpfCnpj().isBlank()) {
            if (clienteRepository.existsByCpfCnpjAndIdNot(dto.cpfCnpj().trim(), id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este CPF/CNPJ.");
            }
        }

        // Validação de Telefone/Celular
        if (dto.telefone() != null && !dto.telefone().isBlank()) {
            if (clienteRepository.existsByTelefoneOuCelularAndIdNot(dto.telefone().trim(), id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Telefone/Celular.");
            }
        }

        if (dto.celular() != null && !dto.celular().isBlank()) {
            if (clienteRepository.existsByTelefoneOuCelularAndIdNot(dto.celular().trim(), id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Telefone/Celular.");
            }
        }
    }
}
