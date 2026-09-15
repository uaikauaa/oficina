package com.oficinagestao.cliente;

import com.oficinagestao.cliente.dto.ClienteCreateDTO;
import com.oficinagestao.cliente.dto.ClienteResponseDTO;
import com.oficinagestao.cliente.dto.ClienteUpdateDTO;
import com.oficinagestao.cliente.dto.EnderecoDTO;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class ClienteMapper {

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

    public Endereco toEnderecoEntity(EnderecoDTO dto) {
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

    public Cliente toEntity(ClienteCreateDTO dto) {
        if (dto == null) {
            return null;
        }
        Cliente cliente = new Cliente(
                dto.tipoPessoa(),
                dto.nomeRazaoSocial().trim(),
                dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null,
                dto.cpfCnpj() != null && !dto.cpfCnpj().isBlank() ? dto.cpfCnpj().trim() : null,
                dto.rgIe() != null && !dto.rgIe().isBlank() ? dto.rgIe().trim() : null,
                dto.telefone() != null && !dto.telefone().isBlank() ? dto.telefone().trim() : null,
                dto.celular() != null && !dto.celular().isBlank() ? dto.celular().trim() : null,
                dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null,
                dto.observacoes()
        );

        if (dto.endereco() != null && dto.endereco().logradouro() != null && !dto.endereco().logradouro().isBlank()) {
            Endereco endereco = toEnderecoEntity(dto.endereco());
            cliente.adicionarEndereco(endereco);
        }

        return cliente;
    }

    public void updateEntity(Cliente cliente, ClienteUpdateDTO dto) {
        cliente.setTipoPessoa(dto.tipoPessoa());
        cliente.setNomeRazaoSocial(dto.nomeRazaoSocial().trim());
        cliente.setNomeFantasia(dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null);
        cliente.setCpfCnpj(dto.cpfCnpj() != null && !dto.cpfCnpj().isBlank() ? dto.cpfCnpj().trim() : null);
        cliente.setRgIe(dto.rgIe() != null && !dto.rgIe().isBlank() ? dto.rgIe().trim() : null);
        cliente.setTelefone(dto.telefone() != null && !dto.telefone().isBlank() ? dto.telefone().trim() : null);
        cliente.setCelular(dto.celular() != null && !dto.celular().isBlank() ? dto.celular().trim() : null);
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
}
