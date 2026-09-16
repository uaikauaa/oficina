package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final AuditoriaService auditoriaService;
    private final MaquinaRepository maquinaRepository;

    public ClienteService(
            ClienteRepository clienteRepository,
            AuditoriaService auditoriaService,
            MaquinaRepository maquinaRepository
    ) {
        this.clienteRepository = clienteRepository;
        this.auditoriaService = auditoriaService;
        this.maquinaRepository = maquinaRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<ClienteResponseDTO> listar(String termo, TipoPessoa tipoPessoa, Boolean ativo, Pageable pageable) {
        String termoNormalizado = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        Page<Cliente> page = clienteRepository.pesquisar(termoNormalizado, tipoPessoa, ativo, pageable);
        return PageResponse.from(page.map(cliente ->
                toResponseDTO(cliente, maquinaRepository.countByClienteId(cliente.getId()))));
    }

    @Transactional(readOnly = true)
    public ClienteResponseDTO buscarPorId(Long id) {
        Cliente cliente = clienteRepository.findByIdWithEnderecos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + id));
        long totalEquipamentos = maquinaRepository.countByClienteId(id);
        return toResponseDTO(cliente, totalEquipamentos);
    }

    @Transactional
    public ClienteResponseDTO criar(ClienteCreateDTO dto, Long usuarioId, String ipOrigem) {
        validarDuplicidadeCriacao(dto);

        Cliente cliente = toEntity(dto);
        Cliente salvo = clienteRepository.save(cliente);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Cliente", String.valueOf(salvo.getId()), "INSERT", ipOrigem);
        }

        return toResponseDTO(salvo, 0L);
    }

    @Transactional
    public ClienteResponseDTO atualizar(Long id, ClienteUpdateDTO dto, Long usuarioId, String ipOrigem) {
        Cliente cliente = clienteRepository.findByIdWithEnderecos(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado com ID: " + id));

        validarDuplicidadeAtualizacao(id, dto);

        updateEntity(cliente, dto);
        Cliente atualizado = clienteRepository.save(cliente);

        if (usuarioId != null) {
            auditoriaService.registrar(usuarioId, "Cliente", String.valueOf(atualizado.getId()), "UPDATE", ipOrigem);
        }

        long totalEquipamentos = maquinaRepository.countByClienteId(atualizado.getId());
        return toResponseDTO(atualizado, totalEquipamentos);
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

        long totalEquipamentos = maquinaRepository.countByClienteId(atualizado.getId());
        return toResponseDTO(atualizado, totalEquipamentos);
    }

    // --- Métodos de Mapeamento Diretos ---

    public ClienteResponseDTO toResponseDTO(Cliente cliente, long totalEquipamentos) {
        if (cliente == null) {
            return null;
        }

        List<EnderecoDTO> enderecosDTO = cliente.getEnderecos() != null
                ? cliente.getEnderecos().stream().map(this::toEnderecoDTO).toList()
                : Collections.emptyList();

        return new ClienteResponseDTO(
                cliente.getId(),
                cliente.getTipoPessoa(),
                cliente.getNomeRazaoSocial(),
                cliente.getNomeFantasia(),
                cliente.getCpfCnpj(),
                cliente.getRgIe(),
                cliente.getTelefone(),
                cliente.getCelular(),
                cliente.getEmail(),
                cliente.getAtivo(),
                cliente.getObservacoes(),
                enderecosDTO,
                totalEquipamentos,
                cliente.getCreatedAt(),
                cliente.getUpdatedAt()
        );
    }

    public EnderecoDTO toEnderecoDTO(Endereco endereco) {
        if (endereco == null) {
            return null;
        }
        return new EnderecoDTO(
                endereco.getId(),
                endereco.getCep(),
                endereco.getLogradouro(),
                endereco.getNumero(),
                endereco.getComplemento(),
                endereco.getBairro(),
                endereco.getCidade(),
                endereco.getEstado(),
                endereco.getTipoEndereco()
        );
    }

    private Endereco toEnderecoEntity(EnderecoDTO dto) {
        if (dto == null) {
            return null;
        }
        return new Endereco(
                dto.cep(),
                dto.logradouro(),
                dto.numero(),
                dto.complemento(),
                dto.bairro(),
                dto.cidade(),
                dto.estado() != null ? dto.estado().toUpperCase() : null,
                dto.tipoEndereco() != null ? dto.tipoEndereco() : TipoEndereco.PRINCIPAL
        );
    }

    public static String apenasDigitos(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String digitos = valor.replaceAll("\\D", "");
        return digitos.isBlank() ? null : digitos;
    }

    private void validarFormatoCpfCnpj(String doc, TipoPessoa tipoPessoa) {
        if (doc == null) return;
        if (tipoPessoa == TipoPessoa.FISICA) {
            if (doc.length() != 11) {
                throw new BusinessException("CPF deve conter exatamente 11 dígitos numéricos.");
            }
            if (doc.chars().distinct().count() == 1) {
                throw new BusinessException("CPF inválido (sequência de dígitos idênticos).");
            }
        } else if (tipoPessoa == TipoPessoa.JURIDICA) {
            if (doc.length() != 14) {
                throw new BusinessException("CNPJ deve conter exatamente 14 dígitos numéricos.");
            }
            if (doc.chars().distinct().count() == 1) {
                throw new BusinessException("CNPJ inválido (sequência de dígitos idênticos).");
            }
        }
    }

    private Cliente toEntity(ClienteCreateDTO dto) {
        if (dto == null) {
            return null;
        }
        String cpfCnpjNormalizado = apenasDigitos(dto.cpfCnpj());
        validarFormatoCpfCnpj(cpfCnpjNormalizado, dto.tipoPessoa());

        Cliente cliente = new Cliente(
                dto.tipoPessoa(),
                dto.nomeRazaoSocial().trim(),
                dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null,
                cpfCnpjNormalizado,
                dto.rgIe() != null && !dto.rgIe().isBlank() ? dto.rgIe().trim() : null,
                apenasDigitos(dto.telefone()),
                apenasDigitos(dto.celular()),
                dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null,
                dto.observacoes()
        );

        if (dto.endereco() != null && dto.endereco().logradouro() != null && !dto.endereco().logradouro().isBlank()) {
            Endereco endereco = toEnderecoEntity(dto.endereco());
            cliente.adicionarEndereco(endereco);
        }

        return cliente;
    }

    private void updateEntity(Cliente cliente, ClienteUpdateDTO dto) {
        String cpfCnpjNormalizado = apenasDigitos(dto.cpfCnpj());
        validarFormatoCpfCnpj(cpfCnpjNormalizado, dto.tipoPessoa());

        cliente.setTipoPessoa(dto.tipoPessoa());
        cliente.setNomeRazaoSocial(dto.nomeRazaoSocial().trim());
        cliente.setNomeFantasia(dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null);
        cliente.setCpfCnpj(cpfCnpjNormalizado);
        cliente.setRgIe(dto.rgIe() != null && !dto.rgIe().isBlank() ? dto.rgIe().trim() : null);
        cliente.setTelefone(apenasDigitos(dto.telefone()));
        cliente.setCelular(apenasDigitos(dto.celular()));
        cliente.setEmail(dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null);
        if (dto.ativo() != null) {
            cliente.setAtivo(dto.ativo());
        }
        cliente.setObservacoes(dto.observacoes());

        if (dto.endereco() != null && dto.endereco().logradouro() != null && !dto.endereco().logradouro().isBlank()) {
            if (!cliente.getEnderecos().isEmpty()) {
                Endereco enderecoExistente = cliente.getEnderecos().get(0);
                enderecoExistente.setCep(dto.endereco().cep());
                enderecoExistente.setLogradouro(dto.endereco().logradouro());
                enderecoExistente.setNumero(dto.endereco().numero());
                enderecoExistente.setComplemento(dto.endereco().complemento());
                enderecoExistente.setBairro(dto.endereco().bairro());
                enderecoExistente.setCidade(dto.endereco().cidade());
                enderecoExistente.setEstado(dto.endereco().estado() != null ? dto.endereco().estado().toUpperCase() : null);
                if (dto.endereco().tipoEndereco() != null) {
                    enderecoExistente.setTipoEndereco(dto.endereco().tipoEndereco());
                }
            } else {
                Endereco novoEndereco = toEnderecoEntity(dto.endereco());
                cliente.adicionarEndereco(novoEndereco);
            }
        }
    }

    // --- Validações de Duplicidade ---

    private void validarDuplicidadeCriacao(ClienteCreateDTO dto) {
        if (dto.nomeRazaoSocial() != null && !dto.nomeRazaoSocial().isBlank()) {
            if (clienteRepository.existsByNomeRazaoSocialIgnoreCase(dto.nomeRazaoSocial().trim())) {
                throw new ConflictException("Já existe um cliente cadastrado com este Nome ou Razão Social.");
            }
        }

        String cpfCnpjNorm = apenasDigitos(dto.cpfCnpj());
        if (cpfCnpjNorm != null) {
            validarFormatoCpfCnpj(cpfCnpjNorm, dto.tipoPessoa());
            if (clienteRepository.existsByCpfCnpj(cpfCnpjNorm)) {
                throw new ConflictException("Já existe um cliente cadastrado com este CPF/CNPJ.");
            }
        }

        String telNorm = apenasDigitos(dto.telefone());
        if (telNorm != null) {
            if (clienteRepository.existsByTelefoneOuCelular(telNorm)) {
                throw new ConflictException("Já existe um cliente cadastrado com este Telefone/Celular.");
            }
        }

        String celNorm = apenasDigitos(dto.celular());
        if (celNorm != null) {
            if (clienteRepository.existsByTelefoneOuCelular(celNorm)) {
                throw new ConflictException("Já existe um cliente cadastrado com este Telefone/Celular.");
            }
        }
    }

    private void validarDuplicidadeAtualizacao(Long id, ClienteUpdateDTO dto) {
        if (dto.nomeRazaoSocial() != null && !dto.nomeRazaoSocial().isBlank()) {
            if (clienteRepository.existsByNomeRazaoSocialIgnoreCaseAndIdNot(dto.nomeRazaoSocial().trim(), id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Nome ou Razão Social.");
            }
        }

        String cpfCnpjNorm = apenasDigitos(dto.cpfCnpj());
        if (cpfCnpjNorm != null) {
            validarFormatoCpfCnpj(cpfCnpjNorm, dto.tipoPessoa());
            if (clienteRepository.existsByCpfCnpjAndIdNot(cpfCnpjNorm, id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este CPF/CNPJ.");
            }
        }

        String telNorm = apenasDigitos(dto.telefone());
        if (telNorm != null) {
            if (clienteRepository.existsByTelefoneOuCelularAndIdNot(telNorm, id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Telefone/Celular.");
            }
        }

        String celNorm = apenasDigitos(dto.celular());
        if (celNorm != null) {
            if (clienteRepository.existsByTelefoneOuCelularAndIdNot(celNorm, id)) {
                throw new ConflictException("Já existe outro cliente cadastrado com este Telefone/Celular.");
            }
        }
    }
}
